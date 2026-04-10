import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;
  try {
    const take = Math.min(200, Number(req.nextUrl.searchParams.get('limit') ?? '50'));
    const level = req.nextUrl.searchParams.get('level') ?? undefined;
    const source = req.nextUrl.searchParams.get('source') ?? undefined;

    const logs = await db.systemLog.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(source ? { source } : {}),
      },
      take,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Monitoring logs GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'monitoring-logs-post', 60, 60_000);
  if (limited) return limited;
  try {
    const body = await req.json();
    const { level, source, message, metadata } = body;

    if (!source || !message) {
      return NextResponse.json({ success: false, error: 'source and message are required' }, { status: 400 });
    }

    const entry = await db.systemLog.create({
      level: level ?? 'error',
      source,
      message,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error('Monitoring logs POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create log entry' }, { status: 500 });
  }
}