import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET /api/notifications?unread=true&limit=30
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';
    const limitN = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30'), 100);

    let q = adminDb.collection('notifications').orderBy('createdAt', 'desc').limit(limitN) as FirebaseFirestore.Query;
    if (unreadOnly) q = q.where('isRead', '==', false);

    const snap = await q.get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: (d.data().createdAt?.toDate?.() ?? new Date()).toISOString() }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[notifications GET]', err);
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
  }
}

// POST /api/notifications — create a notification (ops only)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'ops');
  if (!auth.ok) return auth.response;

  const rl = enforceRateLimit(req, 'notifications-post', 60, 60_000);
  if (rl) return rl;

  try {
    const body = await req.json() as Record<string, unknown>;
    const { type, title, body: bodyText, severity, metadata, link } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    }

    const ref = await adminDb.collection('notifications').add({
      type: type ?? 'info',
      title: (title as string).trim(),
      body: bodyText ?? '',
      severity: severity ?? 'info',
      isRead: false,
      metadata: metadata ?? {},
      link: link ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (err) {
    console.error('[notifications POST]', err);
    return NextResponse.json({ success: false, error: 'Create failed' }, { status: 500 });
  }
}

// PATCH /api/notifications?id=xxx — mark as read / update
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');

  try {
    const body = await req.json() as Record<string, unknown>;

    if (id) {
      await adminDb.collection('notifications').doc(id).set(
        { isRead: body.isRead ?? true, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } else {
      // Mark ALL unread as read
      const snap = await adminDb.collection('notifications').where('isRead', '==', false).get();
      const batch = adminDb.batch();
      snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications PATCH]', err);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

// DELETE /api/notifications?id=xxx  OR  ?olderThan=7  (ops clears old notifications)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, 'ops');
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  const olderThan = req.nextUrl.searchParams.get('olderThan'); // days

  try {
    if (id) {
      await adminDb.collection('notifications').doc(id).delete();
    } else if (olderThan) {
      const days = parseInt(olderThan);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const snap = await adminDb.collection('notifications')
        .where('createdAt', '<', cutoff)
        .limit(500)
        .get();
      const batch = adminDb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return NextResponse.json({ success: true, deleted: snap.size });
    } else {
      return NextResponse.json({ success: false, error: 'id or olderThan required' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications DELETE]', err);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}
