import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, AlertTriangle, Check, X } from "lucide-react";
import { decideStockAdjustment } from "@/lib/business.functions";

export const Route = createFileRoute("/app/inventory")({ component: Inventory });

const CATS = ["food", "beverages", "alcohol", "cleaning", "toiletries", "laundry", "maintenance", "other"] as const;

function Inventory() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ["products-all", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", bizId!)
        .order("name");
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["adj-requests", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_adjustment_requests")
        .select("*, products(name)")
        .eq("business_id", bizId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function del(id: string) {
    if (!confirm("Delete this product? It may affect existing orders and stock history.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries(); }
  }

  async function handleDecide(id: string, decision: "approved" | "rejected") {
    try {
      await decideStockAdjustment({ requestId: id, decision });
      toast.success(`Request ${decision}`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Manage products, prices and stock levels." : "Submit adjustment requests for stock changes."}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && <ProductDialog onSaved={() => qc.invalidateQueries()} />}
          {!isOwner && <AdjustRequestDialog products={products.data ?? []} onSaved={() => qc.invalidateQueries()} />}
        </div>
      </header>

      {isOwner && (requests.data?.filter((r) => r.status === "pending").length ?? 0) > 0 && (
        <section className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" /> Pending adjustment requests
          </div>
          <div className="mt-3 space-y-2">
            {requests.data!.filter((r) => r.status === "pending").map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">
                    {(r.products as { name: string } | null)?.name ?? "—"}{" "}
                    <span className="text-muted-foreground">· {Number(r.requested_change) > 0 ? "+" : ""}{r.requested_change}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.reason}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDecide(r.id, "rejected")}><X className="mr-1 h-3 w-3" />Reject</Button>
                  <Button size="sm" onClick={() => handleDecide(r.id, "approved")}><Check className="mr-1 h-3 w-3" />Approve</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Category</th>
              {isOwner && <th className="px-3 py-2 text-right">Cost</th>}
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-left">Sold in</th>
              {isOwner && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {products.data?.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{p.category}</td>
                {isOwner && <td className="px-3 py-2 text-right stat-num">K{Number(p.cost_price).toFixed(2)}</td>}
                <td className="px-3 py-2 text-right stat-num">K{Number(p.selling_price).toFixed(2)}</td>
                <td className={`px-3 py-2 text-right stat-num ${Number(p.stock_quantity) <= Number(p.min_stock_level) ? "text-destructive" : ""}`}>
                  {Number(p.stock_quantity)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {p.sold_in_restaurant && <Badge variant="outline">Restaurant</Badge>}
                    {p.sold_in_bar && <Badge variant="outline">Bar</Badge>}
                  </div>
                </td>
                {isOwner && (
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <ProductDialog product={p} onSaved={() => qc.invalidateQueries()} />
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => del(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {products.data?.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">No products yet.</div>
        )}
      </div>
    </div>
  );
}

type Product = {
  id: string;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  sold_in_restaurant: boolean;
  sold_in_bar: boolean;
};

function ProductDialog({ product, onSaved }: { product?: Product; onSaved: () => void }) {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: product?.name ?? "",
    category: (product?.category ?? "beverages") as (typeof CATS)[number],
    cost_price: product?.cost_price ?? 0,
    selling_price: product?.selling_price ?? 0,
    stock_quantity: product?.stock_quantity ?? 0,
    min_stock_level: product?.min_stock_level ?? 0,
    sold_in_restaurant: product?.sold_in_restaurant ?? true,
    sold_in_bar: product?.sold_in_bar ?? true,
  });

  async function save() {
    if (!bizId) return;
    if (!f.name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const payload = { ...f, business_id: bizId };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) return toast.error(error.message);
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) return toast.error(error.message);
      }
      toast.success(product ? "Updated" : "Added");
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button size="icon" variant="outline" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button><Plus className="mr-1 h-4 w-4" />Add product</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as typeof f.category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Stock</Label><Input type="number" value={f.stock_quantity} onChange={(e) => setF({ ...f, stock_quantity: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Cost (K)</Label><Input type="number" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Selling (K)</Label><Input type="number" value={f.selling_price} onChange={(e) => setF({ ...f, selling_price: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Min stock alert</Label><Input type="number" value={f.min_stock_level} onChange={(e) => setF({ ...f, min_stock_level: Number(e.target.value) })} /></div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.sold_in_restaurant} onChange={(e) => setF({ ...f, sold_in_restaurant: e.target.checked })} /> Restaurant menu</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.sold_in_bar} onChange={(e) => setF({ ...f, sold_in_bar: e.target.checked })} /> Bar menu</label>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustRequestDialog({ products, onSaved }: { products: { id: string; name: string }[]; onSaved: () => void }) {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const [open, setOpen] = useState(false);
  const [productId, setPid] = useState("");
  const [change, setCh] = useState(0);
  const [reason, setR] = useState("");
  async function submit() {
    if (!bizId || !productId || !reason) return toast.error("Product and reason required");
    const { error } = await supabase.from("stock_adjustment_requests").insert({
      business_id: bizId, product_id: productId, requested_change: change, reason,
    });
    if (error) return toast.error(error.message);
    toast.success("Request submitted for owner approval");
    onSaved();
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" />Request adjustment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Stock adjustment request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setPid}>
              <SelectTrigger><SelectValue placeholder="Pick a product" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Change (use negative to deduct)</Label><Input type="number" value={change} onChange={(e) => setCh(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Reason</Label><Input value={reason} onChange={(e) => setR(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
