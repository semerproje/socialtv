import { NextRequest, NextResponse } from 'next/server';
import {
  broadcastToAll,
  sendToScreen,
  broadcastToScreens,
  getConnectedScreens,
  getConnectedCount,
} from '@/lib/sse-manager';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

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

  return NextResponse.json({ success: true, targetedScreens: sent });
}
