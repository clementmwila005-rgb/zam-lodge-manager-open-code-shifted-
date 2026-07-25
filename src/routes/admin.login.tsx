import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensurePlatformAdmin, PLATFORM_ADMIN_EMAIL } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Platform admin login" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const nav = useNavigate();
  const [email, setE] = useState(PLATFORM_ADMIN_EMAIL ?? "");
  const [password, setP] = useState("");
  const [loading, setL] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || email.toLowerCase() !== (PLATFORM_ADMIN_EMAIL ?? "").toLowerCase()) {
      return toast.error("Platform admin email is locked");
    }
    setL(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await ensurePlatformAdmin();
      nav({ to: "/admin/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setL(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for a password reset link");
    setForgotOpen(false);
    setForgotEmail("");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar p-6 text-sidebar-foreground">
      <div className="w-full max-w-sm rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Platform admin</h1>
        </div>
        <p className="mt-1 text-xs text-sidebar-foreground/70">
          Restricted to the platform owner. Business users sign in elsewhere.
        </p>

        <form onSubmit={onLogin} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" required value={email} onChange={(e) => setE(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Password</Label>
              <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="text-xs text-primary hover:underline">
                Forgot password?
              </button>
            </div>
            <Input type="password" required value={password} onChange={(e) => setP(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Enter your email and we'll send you a reset link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-forgot-email">Email</Label>
              <Input
                id="admin-forgot-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
