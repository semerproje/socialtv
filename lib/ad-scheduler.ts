import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { isAdActiveNow } from '@/lib/utils';
import type { Advertisement } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

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
const FREQ_COLLECTION = 'ad_frequency_state';

function buildScope(adId: string, screenId?: string): string {
  return screenId ? `${adId}:${screenId}` : `${adId}:global`;
}

function buildFreqDocId(adId: string, scope: string): string {
  return `${adId}__${scope.replace(/[^a-zA-Z0-9:_-]/g, '_')}`;
}

function getHourBucket(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
}

function getDayBucket(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function canServeWithState(ad: AdLike, state: FrequencyState | undefined, nowMs: number, hourBucket: string, dayBucket: string): boolean {
  const maxPerHour = Number(ad.maxPerHour ?? 0);
  const maxPerDay = Number(ad.maxPerDay ?? 0);
  const cooldownSeconds = Number(ad.cooldownSeconds ?? 0);
  if (maxPerHour <= 0 && maxPerDay <= 0 && cooldownSeconds <= 0) return true;

  const effectiveHourCount = state?.hourBucket === hourBucket ? state.hourCount : 0;
  const effectiveDayCount = state?.dayBucket === dayBucket ? state.dayCount : 0;
  const lastShownAt = state?.lastShownAt ?? 0;

  if (cooldownSeconds > 0 && nowMs - lastShownAt < cooldownSeconds * 1000) return false;
  if (maxPerHour > 0 && effectiveHourCount >= maxPerHour) return false;
  if (maxPerDay > 0 && effectiveDayCount >= maxPerDay) return false;
  return true;
}

async function readFrequencyStateBatch(ads: AdLike[], screenId?: string): Promise<Map<string, FrequencyState>> {
  const out = new Map<string, FrequencyState>();
  const candidates = ads.filter((ad) => Number(ad.maxPerHour ?? 0) > 0 || Number(ad.maxPerDay ?? 0) > 0 || Number(ad.cooldownSeconds ?? 0) > 0);
  if (candidates.length === 0) return out;

  try {
    const refs = candidates.map((ad) => {
      const adId = String(ad.id ?? '');
      const scope = buildScope(adId, screenId);
      const id = buildFreqDocId(adId, scope);
      return adminDb.collection(FREQ_COLLECTION).doc(id);
    });
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as Record<string, unknown>;
      const adId = String(data.adId ?? '');
      const scope = String(data.scope ?? '');
      if (!adId || !scope) return;
      out.set(`${adId}:${scope}`, {
        hourBucket: String(data.hourBucket ?? ''),
        dayBucket: String(data.dayBucket ?? ''),
        hourCount: Number(data.hourCount ?? 0),
        dayCount: Number(data.dayCount ?? 0),
        lastShownAt: Number(data.lastShownAt ?? 0),
      });
    });
  } catch {
    // Fallback: keep using in-memory counters when Firestore isn't reachable.
  }

  return out;
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

async function markAdServedPersistent(ad: AdLike, screenId?: string): Promise<void> {
  const adId = String(ad.id ?? '');
  if (!adId) return;
  const scope = buildScope(adId, screenId);
  const ref = adminDb.collection(FREQ_COLLECTION).doc(buildFreqDocId(adId, scope));
  const now = new Date();
  const nowMs = now.getTime();
  const hourBucket = getHourBucket(now);
  const dayBucket = getDayBucket(now);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data() as Record<string, unknown>) : {};
      const prevHourBucket = String(current.hourBucket ?? '');
      const prevDayBucket = String(current.dayBucket ?? '');
      const prevHourCount = Number(current.hourCount ?? 0);
      const prevDayCount = Number(current.dayCount ?? 0);

      tx.set(ref, {
        adId,
        scope,
        hourBucket,
        dayBucket,
        hourCount: prevHourBucket === hourBucket ? prevHourCount + 1 : 1,
        dayCount: prevDayBucket === dayBucket ? prevDayCount + 1 : 1,
        lastShownAt: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch {
    // Fallback to in-memory tracking if transaction fails.
    markAdServed(ad, screenId);
  }
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

  const now = new Date();
  const nowMs = now.getTime();
  const hourBucket = getHourBucket(now);
  const dayBucket = getDayBucket(now);

  const preFiltered = (ads as AdLike[]).filter((ad) =>
    isAdActiveNow(ad as unknown as Parameters<typeof isAdActiveNow>[0])
      && ad.id !== opts.excludeId,
  );
  const persistedStates = await readFrequencyStateBatch(preFiltered, opts.screenId);

  const activeAds = preFiltered.filter((ad) => {
    const adId = String(ad.id ?? '');
    const scope = buildScope(adId, opts.screenId);
    const persisted = persistedStates.get(`${adId}:${scope}`);
    const memory = serverFreqTracker.get(scope);
    const state = persisted ?? memory;
    return canServeWithState(ad, state, nowMs, hourBucket, dayBucket);
  });

  if (activeAds.length === 0) return null;

  const totalWeight = activeAds.reduce((sum, ad) => sum + (ad.priority as number), 0);
  let random = Math.random() * totalWeight;

  for (const ad of activeAds) {
    random -= (ad.priority as number);
    if (random <= 0) {
      if (opts.consume) await markAdServedPersistent(ad, opts.screenId);
      return ad as unknown as Advertisement;
    }
  }

  if (opts.consume) await markAdServedPersistent(activeAds[0], opts.screenId);
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
