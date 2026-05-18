import type { ApiErrorBody } from "@sadiyakargo/shared";
import { API_BASE } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  fields?: Record<string, string>;
  constructor(body: ApiErrorBody, status: number) {
    super(body.error || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.fields = body.fields;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Internal — prevents recursion on the refresh call itself. */
  _retry?: boolean;
}

interface RawResponse {
  res: Response;
  data: unknown;
}

async function rawFetch(path: string, opts: RequestOptions): Promise<RawResponse> {
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers: Record<string, string> = {};
  // Don't set Content-Type for FormData — the browser appends the multipart
  // boundary itself; setting it manually breaks parsing on the server.
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const body =
    opts.body === undefined
      ? undefined
      : isFormData
        ? (opts.body as FormData)
        : JSON.stringify(opts.body);

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
    credentials: "include",
    signal: opts.signal,
  });

  const text = await res.text();
  const data = text ? safeJSON(text) : null;
  return { res, data };
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const { res, data } = await rawFetch("/auth/refresh", {
        method: "POST",
        auth: false,
        _retry: true,
      });
      if (!res.ok) return false;
      const body = data as { accessToken?: string; user?: unknown };
      if (!body.accessToken) return false;
      useAuthStore.getState().setAccessToken(body.accessToken);
      if (body.user) useAuthStore.getState().setUser(body.user as never);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { res, data } = await rawFetch(path, opts);

  if (res.status === 401 && !opts._retry && opts.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...opts, _retry: true });
    }
  }

  if (!res.ok) {
    if (res.status === 401) useAuthStore.getState().clear();
    throw new ApiError((data as ApiErrorBody) || { error: `HTTP ${res.status}` }, res.status);
  }

  return data as T;
}

function safeJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
