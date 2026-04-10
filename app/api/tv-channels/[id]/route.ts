import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';
import { sanitizeLiveChannelInput, validateLiveChannelInput } from '@/lib/live-stream-utils';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(_req, 'viewer');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const channel = await db.liveChannel.findUnique(id);
  if (!channel) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: channel });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, 'tv-channels-put', 30, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const body = await req.json();
    const current = await db.liveChannel.findUnique(id);
    if (!current) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const sanitized = sanitizeLiveChannelInput({ ...current, ...body });
    const validationError = validateLiveChannelInput(sanitized);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }
    const channel = await db.liveChannel.update(id, sanitized);
    return NextResponse.json({ success: true, data: channel });
  } catch (error) {
    console.error('TV channels PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update channel' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(_req, 'tv-channels-delete', 10, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(_req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    await db.liveChannel.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('TV channels DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete channel' }, { status: 500 });
  }
}