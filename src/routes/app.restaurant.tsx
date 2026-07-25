import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { POS } from "@/components/pos";
import { RestaurantTables } from "@/components/restaurant-tables";
import { Utensils, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/app/restaurant")({ component: RestaurantPage });

function RestaurantPage() {
  const [tab, setTab] = useState<"pos" | "tables">("pos");
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border bg-card/60">
        <button
          onClick={() => setTab("pos")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === "pos" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Utensils className="h-4 w-4" /> POS
        </button>
        <button
          onClick={() => setTab("tables")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === "tables" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <LayoutGrid className="h-4 w-4" /> Tables
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "pos" ? <POS orderType="restaurant" /> : <RestaurantTables />}
      </div>
    </div>
  );
}
