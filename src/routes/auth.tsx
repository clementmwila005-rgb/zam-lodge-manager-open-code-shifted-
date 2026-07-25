import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registerBusiness, PLATFORM_ADMIN_EMAIL } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Owner sign in · Zam Lodge Manager" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // register
  const [biz, setBiz] = useState({
    businessName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    roomCount: 10,
    password: "",
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (PLATFORM_ADMIN_EMAIL && email.toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase()) {
      return toast.error("Platform admin must use the admin login at /admin/login");
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/app" });
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (PLATFORM_ADMIN_EMAIL && biz.email.toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase()) {
      return toast.error("This email is reserved for the platform admin");
    }
    setLoading(true);
    try {
      const r = await registerBusiness(biz);
      toast.success(`Business created — code: ${r.businessCode}`);
      const { error } = await supabase.auth.signInWithPassword({
        email: r.email,
        password: biz.password,
      });
      if (error) throw error;
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Zam Lodge Manager</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight">
            One system. Every department. Every shift.
          </h2>
          <p className="text-sm text-sidebar-foreground/70">
            Reception, restaurant, bar, inventory, billing and reporting — designed for Zambian
            lodges, guest houses and small hotels.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Staff signing in? <Link to="/staff-login" className="underline">Use staff login</Link>.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">Owner access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your lodge — or create a new business account.
          </p>
          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create business</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="e">Email</Label>
                  <Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="p">Password</Label>
                    <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input id="p" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3">
                <Field label="Business name" v={biz.businessName} on={(v) => setBiz({ ...biz, businessName: v })} />
                <Field label="Owner full name" v={biz.ownerName} on={(v) => setBiz({ ...biz, ownerName: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone" v={biz.phone} on={(v) => setBiz({ ...biz, phone: v })} />
                  <Field label="Rooms" type="number" v={String(biz.roomCount)} on={(v) => setBiz({ ...biz, roomCount: Number(v) || 0 })} />
                </div>
                <Field label="Email" type="email" v={biz.email} on={(v) => setBiz({ ...biz, email: v })} />
                <Field label="Address" v={biz.address} on={(v) => setBiz({ ...biz, address: v })} />
                <Field label="Password (min 8)" type="password" v={biz.password} on={(v) => setBiz({ ...biz, password: v })} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create business & start trial"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Enter your email and we'll send you a reset link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
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

function Field({
  label,
  v,
  on,
  type = "text",
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} required value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
