import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANS } from "@/lib/plans";

export const Route = createFileRoute("/admin/dashboard")({ component: AdminDashboard });

function AdminDashboard() {
  const qc = useQueryClient();
  const businesses = useQuery({
    queryKey: ["sa-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totals = useQuery({
    queryKey: ["sa-totals"],
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("subscription_status");
      const list = data ?? [];
      return {
        total: list.length,
        active: list.filter((b) => b.subscription_status === "active").length,
        trial: list.filter((b) => b.subscription_status === "trial").length,
        expired: list.filter((b) => b.subscription_status === "expired").length,
        suspended: list.filter((b) => b.subscription_status === "suspended").length,
      };
    },
  });

  async function setStatus(id: string, status: "active" | "suspended" | "expired" | "trial") {
    const { data: biz } = await supabase.from("businesses").select("subscription_status").eq("id", id).single();
    if (!biz) return;
    const { error } = await supabase.from("businesses").update({ subscription_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      business_id: id,
      user_id: user.user?.id,
      action: "business.status_changed",
      entity: "business",
      entity_id: id,
      after_value: { from: biz.subscription_status, to: status } as never,
    });
    toast.success("Updated");
    qc.invalidateQueries();
  }

  async function extend(id: string, days: number) {
    const { data: b } = await supabase.from("businesses").select("subscription_expires_at").eq("id", id).single();
    if (!b) return;
    const baseDate = b.subscription_expires_at ? new Date(b.subscription_expires_at) : new Date();
    const next = new Date(baseDate.getTime() + days * 24 * 3600 * 1000);
    const { error } = await supabase.from("businesses").update({
      subscription_expires_at: next.toISOString(),
      subscription_status: "active",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      business_id: id,
      user_id: user.user?.id,
      action: "business.extended",
      entity: "business",
      entity_id: id,
      after_value: { days_added: days, new_expiry: next.toISOString().slice(0, 10) } as never,
    });
    toast.success(`Extended by ${days} days`);
    qc.invalidateQueries();
  }

  async function setPlan(id: string, plan: string) {
    const { data: b } = await supabase.from("businesses").select("plan").eq("id", id).single();
    if (!b) return;
    const { error } = await supabase.from("businesses").update({ plan: plan as "starter" | "business" | "pro" | "enterprise" | "trial" }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      business_id: id,
      user_id: user.user?.id,
      action: "business.plan_changed",
      entity: "business",
      entity_id: id,
      after_value: { from: b.plan, to: plan } as never,
    });
    toast.success(`Plan changed to ${plan}`);
    qc.invalidateQueries();
  }

  const t = totals.data;
  return (
    <div className="p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Platform admin</h1>
        <p className="text-sm text-muted-foreground">Manage every business on Zam Lodge Manager.</p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total" v={t?.total ?? 0} />
        <Stat label="Active" v={t?.active ?? 0} />
        <Stat label="Trial" v={t?.trial ?? 0} />
        <Stat label="Expired" v={t?.expired ?? 0} />
        <Stat label="Suspended" v={t?.suspended ?? 0} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Business</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Expires</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.data?.map((b) => (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{b.name}</td>
                <td className="px-3 py-2 font-mono">{b.business_code}</td>
                <td className="px-3 py-2"><div>{b.owner_name}</div><div className="text-xs text-muted-foreground">{b.email}</div></td>
                <td className="px-3 py-2">
                  <Select value={b.plan} onValueChange={(v) => setPlan(b.id, v)}>
                    <SelectTrigger className="h-7 w-[100px] text-xs capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => (
                        <SelectItem key={p.key} value={p.key} className="text-xs capitalize">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={b.subscription_status === "active" ? "default" : "outline"} className="capitalize">
                    {b.subscription_status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{b.subscription_expires_at?.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => extend(b.id, 30)}>+30d</Button>
                    {b.subscription_status !== "active" && <Button size="sm" onClick={() => setStatus(b.id, "active")}>Activate</Button>}
                    {b.subscription_status !== "suspended" && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "suspended")}>Suspend</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {businesses.data?.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No businesses yet.</div>}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 stat-num text-2xl font-semibold">{v}</div>
    </div>
  );
}
