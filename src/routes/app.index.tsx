import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  BedDouble,
  CalendarCheck2,
  CalendarX2,
  CircleDollarSign,
  Utensils,
  Wine,
  Users,
  AlertTriangle,
  Sparkles,
  ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const businessId = me?.profile?.business_id;
  const userId = me?.profile?.id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const stats = useQuery({
    queryKey: ["dashboard", businessId, today, role, userId],
    enabled: !!businessId,
    queryFn: async () => {
      if (role === "restaurant_staff") {
        const { data: orders } = await supabase
          .from("orders")
          .select("total, status")
          .eq("business_id", businessId!)
          .eq("order_type", "restaurant")
          .gte("created_at", today);
        const paidOrders = (orders ?? []).filter((o) => o.status === "paid");
        const todayRev = paidOrders.reduce((s, o) => s + Number(o.total), 0);
        const totalOrders = (orders ?? []).length;
        const pendingOrders = (orders ?? []).filter((o) => o.status === "new").length;
        return { view: "restaurant" as const, todayRev, totalOrders, pendingOrders };
      }

      if (role === "bar_staff") {
        const { data: orders } = await supabase
          .from("orders")
          .select("total, status")
          .eq("business_id", businessId!)
          .eq("order_type", "bar")
          .gte("created_at", today);
        const paidOrders = (orders ?? []).filter((o) => o.status === "paid");
        const todayRev = paidOrders.reduce((s, o) => s + Number(o.total), 0);
        const totalOrders = (orders ?? []).length;
        const pendingOrders = (orders ?? []).filter((o) => o.status === "new").length;
        return { view: "bar" as const, todayRev, totalOrders, pendingOrders };
      }

      if (role === "receptionist") {
        const [rooms, checkInsToday, checkOutsToday, reservations] = await Promise.all([
          supabase.from("rooms").select("status").eq("business_id", businessId!),
          supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("action", "guest.checked_in").gte("created_at", today),
          supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("action", "guest.checked_out").gte("created_at", today),
          supabase.from("reservations").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("status", "confirmed"),
        ]);
        const roomList = rooms.data ?? [];
        const occ = roomList.filter((r) => r.status === "occupied").length;
        const vac = roomList.filter((r) => r.status === "available").length;
        const res = roomList.filter((r) => r.status === "reserved").length;
        return {
          view: "receptionist" as const,
          occ, vac, res, total: roomList.length,
          checkInsToday: checkInsToday.count ?? 0,
          checkOutsToday: checkOutsToday.count ?? 0,
          upcomingReservations: reservations.count ?? 0,
        };
      }

      if (role === "housekeeping") {
        const { data } = await supabase
          .from("rooms")
          .select("id, room_number, status")
          .eq("business_id", businessId!);
        const roomList = data ?? [];
        const needsCleaning = roomList.filter((r) => r.status === "cleaning").length;
        const occupied = roomList.filter((r) => r.status === "occupied").length;
        const available = roomList.filter((r) => r.status === "available").length;
        return { view: "housekeeping" as const, needsCleaning, occupied, available, total: roomList.length };
      }

      // Owner sees everything
      const [rooms, checkInsToday, checkOutsToday, paymentsToday, paymentsMonth, ordersToday, openCredits, pending, staffCount] = await Promise.all([
        supabase.from("rooms").select("status").eq("business_id", businessId!),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("action", "guest.checked_in").gte("created_at", today),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("action", "guest.checked_out").gte("created_at", today),
        supabase.from("payments").select("amount").eq("business_id", businessId!).gte("created_at", today),
        supabase.from("payments").select("amount").eq("business_id", businessId!).gte("created_at", monthStart),
        supabase.from("orders").select("order_type, total").eq("business_id", businessId!).gte("created_at", today).eq("status", "paid"),
        supabase.from("folios").select("id, folio_lines(amount), payments(amount)").eq("business_id", businessId!).eq("status", "open"),
        supabase.from("stock_adjustment_requests").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("business_id", businessId!).eq("is_active", true),
      ]);
      const roomList = rooms.data ?? [];
      const occ = roomList.filter((r) => r.status === "occupied").length;
      const vac = roomList.filter((r) => r.status === "available").length;
      const res = roomList.filter((r) => r.status === "reserved").length;
      const revenueToday = (paymentsToday.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const revenueMonth = (paymentsMonth.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const restaurantRev = (ordersToday.data ?? []).filter((o) => o.order_type === "restaurant").reduce((s, o) => s + Number(o.total), 0);
      const barRev = (ordersToday.data ?? []).filter((o) => o.order_type === "bar").reduce((s, o) => s + Number(o.total), 0);
      const outstanding = (openCredits.data ?? []).reduce((s, f) => {
        const c = (f.folio_lines as { amount: number }[]).reduce((a, l) => a + Number(l.amount), 0);
        const p = (f.payments as { amount: number }[]).reduce((a, l) => a + Number(l.amount), 0);
        return s + Math.max(0, c - p);
      }, 0);
      const total = roomList.length || 1;
      return {
        view: "owner" as const,
        occ, vac, res, total,
        occupancy: Math.round((occ / total) * 100),
        checkInsToday: checkInsToday.count ?? 0,
        checkOutsToday: checkOutsToday.count ?? 0,
        revenueToday, revenueMonth, restaurantRev, barRev,
        outstanding,
        pending: pending.count ?? 0,
        staff: staffCount.count ?? 0,
      };
    },
  });

  if (role === "super_admin") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Go to <a href="/admin/dashboard" className="text-primary underline">Platform admin</a> to manage businesses.
        </p>
      </div>
    );
  }

  const s = stats.data;

  if (s?.view === "restaurant") {
    return (
      <div className="p-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Restaurant — Today</h1>
            <p className="text-sm text-muted-foreground">Your restaurant orders and revenue.</p>
          </div>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={Utensils} label="Orders today" value={s.totalOrders} />
          <Stat icon={CircleDollarSign} label="Revenue today" value={`K${s.todayRev.toFixed(2)}`} />
          <Stat icon={ClipboardList} label="Pending orders" value={s.pendingOrders} accent={s.pendingOrders > 0 ? "warning" : undefined} />
        </div>
      </div>
    );
  }

  if (s?.view === "bar") {
    return (
      <div className="p-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Bar — Today</h1>
            <p className="text-sm text-muted-foreground">Your bar orders and revenue.</p>
          </div>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={Wine} label="Orders today" value={s.totalOrders} />
          <Stat icon={CircleDollarSign} label="Revenue today" value={`K${s.todayRev.toFixed(2)}`} />
          <Stat icon={ClipboardList} label="Pending orders" value={s.pendingOrders} accent={s.pendingOrders > 0 ? "warning" : undefined} />
        </div>
      </div>
    );
  }

  if (s?.view === "receptionist") {
    return (
      <div className="p-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Reception — Today</h1>
            <p className="text-sm text-muted-foreground">Room status and guest movement.</p>
          </div>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={BedDouble} label="Rooms occupied" value={`${s.occ} / ${s.total}`} hint={`${s.vac} vacant · ${s.res} reserved`} />
          <Stat icon={CalendarCheck2} label="Check-ins today" value={s.checkInsToday} />
          <Stat icon={CalendarX2} label="Check-outs today" value={s.checkOutsToday} />
          <Stat icon={BedDouble} label="Upcoming reservations" value={s.upcomingReservations} />
        </div>
      </div>
    );
  }

  if (s?.view === "housekeeping") {
    return (
      <div className="p-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Housekeeping</h1>
            <p className="text-sm text-muted-foreground">Room cleaning status.</p>
          </div>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={Sparkles} label="Needs cleaning" value={s.needsCleaning} accent={s.needsCleaning > 0 ? "warning" : undefined} />
          <Stat icon={BedDouble} label="Occupied" value={s.occupied} />
          <Stat icon={BedDouble} label="Available" value={s.available} />
        </div>
      </div>
    );
  }

  // Owner view
  return (
    <div className="p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of operations across reception, restaurant and bar.
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Occupancy</div>
          <div className="stat-num text-3xl font-semibold">{s?.occupancy ?? 0}%</div>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={BedDouble} label="Rooms occupied" value={`${s?.occ ?? 0} / ${s?.total ?? 0}`} hint={`${s?.vac ?? 0} vacant · ${s?.res ?? 0} reserved`} />
        <Stat icon={CalendarCheck2} label="Check-ins today" value={s?.checkInsToday ?? 0} />
        <Stat icon={CalendarX2} label="Check-outs today" value={s?.checkOutsToday ?? 0} />
        <Stat icon={CircleDollarSign} label="Revenue today" value={`K${(s?.revenueToday ?? 0).toFixed(2)}`} hint={`K${(s?.revenueMonth ?? 0).toFixed(2)} this month`} />
        <Stat icon={Utensils} label="Restaurant today" value={`K${(s?.restaurantRev ?? 0).toFixed(2)}`} />
        <Stat icon={Wine} label="Bar today" value={`K${(s?.barRev ?? 0).toFixed(2)}`} />
        <Stat icon={AlertTriangle} label="Pending approvals" value={s?.pending ?? 0} accent={(s?.pending ?? 0) > 0 ? "warning" : undefined} />
        <Stat icon={Users} label="Active staff" value={s?.staff ?? 0} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Outstanding guest balances</h2>
          <p className="mt-1 text-3xl stat-num font-semibold">K{(s?.outstanding ?? 0).toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across all open folios.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Subscription</h2>
          <p className="mt-1 text-sm capitalize">
            {me?.business?.plan} · <span className="capitalize">{me?.business?.subscription_status}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expires {me?.business?.subscription_expires_at?.slice(0, 10)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent === "warning" ? "text-warning" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 stat-num text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
