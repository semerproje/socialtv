import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/logs
 * Returns the latest broadcast log entries.
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, 'sync-logs', 30, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const snap = await adminDb
      .collection('broadcast_logs')
      .orderBy('sentAt', 'desc')
      .limit(20)
      .get();

    const data = snap.docs.map((d) => {
      const obj = d.data();
      return {
        id: d.id,
        event: obj.event,
        targetLabel: obj.targetLabel,
        targetCount: obj.targetCount ?? 0,
        data: obj.data ?? {},
        sentAt: obj.sentAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[GET /api/sync/logs]', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 });
  }
}
