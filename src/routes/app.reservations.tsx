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
import { Plus } from "lucide-react";
import { checkInGuest, checkOutGuest } from "@/lib/business.functions";

export const Route = createFileRoute("/app/reservations")({ component: Reservations });

function Reservations() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isAllowed = role === "owner" || role === "receptionist";
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["reservations", bizId],
    enabled: !!bizId && isAllowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, guests(full_name, phone), rooms(room_number)")
        .eq("business_id", bizId!)
        .order("check_in_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const openFolios = useQuery({
    queryKey: ["open-folios", bizId],
    enabled: !!bizId && isAllowed,
    queryFn: async () => {
      const { data } = await supabase
        .from("folios")
        .select("id, room_id, rooms(room_number), guests(full_name), folio_lines(amount), payments(amount)")
        .eq("business_id", bizId!)
        .eq("status", "open");
      return data ?? [];
    },
  });

  const [checkoutFolioId, setCheckoutFolioId] = useState<string | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<"cash" | "mobile_money" | "card">("cash");

  if (!isAllowed) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        Only owners and receptionists can view reservations.
      </div>
    );
  }

  async function handleCheckOut(folioId: string, paymentMethod: string) {
    try {
      const r = await checkOutGuest({ folioId, paymentMethod: paymentMethod as "cash" | "mobile_money" | "card" });
      toast.success(`Checked out — K${r.charges.toFixed(2)}`);
      setCheckoutFolioId(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reservations & check-in</h1>
          <p className="text-sm text-muted-foreground">Walk-ins, future bookings and active guests.</p>
        </div>
        <WalkInDialog onDone={() => qc.invalidateQueries()} doCheckIn={(args) => checkInGuest(args)} />
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Active guests</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {openFolios.data?.map((f) => {
            const charges = (f.folio_lines as { amount: number }[]).reduce((s, l) => s + Number(l.amount), 0);
            const paid = (f.payments as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);
            return (
              <div key={f.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold">{(f.guests as { full_name: string } | null)?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Room {(f.rooms as { room_number: string } | null)?.room_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-num text-sm font-semibold">K{charges.toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground">paid K{paid.toFixed(2)}</div>
                  </div>
                </div>
                {checkoutFolioId === f.id ? (
                  <div className="mt-3 space-y-2">
                    <Select value={checkoutMethod} onValueChange={(v) => setCheckoutMethod(v as typeof checkoutMethod)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleCheckOut(f.id, checkoutMethod)}>Confirm</Button>
                      <Button size="sm" variant="outline" onClick={() => setCheckoutFolioId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="mt-3 w-full" onClick={() => setCheckoutFolioId(f.id)}>
                    Check out
                  </Button>
                )}
              </div>
            );
          })}
          {openFolios.data?.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No active guests right now.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Recent reservations</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Guest</th>
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-3 py-2 text-left">In</th>
                <th className="px-3 py-2 text-left">Out</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{(r.guests as { full_name: string } | null)?.full_name}</td>
                  <td className="px-3 py-2">{(r.rooms as { room_number: string } | null)?.room_number ?? "—"}</td>
                  <td className="px-3 py-2">{r.check_in_date}</td>
                  <td className="px-3 py-2">{r.check_out_date}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WalkInDialog({
  onDone,
  doCheckIn,
}: {
  onDone: () => void;
  doCheckIn: (a: { roomId: string; guest: { fullName: string; phone?: string; nrcPassport?: string; address?: string }; checkOutDate: string }) => Promise<unknown>;
}) {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [guest, setGuest] = useState({ fullName: "", phone: "", nrcPassport: "", address: "" });
  const [out, setOut] = useState("");

  const availableRooms = useQuery({
    queryKey: ["rooms-available", bizId, open],
    enabled: open && !!bizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, room_number, room_type, daily_rate")
        .eq("business_id", bizId!)
        .in("status", ["available", "reserved"]);
      return data ?? [];
    },
  });

  async function submit() {
    if (!roomId || !guest.fullName || !out) return toast.error("Room, guest name and check-out date required");
    try {
      await doCheckIn({ roomId, guest, checkOutDate: out });
      toast.success("Checked in");
      setOpen(false);
      setGuest({ fullName: "", phone: "", nrcPassport: "", address: "" });
      setRoomId("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> Walk-in check-in</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Walk-in check-in</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Select available room" /></SelectTrigger>
              <SelectContent>
                {availableRooms.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.room_number} · {r.room_type} · K{Number(r.daily_rate).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Guest name</Label><Input value={guest.fullName} onChange={(e) => setGuest({ ...guest, fullName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>NRC / Passport</Label><Input value={guest.nrcPassport} onChange={(e) => setGuest({ ...guest, nrcPassport: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Check-out date</Label><Input type="date" value={out} onChange={(e) => setOut(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={guest.address} onChange={(e) => setGuest({ ...guest, address: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Check in</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
