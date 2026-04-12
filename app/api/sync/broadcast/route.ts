import { NextRequest, NextResponse } from 'next/server';
import {
  broadcastToAll,
  sendToScreen,
  broadcastToScreens,
  getConnectedScreens,
  getConnectedCount,
} from '@/lib/sse-manager';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/broadcast
 * Returns list of connected screens.
 */
export async function GET() {
  return NextResponse.json({
    connectedCount: getConnectedCount(),
    screens: getConnectedScreens(),
  });
}

/**
 * POST /api/sync/broadcast
 * Body: { event, data?, screenId?, screenIds? }
 *
 * Events:
 *   reload            — full page reload
 *   update_content    — re-fetch display data
 *   play_youtube      — { videoId, title? }
 *   play_stream       — { title, provider?, playbackMode, streamUrl?, embedUrl?, videoId?, posterUrl?, logoUrl? }
 *   play_playlist     — { videos: [{videoId, title}] }
 *   show_instagram    — { posts: [] }
 *   show_ad           — { adId }
 *   change_layout     — { layoutType }
 *   fullscreen_video  — { url, title? }
 *   overlay_message   — { text, duration?, color? }
 *   clear_overlay     — {}
 *   set_volume        — { value: 0-100 }
 *   mute              — {}
 *   unmute            — {}
 */
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'sync-broadcast', 40, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  let body: { event: string; data?: unknown; screenId?: string; screenIds?: string[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, data, screenId, screenIds } = body;

  if (!event) {
    return NextResponse.json({ error: 'event field is required' }, { status: 400 });
  }

  // Skip internal presence events — don't persist to Firestore
  const isInternal = event === 'screen_connected' || event === 'screen_disconnected' || event === 'heartbeat';

  // Write to Firestore so screens with Firestore listener receive the command
  // even when SSE is unavailable (Cloud Run serverless)
  if (!isInternal) {
    const cmd = { type: event, data: data ?? {}, sentAt: FieldValue.serverTimestamp() };
    try {
      if (screenId) {
        // Target specific screen
        await adminDb.collection('screens').doc(screenId).set({ lastCommand: cmd }, { merge: true });
      } else if (screenIds?.length) {
        // Target multiple screens
        const batch = adminDb.batch();
        for (const id of screenIds) {
          batch.set(adminDb.collection('screens').doc(id), { lastCommand: cmd }, { merge: true });
        }
        await batch.commit();
      } else {
        // Broadcast to all
        await adminDb.collection('broadcast').doc('current').set({ lastCommand: cmd }, { merge: true });
      }
    } catch {
      // Non-blocking — SSE fallback below still runs
    }
  }

  // SSE delivery (best-effort, works on local / single-instance)
  let sent = 0;
  if (screenId) {
    const ok = sendToScreen(screenId, event, data ?? {});
    sent = ok ? 1 : 0;
  } else if (screenIds?.length) {
    broadcastToScreens(screenIds, event, data ?? {});
    sent = screenIds.length;
  } else {
    broadcastToAll(event, data ?? {});
    sent = getConnectedCount();
  }

  // Persist broadcast log (non-blocking)
  if (!isInternal) {
    const targetLabel = screenId
      ? `screen:${screenId}`
      : screenIds?.length
        ? `screens:${screenIds.length}`
        : 'all';
    adminDb.collection('broadcast_logs').add({
      event,
      targetLabel,
      targetCount: sent,
      data: data ?? {},
      sentAt: FieldValue.serverTimestamp(),
    }).catch(() => { /* non-blocking */ });
  }

  return NextResponse.json({ success: true, targetedScreens: sent });
}
