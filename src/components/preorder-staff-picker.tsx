import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type StaffMember = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role?: string;
};

type Props = {
  businessId: string;
  value: StaffMember[];
  onChange: (value: StaffMember[]) => void;
};

const ROLE_LABELS: Record<string, string> = {
  restaurant_staff: "Restaurant",
  bar_staff: "Bar",
  housekeeping: "Housekeeping",
  receptionist: "Reception",
};

const ROLE_ORDER = ["restaurant_staff", "bar_staff", "receptionist", "housekeeping"];

export function StaffPicker({ businessId, value, onChange }: Props) {
  const staff = useQuery({
    queryKey: ["staff-for-preorder", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("business_id", businessId)
        .in("role", ["restaurant_staff", "bar_staff", "housekeeping", "receptionist"]);
      const roleMap = new Map<string, string>();
      for (const r of roleData ?? []) roleMap.set(r.user_id, r.role);

      const ids = (roleData ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids)
        .eq("is_active", true)
        .order("full_name");

      return (data ?? []).map((s) => ({
        ...s,
        role: roleMap.get(s.id) ?? "other",
      })) as StaffMember[];
    },
  });

  const grouped = ROLE_ORDER.reduce<Record<string, StaffMember[]>>((acc, r) => {
    acc[r] = (staff.data ?? []).filter((s) => s.role === r);
    return acc;
  }, {});
  const ungrouped = (staff.data ?? []).filter((s) => !ROLE_ORDER.includes(s.role ?? ""));
  if (ungrouped.length > 0) grouped["other"] = ungrouped;

  function toggle(s: StaffMember) {
    const exists = value.find((v) => v.id === s.id);
    if (exists) {
      onChange(value.filter((v) => v.id !== s.id));
    } else {
      onChange([...value, s]);
    }
  }

  if (staff.isLoading) {
    return (
      <div className="space-y-2">
        <Label>Send to staff</Label>
        <p className="text-xs text-muted-foreground">Loading staff...</p>
      </div>
    );
  }

  if (!staff.data?.length) {
    return (
      <div className="space-y-2">
        <Label>Send to staff</Label>
        <p className="text-xs text-muted-foreground">No active staff found. Add staff in Staff settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Send to staff — {value.length} selected</Label>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-2">
        {Object.entries(grouped).map(([role, members]) => {
          if (members.length === 0) return null;
          return (
            <div key={role}>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {ROLE_LABELS[role] ?? role}
              </div>
              <div className="space-y-0.5">
                {members.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={!!value.find((v) => v.id === s.id)}
                      onCheckedChange={() => toggle(s)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.full_name ?? "Unnamed"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.phone ?? "No phone (in-app only)"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          WhatsApp opens for staff with phone numbers. In-app messages go to all selected staff.
        </p>
      )}
    </div>
  );
}
