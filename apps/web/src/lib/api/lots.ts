import type {
  CreateLotInput,
  InboundLot,
  PaginatedResponse,
  UpdateLotInput,
} from "@depotakip/shared";
import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { request } from "./client";

export interface StockBreakdownRow {
  id: string;
  name: string;
  totalAvailable: number;
  lots: number;
}

interface ListParams {
  page?: number;
  limit?: number;
  senderId?: string;
  categoryId?: string;
  status?: string;
  available?: boolean;
  from?: string;
  to?: string;
}

export const lotsApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<InboundLot>>(`/lots${suffix}`);
  },
  create: (input: CreateLotInput) => request<InboundLot>("/lots", { method: "POST", body: input }),
  update: (id: string, input: UpdateLotInput) =>
    request<InboundLot>(`/lots/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/lots/${id}`, { method: "DELETE" }),
  stockByCategory: () => request<StockBreakdownRow[]>("/lots/stock/by-category"),
  stockBySender: () => request<StockBreakdownRow[]>("/lots/stock/by-sender"),
  receiptPdfUrl: (id: string) => `${API_BASE}/lots/${id}/receipt.pdf`,
};

/** Download the receipt PDF using the current access token. Toast on failure
 *  so the user gets feedback instead of a silently-failed click. */
export async function downloadReceiptPdf(lotId: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(lotsApi.receiptPdfUrl(lotId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${lotId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("PDF indirilemedi", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}
