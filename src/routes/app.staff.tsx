import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { createStaff } from "@/lib/auth.functions";
import { getPlan } from "@/lib/plans";

export const Route = createFileRoute("/app/staff")({ component: Staff });

function Staff() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const staff = useQuery({
    queryKey: ["staff", bizId],
    enabled: !!bizId && isOwner,
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .eq("business_id", bizId!)
        .order("created_at", { ascending: false });
      const ids = (profs ?? []).map((p) => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const map = new Map<string, { role: string }[]>();
      roles?.forEach((r) => {
        const arr = map.get(r.user_id) ?? [];
        arr.push({ role: r.role });
        map.set(r.user_id, arr);
      });
      return (profs ?? []).map((p) => ({ ...p, user_roles: map.get(p.id) ?? [] }));
    },
  });

  if (!isOwner) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        Only the owner can manage staff.
      </div>
    );
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Enabled" : "Disabled");
    qc.invalidateQueries({ queryKey: ["staff"] });
  }

  const plan = getPlan(me?.business?.plan);
  const staffCount = (staff.data ?? []).filter((s) => (s.user_roles as { role: string }[])?.some((r) => r.role !== "owner")).length;
  const limitLabel = plan.staffLimit === 0 ? "Unlimited" : `${staffCount} / ${plan.staffLimit}`;

  return (
    <div className="p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Create staff accounts linked to your business. {plan.label} plan · {limitLabel} staff.
          </p>
        </div>
        <NewStaffDialog onSaved={() => qc.invalidateQueries({ queryKey: ["staff"] })} />
      </header>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.data?.map((s) => {
              const roles = (s.user_roles as { role: string }[] | null) ?? [];
              const role = roles[0]?.role ?? "—";
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.username ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{role.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.phone ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.id !== me?.profile?.id && role !== "owner" && (
                      <Button size="sm" variant="outline" onClick={() => toggleActive(s.id, !s.is_active)}>
                        {s.is_active ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewStaffDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    fullName: "", phone: "", username: "", password: "", role: "receptionist" as "receptionist" | "restaurant_staff" | "bar_staff" | "housekeeping",
  });
  async function save() {
    setSaving(true);
    try {
      await createStaff(f);
      toast.success("Staff created");
      onSaved();
      setOpen(false);
      setF({ fullName: "", phone: "", username: "", password: "", role: "receptionist" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add staff</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Username</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as typeof f.role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receptionist">Receptionist</SelectItem>
                <SelectItem value="restaurant_staff">Restaurant staff</SelectItem>
                <SelectItem value="bar_staff">Bar staff</SelectItem>
                <SelectItem value="housekeeping">Housekeeping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Staff sign in with the business code, this username and password.
          </p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
