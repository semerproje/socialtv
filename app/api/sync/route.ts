import { NextRequest } from 'next/server';
import {
  registerScreen,
  unregisterScreen,
  broadcastToAll,
  getConnectedScreens,
  startHeartbeat,
} from '@/lib/sse-manager';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Heartbeat singleton guard
let heartbeatStarted = false;
const enc = new TextEncoder();

/**
 * HEAD /api/sync — lightweight screen presence ping (no SSE)
 */
export async function HEAD(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId');
  const screenName = req.nextUrl.searchParams.get('name') ?? undefined;
  if (screenId) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined;
    db.screen.upsert(screenId, { name: screenName ?? `Ekran ${screenId.slice(-8)}`, lastSeen: new Date().toISOString(), ipAddress: ip }).catch(() => {});
  }
  return new Response(null, { status: 200 });
}

/**
 * GET /api/sync?screenId=...&name=...
 * Screens subscribe here for real-time SSE events.
 *
 * Design notes (Cloud Run + Google LB):
 *  - Response is returned IMMEDIATELY — no awaits before stream creation.
 *  - DB upsert is fire-and-forget (non-blocking).
 *  - Heartbeat every 20s — safely under GCP LB's ~30s idle timeout.
 *  - No `Connection` header — HTTP/2 ignores it and some proxies reject it.
 */
export function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId') ?? `screen_${Date.now()}`;
  const screenName = req.nextUrl.searchParams.get('name') ?? undefined;

  if (!heartbeatStarted) {
    heartbeatStarted = true;
    startHeartbeat(20_000);
  }

  // Fire-and-forget — must NOT block before returning response
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined;
  db.screen
    .upsert(screenId, {
      name: screenName ?? `Ekran ${screenId.slice(-8)}`,
      lastSeen: new Date().toISOString(),
      ipAddress: ip,
    })
    .catch(() => {});

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      registerScreen(screenId, ctrl, screenName);

      // Initial event — sent immediately so browser confirms stream is alive
      ctrl.enqueue(
        enc.encode(
          `event: connected\ndata: ${JSON.stringify({
            screenId,
            timestamp: new Date().toISOString(),
            connectedScreens: getConnectedScreens().length,
          })}\n\n`
        )
      );
    },
    cancel() {
      unregisterScreen(screenId);
      broadcastToAll('screen_disconnected', { screenId, timestamp: new Date().toISOString() });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
