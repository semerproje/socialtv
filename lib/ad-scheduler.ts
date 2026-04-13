import { db } from '@/lib/db';
import { isAdActiveNow } from '@/lib/utils';
import type { Advertisement } from '@/types';

type AdLike = Record<string, unknown>;

interface FrequencyState {
  hourBucket: string;
  dayBucket: string;
  hourCount: number;
  dayCount: number;
  lastShownAt: number;
}

interface NextAdOptions {
  excludeId?: string;
  screenId?: string;
  consume?: boolean;
}

const serverFreqTracker = new Map<string, FrequencyState>();

function getHourBucket(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
}

function getDayBucket(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function canServeAd(ad: AdLike, screenId?: string): boolean {
  const maxPerHour = Number(ad.maxPerHour ?? 0);
  const maxPerDay = Number(ad.maxPerDay ?? 0);
  const cooldownSeconds = Number(ad.cooldownSeconds ?? 0);
  if (maxPerHour <= 0 && maxPerDay <= 0 && cooldownSeconds <= 0) return true;

  const adId = String(ad.id ?? '');
  if (!adId) return true;
  const scope = screenId ? `${adId}:${screenId}` : `${adId}:global`;
  const now = new Date();
  const nowMs = now.getTime();
  const hourBucket = getHourBucket(now);
  const dayBucket = getDayBucket(now);
  const entry = serverFreqTracker.get(scope) ?? {
    hourBucket,
    dayBucket,
    hourCount: 0,
    dayCount: 0,
    lastShownAt: 0,
  };

  const effectiveHourCount = entry.hourBucket === hourBucket ? entry.hourCount : 0;
  const effectiveDayCount = entry.dayBucket === dayBucket ? entry.dayCount : 0;

  if (cooldownSeconds > 0 && nowMs - entry.lastShownAt < cooldownSeconds * 1000) return false;
  if (maxPerHour > 0 && effectiveHourCount >= maxPerHour) return false;
  if (maxPerDay > 0 && effectiveDayCount >= maxPerDay) return false;
  return true;
}

function markAdServed(ad: AdLike, screenId?: string): void {
  const adId = String(ad.id ?? '');
  if (!adId) return;
  const scope = screenId ? `${adId}:${screenId}` : `${adId}:global`;
  const now = new Date();
  const nowMs = now.getTime();
  const hourBucket = getHourBucket(now);
  const dayBucket = getDayBucket(now);
  const entry = serverFreqTracker.get(scope) ?? {
    hourBucket,
    dayBucket,
    hourCount: 0,
    dayCount: 0,
    lastShownAt: 0,
  };

  serverFreqTracker.set(scope, {
    hourBucket,
    dayBucket,
    hourCount: entry.hourBucket === hourBucket ? entry.hourCount + 1 : 1,
    dayCount: entry.dayBucket === dayBucket ? entry.dayCount + 1 : 1,
    lastShownAt: nowMs,
  });
}

/**
 * Get the next ad to display based on priority and schedule.
 * Uses a weighted round-robin approach: higher priority ads play more often.
 */
export async function getNextAd(options?: string | NextAdOptions): Promise<Advertisement | null> {
  const opts: NextAdOptions = typeof options === 'string' ? { excludeId: options } : (options ?? {});
  const ads = await db.advertisement.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { impressions: 'asc' }],
  });

  const activeAds = (ads as AdLike[]).filter((ad) =>
    isAdActiveNow(ad as unknown as Parameters<typeof isAdActiveNow>[0])
      && ad.id !== opts.excludeId
      && canServeAd(ad, opts.screenId),
  );

  if (activeAds.length === 0) return null;

  const totalWeight = activeAds.reduce((sum, ad) => sum + (ad.priority as number), 0);
  let random = Math.random() * totalWeight;

  for (const ad of activeAds) {
    random -= (ad.priority as number);
    if (random <= 0) {
      if (opts.consume) markAdServed(ad, opts.screenId);
      return ad as unknown as Advertisement;
    }
  }

  if (opts.consume) markAdServed(activeAds[0], opts.screenId);
  return activeAds[0] as unknown as Advertisement;
}

/**
 * Record an analytics event for an ad impression
 */
export async function recordAdImpression(adId: string, durationSeconds?: number) {
  await Promise.all([
    db.analyticsEvent.create({
      type: 'ad_impression',
      advertisementId: adId,
      duration: durationSeconds ?? null,
    }),
    db.advertisement.incrementStats(adId, 'impressions', durationSeconds ?? 0),
  ]);
}

/**
 * Record ad completion
 */
export async function recordAdCompletion(adId: string, duration: number) {
  await Promise.all([
    db.analyticsEvent.create({
      type: 'ad_complete',
      advertisementId: adId,
      duration,
    }),
    db.advertisement.incrementStats(adId, 'completions'),
  ]);
}
