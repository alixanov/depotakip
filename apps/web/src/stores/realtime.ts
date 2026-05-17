import { create } from "zustand";

/**
 * Tracks which shipment ids changed in the last few seconds (driven by the
 * socket bridge in `lib/realtime.ts`). Consumers — primarily the takip
 * table — read it to render a one-shot highlight on the affected row so
 * other operators' edits don't silently re-render.
 */

const FLASH_DURATION_MS = 4_000;

interface RealtimeState {
  /** Map of shipmentId → wall-clock timestamp set by the last flash. */
  flashedAt: Record<string, number>;
  flash: (id: string) => void;
  /** Returns true if `id` was flashed within the last FLASH_DURATION_MS. */
  isFlashed: (id: string) => boolean;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  flashedAt: {},
  flash: (id) => {
    set((s) => ({ flashedAt: { ...s.flashedAt, [id]: Date.now() } }));
    // Trigger a re-render after the flash expires so subscribers re-evaluate
    // `isFlashed` and drop the highlight class.
    setTimeout(() => {
      set((s) => {
        const next = { ...s.flashedAt };
        // Only clear if it hasn't been re-flashed in the meantime.
        if (next[id] && Date.now() - next[id] >= FLASH_DURATION_MS) {
          delete next[id];
        }
        return { flashedAt: next };
      });
    }, FLASH_DURATION_MS + 50);
  },
  isFlashed: (id) => {
    const ts = get().flashedAt[id];
    return ts !== undefined && Date.now() - ts < FLASH_DURATION_MS;
  },
}));
