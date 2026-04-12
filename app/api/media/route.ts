import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'social-web-tv.appspot.com';
const MEDIA_PREFIX = 'media/';

function getAdminStorage() {
  const app = getAdminApp(); // re-use the existing admin app getter
  return getStorage(app).bucket(BUCKET);
}

// GET /api/media?prefix=media/&limit=100 — list uploaded files
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const prefix = req.nextUrl.searchParams.get('prefix') ?? MEDIA_PREFIX;
    const limitParam = req.nextUrl.searchParams.get('limit');
    const maxResults = limitParam ? Math.min(Number(limitParam), 500) : 200;

    const bucket = getAdminStorage();
    const [files] = await bucket.getFiles({ prefix, maxResults });

    const items = await Promise.all(
      files
        .filter((f) => !f.name.endsWith('/')) // skip virtual folders
        .map(async (f) => {
          const [metadata] = await f.getMetadata();
          const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(f.name)}?alt=media`;
          const customMeta = (metadata.metadata as Record<string, string> | undefined) ?? {};
          return {
            name: f.name,
            fileName: f.name.split('/').pop(),
            url,
            contentType: metadata.contentType ?? 'application/octet-stream',
            size: metadata.size ? Number(metadata.size) : 0,
            updatedAt: metadata.updated ?? null,
            title: customMeta.title ?? null,
            tags: customMeta.tags ? customMeta.tags.split(',').filter(Boolean) : [],
            notes: customMeta.notes ?? null,
          };
        })
    );

    // Sort newest first
    items.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ success: true, data: items, total: items.length });
  } catch (err) {
    console.error('[GET /api/media]', err);
    return NextResponse.json({ success: false, error: 'Failed to list media' }, { status: 500 });
  }
}

// DELETE /api/media?path=media/filename.jpg — delete a file
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(req, 'media-delete', 20, 60_000);
  if (limited) return limited;

  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  // Security: only allow deleting from media/ prefix
  if (!path.startsWith(MEDIA_PREFIX)) {
    return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
  }

  try {
    const bucket = getAdminStorage();
    await bucket.file(path).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/media]', err);
    return NextResponse.json({ success: false, error: 'Failed to delete file' }, { status: 500 });
  }
}

// PATCH /api/media — update custom metadata on a file
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(req, 'media-patch', 30, 60_000);
  if (limited) return limited;

  try {
    const body = await req.json();
    const { path, title, tags, notes } = body;

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'path required' }, { status: 400 });
    }
    if (!path.startsWith(MEDIA_PREFIX)) {
      return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
    }

    const bucket = getAdminStorage();
    const file = bucket.file(path);
    await file.setMetadata({
      metadata: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags.join(',') : String(tags) } : {}),
        ...(notes !== undefined ? { notes: String(notes) } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/media]', err);
    return NextResponse.json({ success: false, error: 'Failed to update metadata' }, { status: 500 });
  }
}
