import { db } from '@/lib/db';
import { isAdActiveNow } from '@/lib/utils';
import type { Advertisement } from '@/types';

/**
 * Get the next ad to display based on priority and schedule.
 * Uses a weighted round-robin approach: higher priority ads play more often.
 */
export async function getNextAd(excludeId?: string): Promise<Advertisement | null> {
  const ads = await db.advertisement.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { impressions: 'asc' }],
  });

  const activeAds = (ads as Array<Record<string, unknown>>).filter((ad) =>
    isAdActiveNow(ad as unknown as Parameters<typeof isAdActiveNow>[0]) && ad.id !== excludeId,
  );

  if (activeAds.length === 0) return null;

  const totalWeight = activeAds.reduce((sum, ad) => sum + (ad.priority as number), 0);
  let random = Math.random() * totalWeight;

  for (const ad of activeAds) {
    random -= (ad.priority as number);
    if (random <= 0) return ad as unknown as Advertisement;
  }

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
