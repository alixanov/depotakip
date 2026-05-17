import type { Server as IoServer } from "socket.io";

let io: IoServer | null = null;

export function setIoServer(server: IoServer): void {
  io = server;
}

/** Broadcast an event to every socket joined to the `org:{orgId}` room. */
export function emitOrgEvent(orgId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`org:${orgId}`).emit(event, payload);
}
