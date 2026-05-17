import type {
  CreateShipmentInput,
  PaginatedResponse,
  Shipment,
  Status,
  UpdateShipmentStatusInput,
} from "@sadiyakargo/shared";
import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { request } from "./client";

export interface PublicTrackInfo {
  shortCode: string;
  status: Status;
  shipmentDate: string;
  totalItems: number;
  recipient: { name: string; phoneMasked: string; cityHint: string } | null;
  statusHistory: { toStatus: Status; changedAt: string }[];
}

export const shipmentsApi = {
  list: (
    params: {
      page?: number;
      limit?: number;
      status?: Status;
      /** "Needs attention" preset — overrides `status` server-side. */
      attention?: boolean;
      carrierId?: string;
      q?: string;
      sort?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<Shipment>>(`/shipments${suffix}`);
  },
  get: (id: string) => request<Shipment>(`/shipments/${id}`),
  create: (input: CreateShipmentInput, idempotencyKey?: string) =>
    request<Shipment>("/shipments", {
      method: "POST",
      body: input,
      idempotencyKey,
    }),
  updateStatus: (id: string, input: UpdateShipmentStatusInput) =>
    request<Shipment>(`/shipments/${id}/status`, {
      method: "PATCH",
      body: input,
    }),
  waybillPdfUrl: (id: string) => `${API_BASE}/shipments/${id}/waybill.pdf`,
  publicTrack: (token: string) =>
    request<PublicTrackInfo>(`/public/track/${token}`, { auth: false }),
};

export async function downloadWaybillPdf(shipmentId: string, shortCode: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(shipmentsApi.waybillPdfUrl(shipmentId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waybill-${shortCode}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("Waybill PDF indirilemedi", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}
