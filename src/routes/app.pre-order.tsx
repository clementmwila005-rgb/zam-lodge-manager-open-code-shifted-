import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-auth";
import { PreorderForm } from "@/components/preorder-form";

export const Route = createFileRoute("/app/pre-order")({ component: PreorderPage });

function PreorderPage() {
  const { data: me, isLoading, isError } = useMe();
  const nav = useNavigate();

  useEffect(() => {
    if (isError) nav({ to: "/auth", replace: true });
  }, [isError, nav]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  const bizId = me.profile?.business_id;
  const userId = me.profile?.id;
  if (!bizId) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center p-6 text-center text-sm text-muted-foreground">
        No business found. Contact support.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <PreorderForm
        businessId={bizId}
        userId={userId ?? ""}
        ownerName={me.profile?.full_name}
        businessName={me.business?.name}
      />
    </div>
  );
}
