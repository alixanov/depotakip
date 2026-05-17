import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useRealtimeStore } from "@/stores/realtime";

let socket: Socket | null = null;

function ensureSocket(token: string): Socket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();
  socket = io({ path: "/socket.io", auth: { token } });
  return socket;
}

interface ShipmentEvt {
  id?: string;
  shortCode?: string;
  status?: string;
}

/**
 * Wire the websocket to invalidate React Query caches on org-wide events
 * and surface a non-intrusive toast so operators notice changes made by
 * teammates (e.g. another operator updates a shipment status).
 */
export function useRealtimeInvalidations(): void {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }
    const s = ensureSocket(token);

    const flash = useRealtimeStore.getState().flash;
    const onShipmentCreated = (evt: ShipmentEvt) => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      if (evt?.id) flash(evt.id);
      toast.info("Yeni sevkiyat eklendi", { description: evt?.shortCode });
    };
    const onShipmentStatus = (evt: ShipmentEvt) => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      if (evt?.id) flash(evt.id);
      if (evt?.shortCode && evt?.status) {
        toast.info(`${evt.shortCode} → ${evt.status}`);
      }
    };
    const onLot = () => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      toast.info("Yeni parti alındı");
    };

    s.on("shipment:created", onShipmentCreated);
    s.on("shipment:status_changed", onShipmentStatus);
    s.on("lot:created", onLot);
    return () => {
      s.off("shipment:created", onShipmentCreated);
      s.off("shipment:status_changed", onShipmentStatus);
      s.off("lot:created", onLot);
    };
  }, [qc, token]);
}
