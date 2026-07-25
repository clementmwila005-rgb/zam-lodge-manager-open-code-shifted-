import { useEffect, useState } from "react";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useMe() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["me", session?.user.id ?? "none"],
    enabled: !!session,
    queryFn: () => getMyContext(),
    staleTime: 30_000,
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
