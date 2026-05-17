import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { request } from "./client";

export interface DashboardKpi {
  shipmentsTotal: number;
  shipmentsByStatus: Record<string, number>;
  stockTotal: number;
  carrierBalanceUsd: number;
  senderBalanceUsd: number;
  shipmentsByDay: { day: string; count: number }[];
  receivedByDay: { day: string; qty: number }[];
}

export type ReportType = "carriers" | "senders" | "categories" | "finance";

export const reportsApi = {
  dashboard: (params: { from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<DashboardKpi>(`/reports/dashboard${suffix}`);
  },
  report: <T = Record<string, unknown>>(
    type: ReportType,
    params: { from?: string; to?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<T[]>(`/reports/${type}${suffix}`);
  },
  exportUrl: (
    type: ReportType,
    format: "csv" | "xlsx",
    params: { from?: string; to?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    qs.set("format", format);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    return `${API_BASE}/reports/${type}/export?${qs.toString()}`;
  },
};

export async function downloadReportExport(
  type: ReportType,
  format: "csv" | "xlsx",
  params: { from?: string; to?: string } = {}
): Promise<void> {
  const { toast } = await import("sonner");
  try {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(reportsApi.exportUrl(type, format, params), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${type}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("Rapor indirilemedi", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}
