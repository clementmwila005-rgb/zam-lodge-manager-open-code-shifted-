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
import { Plus, Pencil } from "lucide-react";
import { getPlan } from "@/lib/plans";

export const Route = createFileRoute("/app/rooms")({ component: Rooms });

const STATUSES = ["available", "occupied", "reserved", "cleaning", "maintenance"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_TONE: Record<Status, string> = {
  available: "bg-success/10 text-success border-success/20",
  occupied: "bg-info/10 text-info border-info/20",
  reserved: "bg-warning/10 text-warning-foreground border-warning/30",
  cleaning: "bg-muted text-muted-foreground border-border",
  maintenance: "bg-destructive/10 text-destructive border-destructive/20",
};

function Rooms() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const rooms = useQuery({
    queryKey: ["rooms", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("business_id", bizId!)
        .order("room_number");
      if (error) throw error;
      return data;
    },
  });

  async function changeStatus(id: string, status: Status) {
    const { error } = await supabase.from("rooms").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Room updated");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    }
  }

  return (
    <div className="p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rooms</h1>
          <p className="text-sm text-muted-foreground">Visual grid of every room. Click status to update.</p>
        </div>
        {isOwner && <RoomDialog roomCount={rooms.data?.length ?? 0} onSaved={() => qc.invalidateQueries({ queryKey: ["rooms"] })} />}
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rooms.data?.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold tracking-tight">Room {r.room_number}</div>
                <div className="text-xs text-muted-foreground">{r.room_type}</div>
              </div>
              <div className="stat-num text-sm font-semibold">K{Number(r.daily_rate).toFixed(2)}</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Select value={r.status} onValueChange={(v) => changeStatus(r.id, v as Status)}>
                <SelectTrigger className={`h-8 w-full border ${STATUS_TONE[r.status as Status]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isOwner && <RoomDialog room={r} roomCount={rooms.data?.length ?? 0} onSaved={() => qc.invalidateQueries({ queryKey: ["rooms"] })} />}
            </div>
            {r.description && <p className="mt-2 text-xs text-muted-foreground">{r.description}</p>}
          </div>
        ))}
        {rooms.data && rooms.data.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No rooms yet. {isOwner ? "Add your first room above." : "Ask the owner to add rooms."}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomDialog({
  room,
  roomCount,
  onSaved,
}: {
  room?: { id: string; room_number: string; room_type: string; daily_rate: number; description: string | null };
  roomCount: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    room_number: room?.room_number ?? "",
    room_type: room?.room_type ?? "Standard",
    daily_rate: room?.daily_rate ?? 0,
    description: room?.description ?? "",
  });
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;

  async function save() {
    if (!bizId) return;
    if (!room) {
      const plan = getPlan(me?.business?.plan);
      if (plan.roomLimit > 0 && roomCount >= plan.roomLimit) {
        return toast.error(`Your ${plan.label} plan allows ${plan.roomLimit} rooms. Upgrade to add more.`);
      }
    }
    setSaving(true);
    try {
      const payload = { ...form, daily_rate: Number(form.daily_rate) };
      if (room) {
        const { error } = await supabase.from("rooms").update(payload).eq("id", room.id);
        if (error) return toast.error(error.message);
      } else {
        const { error } = await supabase.from("rooms").insert({ ...payload, business_id: bizId });
        if (error) return toast.error(error.message);
      }
      toast.success(room ? "Room updated" : "Room created");
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {room ? (
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Edit room" : "New room"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Room number</Label>
              <Input value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Standard", "Double", "Deluxe", "Executive", "Suite"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Daily rate (K)</Label>
            <Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
