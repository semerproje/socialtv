import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

// GET /api/ads/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const ad = await db.advertisement.findUnique(id);
    if (!ad) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: ad });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch ad' }, { status: 500 });
  }
}

// PUT /api/ads/[id]
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, 'ads-put', 40, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const {
      title, description, type, content, thumbnailUrl,
      duration, priority, isActive,
      startDate, endDate, scheduleJson,
      backgroundColor, textColor, accentColor,
    } = body;

    const ad = await db.advertisement.update(id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(content !== undefined && { content }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(isActive !== undefined && { isActive }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(scheduleJson !== undefined && { scheduleJson }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(textColor !== undefined && { textColor }),
        ...(accentColor !== undefined && { accentColor }),
    });

    return NextResponse.json({ success: true, data: ad });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update ad' }, { status: 500 });
  }
}

// DELETE /api/ads/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, 'ads-delete', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await db.advertisement.delete(id);
    return NextResponse.json({ success: true, message: 'Ad deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete ad' }, { status: 500 });
  }
}
