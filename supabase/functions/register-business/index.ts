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
      businessName,
      ownerName,
      phone,
      email,
      roomCount,
      address,
      password,
    } = await req.json();

    if (!businessName || !ownerName || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const letters = businessName
      .toUpperCase()
      .replace(/[^A-Z ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w: string) => w[0])
      .join("")
      .slice(0, 3)
      .padEnd(3, "X");
    const num = Math.floor(1000 + Math.random() * 9000);
    const businessCode = `${letters}-${num}`;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;
    const userId = authUser.user.id;

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .insert({
        name: businessName,
        business_code: businessCode,
        owner_name: ownerName,
        phone,
        email,
        address,
        room_count: roomCount ?? 0,
        plan: "trial",
        subscription_status: "trial",
        subscription_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        service_fee_amount: 50,
        delivery_fee_amount: 0,
      })
      .select()
      .single();
    if (bizError) throw bizError;

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      business_id: business.id,
      role: "owner",
    });
    if (roleError) throw roleError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: ownerName,
      email,
      phone,
      business_id: business.id,
    });
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ businessId: business.id, businessCode, email }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("register-business error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
