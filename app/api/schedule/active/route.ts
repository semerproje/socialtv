import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attachLiveChannel, resolveActiveScheduleEvent } from '@/lib/schedule-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const screenId = req.nextUrl.searchParams.get('screenId') ?? undefined;
    const [events, channels] = await Promise.all([
      db.scheduleEvent.findMany({ where: { isActive: true } }),
      db.liveChannel.findMany({ where: { isActive: true } }),
    ]);

    const autoSwitchEvents = (events as any[]).filter((event) => event.autoSwitch !== false);
    const event = resolveActiveScheduleEvent(autoSwitchEvents, new Date(), screenId);
    const attached = attachLiveChannel(event as any, channels as any[]);

    return NextResponse.json({ success: true, data: attached.event, channel: attached.channel });
  } catch (error) {
    console.error('Schedule active GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve active schedule' }, { status: 500 });
  }
}