import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';
import { checkChannelHealth } from '@/lib/channel-health';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { channelToBroadcastPayload } from '@/lib/live-stream-utils';

export const dynamic = 'force-dynamic';

const FAILOVER_THRESHOLD = 3; // consecutive unreachable checks before switching

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

  // ── Track consecutive failures & auto-failover ────────────────────────────
  const isUnhealthy = result.state === 'unreachable' || result.state === 'degraded';
  const currentFails = typeof channel.consecutiveFails === 'number' ? channel.consecutiveFails : 0;
  const newFails = isUnhealthy ? currentFails + 1 : 0;

  // Update consecutiveFails on the channel document
  await adminDb.collection('live_channels').doc(id).update({
    consecutiveFails: newFails,
    lastHealthCheck: FieldValue.serverTimestamp(),
  });

  // Auto-failover: trigger if threshold reached, failover configured, and not already a failover target
  let failoverTriggered = false;
  if (
    newFails >= FAILOVER_THRESHOLD &&
    channel.autoFailover &&
    channel.backupChannelId &&
    typeof channel.backupChannelId === 'string'
  ) {
    try {
      const backup = await db.liveChannel.findUnique(channel.backupChannelId);
      if (backup && backup.isActive) {
        await fetch(
          new URL('/api/sync/broadcast', _req.url).toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'play_stream',
              data: channelToBroadcastPayload(backup as any),
            }),
          }
        );
        // Reset fail counter after triggering failover
        await adminDb.collection('live_channels').doc(id).update({ consecutiveFails: 0 });
        failoverTriggered = true;

        // Create a notification about the failover
        await adminDb.collection('notifications').add({
          type: 'channel_failover',
          title: `⚡ Otomatik Failover: "${title}"`,
          body: `"${title}" ${FAILOVER_THRESHOLD} ardışık başarısız kontrol sonrası "${backup.title}" yedek kanalına geçildi.`,
          severity: 'warning',
          isRead: false,
          metadata: { channelId: id, backupChannelId: channel.backupChannelId, backupTitle: backup.title },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[health failover]', err);
    }
  }

  await db.systemLog.create({
    level: result.state === 'healthy' ? 'info' : result.state === 'auth-required' ? 'warn' : 'error',
    source: 'tv-health',
    message: `${title}: ${result.message}${failoverTriggered ? ' [FAILOVER TRIGGERED]' : ''}`,
    metadataJson: JSON.stringify({ channelId: channel.id, provider, health: result, consecutiveFails: newFails, failoverTriggered }),
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

  return NextResponse.json({ success: true, data: result, channel, consecutiveFails: newFails, failoverTriggered });
}
