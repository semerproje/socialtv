import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/display/playlist/[id]
 * Public endpoint — no auth required. Used by display screens to fetch
 * a playlist and its active, ordered items for playback.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const rl = enforceRateLimit(req, 'display-playlist', 120, 60_000);
  if (rl instanceof NextResponse) return rl;

  try {
    const { id } = await context.params;
    const p = await db.playlist.findUnique(id);
    if (!p) {
      return NextResponse.json({ success: false, error: 'Playlist not found' }, { status: 404 });
    }
    if (!p.isActive) {
      return NextResponse.json({ success: false, error: 'Playlist is inactive' }, { status: 403 });
    }

    const allItems = await db.playlistItem.findManyByPlaylist(id);
    // Only return active items, sorted by order
    const items = allItems
      .filter((i) => i.isActive)
      .sort((a, b) => (a.order as number) - (b.order as number));

    return NextResponse.json({
      success: true,
      data: {
        id: p.id,
        name: p.name,
        loop: p.loop,
        shuffle: p.shuffle,
        transition: p.transition,
        defaultDuration: p.defaultDuration,
        items,
      },
    });
  } catch (err) {
    console.error('[GET /api/display/playlist/[id]]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}
