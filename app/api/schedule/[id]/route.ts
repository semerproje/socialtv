import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(_req, 'viewer');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const event = await db.scheduleEvent.findUnique(id);
  if (!event) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: event });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, 'schedule-put', 40, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const body = await req.json();
    if (body.daysOfWeek && Array.isArray(body.daysOfWeek)) {
      body.daysOfWeek = JSON.stringify(body.daysOfWeek);
    }
    if (body.payload && typeof body.payload === 'object') {
      body.payload = JSON.stringify(body.payload);
    }
    const updated = await db.scheduleEvent.update(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(_req, 'schedule-delete', 20, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(_req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    await db.scheduleEvent.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}
