import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Utensils, BedDouble, Wine, BarChart3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zam Lodge Manager — Hospitality SaaS for Zambian Lodges" },
      {
        name: "description",
        content:
          "Reservations, restaurant, bar, inventory, billing, staff and reports — built for Zambian lodges, guest houses and small hotels.",
      },
      { property: "og:title", content: "Zam Lodge Manager" },
      {
        property: "og:description",
        content: "Complete lodge management system for Zambian lodges.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Zam Lodge Manager</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/staff-login"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Staff sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Owner sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Hospitality management · Built in Zambia
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Run your lodge end-to-end —
          <span className="text-muted-foreground"> reception, restaurant, bar and back office.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground">
          Zam Lodge Manager replaces the spreadsheets, paper folios and second-job bookkeeping with
          one calm system your staff actually use. Multi-tenant, mobile-first, installable.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Start a free 3-day trial
          </Link>
          <Link
            to="/staff-login"
            className="rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            I'm staff
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden bg-border px-0 py-0 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: BedDouble, t: "Reception & Reservations", d: "Visual room grid, walk-ins, check-in/out, guest folios." },
            { i: Utensils, t: "Restaurant POS", d: "Tables, kitchen tickets, split bills, charge-to-room." },
            { i: Wine, t: "Bar POS", d: "Fast register, open tabs, mobile money, room billing." },
            { i: BarChart3, t: "Reports & KPIs", d: "Daily revenue, occupancy, staff performance — exportable." },
            { i: ShieldCheck, t: "Approvals & Audit", d: "Staff request stock changes; owner approves. Every action logged." },
            { i: Building2, t: "Multi-tenant SaaS", d: "Each lodge isolated by design. Unlimited businesses." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="bg-background p-6">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Zam Lodge Manager</span>
          <Link to="/admin/login" className="hover:text-foreground">
            Platform admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
