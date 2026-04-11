import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/playlists — list all playlists (with optional item counts)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if ('response' in auth) return auth.response;

  try {
    const withItems = req.nextUrl.searchParams.get('withItems') === '1';
    const activeOnly = req.nextUrl.searchParams.get('active') !== '0';

    const playlists = await db.playlist.findMany(activeOnly ? { where: { isActive: true } } : undefined);

    if (withItems) {
      const enriched = await Promise.all(
        playlists.map(async (p) => {
          const items = await db.playlistItem.findManyByPlaylist(p.id as string);
          const activeItems = items.filter((i) => i.isActive);
          const totalDuration = activeItems.reduce((sum, i) => sum + ((i.duration as number) ?? 0), 0);
          return { ...p, items: activeItems, itemCount: activeItems.length, totalDuration };
        })
      );
      return NextResponse.json({ success: true, data: enriched });
    }

    // Just attach item count (fast path)
    const enriched = await Promise.all(
      playlists.map(async (p) => {
        const items = await db.playlistItem.findManyByPlaylist(p.id as string);
        const activeItems = items.filter((i) => i.isActive);
        const totalDuration = activeItems.reduce((sum, i) => sum + ((i.duration as number) ?? 0), 0);
        return { ...p, itemCount: activeItems.length, totalDuration };
      })
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    console.error('[GET /api/playlists]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}

// POST /api/playlists — create playlist
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if ('response' in auth) return auth.response;

  const rl = enforceRateLimit(req, 'playlists-post', 30, 60_000);
  if (rl instanceof NextResponse) return rl;

  try {
    const body = await req.json();
    const { name, description, loop, shuffle, transition, defaultDuration, tags, screenIds } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const created = await db.playlist.create({
      name: name.trim(),
      description: description ?? null,
      loop: loop ?? true,
      shuffle: shuffle ?? false,
      transition: transition ?? 'fade',
      defaultDuration: defaultDuration ?? 10,
      tags: tags ?? null,
      screenIds: screenIds ?? null,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/playlists]', err);
    return NextResponse.json({ success: false, error: 'Create failed' }, { status: 500 });
  }
}
