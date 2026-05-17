/// <reference types="vite/client" />

export const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
