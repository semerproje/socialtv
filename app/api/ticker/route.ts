import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const tickers = await db.tickerMessage.findMany();
    return NextResponse.json({ success: true, data: tickers });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ticker-post', 30, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { text, emoji, isActive = true, priority = 5, color } = body;

    if (!text) {
      return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    }

    const ticker = await db.tickerMessage.create(
      { text, emoji, isActive, priority: Number(priority), color },
    );
    return NextResponse.json({ success: true, data: ticker }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create' }, { status: 500 });
  }
}
