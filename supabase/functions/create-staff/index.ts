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
    const {
      fullName,
      phone,
      username,
      password,
      role,
      businessId,
      businessCode,
      ownerUserId,
    } = await req.json();

    if (!fullName || !username || !password || !role || !businessId || !ownerUserId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const email = `${businessCode.toLowerCase()}-${username.toLowerCase()}@staff.zamlodge.local`;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;
    const userId = authUser.user.id;

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      business_id: businessId,
      role,
    });
    if (roleError) throw roleError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      username,
      phone,
      email,
      business_id: businessId,
    });
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ userId, username }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("create-staff error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
