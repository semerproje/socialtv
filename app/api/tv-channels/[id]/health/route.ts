import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';
import { checkChannelHealth } from '@/lib/channel-health';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(_req, 'tv-health-single', 40, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(_req, 'viewer');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const channel = await db.liveChannel.findUnique(id);

  if (!channel) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const title = typeof channel.title === 'string' ? channel.title : 'Unknown Channel';
  const provider = typeof channel.provider === 'string' ? channel.provider : 'other';
  const result = await checkChannelHealth(channel as any);

  await db.systemLog.create({
    level: result.state === 'healthy' ? 'info' : result.state === 'auth-required' ? 'warn' : 'error',
    source: 'tv-health',
    message: `${title}: ${result.message}`,
    metadataJson: JSON.stringify({ channelId: channel.id, provider, health: result }),
  });

  await db.channelHealthLog.create({
    channelId: String(channel.id),
    channelTitle: title,
    provider,
    state: result.state,
    checkedAt: result.checkedAt,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode ?? null,
    message: result.message,
    target: result.target ?? null,
  });
  await db.channelHealthDailyAggregate.recordCheck({
    channelId: String(channel.id),
    channelTitle: title,
    provider,
    state: result.state,
    checkedAt: result.checkedAt,
    latencyMs: result.latencyMs,
  });

  return NextResponse.json({ success: true, data: result, channel });
}