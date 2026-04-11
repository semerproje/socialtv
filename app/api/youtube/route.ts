import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/youtube — list videos (optionally filtered by playlistId)
export async function GET(req: NextRequest) {
  try {
    const playlistId = req.nextUrl.searchParams.get('playlistId');
    const activeOnly = req.nextUrl.searchParams.get('active') !== '0';

    const videos = await db.youTubeVideo.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(playlistId ? { playlistId } : {}),
      },
      include: { playlist: { select: { id: true, name: true } } },
    });

    const playlists = await db.videoPlaylist.findMany({
      where: { isActive: true },
    });

    return NextResponse.json({ success: true, videos, playlists });
  } catch (error) {
    console.error('GET /api/youtube error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch videos' }, { status: 500 });
  }
}

// POST /api/youtube — add video or create playlist
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(req, 'youtube-post', 20, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json();

    // ── Playlist creation ───────────────────────────────────────────────────
    if (body.type === 'playlist') {
      const { name, description } = body;
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const playlist = await db.videoPlaylist.create({ name, description });
      return NextResponse.json({ success: true, data: playlist }, { status: 201 });
    }

    // ── Video creation ──────────────────────────────────────────────────────
    const {
      videoId,
      title,
      description,
      thumbnailUrl,
      channelName,
      duration,
      playlistId,
      muted,
      loop,
      startSeconds,
      displayOrder,
    } = body;

    if (!videoId || !title) {
      return NextResponse.json({ error: 'videoId and title are required' }, { status: 400 });
    }

    // Extract video ID from full URL if needed
    const cleanId = extractYouTubeId(videoId) ?? videoId;

    const video = await db.youTubeVideo.upsert(
      cleanId,
      { videoId: cleanId, title, description, thumbnailUrl: thumbnailUrl ?? `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`, channelName, duration, playlistId: playlistId ?? null, muted: muted ?? true, loop: loop ?? true, startSeconds: startSeconds ?? 0, displayOrder: displayOrder ?? 0 },
      { title, description, thumbnailUrl: thumbnailUrl ?? `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`, channelName, duration, playlistId: playlistId ?? null, muted: muted ?? true, loop: loop ?? true, startSeconds: startSeconds ?? 0, displayOrder: displayOrder ?? 0, isActive: true },
    );

    return NextResponse.json({ success: true, data: video }, { status: 201 });
  } catch (error) {
    console.error('POST /api/youtube error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add video' }, { status: 500 });
  }
}

// PATCH /api/youtube?id=... — update video | ?playlistId=... — update playlist | ?action=reorder — batch display order
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(req, 'youtube-patch', 60, 60_000);
  if (limited) return limited;

  try {
    const id = req.nextUrl.searchParams.get('id');
    const playlistId = req.nextUrl.searchParams.get('playlistId');
    const action = req.nextUrl.searchParams.get('action');
    const body = await req.json();

    // Batch reorder videos
    if (action === 'reorder' && Array.isArray(body.items)) {
      await Promise.all(
        body.items.map((item: { id: string; displayOrder: number }) =>
          db.youTubeVideo.update(item.id, { displayOrder: item.displayOrder })
        )
      );
      return NextResponse.json({ success: true });
    }

    // Update playlist
    if (playlistId) {
      const playlist = await db.videoPlaylist.update(playlistId, body);
      return NextResponse.json({ success: true, data: playlist });
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const video = await db.youTubeVideo.update(id, body);
    return NextResponse.json({ success: true, data: video });
  } catch (error) {
    console.error('PATCH /api/youtube error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/youtube?id=... or ?playlistId=...
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(req, 'youtube-delete', 20, 60_000);
  if (limited) return limited;

  try {
    const id = req.nextUrl.searchParams.get('id');
    const playlistId = req.nextUrl.searchParams.get('playlistId');

    if (playlistId) {
      await db.videoPlaylist.delete(playlistId);
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await db.youTubeVideo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/youtube error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&?#\s]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
