import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/expenses")({ component: Expenses });

const DEPTS = ["bar", "restaurant", "accommodation", "general"] as const;
type Dept = (typeof DEPTS)[number];

type Expense = {
  id: string;
  department: Dept;
  category: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  expense_date: string;
  recorded_by: string | null;
};

function Expenses() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [dept, setDept] = useState<"all" | Dept>("all");

  const list = useQuery({
    queryKey: ["expenses", bizId, from, to, dept],
    enabled: !!bizId,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("*")
        .eq("business_id", bizId!)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false });
      if (dept !== "all") q = q.eq("department", dept);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const totals = useMemo(() => {
    const t: Record<Dept | "all", number> = { bar: 0, restaurant: 0, accommodation: 0, general: 0, all: 0 };
    (list.data ?? []).forEach((e) => {
      t[e.department] += Number(e.amount);
      t.all += Number(e.amount);
    });
    return t;
  }, [list.data]);

  async function del(id: string) {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    }
  }

  if (!isOwner) {
    return <div className="p-6 text-sm text-muted-foreground">Only owners can manage expenses.</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track outflows by department for accurate gross profit.</p>
        </div>
        <ExpenseDialog onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(["all", ...DEPTS] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDept(d as "all" | Dept)}
            className={`rounded-lg border p-3 text-left transition ${dept === d ? "border-primary bg-accent/30" : "border-border bg-card"}`}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{d}</div>
            <div className="mt-1 stat-num text-lg font-semibold">K{totals[d as Dept | "all"].toFixed(2)}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[650px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Dept</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-3 py-2">{e.expense_date}</td>
                <td className="px-3 py-2 capitalize">{e.department}</td>
                <td className="px-3 py-2">{e.category}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[280px]">{e.note}</td>
                <td className="px-3 py-2 text-right stat-num">K{Number(e.amount).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <ExpenseDialog expense={e} onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => del(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No expenses in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenseDialog({ expense, onSaved }: { expense?: Expense; onSaved: () => void }) {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department: (expense?.department ?? "general") as Dept,
    category: expense?.category ?? "",
    amount: expense?.amount ?? 0,
    payment_method: expense?.payment_method ?? "cash",
    note: expense?.note ?? "",
    expense_date: expense?.expense_date ?? new Date().toISOString().slice(0, 10),
  });

  async function save() {
    if (!bizId) return;
    if (!form.category.trim()) return toast.error("Category required");
    if (Number(form.amount) <= 0) return toast.error("Amount must be positive");
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), business_id: bizId };
      if (expense) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id);
        if (error) return toast.error(error.message);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("expenses").insert({ ...payload, recorded_by: u.user?.id ?? null });
        if (error) return toast.error(error.message);
      }
      toast.success(expense ? "Updated" : "Added");
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {expense ? (
          <Button size="icon" variant="outline" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add expense</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v as Dept })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPTS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Stock purchase, Utilities, Salary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (K)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Paid with</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "mobile_money", "card", "bank_transfer"].map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
