import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/analytics/screens?days=7
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '7');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [screens, screenEvents] = await Promise.all([
      db.screen.findMany(),
      db.analyticsEvent.getByScreen(since),
    ]);

    const data = screens.map((s: Record<string, unknown>) => {
      const sid = s.id as string;
      const events = screenEvents[sid] ?? { impressions: 0, contentViews: 0 };
      const lastSeen = s.lastSeen as string | null | undefined;
      const isOnline = lastSeen
        ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
        : false;
      return {
        screenId: sid,
        screenName: s.name as string,
        layoutType: s.layoutType as string ?? 'unknown',
        isOnline,
        lastSeen: lastSeen ?? null,
        impressionCount: events.impressions,
        contentViewCount: events.contentViews,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/analytics/screens error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch screen analytics' },
      { status: 500 }
    );
  }
}
