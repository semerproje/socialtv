import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const screenId = searchParams.get('screenId') ?? undefined;
  const activeOnly = searchParams.get('active') === '1';

  try {
    const events = await db.scheduleEvent.findMany({
      where: {
        ...(screenId ? { screenId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
    });
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'schedule-post', 30, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { title, description, screenId, type, contentRef, sourceRef, layoutType, payload, startAt, endAt, recurrence, daysOfWeek, priority, autoSwitch, color } = body;

    if (!title || !type || !startAt) {
      return NextResponse.json({ success: false, error: 'title, type and startAt are required' }, { status: 400 });
    }

    const event = await db.scheduleEvent.create({
      title,
      description: description ?? null,
      screenId: screenId ?? null,
      type,
      contentRef: contentRef ?? null,
      sourceRef: sourceRef ?? null,
      layoutType: layoutType ?? null,
      payload: payload ? JSON.stringify(payload) : null,
      startAt,
      endAt: endAt ?? null,
      recurrence: recurrence ?? 'once',
      daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
      priority: priority ?? 'normal',
      autoSwitch: autoSwitch ?? true,
      color: color ?? null,
      isActive: true,
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}
