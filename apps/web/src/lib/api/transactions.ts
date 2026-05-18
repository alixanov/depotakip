import type {
  CreateTransactionInput,
  PaginatedResponse,
  Transaction,
  TransactionKind,
} from "@sadiyakargo/shared";
import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { request } from "./client";

export interface BalanceRow {
  counterpartyId: string;
  name: string;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
}

interface ListParams {
  page?: number;
  limit?: number;
  counterpartyId?: string;
  shipmentId?: string;
  kind?: TransactionKind;
  from?: string;
  to?: string;
  sort?: string;
}

export const transactionsApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<PaginatedResponse<Transaction>>(`/transactions${suffix}`);
  },
  create: (input: CreateTransactionInput, idempotencyKey?: string) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: input,
      idempotencyKey,
    }),
  carrierBalances: () => request<BalanceRow[]>("/transactions/balances/carriers"),
  receiptPdfUrl: (id: string) => `${API_BASE}/transactions/${id}/receipt.pdf`,
};

export async function downloadPaymentReceipt(id: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(transactionsApi.receiptPdfUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("Makbuz PDF indirilemedi", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}
