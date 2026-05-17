import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating action button that appears after the user scrolls past
 * ~400px. Click smoothly scrolls back to top. Sits above mobile bottom-nav
 * via `bottom-24 md:bottom-6`.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={cn(
        "fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-soft-lg ring-1 ring-border transition-all duration-300 ease-spring",
        "hover:scale-105 hover:bg-muted",
        "bottom-24 md:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
