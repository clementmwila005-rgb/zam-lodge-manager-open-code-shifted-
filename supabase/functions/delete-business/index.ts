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
    const { businessId } = await req.json();
    if (!businessId) {
      return new Response(JSON.stringify({ error: "businessId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("business_id", businessId);

    const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];

    const { error: bizError } = await supabase
      .from("businesses")
      .delete()
      .eq("id", businessId);
    if (bizError) throw bizError;

    for (const uid of userIds) {
      await supabase.from("profiles").delete().eq("id", uid);
      await supabase.auth.admin.deleteUser(uid);
    }

    return new Response(JSON.stringify({ ok: true, deletedUsers: userIds.length }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("delete-business error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
