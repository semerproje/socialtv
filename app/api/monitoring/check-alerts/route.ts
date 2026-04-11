import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST /api/monitoring/check-alerts
// Called by a scheduler (e.g. every 5 min). No user auth needed — uses a shared secret.
// For manual calls from admin, plain POST also works (rate-limited).
export async function POST(req: NextRequest) {
  // Shared-secret check for scheduler calls
  const secret = req.headers.get('x-alert-secret');
  const expectedSecret = process.env.ALERT_SECRET;
  const isSchedulerCall = expectedSecret && secret === expectedSecret;

  if (!isSchedulerCall) {
    // Allow manual calls from admin (rate-limited, no auth required for internal service)
    const rl = enforceRateLimit(req, 'check-alerts', 12, 60_000);
    if (rl) return rl;
  }

  const now = Date.now();
  const alerts: Array<{ type: string; title: string; body: string; severity: string; metadata: Record<string, unknown>; link?: string }> = [];

  try {
    // ── 1. Offline Screens ────────────────────────────────────────────────────
    const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const screensSnap = await adminDb.collection('screens').get();
    const screensChecked: string[] = [];

    for (const docSnap of screensSnap.docs) {
      const screen = docSnap.data();
      const lastPing = screen.lastPing?.toDate?.()?.getTime?.() ?? 0;
      const isOnline = screen.isOnline ?? false;

      // Only alert if screen was previously online and has gone silent
      if (isOnline && lastPing > 0 && now - lastPing > OFFLINE_THRESHOLD_MS) {
        screensChecked.push(docSnap.id);

        // Check if we already have an unread offline alert for this screen
        const existing = await adminDb.collection('notifications')
          .where('type', '==', 'screen_offline')
          .where('isRead', '==', false)
          .where('metadata.screenId', '==', docSnap.id)
          .limit(1)
          .get();

        if (existing.empty) {
          alerts.push({
            type: 'screen_offline',
            title: `📴 "${screen.name ?? 'Ekran'}" çevrimdışı`,
            body: `Ekran 5 dakikadan fazladır ping atmıyor.`,
            severity: 'error',
            metadata: { screenId: docSnap.id, screenName: screen.name ?? '' },
            link: '/admin/screens',
          });
        }
      }
    }

    // ── 2. Unhealthy Channels ─────────────────────────────────────────────────
    const UNHEALTHY_THRESHOLD = 3; // consecutive failures
    const channelsSnap = await adminDb.collection('live_channels')
      .where('isActive', '==', true)
      .get();

    for (const docSnap of channelsSnap.docs) {
      const ch = docSnap.data();
      const consecutiveFails = ch.consecutiveFails ?? 0;

      if (consecutiveFails >= UNHEALTHY_THRESHOLD) {
        const existing = await adminDb.collection('notifications')
          .where('type', '==', 'channel_unhealthy')
          .where('isRead', '==', false)
          .where('metadata.channelId', '==', docSnap.id)
          .limit(1)
          .get();

        if (existing.empty) {
          alerts.push({
            type: 'channel_unhealthy',
            title: `📺 "${ch.title ?? 'Kanal'}" sağlıksız`,
            body: `Kanal ${consecutiveFails} ardışık health check başarısız.`,
            severity: 'warning',
            metadata: { channelId: docSnap.id, channelTitle: ch.title ?? '', consecutiveFails },
            link: '/admin/monitoring',
          });
        }
      }
    }

    // ── 3. Pending Content ────────────────────────────────────────────────────
    const PENDING_THRESHOLD = 10;
    const pendingSnap = await adminDb.collection('content')
      .where('isApproved', '==', false)
      .count()
      .get();
    const pendingCount = pendingSnap.data().count;

    if (pendingCount >= PENDING_THRESHOLD) {
      const existing = await adminDb.collection('notifications')
        .where('type', '==', 'content_pending')
        .where('isRead', '==', false)
        .limit(1)
        .get();

      if (existing.empty) {
        alerts.push({
          type: 'content_pending',
          title: `🖼️ ${pendingCount} içerik onay bekliyor`,
          body: `İçerik moderasyonu gerekiyor.`,
          severity: 'info',
          metadata: { pendingCount },
          link: '/admin/content',
        });
      }
    }

    // ── Write alerts to Firestore ─────────────────────────────────────────────
    if (alerts.length > 0) {
      const batch = adminDb.batch();
      for (const alert of alerts) {
        const ref = adminDb.collection('notifications').doc();
        batch.set(ref, { ...alert, isRead: false, createdAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      alertsCreated: alerts.length,
      screensChecked: screensChecked.length,
      alerts: alerts.map(a => ({ type: a.type, title: a.title })),
    });
  } catch (err) {
    console.error('[check-alerts]', err);
    return NextResponse.json({ success: false, error: 'Alert check failed' }, { status: 500 });
  }
}

// GET — returns current unread alert counts by type
export async function GET(req: NextRequest) {
  const rl = enforceRateLimit(req, 'check-alerts-get', 30, 60_000);
  if (rl) return rl;

  try {
    const snap = await adminDb.collection('notifications')
      .where('isRead', '==', false)
      .get();

    const counts: Record<string, number> = {};
    for (const d of snap.docs) {
      const t = d.data().type ?? 'info';
      counts[t] = (counts[t] ?? 0) + 1;
    }

    return NextResponse.json({ success: true, total: snap.size, byType: counts });
  } catch (err) {
    console.error('[check-alerts GET]', err);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
