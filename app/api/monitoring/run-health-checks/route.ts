import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { checkChannelHealth } from '@/lib/channel-health';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'run-health-checks', 6, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'ops');
  if (!auth.ok) return auth.response;

  try {
    const channels = await db.liveChannel.findMany({ where: { isActive: true } });
    const results = await Promise.all(
      (channels as any[]).map(async (rawChannel) => {
        const channel = rawChannel as any;
        const result = await checkChannelHealth(channel);
        await db.systemLog.create({
          level: result.state === 'healthy' ? 'info' : result.state === 'auth-required' ? 'warn' : 'error',
          source: 'tv-health-batch',
          message: `${String(channel.title ?? 'Unknown Channel')}: ${result.message}`,
          metadataJson: JSON.stringify({ channelId: String(channel.id ?? ''), provider: String(channel.provider ?? 'other'), health: result }),
        });
        await db.channelHealthLog.create({
          channelId: String(channel.id ?? ''),
          channelTitle: String(channel.title ?? 'Unknown Channel'),
          provider: String(channel.provider ?? 'other'),
          state: result.state,
          checkedAt: result.checkedAt,
          latencyMs: result.latencyMs,
          statusCode: result.statusCode ?? null,
          message: result.message,
          target: result.target ?? null,
        });
        await db.channelHealthDailyAggregate.recordCheck({
          channelId: String(channel.id ?? ''),
          channelTitle: String(channel.title ?? 'Unknown Channel'),
          provider: String(channel.provider ?? 'other'),
          state: result.state,
          checkedAt: result.checkedAt,
          latencyMs: result.latencyMs,
        });
        return { channelId: channel.id, title: channel.title, ...result };
      })
    );

    return NextResponse.json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('Run health checks error:', error);
    return NextResponse.json({ success: false, error: 'Failed to run health checks' }, { status: 500 });
  }
}