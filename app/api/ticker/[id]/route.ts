import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, 'ticker-put', 40, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const ticker = await db.tickerMessage.update(id, body);
    return NextResponse.json({ success: true, data: ticker });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, 'ticker-delete', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await db.tickerMessage.delete(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
