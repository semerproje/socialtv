/**
 * SSE (Server-Sent Events) Manager
 * Real-time multi-screen broadcasting system.
 * Global singleton — works for self-hosted Node.js (Windows).
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

interface ScreenClient {
  controller: SSEController;
  screenId: string;
  screenName?: string;
  connectedAt: Date;
}

// ─── Global client registry ───────────────────────────────────────────────────
const clients = new Map<string, ScreenClient>();
const encoder = new TextEncoder();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function format(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function safeSend(client: ScreenClient, event: string, data: unknown): boolean {
  try {
    client.controller.enqueue(format(event, data));
    return true;
  } catch {
    clients.delete(client.screenId);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function registerScreen(
  screenId: string,
  controller: SSEController,
  screenName?: string
) {
  clients.set(screenId, { controller, screenId, screenName, connectedAt: new Date() });
}

export function unregisterScreen(screenId: string) {
  clients.delete(screenId);
}

/** Broadcast an event to ALL connected screens */
export function broadcastToAll(event: string, data: unknown) {
  clients.forEach((client) => safeSend(client, event, data));
}

/** Send an event to a specific screen */
export function sendToScreen(screenId: string, event: string, data: unknown): boolean {
  const client = clients.get(screenId);
  if (!client) return false;
  return safeSend(client, event, data);
}

/** Send an event to all screens in a group */
export function broadcastToScreens(screenIds: string[], event: string, data: unknown) {
  screenIds.forEach((id) => sendToScreen(id, event, data));
}

/** Get list of connected screens */
export function getConnectedScreens(): Array<{
  screenId: string;
  screenName?: string;
  connectedAt: string;
}> {
  return Array.from(clients.values()).map(({ screenId, screenName, connectedAt }) => ({
    screenId,
    screenName,
    connectedAt: connectedAt.toISOString(),
  }));
}

/** Get count of connected screens */
export function getConnectedCount(): number {
  return clients.size;
}

/** Keep connections alive with periodic heartbeats */
export function startHeartbeat(intervalMs = 25_000) {
  setInterval(() => {
    broadcastToAll('heartbeat', { ts: new Date().toISOString() });
  }, intervalMs);
}
