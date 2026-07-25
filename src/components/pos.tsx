import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Minus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { chargeOrderToRoom } from "@/lib/business.functions";
import { loadReceipt, printReceiptWindow, whatsappReceipt, emailReceipt } from "@/lib/receipt";

export type OrderType = "restaurant" | "bar";

type Line = { productId: string; name: string; unitPrice: number; quantity: number };
type ServiceMode = "dine_in" | "takeaway";

export function POS({ orderType }: { orderType: OrderType }) {
  const nav = useNavigate();
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const [cart, setCart] = useState<Line[]>([]);
  const [tableId, setTableId] = useState<string>("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    orderType === "restaurant" ? "dine_in" : "takeaway",
  );
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "mobile_money" | "card" | "charge_to_room">(
    "cash",
  );
  const [roomNumber, setRoomNumber] = useState("");
  const [isDelivery, setIsDelivery] = useState(false);
  const [checking, setChecking] = useState(false);

  // Receipt dialog
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const products = useQuery({
    queryKey: ["products", bizId, orderType],
    enabled: !!bizId,
    queryFn: async () => {
      const col = orderType === "bar" ? "sold_in_bar" : "sold_in_restaurant";
      const { data } = await supabase
        .from("products")
        .select("id, name, selling_price, category, stock_quantity")
        .eq("business_id", bizId!)
        .eq(col, true)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const tables = useQuery({
    queryKey: ["restaurant_tables", bizId],
    enabled: !!bizId && orderType === "restaurant",
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, status")
        .eq("business_id", bizId!)
        .order("table_number");
      return data ?? [];
    },
  });

  const occupiedRooms = useQuery({
    queryKey: ["occupied-rooms", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, room_number, room_type")
        .eq("business_id", bizId!)
        .eq("status", "occupied")
        .order("room_number");
      return data ?? [];
    },
  });

  function add(p: { id: string; name: string; selling_price: number }) {
    setCart((c) => {
      const ex = c.find((l) => l.productId === p.id);
      if (ex) return c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...c,
        { productId: p.id, name: p.name, unitPrice: Number(p.selling_price), quantity: 1 },
      ];
    });
  }
  function dec(id: string) {
    setCart((c) =>
      c.flatMap((l) =>
        l.productId === id ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []) : [l],
      ),
    );
  }
  function remove(id: string) {
    setCart((c) => c.filter((l) => l.productId !== id));
  }

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const serviceFee = payMethod === "charge_to_room" ? Number(me?.business?.service_fee_amount ?? 0) : 0;
  const deliveryFee = payMethod === "charge_to_room" && isDelivery ? Number(me?.business?.delivery_fee_amount ?? 0) : 0;
  const grandTotal = subtotal + serviceFee + deliveryFee;

  async function checkout() {
    if (!bizId || cart.length === 0) return;
    if (orderType === "restaurant" && serviceMode === "dine_in" && !tableId) {
      return toast.error("Pick a table for dine-in");
    }
    if (payMethod === "charge_to_room" && !roomNumber) {
      return toast.error("Select a room to charge to");
    }
    setChecking(true);
    try {

    // Validate stock before sale
    const stockCheck = await Promise.all(
      cart.map(async (l) => {
        const { data: p } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", l.productId)
          .single();
        return { name: l.name, ordered: l.quantity, inStock: Number(p?.stock_quantity ?? 0) };
      })
    );
    const outOfStock = stockCheck.filter((s) => s.inStock < s.ordered);
    if (outOfStock.length > 0) {
      const names = outOfStock.map((s) => `${s.name} (have ${s.inStock}, need ${s.ordered})`).join(", ");
      return toast.error(`Insufficient stock: ${names}`);
    }

    const useTableId =
      orderType === "restaurant" && serviceMode === "dine_in" ? tableId || null : null;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        business_id: bizId,
        order_type: orderType,
        table_id: useTableId,
        status: payMethod === "charge_to_room" ? "new" : "paid",
        subtotal,
        total: grandTotal,
        payment_method: payMethod === "charge_to_room" ? null : payMethod,
        closed_at: payMethod === "charge_to_room" ? null : new Date().toISOString(),
        created_by: me?.profile?.id ?? null,
      })
      .select()
      .single();
    if (error || !order) return toast.error(error?.message ?? "Could not create order");

    await supabase.from("order_items").insert(
      cart.map((l) => ({
        business_id: bizId,
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
        line_total: l.unitPrice * l.quantity,
      })),
    );

    if (payMethod === "charge_to_room") {
      try {
        await chargeOrderToRoom({ orderId: order.id, roomNumber, isDelivery });
        toast.success("Charged to room");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Charge failed");
        setPayOpen(false);
        return;
      }
    } else {
      const { error: payErr } = await supabase.from("payments").insert({
        business_id: bizId,
        order_id: order.id,
        amount: grandTotal,
        method: payMethod,
        created_by: me?.profile?.id ?? null,
      });
      if (payErr) {
        toast.error("Payment recording failed: " + payErr.message);
        setChecking(false);
        return;
      }
      toast.success(`Paid · K${grandTotal.toFixed(2)}`);
    }

    await Promise.all(cart.map(async (l) => {
      const { data: p } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", l.productId)
        .single();
      const prev = Number(p?.stock_quantity ?? 0);
      const next = prev - l.quantity;
      await supabase.from("products").update({ stock_quantity: next }).eq("id", l.productId);
      await supabase.from("stock_movements").insert({
        business_id: bizId,
        product_id: l.productId,
        change: -l.quantity,
        previous_qty: prev,
        new_qty: next,
        reason: `${orderType} sale`,
        reference: order.id,
        created_by: me?.profile?.id ?? null,
      });
    }));

    // Open bills hold the table; paid bills release it
    if (useTableId) {
      await supabase
        .from("restaurant_tables")
        .update({ status: payMethod === "charge_to_room" ? "occupied" : "available" })
        .eq("id", useTableId);
    }

    setCart([]);
    setPayOpen(false);
    setRoomNumber("");
    setIsDelivery(false);
    setLastOrderId(order.id);
    setReceiptOpen(true);
    qc.invalidateQueries();
    } finally {
      setChecking(false);
    }
  }

  async function doPrint() {
    if (!lastOrderId) return;
    const r = await loadReceipt(lastOrderId);
    if (r) printReceiptWindow(r);
  }
  async function doWhatsApp() {
    if (!lastOrderId) return;
    const r = await loadReceipt(lastOrderId);
    if (r) whatsappReceipt(r, phone);
  }
  async function doEmail() {
    if (!lastOrderId) return;
    const r = await loadReceipt(lastOrderId);
    if (r) emailReceipt(r, email);
  }

  return (
    <div className="grid h-[calc(100vh-65px)] lg:h-screen grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="overflow-auto p-4 sm:p-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight capitalize">{orderType} POS</h1>
          <p className="text-sm text-muted-foreground">Tap items to add to the order.</p>
        </header>
        {orderType === "restaurant" && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-border bg-card overflow-hidden">
              {(["dine_in", "takeaway"] as ServiceMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setServiceMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium ${serviceMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {m === "dine_in" ? "Dine in" : "Takeaway"}
                </button>
              ))}
            </div>
            {serviceMode === "dine_in" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Table</Label>
                <Select value={tableId} onValueChange={setTableId}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue placeholder="Pick a free table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.data?.map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        disabled={t.status === "occupied" || t.status === "reserved"}
                      >
                        Table {t.table_number} {t.status !== "available" ? `(${t.status})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {products.data?.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">{p.category}</span>
                <span className="stat-num font-semibold">
                  K{Number(p.selling_price).toFixed(2)}
                </span>
              </div>
            </button>
          ))}
          {products.data?.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No products in this menu. Add products in Inventory.
            </div>
          )}
        </div>
      </div>

      <aside className="border-t border-border bg-card lg:border-l lg:border-t-0 flex flex-col">
        <div className="border-b border-border p-4">
          <div className="text-sm font-semibold">Current order</div>
          <div className="text-xs text-muted-foreground">{cart.length} item(s)</div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Empty
            </div>
          ) : (
            cart.map((l) => (
              <div key={l.productId} className="mb-2 rounded-md border border-border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{l.name}</div>
                  <button
                    onClick={() => remove(l.productId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => dec(l.productId)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        add({ id: l.productId, name: l.name, selling_price: l.unitPrice })
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="stat-num text-sm font-semibold">
                    K{(l.unitPrice * l.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="stat-num font-semibold">K{subtotal.toFixed(2)}</span>
          </div>
          <Button
            className="mt-3 w-full"
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
          >
            Charge
          </Button>
        </div>
      </aside>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v as typeof payMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="charge_to_room">Charge to room (+fees)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === "charge_to_room" && (
              <div className="space-y-1.5">
                <Label>Select room</Label>
                <Select value={roomNumber} onValueChange={setRoomNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an occupied room" />
                  </SelectTrigger>
                  <SelectContent>
                    {occupiedRooms.data?.map((r) => (
                      <SelectItem key={r.id} value={r.room_number}>
                        Room {r.room_number} ({r.room_type})
                      </SelectItem>
                    ))}
                    {occupiedRooms.data?.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No occupied rooms
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isDelivery}
                    onChange={(e) => setIsDelivery(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  Deliver to room
                </label>
                <p className="text-xs text-muted-foreground">
                  Service fee: K{Number(me?.business?.service_fee_amount ?? 0).toFixed(2)}
                  {isDelivery && <> · Delivery fee: K{Number(me?.business?.delivery_fee_amount ?? 0).toFixed(2)}</>}
                </p>
              </div>
            )}
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="stat-num">K{subtotal.toFixed(2)}</span>
              </div>
              {payMethod === "charge_to_room" && serviceFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service fee</span>
                  <span>K{serviceFee.toFixed(2)}</span>
                </div>
              )}
              {payMethod === "charge_to_room" && deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>K{deliveryFee.toFixed(2)}</span>
                </div>
              )}
              {payMethod === "charge_to_room" && (
                <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
                  <span>Total</span>
                  <span className="stat-num">K{grandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={checkout} disabled={checking}>{checking ? "Processing..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={doPrint}>
              Print receipt
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => nav({ to: "/app/pre-order" })}
            >
              Forward to staff via WhatsApp
            </Button>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp (with country code)</Label>
              <div className="flex gap-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="260977..."
                />
                <Button onClick={doWhatsApp}>Send</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
                <Button variant="outline" onClick={doEmail}>
                  Send
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceiptOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
