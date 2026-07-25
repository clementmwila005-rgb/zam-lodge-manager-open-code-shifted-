import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/housekeeping")({ component: Housekeeping });

function Housekeeping() {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const qc = useQueryClient();

  const cleaningRooms = useQuery({
    queryKey: ["housekeeping-rooms", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, room_number, room_type, daily_rate, notes, status")
        .eq("business_id", bizId!)
        .eq("status", "cleaning")
        .order("room_number");
      return data ?? [];
    },
  });

  async function markClean(roomId: string, roomNumber: string) {
    const { error } = await supabase
      .from("rooms")
      .update({ status: "available" })
      .eq("id", roomId);
    if (error) return toast.error(error.message);

    const { error: auditErr } = await supabase.from("audit_logs").insert({
      business_id: bizId!,
      user_id: me?.profile?.id,
      action: "room.cleaned",
      entity: "room",
      entity_id: roomId,
      after_value: { roomNumber, from: "cleaning", to: "available" } as never,
    });
    if (auditErr) console.error("Audit log failed:", auditErr.message);

    toast.success(`Room ${roomNumber} marked as clean`);
    qc.invalidateQueries({ queryKey: ["housekeeping-rooms"] });
  }

  return (
    <div className="p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Housekeeping</h1>
        <p className="text-sm text-muted-foreground">
          Rooms that need cleaning after guest checkout.
        </p>
      </header>

      <div className="mt-6">
        {cleaningRooms.isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {!cleaningRooms.isLoading && cleaningRooms.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">No rooms need cleaning right now.</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cleaningRooms.data?.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold">Room {r.room_number}</div>
                  <div className="text-sm text-muted-foreground capitalize">{r.room_type}</div>
                  {r.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                  )}
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Cleaning
                </Badge>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={() => markClean(r.id, r.room_number)}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Mark as Clean
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
