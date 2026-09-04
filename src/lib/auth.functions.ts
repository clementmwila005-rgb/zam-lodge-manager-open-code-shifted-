import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PLANS } from "@/lib/plans";

// ---- Helpers ----
export function genBusinessCode(name: string) {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .padEnd(3, "X");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${letters}-${num}`;
}

export function staffEmail(businessCode: string, username: string) {
  return `${businessCode.toLowerCase()}-${username.toLowerCase()}@staff.zamlodge.local`;
}

// ---- Edge Function caller ----
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
async function callEdge<T = unknown>(name: string, body: unknown, authToken?: string): Promise<T> {
  const token = authToken || (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Not authenticated — please sign in again");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || "Request failed");
  }
  return res.json() as T;
}

// ---- Register Business (Owner sign-up) ----
const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(160),
  roomCount: z.number().int().min(0).max(2000),
  address: z.string().trim().max(300).optional(),
  password: z.string().min(8).max(72),
});

export async function registerBusiness(data: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.parse(data);
  return callEdge<{ businessId: string; businessCode: string; email: string }>(
    "register-business",
    parsed,
  );
}

// ---- Resolve staff email from business code + username ----
const staffResolveSchema = z.object({
  businessCode: z.string().trim().min(3).max(20),
  username: z.string().trim().min(2).max(40),
});

export async function resolveStaffEmail(data: z.infer<typeof staffResolveSchema>) {
  const parsed = staffResolveSchema.parse(data);
  const email = staffEmail(parsed.businessCode, parsed.username);
  return { email, businessCode: parsed.businessCode.toUpperCase() };
}

// ---- Owner creates a staff account ----
const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(4).max(30).optional(),
  username: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_.-]+$/i),
  password: z.string().min(6).max(72),
  role: z.enum(["receptionist", "restaurant_staff", "bar_staff", "housekeeping"]),
});

export async function createStaff(data: z.infer<typeof createStaffSchema>) {
  const parsed = createStaffSchema.parse(data);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("business_id, role")
    .eq("user_id", session.user.id);
  const ownerRole = roles?.find((r) => r.role === "owner");
  if (!ownerRole?.business_id) throw new Error("Only owners can create staff");

  const { data: biz } = await supabase
    .from("businesses")
    .select("business_code, plan")
    .eq("id", ownerRole.business_id)
    .single();
  if (!biz) throw new Error("Business not found");

  const plan = PLANS.find((p) => p.key === biz.plan) ?? PLANS[0];
  if (plan.staffLimit > 0) {
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ownerRole.business_id)
      .in("role", ["receptionist", "restaurant_staff", "bar_staff", "housekeeping"]);
    if ((count ?? 0) >= plan.staffLimit) {
      throw new Error(
        `Your ${plan.label} plan allows ${plan.staffLimit} staff. Upgrade to add more.`,
      );
    }
  }

  return callEdge<{ userId: string; username: string }>("create-staff", {
    ...parsed,
    businessId: ownerRole.business_id,
    businessCode: biz.business_code,
    ownerUserId: session.user.id,
  });
}

// ---- Get current user context (business + roles + profile) ----
export async function getMyContext() {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr) {
    throw new Error("Session expired — please sign in again");
  }
  if (!session?.user) {
    throw new Error("Not authenticated — please sign in again");
  }
  const userId = session.user.id;

  const [{ data: profile, error: profileErr }, { data: roles, error: rolesErr }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role, business_id").eq("user_id", userId),
  ]);

  if (profileErr) {
    throw new Error(`Failed to load profile: ${profileErr.message}`);
  }
  if (rolesErr) {
    throw new Error(`Failed to load roles: ${rolesErr.message}`);
  }

  let business = null;
  if (profile?.business_id) {
    const { data, error: bizErr } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", profile.business_id)
      .maybeSingle();
    if (bizErr) {
      throw new Error(`Failed to load business: ${bizErr.message}`);
    }
    business = data;
    if (business?.logo_url && !/^https?:\/\//i.test(business.logo_url)) {
      const { data: signed } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(business.logo_url, 60 * 60 * 24);
      (business as { logo_signed_url?: string | null }).logo_signed_url = signed?.signedUrl ?? null;
    } else if (business?.logo_url) {
      (business as { logo_signed_url?: string | null }).logo_signed_url = business.logo_url;
    }
  }
  return { profile, roles: roles ?? [], business };
}

// ---- Platform super admin ----
export const PLATFORM_ADMIN_EMAIL =
  import.meta.env.VITE_PLATFORM_ADMIN_EMAIL;
export const PLATFORM_ADMIN_NAME = "Platform Admin";

export async function ensurePlatformAdmin() {
  return callEdge<{ ok: true }>("ensure-platform-admin", {});
}

export async function deleteBusiness(businessId: string) {
  return callEdge<{ ok: boolean; deletedUsers: number }>("delete-business", { businessId });
}
