import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/ads — List all ads
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const ads = await db.advertisement.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: ads });
  } catch (error) {
    console.error('GET /api/ads error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ads' }, { status: 500 });
  }
}

// POST /api/ads — Create new ad
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ads-post', 30, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    const {
      title, description, type, content, thumbnailUrl,
      duration = 15, priority = 5, isActive = true,
      startDate, endDate, scheduleJson,
      backgroundColor, textColor, accentColor,
      aiGenerated = false, aiPrompt,
      targetImpressions,
      maxPerHour, maxPerDay, cooldownSeconds,
    } = body;

    if (!title || !type || !content) {
      return NextResponse.json(
        { success: false, error: 'title, type ve content zorunludur' },
        { status: 400 },
      );
    }

    const ad = await db.advertisement.create({
      data: {
        title, description, type, content, thumbnailUrl,
        duration: Number(duration),
        priority: Number(priority),
        isActive,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        scheduleJson,
        backgroundColor, textColor, accentColor,
        aiGenerated, aiPrompt,
        ...(targetImpressions ? { targetImpressions: Number(targetImpressions) } : {}),
        ...(maxPerHour != null ? { maxPerHour: Number(maxPerHour) } : {}),
        ...(maxPerDay != null ? { maxPerDay: Number(maxPerDay) } : {}),
        ...(cooldownSeconds != null ? { cooldownSeconds: Number(cooldownSeconds) } : {}),
      },
    });

    return NextResponse.json({ success: true, data: ad }, { status: 201 });
  } catch (error) {
    console.error('POST /api/ads error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create ad' }, { status: 500 });
  }
}
