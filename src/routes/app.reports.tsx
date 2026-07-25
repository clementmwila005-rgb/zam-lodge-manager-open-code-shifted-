import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

export const Route = createFileRoute("/app/reports")({ component: Reports });

type Preset = "today" | "week" | "month" | "custom";
type Dept = "bar" | "restaurant" | "accommodation";
type Tab = "combined" | Dept | "expenses";

function rangeFor(preset: Preset, from: string, to: string) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else if (preset === "week") { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else if (preset === "month") { start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); }
  else {
    start = from ? new Date(from + "T00:00:00") : new Date(0);
    return { start, end: to ? new Date(to + "T23:59:59") : end };
  }
  return { start, end };
}

function Reports() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const [preset, setPreset] = useState<Preset>("month");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>("combined");

  const { start, end } = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  const data = useQuery({
    queryKey: ["reports-v2", bizId, preset, from, to],
    enabled: !!bizId && isOwner,
    queryFn: async () => {
      const sIso = start.toISOString();
      const eIso = end.toISOString();
      const sDate = start.toISOString().slice(0, 10);
      const eDate = end.toISOString().slice(0, 10);

      const [
        { data: orders },
        { data: items },
        { data: products },
        { data: expenses },
        { data: folioLines },
        { data: payments },
        { data: adjustments },
      ] = await Promise.all([
        supabase.from("orders").select("id, order_type, total, subtotal, service_fee, created_at, status, payment_method")
          .eq("business_id", bizId!).gte("created_at", sIso).lte("created_at", eIso),
        supabase.from("order_items").select("order_id, product_id, quantity, line_total, unit_price")
          .eq("business_id", bizId!).gte("created_at", sIso).lte("created_at", eIso),
        supabase.from("products").select("id, name, stock_quantity, cost_price, min_stock_level, sold_in_bar, sold_in_restaurant")
          .eq("business_id", bizId!),
        supabase.from("expenses").select("id, department, category, note, amount, expense_date")
          .eq("business_id", bizId!).gte("expense_date", sDate).lte("expense_date", eDate),
        supabase.from("folio_lines").select("category, amount, created_at")
          .eq("business_id", bizId!).gte("created_at", sIso).lte("created_at", eIso),
        supabase.from("payments").select("amount, method, created_at")
          .eq("business_id", bizId!).gte("created_at", sIso).lte("created_at", eIso),
        supabase.from("stock_adjustment_requests").select("product_id, requested_change, reason, status, created_at")
          .eq("business_id", bizId!).eq("status", "approved").gte("created_at", sIso).lte("created_at", eIso),
      ]);

      const productMap = new Map((products ?? []).map((p) => [p.id, p]));
      const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

      // Department classification helpers
      const productDept = (pid?: string | null): Dept | "general" => {
        if (!pid) return "general";
        const p = productMap.get(pid);
        if (!p) return "general";
        if (p.sold_in_bar && !p.sold_in_restaurant) return "bar";
        if (p.sold_in_restaurant && !p.sold_in_bar) return "restaurant";
        return "restaurant";
      };

      // Revenue per dept — ALL paid orders counted by type (including charge-to-room)
      let revBar = 0, revRest = 0, revAccom = 0, chargeToRoomTotal = 0;
      (orders ?? []).filter((o) => o.status === "paid").forEach((o) => {
        if (o.order_type === "bar") revBar += Number(o.subtotal);
        else if (o.order_type === "restaurant") revRest += Number(o.subtotal);
      });
      // Accommodation revenue = folio lines (room charges + service fees) + charge-to-room subtotals
      (folioLines ?? []).forEach((l) => {
        const c = (l.category ?? "").toLowerCase();
        if (c.includes("room") || c.includes("lodg") || c.includes("accom") || c.includes("service")) {
          revAccom += Number(l.amount);
        }
      });
      (orders ?? []).filter((o) => o.status === "paid" && o.payment_method === "charge_to_room").forEach((o) => {
        const amt = Number(o.subtotal);
        chargeToRoomTotal += amt;
        revAccom += amt;
      });

      // COGS per dept — includes charge-to-room orders (they appear in bar/restaurant tabs)
      let cogsBar = 0, cogsRest = 0;
      (items ?? []).forEach((it) => {
        const order = orderMap.get(it.order_id);
        if (!order || order.status !== "paid") return;
        const product = it.product_id ? productMap.get(it.product_id) : null;
        const cost = product ? Number(product.cost_price) * Number(it.quantity) : 0;
        if (order.order_type === "bar") cogsBar += cost;
        else if (order.order_type === "restaurant") cogsRest += cost;
      });

      // Expenses per dept
      const expByDept: Record<Dept | "general", number> = { bar: 0, restaurant: 0, accommodation: 0, general: 0 };
      (expenses ?? []).forEach((e) => { expByDept[e.department as Dept | "general"] += Number(e.amount); });

      // Shortages — approved negative adjustments where reason is shortage/waste/damage/loss
      const shortageBar: { name: string; qty: number; value: number }[] = [];
      const shortageRest: { name: string; qty: number; value: number }[] = [];
      const shortageAccom: { name: string; qty: number; value: number }[] = [];
      let shortageValBar = 0, shortageValRest = 0, shortageValAccom = 0;
      (adjustments ?? []).forEach((a) => {
        const reason = (a.reason ?? "").toLowerCase();
        if (!/shortage|waste|wast|damage|loss|spoil|expired/.test(reason)) return;
        if (Number(a.requested_change) >= 0) return;
        const product = a.product_id ? productMap.get(a.product_id) : null;
        if (!product) return;
        const qty = Math.abs(Number(a.requested_change));
        const value = qty * Number(product.cost_price);
        const dept = productDept(a.product_id);
        const entry = { name: product.name, qty, value };
        if (dept === "bar") { shortageBar.push(entry); shortageValBar += value; }
        else if (dept === "restaurant") { shortageRest.push(entry); shortageValRest += value; }
        else { shortageAccom.push(entry); shortageValAccom += value; }
      });

      // Inventory snapshots
      const invBar = (products ?? []).filter((p) => p.sold_in_bar);
      const invRest = (products ?? []).filter((p) => p.sold_in_restaurant && !p.sold_in_bar);
      const invAll = products ?? [];
      const invValue = (list: typeof invAll) => list.reduce((s, p) => s + Number(p.cost_price) * Number(p.stock_quantity), 0);
      const lowStock = (list: typeof invAll) => list.filter((p) => Number(p.stock_quantity) <= Number(p.min_stock_level));

      // Revenue by day (combined)
      const byDay = new Map<string, number>();
      (payments ?? []).forEach((p) => {
        const d = p.created_at.slice(0, 10);
        byDay.set(d, (byDay.get(d) ?? 0) + Number(p.amount));
      });

      const byMethod = (["cash", "mobile_money", "card", "charge_to_room"] as const).map((m) => ({
        method: m,
        total: (payments ?? []).filter((p) => p.method === m).reduce((s, p) => s + Number(p.amount), 0),
      }));

      const bar = {
        revenue: revBar, cogs: cogsBar, expenses: expByDept.bar,
        gross: revBar - cogsBar - expByDept.bar,
        shortages: shortageBar, shortageValue: shortageValBar,
        inventory: invBar, invValue: invValue(invBar), lowStock: lowStock(invBar),
      };
      const restaurant = {
        revenue: revRest, cogs: cogsRest, expenses: expByDept.restaurant,
        gross: revRest - cogsRest - expByDept.restaurant,
        shortages: shortageRest, shortageValue: shortageValRest,
        inventory: invRest, invValue: invValue(invRest), lowStock: lowStock(invRest),
      };
      const accommodation = {
        revenue: revAccom, cogs: 0, expenses: expByDept.accommodation,
        gross: revAccom - expByDept.accommodation,
        shortages: shortageAccom, shortageValue: shortageValAccom,
        inventory: [], invValue: 0, lowStock: [],
      };
      const combined = {
        revenue: revBar + revRest + revAccom - chargeToRoomTotal,
        cogs: cogsBar + cogsRest,
        expenses: expByDept.bar + expByDept.restaurant + expByDept.accommodation + expByDept.general,
        gross: (revBar + revRest + revAccom - chargeToRoomTotal) - (cogsBar + cogsRest) - (expByDept.bar + expByDept.restaurant + expByDept.accommodation + expByDept.general),
        shortageValue: shortageValBar + shortageValRest,
        invValue: invValue(invAll),
        lowStock: lowStock(invAll),
        generalExpenses: expByDept.general,
        byDay: [...byDay.entries()].sort(),
        byMethod,
      };
      const expensesList = (expenses ?? []).map((e) => ({
        id: e.id as string,
        department: (e.department ?? "general") as Dept | "general",
        category: (e.category ?? "") as string,
        note: (e.note ?? "") as string,
        amount: Number(e.amount),
        expense_date: e.expense_date as string,
      })).sort((a, b) => b.expense_date.localeCompare(a.expense_date));
      return { bar, restaurant, accommodation, combined, expensesList, expByDept };
    },
  });

  const d = data.data;

  if (!isOwner) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        Only the owner can view reports.
      </div>
    );
  }

  function exportCsv() {
    if (!d) return;
    const rows: string[][] = [
      ["Period", `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`],
      [],
      ["Department", "Revenue", "COGS", "Expenses", "Gross profit", "Shortages (cost)"],
      ["Bar", d.bar.revenue.toFixed(2), d.bar.cogs.toFixed(2), d.bar.expenses.toFixed(2), d.bar.gross.toFixed(2), d.bar.shortageValue.toFixed(2)],
      ["Restaurant", d.restaurant.revenue.toFixed(2), d.restaurant.cogs.toFixed(2), d.restaurant.expenses.toFixed(2), d.restaurant.gross.toFixed(2), d.restaurant.shortageValue.toFixed(2)],
      ["Accommodation", d.accommodation.revenue.toFixed(2), "0.00", d.accommodation.expenses.toFixed(2), d.accommodation.gross.toFixed(2), "0.00"],
      ["General expenses", "", "", d.combined.generalExpenses.toFixed(2), "", ""],
      ["Combined", d.combined.revenue.toFixed(2), d.combined.cogs.toFixed(2), d.combined.expenses.toFixed(2), d.combined.gross.toFixed(2), d.combined.shortageValue.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">{start.toLocaleDateString()} – {end.toLocaleDateString()}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
          <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)} className="capitalize">
            {p === "week" ? "Last 7 days" : p === "month" ? "Last 30 days" : p}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {(["combined", "bar", "restaurant", "accommodation", "expenses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {!d ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading...</div>
      ) : tab === "combined" ? (
        <CombinedView d={d} />
      ) : tab === "expenses" ? (
        <ExpensesView d={d} />
      ) : (
        <DeptView d={d[tab]} label={tab} />
      )}
    </div>
  );
}

type ReportData = { bar: DeptShape; restaurant: DeptShape; accommodation: DeptShape; combined: CombinedShape };
type DeptShape = {
  revenue: number; cogs: number; expenses: number; gross: number;
  shortages: { name: string; qty: number; value: number }[]; shortageValue: number;
  inventory: { id: string; name: string; stock_quantity: number; cost_price: number; min_stock_level: number }[];
  invValue: number;
  lowStock: { id: string; name: string; stock_quantity: number; min_stock_level: number }[];
};
type CombinedShape = {
  revenue: number; cogs: number; expenses: number; gross: number; shortageValue: number;
  invValue: number; lowStock: { name: string; stock_quantity: number; min_stock_level: number }[];
  generalExpenses: number;
  byDay: [string, number][];
  byMethod: { method: string; total: number }[];
};

function CombinedView({ d }: { d: ReportData }) {
  return (
    <>
      <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card title="Revenue" value={`K${d.combined.revenue.toFixed(2)}`} />
        <Card title="COGS" value={`K${d.combined.cogs.toFixed(2)}`} />
        <Card title="Expenses" value={`K${d.combined.expenses.toFixed(2)}`} />
        <Card title="Gross profit" value={`K${d.combined.gross.toFixed(2)}`} highlight={d.combined.gross >= 0 ? "good" : "bad"} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <DeptMini label="Bar" d={d.bar} />
        <DeptMini label="Restaurant" d={d.restaurant} />
        <DeptMini label="Accommodation" d={d.accommodation} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Revenue by day</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {d.combined.byDay.map(([day, total]) => (
                <tr key={day} className="border-t border-border first:border-0">
                  <td className="py-1.5 text-muted-foreground">{day}</td>
                  <td className="py-1.5 text-right stat-num">K{total.toFixed(2)}</td>
                </tr>
              ))}
              {d.combined.byDay.length === 0 && <tr><td className="py-2 text-sm text-muted-foreground">No payments.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Revenue by payment method</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {d.combined.byMethod.map((m) => (
                <tr key={m.method} className="border-t border-border first:border-0">
                  <td className="py-1.5 capitalize text-muted-foreground">{m.method.replace("_", " ")}</td>
                  <td className="py-1.5 text-right stat-num">K{m.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Inventory value (all)</h2>
          <div className="stat-num text-sm">K{d.combined.invValue.toFixed(2)}</div>
        </div>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low stock</h3>
        {d.combined.lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Everything above minimum.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {d.combined.lowStock.map((p) => (
              <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                <span>{p.name}</span>
                <span className="stat-num text-destructive">{Number(p.stock_quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DeptMini({ label, d }: { label: string; d: DeptShape }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 stat-num text-xl font-semibold">K{d.revenue.toFixed(2)}</div>
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <div className="flex justify-between"><span>COGS</span><span>K{d.cogs.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Expenses</span><span>K{d.expenses.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold text-foreground"><span>Gross</span><span>K{d.gross.toFixed(2)}</span></div>
      </div>
    </div>
  );
}

function DeptView({ d, label }: { d: DeptShape; label: string }) {
  return (
    <>
      <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card title="Revenue" value={`K${d.revenue.toFixed(2)}`} />
        <Card title="COGS" value={`K${d.cogs.toFixed(2)}`} />
        <Card title="Expenses" value={`K${d.expenses.toFixed(2)}`} />
        <Card title="Shortages" value={`K${d.shortageValue.toFixed(2)}`} highlight={d.shortageValue > 0 ? "bad" : undefined} />
        <Card title="Gross profit" value={`K${d.gross.toFixed(2)}`} highlight={d.gross >= 0 ? "good" : "bad"} />
      </div>

      {d.shortages.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Shortages — {label}</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Cost value</th></tr></thead>
            <tbody>
              {d.shortages.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5">{s.name}</td>
                  <td className="py-1.5 text-right stat-num">{s.qty}</td>
                  <td className="py-1.5 text-right stat-num text-destructive">K{s.value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.inventory.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Inventory — {label}</h2>
            <div className="stat-num text-sm">Value K{d.invValue.toFixed(2)}</div>
          </div>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low stock</h3>
          {d.lowStock.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Everything above minimum.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <span className="stat-num text-destructive">{Number(p.stock_quantity)} / min {Number(p.min_stock_level)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function Card({ title, value, highlight }: { title: string; value: string; highlight?: "good" | "bad" }) {
  const tone = highlight === "good" ? "text-success" : highlight === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={`mt-2 stat-num text-xl sm:text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function ExpensesView({ d }: { d: ReportData }) {
  const list = (d as unknown as { expensesList: { id: string; department: string; category: string; note: string; amount: number; expense_date: string }[]; expByDept: Record<string, number> }).expensesList;
  const expByDept = (d as unknown as { expByDept: Record<string, number> }).expByDept;
  const total = list.reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card title="Total" value={`K${total.toFixed(2)}`} highlight="bad" />
        <Card title="Bar" value={`K${(expByDept.bar ?? 0).toFixed(2)}`} />
        <Card title="Restaurant" value={`K${(expByDept.restaurant ?? 0).toFixed(2)}`} />
        <Card title="Accommodation" value={`K${(expByDept.accommodation ?? 0).toFixed(2)}`} />
        <Card title="General" value={`K${(expByDept.general ?? 0).toFixed(2)}`} />
      </div>
      <div className="mt-5 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Expenses</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No expenses in this period.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Date</th>
                  <th className="text-left py-1">Dept</th>
                  <th className="text-left py-1">Category</th>
                  <th className="text-left py-1">Note</th>
                  <th className="text-right py-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-1.5">{e.expense_date}</td>
                    <td className="py-1.5 capitalize">{e.department}</td>
                    <td className="py-1.5">{e.category}</td>
                    <td className="py-1.5 text-muted-foreground">{e.note}</td>
                    <td className="py-1.5 text-right stat-num text-destructive">K{e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
