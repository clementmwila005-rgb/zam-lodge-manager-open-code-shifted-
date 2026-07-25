import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/audit")({ component: Audit });

function Audit() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;

  const q = useQuery({
    queryKey: ["audit", bizId],
    enabled: !!bizId && isOwner,
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("business_id", bizId!)
        .order("created_at", { ascending: false })
        .limit(200);
      const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean) as string[])];
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, username").in("id", userIds)
        : { data: [] as { id: string; full_name: string | null; username: string | null }[] };
      const map = new Map(profs?.map((p) => [p.id, p]));
      const data = (logs ?? []).map((l) => ({
        ...l,
        profiles: l.user_id ? (map.get(l.user_id) ?? null) : null,
      }));
      return data ?? [];
    },
  });

  if (!isOwner) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        Only the owner can view the audit log.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Append-only record of important actions.</p>
      </header>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entity</th>
              <th className="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((l) => {
              const p = l.profiles as { full_name: string | null; username: string | null } | null;
              return (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{p?.full_name ?? p?.username ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.entity ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.after_value ? (
                      <code className="rounded bg-muted px-1.5 py-0.5">
                        {JSON.stringify(l.after_value)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {q.data?.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No audit records yet.
          </div>
        )}
      </div>
    </div>
  );
}
