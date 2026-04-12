import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ── GET /api/tv-channels/epg?channelId=X&date=YYYY-MM-DD ─────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const date = searchParams.get('date');

  if (!channelId) return NextResponse.json({ error: 'channelId gerekli' }, { status: 400 });

  try {
    let query = adminDb.collection('tv_epg').where('channelId', '==', channelId);
    if (date) query = query.where('date', '==', date) as typeof query;

    const snap = await query.orderBy('startTime', 'asc').get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ data: entries });
  } catch (err: any) {
    console.error('[EPG GET]', err);
    return NextResponse.json({ error: err.message ?? 'Sunucu hatası' }, { status: 500 });
  }
}

// ── POST /api/tv-channels/epg ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req, 'editor');
  if (!authResult.ok) return authResult.response;

  const rl = enforceRateLimit(req, 'epg-write', 60, 60_000);
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const { channelId, title, startTime, endTime, description, date } = body;

  if (!channelId || !title?.trim() || !startTime || !endTime || !date)
    return NextResponse.json({ error: 'channelId, title, startTime, endTime, date gerekli' }, { status: 400 });

  // Validate HH:MM format
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(startTime) || !timeRe.test(endTime))
    return NextResponse.json({ error: 'Geçersiz saat formatı (HH:MM)' }, { status: 400 });

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: 'Geçersiz tarih formatı (YYYY-MM-DD)' }, { status: 400 });

  try {
    const docRef = await adminDb.collection('tv_epg').add({
      channelId,
      title: title.trim(),
      startTime,
      endTime,
      description: description?.trim() ?? '',
      date,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: docRef.id });
  } catch (err: any) {
    console.error('[EPG POST]', err);
    return NextResponse.json({ error: err.message ?? 'Sunucu hatası' }, { status: 500 });
  }
}

// ── DELETE /api/tv-channels/epg?id=X ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin(req, 'editor');
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  try {
    await adminDb.collection('tv_epg').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[EPG DELETE]', err);
    return NextResponse.json({ error: err.message ?? 'Sunucu hatası' }, { status: 500 });
  }
}
