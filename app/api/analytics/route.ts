import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/analytics — Summary
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '7');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, allAds, adStats, contentCount, dailyData, hourlyData, allContent] = await Promise.all([
      db.analyticsEvent.groupBy({ since }),
      db.advertisement.findMany({ orderBy: [{ impressions: 'desc' }] }),
      db.advertisement.aggregate(),
      db.content.count({ where: { isApproved: true } }),
      db.analyticsEvent.dailyBreakdown(since),
      db.analyticsEvent.hourlyBreakdown(since),
      db.content.findMany({ where: { isApproved: true } }),
    ]);

    // Per-ad CR%
    const topAds = allAds.slice(0, 5).map((ad: Record<string, unknown>) => ({
      ...ad,
      cr: (ad.impressions as number) > 0
        ? Math.round(((ad.completions as number) / (ad.impressions as number)) * 100)
        : 0,
    }));
    const adPerformance = allAds.map((ad: Record<string, unknown>) => ({
      id: ad.id,
      title: ad.title,
      impressions: ad.impressions as number ?? 0,
      completions: ad.completions as number ?? 0,
      totalPlayTime: ad.totalPlayTime as number ?? 0,
      cr: (ad.impressions as number) > 0
        ? +((((ad.completions as number) / (ad.impressions as number)) * 100).toFixed(1))
        : 0,
    }));

    // Platform + sentiment breakdown from content
    const platformMap: Record<string, number> = {};
    const sentimentMap: Record<string, number> = {};
    for (const c of allContent) {
      const p = (c.platform as string) ?? 'unknown';
      platformMap[p] = (platformMap[p] ?? 0) + 1;
      const s = (c.sentiment as string) ?? 'neutral';
      sentimentMap[s] = (sentimentMap[s] ?? 0) + 1;
    }
    const platformBreakdown = Object.entries(platformMap).map(([platform, count]) => ({ platform, count }));
    const contentSentiment = Object.entries(sentimentMap).map(([sentiment, count]) => ({ sentiment, count }));

    const summary = {
      totalImpressions: adStats._sum.impressions ?? 0,
      totalPlayTime: adStats._sum.totalPlayTime ?? 0,
      totalCompletions: adStats._sum.completions ?? 0,
      totalContentViews: events.find((e) => e.type === 'content_view')?._count.id ?? 0,
      totalQRScans: events.find((e) => e.type === 'qr_scan')?._count.id ?? 0,
      approvedContent: contentCount,
      topAds,
      adPerformance,
      dailyData,
      hourlyData,
      platformBreakdown,
      contentSentiment,
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// POST /api/analytics — Log event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, advertisementId, contentId, screenId, duration, metadata } = body;

    if (!type) {
      return NextResponse.json({ success: false, error: 'type is required' }, { status: 400 });
    }

    const event = await db.analyticsEvent.create({
      type,
      advertisementId: advertisementId ?? null,
      contentId: contentId ?? null,
      screenId: screenId ?? null,
      duration: duration ? Number(duration) : null,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    });

    // Update ad stats
    if (advertisementId) {
      if (type === 'ad_impression') {
        await db.advertisement.incrementStats(advertisementId, 'impressions', duration ?? 0);
      } else if (type === 'ad_complete') {
        await db.advertisement.incrementStats(advertisementId, 'completions');
      }
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log event' }, { status: 500 });
  }
}
