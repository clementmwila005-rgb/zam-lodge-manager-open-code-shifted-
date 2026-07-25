import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

const STATUSES = ["available", "occupied", "reserved"] as const;
type Status = (typeof STATUSES)[number];
const TONE: Record<Status, string> = {
  available: "bg-success/10 text-success border-success/20",
  occupied: "bg-info/10 text-info border-info/20",
  reserved: "bg-warning/10 text-warning-foreground border-warning/30",
};

type Table = { id: string; table_number: string; capacity: number; status: Status };

export function RestaurantTables() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const canManage = role === "owner";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const tables = useQuery({
    queryKey: ["restaurant_tables", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("business_id", bizId!)
        .order("table_number");
      if (error) throw error;
      return (data ?? []) as Table[];
    },
  });

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["restaurant_tables"] });
  }

  async function del(id: string) {
    if (!confirm("Delete this table?")) return;
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["restaurant_tables"] });
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tables</h1>
          <p className="text-sm text-muted-foreground">Floor plan. Tap a status to update.</p>
        </div>
        {canManage && (
          <TableDialog onSaved={() => qc.invalidateQueries({ queryKey: ["restaurant_tables"] })} />
        )}
      </header>

      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tables.data?.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Table {t.table_number}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {t.capacity} seats
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <TableDialog
                    table={t}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["restaurant_tables"] })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => del(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3">
              <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as Status)}>
                <SelectTrigger className={`h-8 w-full border ${TONE[t.status]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {tables.data?.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No tables yet.{" "}
            {canManage ? "Add your first table above." : "Ask the owner to add tables."}
          </div>
        )}
      </div>
    </div>
  );
}

function TableDialog({ table, onSaved }: { table?: Table; onSaved: () => void }) {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    table_number: table?.table_number ?? "",
    capacity: table?.capacity ?? 4,
    status: (table?.status ?? "available") as Status,
  });

  async function save() {
    if (!bizId) return;
    if (!form.table_number.trim()) return toast.error("Table number required");
    if (table) {
      const { error } = await supabase.from("restaurant_tables").update(form).eq("id", table.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("restaurant_tables")
        .insert({ ...form, business_id: bizId });
      if (error) return toast.error(error.message);
    }
    toast.success(table ? "Updated" : "Added");
    onSaved();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {table ? (
          <Button variant="outline" size="icon" className="h-7 w-7">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add table
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{table ? "Edit table" : "New table"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Number / Name</Label>
              <Input
                value={form.table_number}
                onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                placeholder="e.g. 1, A2, Patio-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
