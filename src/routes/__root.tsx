import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";

import { supabase } from "@/integrations/supabase/client";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-6xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <a href="/" className="mt-4 inline-block text-sm font-medium text-primary underline">
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[ZamLodge] Unhandled error:", error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1d2447" },
      { title: "Zam Lodge Manager" },
      {
        name: "description",
        content:
          "LODGE MANAGEMENT SOFTWARE MADE FOR ZAMBIAN BUSINESSES",
      },
      { property: "og:title", content: "Zam Lodge Manager" },
      { name: "twitter:title", content: "Zam Lodge Manager" },
      {
        property: "og:description",
        content: "LODGE MANAGEMENT SOFTWARE MADE FOR ZAMBIAN BUSINESSES",
      },
      {
        name: "twitter:description",
        content: "LODGE MANAGEMENT SOFTWARE MADE FOR ZAMBIAN BUSINESSES",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
