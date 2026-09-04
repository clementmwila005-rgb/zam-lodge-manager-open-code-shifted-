import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/auth.functions";
import type { Session } from "@supabase/supabase-js";

export type BusinessWithLogo = {
  logo_signed_url?: string | null;
  [key: string]: unknown;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.warn("[Auth] getSession error:", sessionError.message);
        setError(sessionError.message);
        supabase.auth.signOut().catch(() => {});
        setLoading(false);
        return;
      }
      setSession(data.session);
      setLoading(false);
    }).catch((err) => {
      console.warn("[Auth] getSession failed:", err);
      setError(err instanceof Error ? err.message : "Session check failed");
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setError(null);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { session, loading, error, clearError };
}

export function useMe() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["me", session?.user.id ?? "none"],
    enabled: !!session,
    queryFn: () => getMyContext(),
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useSignOut(redirectTo?: string) {
  const qc = useQueryClient();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = redirectTo || "/auth";
    }
  };
}

export function primaryRole(roles: { role: string }[] | undefined): string | null {
  if (!roles?.length) return null;
  const order = ["super_admin", "owner", "receptionist", "restaurant_staff", "bar_staff", "housekeeping"];
  for (const r of order) if (roles.some((x) => x.role === r)) return r;
  return roles[0].role;
}
