import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || Deno.env.get("PLATFORM_ADMIN_EMAIL") || "";
    const password = body.password || Deno.env.get("PLATFORM_ADMIN_PASSWORD") || "";
    const fullName = body.fullName || "Platform Admin";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: existing } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .maybeSingle();

    if (existing) {
      if (password) {
        await supabase.auth.admin.updateUserById(existing.user_id, { password });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let userId: string;
    if (authError && authError.message.includes("already exists")) {
      const { data: userByEmail } = await supabase.auth.admin.listUsers();
      const found = userByEmail?.users.find((u) => u.email === email);
      if (!found) throw authError;
      userId = found.id;
    } else if (authError) {
      throw authError;
    } else {
      userId = authUser.user.id;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "super_admin",
    });
    if (roleError) throw roleError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
    });
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("ensure-platform-admin error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
