import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resolveStaffEmail } from "@/lib/auth.functions";

export const Route = createFileRoute("/staff-login")({
  head: () => ({ meta: [{ title: "Staff sign in · Zam Lodge Manager" }] }),
  component: StaffLogin,
});

function StaffLogin() {
  const nav = useNavigate();
  const [businessCode, setBC] = useState("");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [loading, setL] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setL(true);
    try {
      const { email } = await resolveStaffEmail({ businessCode, username });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      nav({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setL(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the business code provided by your manager.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Business code</Label>
            <Input
              placeholder="e.g. MOP-4831"
              value={businessCode}
              onChange={(e) => setBC(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setU(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setP(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Owner?{" "}
            <Link to="/auth" className="underline">
              Use email login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
