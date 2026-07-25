import { createFileRoute } from "@tanstack/react-router";
import { POS } from "@/components/pos";
export const Route = createFileRoute("/app/bar")({ component: () => <POS orderType="bar" /> });
