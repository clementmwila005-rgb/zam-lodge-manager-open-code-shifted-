import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffPicker, type StaffMember } from "./preorder-staff-picker";
import { formatPreorderMessage, openWaLink, type PreorderItem } from "@/lib/whatsapp";
import { sendInAppMessage } from "@/lib/messages";

type OrderType = "restaurant" | "bar";

type Props = {
  businessId: string;
  userId: string;
  ownerName: string | null | undefined;
  businessName: string | null | undefined;
};

export function PreorderForm({ businessId, userId, ownerName, businessName }: Props) {
  const [orderType, setOrderType] = useState<OrderType>("restaurant");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<PreorderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");

  const products = useQuery({
    queryKey: ["products-preorder", businessId, orderType],
    enabled: !!businessId,
    queryFn: async () => {
      const col = orderType === "bar" ? "sold_in_bar" : "sold_in_restaurant";
      const { data } = await supabase
        .from("products")
        .select("id, name, selling_price")
        .eq("business_id", businessId)
        .eq(col, true)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  function addProduct(p: { id: string; name: string; selling_price: number }) {
    setItems((prev) => {
      const ex = prev.find((i) => i.name === p.name && i.unitPrice === Number(p.selling_price));
      if (ex) return prev.map((i) => (i === ex ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { name: p.name, quantity: 1, unitPrice: Number(p.selling_price) }];
    });
  }

  function addFreeText() {
    const name = freeName.trim();
    if (!name) return;
    const price = freePrice.trim() ? Number(freePrice) : undefined;
    if (price !== undefined && (isNaN(price) || price < 0)) return toast.error("Invalid price");
    setItems((prev) => [...prev, { name, quantity: 1, unitPrice: price }]);
    setFreeName("");
    setFreePrice("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function changeQuantity(index: number, delta: number) {
    setItems((prev) =>
      prev
        .map((item, i) =>
          i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  const message = formatPreorderMessage({
    orderType,
    location: location.trim() || undefined,
    items,
    notes: notes.trim() || undefined,
    ownerName: ownerName ?? undefined,
    businessName: businessName ?? undefined,
  });

  function sendWhatsApp() {
    if (items.length === 0) return toast.error("Add at least one item");
    if (staff.length === 0) return toast.error("Select at least one staff member");
    const phoneStaff = staff.filter((s) => s.phone);
    for (const s of phoneStaff) {
      if (s.phone) openWaLink(s.phone, message);
    }
    toast.success(
      `Opening WhatsApp for ${phoneStaff.length} staff member${phoneStaff.length > 1 ? "s" : ""}`,
    );
  }

  async function sendInApp() {
    if (items.length === 0) return toast.error("Add at least one item");
    if (staff.length === 0) return toast.error("Select at least one staff member");
    try {
      await Promise.all(
        staff.map((s) =>
          sendInAppMessage({
            businessId,
            senderId: userId,
            recipientId: s.id,
            title: `${orderType === "restaurant" ? "Restaurant" : "Bar"} Pre-order${location ? ` — ${location}` : ""}`,
            body: message,
            metadata: { orderType, location, items, notes },
          }),
        ),
      );
      toast.success(`Sent to ${staff.length} staff member${staff.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  }

  async function sendBoth() {
    if (items.length === 0) return toast.error("Add at least one item");
    if (staff.length === 0) return toast.error("Select at least one staff member");
    const phoneStaff = staff.filter((s) => s.phone);
    for (const s of phoneStaff) {
      if (s.phone) openWaLink(s.phone, message);
    }
    try {
      await Promise.all(
        staff.map((s) =>
          sendInAppMessage({
            businessId,
            senderId: userId,
            recipientId: s.id,
            title: `${orderType === "restaurant" ? "Restaurant" : "Bar"} Pre-order${location ? ` — ${location}` : ""}`,
            body: message,
            metadata: { orderType, location, items, notes },
          }),
        ),
      );
      toast.success(
        `Sent in-app to ${staff.length} staff, WhatsApp to ${phoneStaff.length}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "In-app send failed");
    }
  }

  const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Send Pre-order</h1>
        <p className="text-sm text-muted-foreground">
          Compose a pre-order and send it to staff via WhatsApp or in-app.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs">Order type</Label>
        <div className="flex overflow-hidden rounded-md border border-border bg-card">
          {(["restaurant", "bar"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setOrderType(t);
                setItems([]);
              }}
              className={`px-3 py-1.5 text-xs font-medium capitalize ${
                orderType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Table / Room / Location</Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder='e.g. "Table 5" or "Room 12" or "Takeaway"'
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs">Menu items — tap to add</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {products.data?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="rounded-lg border border-border bg-card p-2 text-left text-sm transition hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    K{Number(p.selling_price).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Free-text item</Label>
              <Input
                value={freeName}
                onChange={(e) => setFreeName(e.target.value)}
                placeholder="Item name"
                onKeyDown={(e) => e.key === "Enter" && addFreeText()}
              />
            </div>
            <div className="w-24 space-y-1.5">
              <Label className="text-xs">Price (K)</Label>
              <Input
                value={freePrice}
                onChange={(e) => setFreePrice(e.target.value)}
                placeholder="optional"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <Button variant="outline" size="icon" onClick={addFreeText} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs">Items ({items.length})</Label>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No items added yet. Tap menu items above or add free-text items.
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      {item.unitPrice != null && (
                        <div className="text-xs text-muted-foreground">
                          K{item.unitPrice.toFixed(2)} each
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => changeQuantity(i, -1)}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </Button>
                      <span className="w-5 text-center text-sm tabular-nums">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => changeQuantity(i, 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                    <button
                      onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {total > 0 && (
                  <div className="text-right text-xs font-medium text-muted-foreground">
                    Est. total: K{total.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='Allergies, special requests, "no onions", etc.'
          rows={2}
        />
      </div>

      <StaffPicker businessId={businessId} value={staff} onChange={setStaff} />

      <div className="space-y-2">
        <Label className="text-xs">Message preview</Label>
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {message || "(empty — add items above)"}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={sendWhatsApp}
          disabled={items.length === 0 || staff.length === 0}
          variant="outline"
        >
          WhatsApp
        </Button>
        <Button
          onClick={sendInApp}
          disabled={items.length === 0 || staff.length === 0}
          variant="outline"
        >
          Send in-app
        </Button>
        <Button
          onClick={sendBoth}
          disabled={items.length === 0 || staff.length === 0}
        >
          Send both
        </Button>
      </div>
    </div>
  );
}
