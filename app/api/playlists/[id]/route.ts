import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/playlists/[id] — fetch playlist with all items
export async function GET(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req, 'viewer');
  if ('response' in auth) return auth.response;

  try {
    const { id } = await context.params;
    const p = await db.playlist.findUnique(id);
    if (!p) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const items = await db.playlistItem.findManyByPlaylist(id);
    const totalDuration = items.filter((i) => i.isActive).reduce((s, i) => s + ((i.duration as number) ?? 0), 0);

    return NextResponse.json({ success: true, data: { ...p, items, itemCount: items.length, totalDuration } });
  } catch (err) {
    console.error('[GET /api/playlists/[id]]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}

// PATCH /api/playlists/[id] — update playlist metadata
export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req, 'editor');
  if ('response' in auth) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { name, description, loop, shuffle, transition, defaultDuration, tags, screenIds, isActive } = body;

    const updated = await db.playlist.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(loop !== undefined && { loop }),
      ...(shuffle !== undefined && { shuffle }),
      ...(transition !== undefined && { transition }),
      ...(defaultDuration !== undefined && { defaultDuration }),
      ...(tags !== undefined && { tags }),
      ...(screenIds !== undefined && { screenIds }),
      ...(isActive !== undefined && { isActive }),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PATCH /api/playlists/[id]]', err);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

// DELETE /api/playlists/[id] — delete playlist + all items
export async function DELETE(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req, 'editor');
  if ('response' in auth) return auth.response;

  try {
    const { id } = await context.params;
    await db.playlist.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/playlists/[id]]', err);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}

// POST /api/playlists/[id] — add item or reorder
export async function POST(req: NextRequest, context: Ctx) {
  const auth = await requireAdmin(req, 'editor');
  if ('response' in auth) return auth.response;

  const rl = enforceRateLimit(req, 'playlist-items-post', 60, 60_000);
  if (rl instanceof NextResponse) return rl;

  try {
    const { id } = await context.params;
    const body = await req.json();

    // ── Reorder items ──────────────────────────────────────────────────────
    if (body.action === 'reorder') {
      const { items } = body as { items: Array<{ id: string; order: number }> };
      if (!Array.isArray(items)) {
        return NextResponse.json({ success: false, error: 'items array required' }, { status: 400 });
      }
      await db.playlistItem.reorder(items);
      return NextResponse.json({ success: true });
    }

    // ── Delete item ────────────────────────────────────────────────────────
    if (body.action === 'delete_item') {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId required' }, { status: 400 });
      await db.playlistItem.delete(itemId);
      return NextResponse.json({ success: true });
    }

    // ── Update item ────────────────────────────────────────────────────────
    if (body.action === 'update_item') {
      const { itemId, ...rest } = body;
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId required' }, { status: 400 });
      const updated = await db.playlistItem.update(itemId, rest);
      return NextResponse.json({ success: true, data: updated });
    }

    // ── Add item ───────────────────────────────────────────────────────────
    const {
      type, title, contentRef, mediaUrl, youtubeVideoId, layoutType, sceneId,
      duration, transition, thumbnailUrl, payload,
    } = body;

    if (!type) return NextResponse.json({ success: false, error: 'type is required' }, { status: 400 });

    // Determine next order
    const existing = await db.playlistItem.findManyByPlaylist(id);
    const nextOrder = existing.length > 0
      ? Math.max(...existing.map((i) => (i.order as number) ?? 0)) + 1
      : 0;

    const item = await db.playlistItem.create({
      playlistId: id,
      order: nextOrder,
      type,
      title: title ?? null,
      contentRef: contentRef ?? null,
      mediaUrl: mediaUrl ?? null,
      youtubeVideoId: youtubeVideoId ?? null,
      layoutType: layoutType ?? null,
      sceneId: sceneId ?? null,
      duration: duration ?? 10,
      transition: transition ?? null,
      thumbnailUrl: thumbnailUrl ?? null,
      payload: payload ?? null,
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/playlists/[id]]', err);
    return NextResponse.json({ success: false, error: 'Operation failed' }, { status: 500 });
  }
}
