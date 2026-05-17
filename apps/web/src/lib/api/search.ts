import { request } from "./client";

export interface SearchHit {
  type: "sender" | "carrier" | "shipment";
  id: string;
  title: string;
  subtitle: string;
}

export const searchApi = {
  query: (q: string, limit = 8) => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return request<SearchHit[]>(`/search?${qs.toString()}`);
  },
};
