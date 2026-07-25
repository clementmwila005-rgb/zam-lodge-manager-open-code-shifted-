import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type StaffMember = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type Props = {
  businessId: string;
  value: StaffMember[];
  onChange: (value: StaffMember[]) => void;
};

export function StaffPicker({ businessId, value, onChange }: Props) {
  const staff = useQuery({
    queryKey: ["staff-for-preorder", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("business_id", businessId)
        .in("role", ["restaurant_staff", "bar_staff", "housekeeping", "receptionist"]);
      const ids = roleData?.map((r) => r.user_id) ?? [];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids)
        .eq("is_active", true)
        .order("full_name");
      return (data ?? []).filter((s) => s.phone) as StaffMember[];
    },
  });

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
        <p className="text-xs text-muted-foreground">
          No active staff with phone numbers found. Add staff with phone numbers in Staff
          settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Send to staff         {value.length} staff member{value.length > 1 ? "s" : ""} selected</Label>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {staff.data.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent/40"
          >
            <Checkbox
              checked={!!value.find((v) => v.id === s.id)}
              onCheckedChange={() => toggle(s)}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{s.full_name ?? "Unnamed"}</div>
              <div className="truncate text-xs text-muted-foreground">{s.phone}</div>
            </div>
          </label>
        ))}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          WhatsApp will open for staff with phone numbers. In-app messages go to all selected staff.
        </p>
      )}
    </div>
  );
}
