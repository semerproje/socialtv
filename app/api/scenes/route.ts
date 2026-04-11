import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

// ─── Scene API ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const snap = await adminDb.collection('scenes').orderBy('createdAt', 'desc').get();
    const scenes = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });
    return NextResponse.json({ success: true, data: scenes });
  } catch (err) {
    console.error('[scenes GET]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  const rl = enforceRateLimit(request, 'scenes-post', 30, 60_000);
  if (rl instanceof NextResponse) return rl;

  try {
    const body = await request.json();
    const { name, icon, color, layout, ticker, ads, youtubePlaylistId, broadcastToGroups } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const doc = await adminDb.collection('scenes').add({
      name: name.trim(),
      icon: icon ?? '🎭',
      color: color ?? '#6366f1',
      layout: layout ?? 'default',
      ticker: ticker ?? { active: true },
      ads: ads ?? { mode: 'normal' },
      youtubePlaylistId: youtubePlaylistId ?? null,
      broadcastToGroups: broadcastToGroups ?? [],
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: doc.id }, { status: 201 });
  } catch (err) {
    console.error('[scenes POST]', err);
    return NextResponse.json({ success: false, error: 'Create failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  try {
    const body = await request.json();
    // Strip undefined/null fields we don't want to overwrite
    const updates: Record<string, unknown> = {};
    const allowed = ['name', 'icon', 'color', 'layout', 'ticker', 'ads', 'youtubePlaylistId', 'broadcastToGroups'];
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    await adminDb.collection('scenes').doc(id).set(updates, { merge: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenes PATCH]', err);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request, 'ops');
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  try {
    await adminDb.collection('scenes').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenes DELETE]', err);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}
