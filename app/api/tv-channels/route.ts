import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';
import { sanitizeLiveChannelInput, validateLiveChannelInput } from '@/lib/live-stream-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;
  try {
    const active = req.nextUrl.searchParams.get('active');
    const provider = req.nextUrl.searchParams.get('provider') ?? undefined;
    const channels = await db.liveChannel.findMany({
      where: {
        ...(active === '1' ? { isActive: true } : {}),
        ...(provider ? { provider } : {}),
      },
    });
    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error('TV channels GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch channels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'tv-channels-post', 20, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const sanitized = sanitizeLiveChannelInput(body);
    const validationError = validateLiveChannelInput(sanitized);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const channel = await db.liveChannel.create({
      ...sanitized,
    });

    return NextResponse.json({ success: true, data: channel }, { status: 201 });
  } catch (error) {
    console.error('TV channels POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create channel' }, { status: 500 });
  }
}