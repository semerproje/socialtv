import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const limit = Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? '200'));
    const channelId = req.nextUrl.searchParams.get('channelId') ?? undefined;
    const provider = req.nextUrl.searchParams.get('provider') ?? undefined;
    const days = Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? '7'));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const summary = req.nextUrl.searchParams.get('summary') === '1';

    if (summary) {
      const rows = await db.channelHealthDailyAggregate.findMany({
        where: {
          ...(channelId ? { channelId } : {}),
          ...(provider ? { provider } : {}),
          since: since.toISOString().slice(0, 10),
        },
        take: limit,
      });
      return NextResponse.json({ success: true, data: rows });
    }

    const logs = await db.channelHealthLog.findMany({
      where: {
        ...(channelId ? { channelId } : {}),
        ...(provider ? { provider } : {}),
        since,
      },
      take: limit,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Monitoring channel health GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch channel health history' }, { status: 500 });
  }
}