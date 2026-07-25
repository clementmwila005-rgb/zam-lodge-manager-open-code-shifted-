import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const resetPasswordSearchSchema = z.object({
  code: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  head: () => ({ meta: [{ title: "Reset password · Zam Lodge Manager" }] }),
  component: ResetPasswordPage,
});

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of raw.split("&")) {
    const [key, ...rest] = pair.split("=");
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(rest.join("="));
  }
  return params;
}

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function handleAuth() {
      const hash = window.location.hash;
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      // PKCE flow — code in query param
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setSessionReady(true);
        } else {
          toast.error("Invalid or expired reset link. Please request a new one.");
        }
        setCheckingSession(false);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      // Implicit flow — tokens in hash fragment
      if (hash && hash.includes("access_token")) {
        const params = parseHashParams(hash);
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            setSessionReady(true);
          } else {
            toast.error("Invalid or expired reset link. Please request a new one.");
          }
        } else {
          toast.error("Invalid reset link.");
        }
        setCheckingSession(false);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      setCheckingSession(false);
    }
    handleAuth();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — signing you in...");
    nav({ to: "/app" });
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Verifying reset link...
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            No reset code found. Please use the link from your email, or request a new one.
          </p>
          <Button className="w-full" onClick={() => nav({ to: "/auth" })}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm password</Label>
            <Input
              id="confirm-pw"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
