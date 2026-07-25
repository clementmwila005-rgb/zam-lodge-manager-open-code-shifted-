import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard, BedDouble, CalendarRange, Utensils, Wine, Boxes, Users,
  BarChart3, ScrollText, Settings, LogOut, Building2, CreditCard, Menu, X, Wallet, MessageCircle,
  Sparkles, Mail,
} from "lucide-react";
import { useMe, useSession, useSignOut, primaryRole, type BusinessWithLogo } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const nav = useNavigate();
  const { session, loading } = useSession();
  const { data: me, isLoading: meLoading, isError } = useMe();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { if (!loading && !session) nav({ to: "/auth", replace: true }); }, [loading, session, nav]);
  useEffect(() => { if (isError) nav({ to: "/auth", replace: true }); }, [isError, nav]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isSuperEarly = primaryRole(me?.roles) === "super_admin";
  useEffect(() => {
    if (isSuperEarly) {
      nav({ to: "/admin/dashboard", replace: true });
    }
  }, [isSuperEarly, nav]);

  const isSubBlocked =
    !isSuperEarly &&
    me?.business &&
    (me.business.subscription_status === "suspended" ||
      (me.business.subscription_status === "expired") ||
      (me.business.subscription_status === "trial" &&
        me.business.subscription_expires_at &&
        new Date(me.business.subscription_expires_at) < new Date()));
  useEffect(() => {
    if (isSubBlocked) {
      nav({ to: "/app/subscription", replace: true });
    }
  }, [isSubBlocked, nav]);

  const userId = me?.profile?.id;
  const bizId = me?.profile?.business_id;
  const showMessages = !isSuperEarly && !!userId;

  const unreadCount = useQuery({
    queryKey: ["unread-messages", userId],
    enabled: showMessages,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId!)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!userId || !bizId || isSuperEarly) return;
    const channel = supabase
      .channel("new-messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const msg = payload.new as { title?: string; body?: string };
        toast.info(msg.title ?? "New message", { description: msg.body?.slice(0, 100) });
        unreadCount.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, bizId, isSuperEarly]);

  if (loading || meLoading || !me) {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading...</div>;
  }

  const role = primaryRole(me.roles);
  const isOwner = role === "owner";

  if (isSubBlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="w-full max-w-sm space-y-4 p-6">
          <div className="text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Subscription inactive</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {me?.business?.subscription_status === "suspended"
                ? "Your account has been suspended. Please contact support."
                : "Your trial has expired. Please upgrade your plan to continue."}
            </p>
          </div>
          {isOwner && (
            <Button className="w-full" onClick={() => nav({ to: "/app/subscription" })}>
              View subscription
            </Button>
          )}
          {!isOwner && (
            <Button className="w-full" variant="outline" onClick={signOut}>
              Sign out
            </Button>
          )}
        </div>
      </div>
    );
  }

  const biz = me.business;
  const isSuper = role === "super_admin";
  const isReception = role === "receptionist";
  const isRest = role === "restaurant_staff";
  const isBar = role === "bar_staff";
  const isHousekeeping = role === "housekeeping";
  const accomVisible = biz?.accommodation_enabled !== false && !isSuper && (isOwner || isReception);
  const roomsVisible = accomVisible;
  const restVisible = biz?.restaurant_enabled !== false && !isSuper && (isOwner || isRest || isReception);
  const barVisible = biz?.bar_enabled !== false && !isSuper && (isOwner || isBar || isReception);
  const inventoryVisible = !isSuper && (isOwner || isRest || isBar);
  const messagesVisible = !isSuper;

  const navItems = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, show: !isSuper },
    { to: "/app/rooms", label: "Rooms", icon: BedDouble, show: roomsVisible },
    { to: "/app/housekeeping", label: "Housekeeping", icon: Sparkles, show: isHousekeeping },
    { to: "/app/reservations", label: "Reservations", icon: CalendarRange, show: accomVisible },
    { to: "/app/restaurant", label: "Restaurant", icon: Utensils, show: restVisible },
    { to: "/app/bar", label: "Bar", icon: Wine, show: barVisible },
    { to: "/app/pre-order", label: "Send Pre-order", icon: MessageCircle, show: isOwner },
    { to: "/app/messages", label: "Messages", icon: Mail, show: messagesVisible, badge: unreadCount.data ?? 0 },
    { to: "/app/inventory", label: "Inventory", icon: Boxes, show: inventoryVisible },
    { to: "/app/expenses", label: "Expenses", icon: Wallet, show: isOwner },
    { to: "/app/staff", label: "Staff", icon: Users, show: isOwner },
    { to: "/app/reports", label: "Reports", icon: BarChart3, show: isOwner },
    { to: "/app/audit", label: "Audit log", icon: ScrollText, show: isOwner },
    { to: "/app/subscription", label: "Subscription", icon: CreditCard, show: isOwner },
    { to: "/app/settings", label: "Settings", icon: Settings, show: isOwner },
  ];

  const SidebarBody = (
    <>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        {(biz as BusinessWithLogo | null)?.logo_signed_url ? (
          <img
            src={(biz as BusinessWithLogo).logo_signed_url!}
            alt={biz?.name ?? "Logo"}
            className="h-8 w-8 shrink-0 rounded-md object-cover bg-sidebar-accent"
          />
        ) : (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{biz?.name ?? "Zam Lodge"}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60 font-mono">{biz?.business_code ?? (isSuper ? "Platform" : "—")}</div>
        </div>
        <button className="lg:hidden text-sidebar-foreground/60" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navItems.filter((n) => n.show).map(({ to, label, icon: Icon, end, badge }) => {
          const active = end ? pathname === to : pathname.startsWith(to);
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{label}</span>
              {typeof badge === "number" && badge > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-1 min-w-0">
          <div className="truncate text-xs font-medium">{me.profile?.full_name ?? "User"}</div>
          <div className="truncate text-[11px] capitalize text-sidebar-foreground/60">{role?.replace("_", " ") ?? "—"}</div>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60">
          <LogOut className="h-4 w-4" />Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        {SidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            {SidebarBody}
          </aside>
        </div>
      )}

      <main className="min-w-0 bg-background">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{biz?.name ?? "Zam Lodge"}</div>
            <div className="truncate text-[11px] font-mono text-muted-foreground">{biz?.business_code ?? ""}</div>
          </div>
          <button onClick={signOut} className="shrink-0 text-xs text-muted-foreground">Sign out</button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
