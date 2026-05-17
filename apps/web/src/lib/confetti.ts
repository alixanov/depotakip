import confetti from "canvas-confetti";

const BRAND_COLORS = ["#2540DE", "#7c3aed", "#d946ef", "#10b981", "#f59e0b"];

/**
 * Celebratory confetti — fired on `teslim` status to add a moment of delight
 * for the operator. Respects `prefers-reduced-motion`.
 */
export function celebrate(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Triple burst from different angles for a fuller feel
  const duration = 900;
  const end = Date.now() + duration;

  const burst = (origin: { x: number; y: number }, angle: number) => {
    confetti({
      particleCount: 60,
      startVelocity: 38,
      spread: 70,
      angle,
      origin,
      colors: BRAND_COLORS,
      gravity: 0.9,
      ticks: 200,
      scalar: 0.85,
      disableForReducedMotion: true,
    });
  };

  burst({ x: 0.2, y: 0.85 }, 60);
  burst({ x: 0.8, y: 0.85 }, 120);

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 90,
      spread: 90,
      origin: { x: Math.random(), y: 0 },
      colors: BRAND_COLORS,
      ticks: 200,
      scalar: 0.75,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
