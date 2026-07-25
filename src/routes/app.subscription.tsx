import { createFileRoute } from "@tanstack/react-router";
import { Check, MessageCircle } from "lucide-react";
import { useMe } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS, WHATSAPP_NUMBER, whatsappUrl, getPlan } from "@/lib/plans";

export const Route = createFileRoute("/app/subscription")({ component: Subscription });

function Subscription() {
  const { data: me } = useMe();
  const b = me?.business;
  const current = getPlan(b?.plan);
  const expires = b?.subscription_expires_at?.slice(0, 10) ?? "—";

  return (
    <div className="p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Subscription</h1>
        <p className="text-sm text-muted-foreground">Manual payments via WhatsApp.</p>
      </header>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</div>
            <div className="mt-1 text-lg font-semibold">{current.label} <span className="text-muted-foreground">· {current.rooms}</span></div>
            <div className="mt-1 text-xs text-muted-foreground">
              Status <Badge variant={b?.subscription_status === "active" ? "default" : "outline"} className="ml-1 capitalize">{b?.subscription_status ?? "—"}</Badge> · Expires {expires}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Business code <span className="font-mono">{b?.business_code}</span></div>
          </div>
          <div className="text-right">
            <div className="stat-num text-2xl font-semibold">{current.price}</div>
            <div className="text-[11px] text-muted-foreground">per month</div>
          </div>
        </div>
      </section>

      <h2 className="mt-8 text-sm font-semibold">Plans</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const active = p.key === current.key;
          const msg = `Hello, I would like to ${active ? "renew" : "upgrade to"} the ${p.label} plan (${p.rooms}) for business ${b?.name ?? ""} [${b?.business_code ?? ""}].`;
          return (
            <div key={p.key} className={`flex flex-col rounded-lg border bg-card p-4 ${active ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{p.label}</div>
                {active && <Badge>Current</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{p.rooms}</div>
              <div className="mt-3 stat-num text-2xl font-semibold">{p.price}</div>
              {p.priceNumber !== null && <div className="text-[11px] text-muted-foreground">per month</div>}
              <ul className="mt-4 space-y-1.5 text-sm">
                <Feat>{p.staffLimit === 0 ? "Unlimited staff accounts" : `${p.staffLimit} staff accounts`}</Feat>
                <Feat>Reservations & room management</Feat>
                <Feat>Restaurant & bar POS</Feat>
                <Feat>Inventory & stock alerts</Feat>
                <Feat>Reports & audit log</Feat>
              </ul>
              <a href={whatsappUrl(msg)} target="_blank" rel="noreferrer" className="mt-4">
                <Button className="w-full" variant={active ? "outline" : "default"}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {p.priceNumber === null ? "Request quote" : active ? "Renew via WhatsApp" : "Upgrade via WhatsApp"}
                </Button>
              </a>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">How to pay</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Send a WhatsApp message to <span className="font-mono text-foreground">{WHATSAPP_NUMBER}</span> with your business code and the plan you want.</li>
          <li>You will receive Mobile Money / bank details to complete payment.</li>
          <li>Once payment is confirmed, your plan is activated within minutes.</li>
        </ol>
        <a href={whatsappUrl(`Hello, I need help with my Zam Lodge Manager subscription. Business ${b?.name ?? ""} [${b?.business_code ?? ""}].`)} target="_blank" rel="noreferrer">
          <Button className="mt-4" variant="outline"><MessageCircle className="mr-2 h-4 w-4" />Chat on WhatsApp</Button>
        </a>
      </section>
    </div>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
