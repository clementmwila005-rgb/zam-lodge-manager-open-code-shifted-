import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import type { BusinessWithLogo } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const qc = useQueryClient();
  const b = me?.business;
  const logoPreview = (b as BusinessWithLogo | undefined)?.logo_signed_url ?? null;
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: "", phone: "", address: "", receipt_footer: "", service_fee_amount: 50, delivery_fee_amount: 0,
    accommodation_enabled: true, restaurant_enabled: true, bar_enabled: true,
  });

  useEffect(() => {
    if (b)
      setF({
        name: b.name,
        phone: b.phone ?? "",
        address: b.address ?? "",
        receipt_footer: b.receipt_footer ?? "",
        service_fee_amount: Number(b.service_fee_amount),
        delivery_fee_amount: Number(b.delivery_fee_amount ?? 0),
        accommodation_enabled: b.accommodation_enabled,
        restaurant_enabled: b.restaurant_enabled,
        bar_enabled: b.bar_enabled,
      });
  }, [b]);

  if (!isOwner) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        Only the owner can manage business settings.
      </div>
    );
  }

  async function save() {
    if (!b) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("businesses").update(f).eq("id", b.id);
      if (error) return toast.error(error.message);
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!b) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${b.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("business-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Best-effort: remove previous file if it was a storage path
      if (b.logo_url && !/^https?:\/\//i.test(b.logo_url) && b.logo_url !== path) {
        await supabase.storage.from("business-logos").remove([b.logo_url]);
      }
      const { error: dbErr } = await supabase.from("businesses").update({ logo_url: path }).eq("id", b.id);
      if (dbErr) throw dbErr;
      toast.success("Logo updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    if (!b?.logo_url) return;
    try {
      if (!/^https?:\/\//i.test(b.logo_url)) {
        await supabase.storage.from("business-logos").remove([b.logo_url]);
      }
      const { error } = await supabase.from("businesses").update({ logo_url: null }).eq("id", b.id);
      if (error) throw error;
      toast.success("Logo removed");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove logo");
    }
  }

  return (
    <div className="p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Business profile, departments and receipts.</p>
      </header>

      <div className="mt-6 max-w-2xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Business</h2>
          <p className="text-xs text-muted-foreground">Business code: <span className="font-mono">{b?.business_code}</span></p>
          <div className="mt-3 flex items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded-md object-cover border border-border bg-muted" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">No logo</div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Business logo</Label>
              <div className="flex gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
                  />
                </label>
                {b?.logo_url && (
                  <Button variant="outline" size="sm" onClick={removeLogo} className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP or SVG. Max 2MB. Shown in the sidebar.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Departments</h2>
          <p className="text-xs text-muted-foreground">Hide modules you don't use.</p>
          <div className="mt-3 space-y-2">
            <Toggle label="Accommodation" v={f.accommodation_enabled} on={(v) => setF({ ...f, accommodation_enabled: v })} />
            <Toggle label="Restaurant" v={f.restaurant_enabled} on={(v) => setF({ ...f, restaurant_enabled: v })} />
            <Toggle label="Bar" v={f.bar_enabled} on={(v) => setF({ ...f, bar_enabled: v })} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Charge-to-room fees</h2>
          <p className="text-xs text-muted-foreground">Fees added when orders are charged to guest rooms.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Service fee (K)</Label>
              <Input type="number" value={f.service_fee_amount} onChange={(e) => setF({ ...f, service_fee_amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5"><Label>Delivery fee (K)</Label>
              <Input type="number" value={f.delivery_fee_amount} onChange={(e) => setF({ ...f, delivery_fee_amount: Number(e.target.value) })} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Receipts</h2>
          <div className="mt-3 space-y-1.5">
            <Label>Footer text</Label>
            <Input value={f.receipt_footer} onChange={(e) => setF({ ...f, receipt_footer: e.target.value })} placeholder="Thank you for your stay." />
          </div>
        </section>

        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={v} onCheckedChange={on} />
    </label>
  );
}
