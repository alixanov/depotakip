import type { CreateExchangeRateInput, Currency, ExchangeRate } from "@sadiyakargo/shared";
import { request } from "./client";

export const exchangeRatesApi = {
  list: (params: { currency?: Currency; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.currency) qs.set("currency", params.currency);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<ExchangeRate[]>(`/exchange-rates${suffix}`);
  },
  create: (input: CreateExchangeRateInput) =>
    request<ExchangeRate>("/exchange-rates", { method: "POST", body: input }),
  remove: (id: string) => request<{ ok: true }>(`/exchange-rates/${id}`, { method: "DELETE" }),
};
