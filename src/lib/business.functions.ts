import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// ---- Helpers ----
async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}

async function getProfile(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", userId)
    .single();
  if (!profile?.business_id) throw new Error("No business context");
  return profile as { business_id: string };
}

// ---- Charge an order to a guest room ----
const chargeToRoomSchema = z.object({
  orderId: z.string().uuid(),
  roomNumber: z.string().trim().min(1),
  isDelivery: z.boolean().optional(),
});

export async function chargeOrderToRoom(data: z.infer<typeof chargeToRoomSchema>) {
  const parsed = chargeToRoomSchema.parse(data);
  const userId = await getUserId();
  const profile = await getProfile(userId);
  const businessId = profile.business_id;

  const { data: biz } = await supabase
    .from("businesses")
    .select("service_fee_amount, delivery_fee_amount")
    .eq("id", businessId)
    .single();
  const serviceFee = Number(biz?.service_fee_amount ?? 0);
  const deliveryFee = parsed.isDelivery ? Number(biz?.delivery_fee_amount ?? 0) : 0;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", parsed.orderId)
    .eq("business_id", businessId)
    .single();
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") throw new Error("Order already paid");

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_number, status")
    .eq("business_id", businessId)
    .eq("room_number", parsed.roomNumber)
    .maybeSingle();
  if (!room) throw new Error("Room not found");
  if (room.status !== "occupied") throw new Error("No active guest in that room");

  const { data: folio } = await supabase
    .from("folios")
    .select("id")
    .eq("business_id", businessId)
    .eq("room_id", room.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!folio) throw new Error("No open folio for that room");

  const subtotal = Number(order.subtotal);
  const total = subtotal + serviceFee + deliveryFee;

  const folioLines: {
    business_id: string;
    folio_id: string;
    description: string;
    category: string;
    amount: number;
    source_order_id: string;
    created_by: string;
  }[] = [
    {
      business_id: businessId,
      folio_id: folio.id,
      description: `${order.order_type === "bar" ? "Bar" : "Restaurant"} order #${order.id.slice(0, 8)}`,
      category: order.order_type,
      amount: subtotal,
      source_order_id: order.id,
      created_by: userId,
    },
    {
      business_id: businessId,
      folio_id: folio.id,
      description: "Charge-to-room service fee",
      category: "service_fee",
      amount: serviceFee,
      source_order_id: order.id,
      created_by: userId,
    },
  ];

  if (deliveryFee > 0) {
    folioLines.push({
      business_id: businessId,
      folio_id: folio.id,
      description: "Room delivery fee",
      category: "delivery_fee",
      amount: deliveryFee,
      source_order_id: order.id,
      created_by: userId,
    });
  }

  const { error: folioErr } = await supabase.from("folio_lines").insert(folioLines);
  if (folioErr) throw new Error("Failed to create folio lines: " + folioErr.message);

  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      status: "paid",
      payment_method: "charge_to_room",
      service_fee: serviceFee,
      total,
      charged_to_room_id: room.id,
      charged_to_folio_id: folio.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (orderErr) throw new Error("Failed to update order: " + orderErr.message);

  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: userId,
    action: "order.charged_to_room",
    entity: "order",
    entity_id: order.id,
    after_value: { roomNumber: parsed.roomNumber, subtotal, serviceFee, deliveryFee, total } as never,
  });

  return { ok: true, folioId: folio.id, total };
}

// ---- Check-in ----
const checkInSchema = z.object({
  reservationId: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  guest: z
    .object({
      fullName: z.string().min(2),
      phone: z.string().optional(),
      nrcPassport: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  guestId: z.string().uuid().optional(),
  checkOutDate: z.string(),
});

export async function checkInGuest(data: z.infer<typeof checkInSchema>) {
  const parsed = checkInSchema.parse(data);
  const userId = await getUserId();
  const profile = await getProfile(userId);
  const businessId = profile.business_id;

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", parsed.roomId)
    .eq("business_id", businessId)
    .single();
  if (!room) throw new Error("Room not found");
  if (room.status !== "available" && room.status !== "reserved") {
    throw new Error(`Room is ${room.status}`);
  }

  let guestId = parsed.guestId;
  if (!guestId && parsed.guest) {
    const { data: g, error: gErr } = await supabase
      .from("guests")
      .insert({
        business_id: businessId,
        full_name: parsed.guest.fullName,
        phone: parsed.guest.phone ?? null,
        nrc_passport: parsed.guest.nrcPassport ?? null,
        address: parsed.guest.address ?? null,
      })
      .select("id")
      .single();
    if (gErr || !g) throw new Error("Failed to create guest: " + (gErr?.message ?? "unknown"));
    guestId = g.id;
  }
  if (!guestId) throw new Error("Guest required");

  const { data: folio, error: folioErr } = await supabase
    .from("folios")
    .insert({
      business_id: businessId,
      reservation_id: parsed.reservationId ?? null,
      guest_id: guestId,
      room_id: room.id,
    })
    .select()
    .single();
  if (folioErr || !folio) throw new Error("Failed to create folio: " + (folioErr?.message ?? "unknown"));

  await supabase.from("folio_lines").insert({
    business_id: businessId,
    folio_id: folio.id,
    description: `Room ${room.room_number} - first night`,
    category: "room",
    amount: Number(room.daily_rate),
    created_by: userId,
  });

  await supabase.from("rooms").update({ status: "occupied" }).eq("id", room.id);

  let reservationId = parsed.reservationId;
  if (reservationId) {
    await supabase
      .from("reservations")
      .update({ status: "checked_in", check_out_date: parsed.checkOutDate })
      .eq("id", reservationId);
  } else {
    const { data: res } = await supabase
      .from("reservations")
      .insert({
        business_id: businessId,
        guest_id: guestId,
        room_id: room.id,
        check_in_date: new Date().toISOString().slice(0, 10),
        check_out_date: parsed.checkOutDate,
        status: "checked_in",
      })
      .select("id")
      .single();
    reservationId = res?.id;
  }

  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: userId,
    action: "guest.checked_in",
    entity: "folio",
    entity_id: folio.id,
    after_value: { roomNumber: room.room_number, guestId, checkOutDate: parsed.checkOutDate } as never,
  });

  return { folioId: folio.id };
}

// ---- Check-out ----
const checkOutSchema = z.object({
  folioId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
});

export async function checkOutGuest(data: z.infer<typeof checkOutSchema>) {
  const parsed = checkOutSchema.parse(data);
  const userId = await getUserId();
  const profile = await getProfile(userId);
  const businessId = profile.business_id;

  const { data: folio } = await supabase
    .from("folios")
    .select("*, folio_lines(amount), payments(amount)")
    .eq("id", parsed.folioId)
    .eq("business_id", businessId)
    .single();
  if (!folio) throw new Error("Folio not found");

  const charges = (folio.folio_lines as { amount: number }[]).reduce(
    (s, l) => s + Number(l.amount),
    0,
  );
  const paid = (folio.payments as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);
  const balance = charges - paid;

  if (balance > 0) {
    await supabase.from("payments").insert({
      business_id: businessId,
      folio_id: folio.id,
      amount: balance,
      method: parsed.paymentMethod,
      created_by: userId,
    });
  }

  await supabase
    .from("folios")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", folio.id);

  if (folio.room_id) {
    await supabase.from("rooms").update({ status: "cleaning" }).eq("id", folio.room_id);
  }

  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: userId,
    action: "guest.checked_out",
    entity: "folio",
    entity_id: folio.id,
    after_value: { charges, paid: paid + balance, method: parsed.paymentMethod } as never,
  });

  return { ok: true, charges, paid: paid + balance };
}

// ---- Owner approves / rejects stock adjustment ----
const decideAdjustmentSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export async function decideStockAdjustment(data: z.infer<typeof decideAdjustmentSchema>) {
  const parsed = decideAdjustmentSchema.parse(data);
  const userId = await getUserId();

  const { data: req } = await supabase
    .from("stock_adjustment_requests")
    .select("*")
    .eq("id", parsed.requestId)
    .single();
  if (!req) throw new Error("Not found");
  if (req.status !== "pending") throw new Error("Already decided");

  if (parsed.decision === "approved") {
    if (req.product_id) {
      const { data: p } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", req.product_id)
        .single();
      const prev = Number(p?.stock_quantity ?? 0);
      const next = prev + Number(req.requested_change);
      await supabase.from("products").update({ stock_quantity: next }).eq("id", req.product_id);
      await supabase.from("stock_movements").insert({
        business_id: req.business_id,
        product_id: req.product_id,
        change: req.requested_change,
        previous_qty: prev,
        new_qty: next,
        reason: req.reason,
        created_by: userId,
      });
    } else if (req.variant_id) {
      const { data: v } = await supabase
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", req.variant_id)
        .single();
      const prev = Number(v?.stock_quantity ?? 0);
      const next = prev + Number(req.requested_change);
      await supabase.from("product_variants").update({ stock_quantity: next }).eq("id", req.variant_id);
      await supabase.from("stock_movements").insert({
        business_id: req.business_id,
        variant_id: req.variant_id,
        change: req.requested_change,
        previous_qty: prev,
        new_qty: next,
        reason: req.reason,
        created_by: userId,
      });
    }
  }

  await supabase
    .from("stock_adjustment_requests")
    .update({
      status: parsed.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", parsed.requestId);

  await supabase.from("audit_logs").insert({
    business_id: req.business_id,
    user_id: userId,
    action: `stock_adjustment.${parsed.decision}`,
    entity: "stock_adjustment_request",
    entity_id: req.id,
  });

  return { ok: true };
}
