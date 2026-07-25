import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { useSession, useMe, useSignOut, primaryRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const nav = useNavigate();
  const { session, loading } = useSession();
  const { data: me, isLoading: meLoading, isError } = useMe();
  const signOut = useSignOut("/admin/login");

  useEffect(() => {
    if (!loading && !session) nav({ to: "/admin/login", replace: true });
  }, [loading, session, nav]);

  useEffect(() => {
    if (isError) nav({ to: "/admin/login", replace: true });
  }, [isError, nav]);

  const role = primaryRole(me?.roles);
  useEffect(() => {
    if (!meLoading && role && role !== "super_admin") {
      nav({ to: "/auth", replace: true });
    }
  }, [meLoading, role, nav]);

  if (!loading && !session) {
    return <Outlet />;
  }

  if (loading || meLoading || !me) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-semibold">Platform Admin</span>
              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Super Admin</span>
            </div>
          </div>
          <button
            onClick={() => {
              signOut();
            }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
