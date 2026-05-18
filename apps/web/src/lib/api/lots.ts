import type {
  CreateLotInput,
  InboundLot,
  PaginatedResponse,
  SignedPhotoUrlResponse,
  Status,
  UpdateLotInput,
} from "@sadiyakargo/shared";
import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { request } from "./client";

export interface StockBreakdownRow {
  id: string;
  name: string;
  totalAvailable: number;
  lots: number;
}

/** Row in the "shipments that drew from this lot" drill-down view. */
export interface LotShipmentRow {
  shipmentId: string;
  shortCode: string;
  shipmentDate: string;
  status: Status;
  carrierId: string;
  qty: number;
  recipient: { name: string; phone: string; addressTr: string } | null;
}

interface ListParams {
  page?: number;
  limit?: number;
  senderId?: string;
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
  stockBySender: () => request<StockBreakdownRow[]>("/lots/stock/by-sender"),
  shipments: (id: string) => request<LotShipmentRow[]>(`/lots/${id}/shipments`),
  receiptPdfUrl: (id: string, lang?: string) =>
    `${API_BASE}/lots/${id}/receipt.pdf${lang ? `?lang=${lang}` : ""}`,

  uploadPhotos: (lotId: string, files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("photos", f);
    return request<InboundLot>(`/lots/${lotId}/photos`, { method: "POST", body: form });
  },
  getPhotoSignedUrl: (lotId: string, photoId: string) =>
    request<SignedPhotoUrlResponse>(`/lots/${lotId}/photos/${photoId}`),
  removePhoto: (lotId: string, photoId: string) =>
    request<InboundLot>(`/lots/${lotId}/photos/${photoId}`, { method: "DELETE" }),
  reorderPhotos: (lotId: string, photoIds: string[]) =>
    request<InboundLot>(`/lots/${lotId}/photos/order`, {
      method: "PATCH",
      body: { photoIds },
    }),
};

/** Download the receipt PDF using the current access token. Toast on failure
 *  so the user gets feedback instead of a silently-failed click. */
export async function downloadReceiptPdf(lotId: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    const token = useAuthStore.getState().accessToken;
    const lang = useUiStore.getState().lang;
    const res = await fetch(lotsApi.receiptPdfUrl(lotId, lang), {
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
