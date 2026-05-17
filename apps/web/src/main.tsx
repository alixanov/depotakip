import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import "./lib/i18n";
import { applyTheme, useUiStore } from "./stores/ui";

applyTheme(useUiStore.getState().theme);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

function AppToaster() {
  const theme = useUiStore((s) => s.theme);
  // Mobile gets top-center toasts so they don't collide with bottom-nav.
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return (
    <Toaster
      richColors
      position={isMobile ? "top-center" : "top-right"}
      theme={theme}
      closeButton
      toastOptions={{ className: "rounded-xl border shadow-soft-lg" }}
    />
  );
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300} skipDelayDuration={150}>
        <RouterProvider router={router} />
        <AppToaster />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
