import { NextRequest, NextResponse } from 'next/server';
import {
  registerScreen,
  unregisterScreen,
  broadcastToAll,
  getConnectedScreens,
  startHeartbeat,
} from '@/lib/sse-manager';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Start heartbeat once (module-level singleton guard)
let heartbeatStarted = false;

/**
 * GET /api/sync?screenId=...&name=...
 * Screens subscribe here for real-time SSE events.
 */
export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId') ?? `screen_${Date.now()}`;
  const screenName = req.nextUrl.searchParams.get('name') ?? undefined;

  if (!heartbeatStarted) {
    heartbeatStarted = true;
    startHeartbeat(25_000);
  }

  // Update screen heartbeat in DB
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined;

    await db.screen.upsert(screenId, {
      name: screenName ?? `Ekran ${screenId.slice(-8)}`,
      lastSeen: new Date().toISOString(),
      ipAddress: ip,
    });
  } catch {
    // Non-blocking — screen still gets SSE stream
  }

  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      registerScreen(screenId, ctrl, screenName);

      // Send initial payload
      const enc = new TextEncoder();
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
      // notify admin that screen disconnected
      broadcastToAll('screen_disconnected', { screenId, timestamp: new Date().toISOString() });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
