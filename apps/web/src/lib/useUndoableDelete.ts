import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface WithId {
  id: string;
}

interface Options {
  /** Query key prefix to mutate optimistically (e.g. ["senders"]). */
  queryKey: QueryKey;
  /** The actual DELETE network call, run after the undo window expires. */
  deleteFn: (id: string) => Promise<unknown>;
  /** Toast title shown when the delete is staged. */
  toastTitle: string;
  /** Toast description, often "<entity name>". Optional. */
  toastDescription?: string;
  /** How long the undo window stays open. Default 5s. */
  windowMs?: number;
}

/**
 * Optimistic, undoable delete. Removes the item from every matching React
 * Query cache immediately, shows a sonner toast with an `Undo` action, and
 * defers the actual DELETE network call by `windowMs` (5s default). If the
 * user clicks Undo the snapshot is restored and the API is never called;
 * if the API call later fails we restore + surface an error toast.
 *
 * Works for both array (`T[]`) and paginated (`{data: T[]}`) shapes.
 */
export function useUndoableDelete({
  queryKey,
  deleteFn,
  toastTitle,
  toastDescription,
  windowMs = 5_000,
}: Options) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return (id: string) => {
    const snapshots = qc.getQueriesData({ queryKey });

    // Optimistic remove across every matching cache.
    for (const [key, data] of snapshots) {
      if (Array.isArray(data)) {
        const filtered = (data as WithId[]).filter((x) => x.id !== id);
        qc.setQueryData(key, filtered);
      } else if (
        data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as { data: unknown }).data)
      ) {
        const page = data as { data: WithId[] };
        qc.setQueryData(key, {
          ...page,
          data: page.data.filter((x) => x.id !== id),
        });
      }
    }

    let cancelled = false;
    const restore = () => {
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
    };

    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await deleteFn(id);
        // Make sure the cache reflects the server (re-fetch in case of pagination drift).
        qc.invalidateQueries({ queryKey });
      } catch (err) {
        restore();
        toast.error(t("undo:delete_failed"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }, windowMs);

    toast(toastTitle, {
      description: toastDescription,
      duration: windowMs,
      action: {
        label: t("undo:label"),
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          restore();
        },
      },
    });
  };
}
