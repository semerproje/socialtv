/**
 * lib/db.ts — Firestore data access layer (replaces Prisma)
 *
 * Mirrors the shape Prisma returned so API routes need minimal changes.
 * All timestamps are converted to ISO strings for JSON serialization.
 */
import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** Strip undefined fields so Firestore doesn't reject them */
function clean(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

function serialize(d: FirebaseFirestore.DocumentData & { id?: string }) {
  const out: Record<string, unknown> = { ...d };
  for (const k of Object.keys(out)) {
    const val = out[k];
    if (val instanceof Timestamp) out[k] = val.toDate().toISOString();
  }
  return out;
}

function docToObj(snap: FirebaseFirestore.DocumentSnapshot) {
  if (!snap.exists) return null;
  return serialize({ id: snap.id, ...snap.data()! });
}

function col(name: string) {
  return adminDb.collection(name);
}

// ─── Advertisement ────────────────────────────────────────────────────────────

export const advertisement = {
  async findMany(opts?: { where?: { isActive?: boolean }; orderBy?: unknown[]; take?: number }) {
    let q: FirebaseFirestore.Query = col('advertisements').orderBy('createdAt', 'desc');
    const snap = await q.get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) docs = docs.filter((d) => d.isActive === opts.where!.isActive);
    docs.sort((a, b) => ((b.priority as number) ?? 0) - ((a.priority as number) ?? 0));
    if (opts?.take) docs = docs.slice(0, opts.take);
    return docs;
  },

  async findUnique(id: string) {
    const snap = await col('advertisements').doc(id).get();
    return docToObj(snap);
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('advertisements').doc();
    await ref.set(clean({ ...data, impressions: 0, completions: 0, totalPlayTime: 0, createdAt: now, updatedAt: now }));
    const snap = await ref.get();
    return docToObj(snap)!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('advertisements').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const snap = await col('advertisements').doc(id).get();
    return docToObj(snap)!;
  },

  async delete(id: string) {
    await col('advertisements').doc(id).delete();
  },

  async aggregate() {
    const snap = await col('advertisements').get();
    let impressions = 0, totalPlayTime = 0, completions = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      impressions += data.impressions ?? 0;
      totalPlayTime += data.totalPlayTime ?? 0;
      completions += data.completions ?? 0;
    });
    return { _sum: { impressions, totalPlayTime, completions } };
  },

  async incrementStats(id: string, field: 'impressions' | 'completions', playTime = 0) {
    const update: Record<string, unknown> = { [field]: FieldValue.increment(1) };
    if (field === 'impressions' && playTime) update.totalPlayTime = FieldValue.increment(playTime);
    await col('advertisements').doc(id).update(update);
  },
};

// ─── Content ─────────────────────────────────────────────────────────────────

export const content = {
  async findMany(opts?: {
    where?: { isApproved?: boolean; moderationPassed?: boolean; platform?: string; isFeatured?: boolean };
    orderBy?: unknown[];
    skip?: number;
    take?: number;
  }) {
    const snap = await col('content').orderBy('createdAt', 'desc').get();
    let all = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isApproved !== undefined) all = all.filter((d) => d.isApproved === opts.where!.isApproved);
    if (opts?.where?.moderationPassed !== undefined) all = all.filter((d) => d.moderationPassed === opts.where!.moderationPassed);
    if (opts?.where?.platform) all = all.filter((d) => d.platform === opts.where!.platform);
    if (opts?.where?.isFeatured !== undefined) all = all.filter((d) => d.isFeatured === opts.where!.isFeatured);
    all.sort((a, b) => ((b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)) || ((b.isHighlight ? 1 : 0) - (a.isHighlight ? 1 : 0)));
    if (opts?.take) all = all.slice(opts.skip ?? 0, (opts.skip ?? 0) + opts.take);
    return opts?.skip && !opts?.take ? all.slice(opts.skip) : all;
  },

  async findUnique(id: string) {
    return docToObj(await col('content').doc(id).get());
  },

  async count(opts?: { where?: Record<string, unknown> }) {
    let q: FirebaseFirestore.Query = col('content');
    if (opts?.where?.isApproved !== undefined) q = q.where('isApproved', '==', opts.where.isApproved);
    const snap = await q.count().get();
    return snap.data().count;
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('content').doc();
    await ref.set(clean({ ...data, createdAt: now, updatedAt: now, postedAt: now }));
    return docToObj(await ref.get())!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('content').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('content').doc(id).get())!;
  },

  async delete(id: string) {
    await col('content').doc(id).delete();
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const setting = {
  async findMany() {
    const snap = await col('settings').get();
    return snap.docs.map((d) => ({ id: d.id, key: d.id, value: d.data().value as string, updatedAt: toDate(d.data().updatedAt) }));
  },

  async upsert(key: string, value: string) {
    await col('settings').doc(key).set({ value, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },
};

// ─── TickerMessage ────────────────────────────────────────────────────────────

export const tickerMessage = {
  async findMany(opts?: { where?: { isActive?: boolean; endDate?: unknown } }) {
    let q: FirebaseFirestore.Query = col('tickers').orderBy('createdAt', 'desc');
    const snap = await q.get();
    const now = Date.now();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) docs = docs.filter((d) => d.isActive === opts.where!.isActive);
    if (opts?.where?.endDate) docs = docs.filter((t) => {
      const endDate = t.endDate ? new Date(t.endDate as string).getTime() : null;
      return !endDate || endDate >= now;
    });
    return docs;
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('tickers').doc();
    await ref.set(clean({ ...data, createdAt: now, updatedAt: now }));
    return docToObj(await ref.get())!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('tickers').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('tickers').doc(id).get())!;
  },

  async delete(id: string) {
    await col('tickers').doc(id).delete();
  },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const screen = {
  async findMany(opts?: { include?: { group?: unknown } }) {
    const snap = await col('screens').orderBy('name', 'asc').get();
    const docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.include?.group) {
      const groups = await screenGroup.findMany();
      const groupMap = Object.fromEntries(groups.map((g) => [g.id as string, g]));
      return docs.map((s) => ({ ...s, group: s.groupId ? (groupMap[s.groupId as string] ?? null) : null }));
    }
    return docs;
  },

  async upsert(id: string, data: Record<string, unknown>) {
    const ref = col('screens').doc(id);
    const now = FieldValue.serverTimestamp();
    await ref.set(clean({ ...data, updatedAt: now }), { merge: true });
    const snap = await ref.get();
    if (!snap.data()?.createdAt) await ref.update({ createdAt: now });
    return docToObj(await ref.get())!;
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('screens').doc();
    await ref.set(clean({ ...data, isActive: true, createdAt: now, updatedAt: now }));
    return docToObj(await ref.get())!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('screens').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('screens').doc(id).get())!;
  },

  async delete(id: string) {
    await col('screens').doc(id).delete();
  },
};

// ─── ScreenGroup ───────────────────────────────────────────────────────────────

export const screenGroup = {
  async findMany() {
    const snap = await col('screen_groups').orderBy('name', 'asc').get();
    return snap.docs.map((d) => docToObj(d)!);
  },
};

// ─── YouTubeVideo ─────────────────────────────────────────────────────────────

export const youTubeVideo = {
  async findMany(opts?: { where?: { isActive?: boolean; playlistId?: string }; include?: unknown }) {
    const snap = await col('youtube_videos').orderBy('createdAt', 'asc').get();
    let videos = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) videos = videos.filter((v) => v.isActive === opts.where!.isActive);
    if (opts?.where?.playlistId) videos = videos.filter((v) => v.playlistId === opts.where!.playlistId);
    if (opts?.include) {
      const playlists = await videoPlaylist.findMany();
      const pm = Object.fromEntries(playlists.map((p) => [p.id as string, p]));
      return videos.map((v) => ({ ...v, playlist: v.playlistId ? (pm[v.playlistId as string] ?? null) : null }));
    }
    return videos;
  },

  async upsert(videoId: string, createData: Record<string, unknown>, updateData: Record<string, unknown>) {
    const snap = await col('youtube_videos').where('videoId', '==', videoId).limit(1).get();
    const now = FieldValue.serverTimestamp();
    if (!snap.empty) {
      const ref = snap.docs[0].ref;
      await ref.update(clean({ ...updateData, updatedAt: now }));
      return docToObj(await ref.get())!;
    } else {
      const ref = col('youtube_videos').doc();
      await ref.set(clean({ ...createData, createdAt: now, updatedAt: now }));
      return docToObj(await ref.get())!;
    }
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('youtube_videos').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('youtube_videos').doc(id).get())!;
  },

  async delete(id: string) {
    await col('youtube_videos').doc(id).delete();
  },
};

// ─── VideoPlaylist ────────────────────────────────────────────────────────────

export const videoPlaylist = {
  async findMany(opts?: { where?: { isActive?: boolean } }) {
    const snap = await col('video_playlists').orderBy('createdAt', 'asc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) docs = docs.filter((d) => d.isActive === opts.where!.isActive);
    return docs;
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('video_playlists').doc();
    await ref.set(clean({ ...data, isActive: true, createdAt: now, updatedAt: now }));
    return docToObj(await ref.get())!;
  },

  async delete(id: string) {
    await col('video_playlists').doc(id).delete();
  },
};

// ─── InstagramPost ────────────────────────────────────────────────────────────

export const instagramPost = {
  async findMany(opts?: { where?: { isDisplayed?: boolean; isApproved?: boolean }; orderBy?: unknown[]; take?: number }) {
    const snap = await col('instagram_posts').orderBy('createdAt', 'desc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isDisplayed !== undefined) docs = docs.filter((d) => d.isDisplayed === opts.where!.isDisplayed);
    if (opts?.where?.isApproved !== undefined) docs = docs.filter((d) => d.isApproved === opts.where!.isApproved);
    if (opts?.take) docs = docs.slice(0, opts.take);
    return docs;
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('instagram_posts').doc();
    await ref.set(clean({ ...data, createdAt: now }));
    return docToObj(await ref.get())!;
  },

  async findByInstagramId(instagramId: string) {
    const snap = await col('instagram_posts')
      .where('instagramId', '==', instagramId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return docToObj(snap.docs[0])!;
  },

  async delete(id: string) {
    await col('instagram_posts').doc(id).delete();
  },
};

// ─── AnalyticsEvent ───────────────────────────────────────────────────────────

export const analyticsEvent = {
  async create(data: Record<string, unknown>) {
    const ref = col('analytics').doc();
    await ref.set({ ...data, createdAt: FieldValue.serverTimestamp() });
    return docToObj(await ref.get())!;
  },

  async groupBy(opts: { since: Date }) {
    const snap = await col('analytics').where('createdAt', '>=', Timestamp.fromDate(opts.since)).get();
    const counts: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const t = d.data().type as string;
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({ type, _count: { id: count } }));
  },

  async dailyBreakdown(since: Date) {
    const snap = await col('analytics').where('createdAt', '>=', Timestamp.fromDate(since)).get();
    const map: Record<string, Record<string, number>> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const ts = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      const date = ts.toISOString().slice(0, 10);
      const type = data.type as string;
      if (!map[date]) map[date] = {};
      map[date][type] = (map[date][type] ?? 0) + 1;
    });
    const rows: { date: string; type: string; count: number }[] = [];
    for (const [date, types] of Object.entries(map)) {
      for (const [type, count] of Object.entries(types)) {
        rows.push({ date, type, count });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  },

  async hourlyBreakdown(since: Date) {
    const snap = await col('analytics').where('createdAt', '>=', Timestamp.fromDate(since)).get();
    // map[dayOfWeek][hour] = count
    const map: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.type !== 'ad_impression' && data.type !== 'content_view') return;
      const ts = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      const dow = ts.getDay(); // 0=Sun .. 6=Sat
      const hour = ts.getHours();
      map[dow][hour]++;
    });
    const rows: { dayOfWeek: number; hour: number; count: number }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        rows.push({ dayOfWeek: dow, hour: h, count: map[dow][h] });
      }
    }
    return rows;
  },

  async getByScreen(since: Date) {
    const snap = await col('analytics').where('createdAt', '>=', Timestamp.fromDate(since)).get();
    const screenMap: Record<string, { impressions: number; contentViews: number }> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const sid = data.screenId as string | undefined;
      if (!sid) return;
      if (!screenMap[sid]) screenMap[sid] = { impressions: 0, contentViews: 0 };
      if (data.type === 'ad_impression') screenMap[sid].impressions++;
      if (data.type === 'content_view') screenMap[sid].contentViews++;
    });
    return screenMap;
  },
};

// ─── SystemLog ───────────────────────────────────────────────────────────────

export const systemLog = {
  async findMany(opts?: { where?: { level?: string; source?: string }; take?: number }) {
    const snap = await col('system_logs').orderBy('createdAt', 'desc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.level) docs = docs.filter((d) => d.level === opts.where!.level);
    if (opts?.where?.source) docs = docs.filter((d) => d.source === opts.where!.source);
    if (opts?.take) docs = docs.slice(0, opts.take);
    return docs;
  },

  async create(data: Record<string, unknown>) {
    const ref = col('system_logs').doc();
    await ref.set(clean({ ...data, createdAt: FieldValue.serverTimestamp() }));
    return docToObj(await ref.get())!;
  },
};

// ─── ChannelHealthLog ────────────────────────────────────────────────────────

export const channelHealthLog = {
  async findMany(opts?: { where?: { channelId?: string; provider?: string; state?: string; since?: Date }; take?: number }) {
    const snap = await col('channel_health_logs').orderBy('createdAt', 'desc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.channelId) docs = docs.filter((d) => d.channelId === opts.where!.channelId);
    if (opts?.where?.provider) docs = docs.filter((d) => d.provider === opts.where!.provider);
    if (opts?.where?.state) docs = docs.filter((d) => d.state === opts.where!.state);
    if (opts?.where?.since) docs = docs.filter((d) => new Date(String(d.createdAt)).getTime() >= opts.where!.since!.getTime());
    if (opts?.take) docs = docs.slice(0, opts.take);
    return docs;
  },

  async create(data: Record<string, unknown>) {
    const ref = col('channel_health_logs').doc();
    await ref.set(clean({ ...data, createdAt: FieldValue.serverTimestamp() }));
    return docToObj(await ref.get())!;
  },
};

// ─── ChannelHealthDailyAggregate ────────────────────────────────────────────

export const channelHealthDailyAggregate = {
  async findMany(opts?: { where?: { day?: string; channelId?: string; provider?: string; since?: string }; take?: number }) {
    const snap = await col('channel_health_daily').orderBy('day', 'desc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.day) docs = docs.filter((d) => d.day === opts.where!.day);
    if (opts?.where?.channelId) docs = docs.filter((d) => d.channelId === opts.where!.channelId);
    if (opts?.where?.provider) docs = docs.filter((d) => d.provider === opts.where!.provider);
    if (opts?.where?.since) docs = docs.filter((d) => String(d.day) >= String(opts.where!.since));
    if (opts?.take) docs = docs.slice(0, opts.take);
    return docs;
  },

  async recordCheck(data: {
    channelId: string;
    channelTitle: string;
    provider: string;
    state: string;
    checkedAt: string;
    latencyMs: number;
  }) {
    const day = data.checkedAt.slice(0, 10);
    const id = `${day}__${data.channelId}`;
    const ref = col('channel_health_daily').doc(id);
    const counts = {
      healthyChecks: data.state === 'healthy' ? 1 : 0,
      degradedChecks: data.state === 'degraded' ? 1 : 0,
      authRequiredChecks: data.state === 'auth-required' ? 1 : 0,
      unreachableChecks: data.state === 'unreachable' ? 1 : 0,
    };

    await ref.set(clean({
      day,
      channelId: data.channelId,
      channelTitle: data.channelTitle,
      provider: data.provider,
      totalChecks: FieldValue.increment(1),
      healthyChecks: FieldValue.increment(counts.healthyChecks),
      degradedChecks: FieldValue.increment(counts.degradedChecks),
      authRequiredChecks: FieldValue.increment(counts.authRequiredChecks),
      unreachableChecks: FieldValue.increment(counts.unreachableChecks),
      totalLatencyMs: FieldValue.increment(data.latencyMs),
      lastState: data.state,
      lastCheckedAt: data.checkedAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }), { merge: true });

    return docToObj(await ref.get())!;
  },
};

// ─── ScheduleEvent ────────────────────────────────────────────────────────────

export const scheduleEvent = {
  async findMany(opts?: { where?: { screenId?: string | null; isActive?: boolean }; orderBy?: string }) {
    const snap = await col('schedule_events').orderBy('startAt', 'asc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) docs = docs.filter((d) => d.isActive === opts.where!.isActive);
    if (opts?.where?.screenId !== undefined) {
      docs = docs.filter((d) => d.screenId === opts.where!.screenId || d.screenId === null || d.screenId === undefined);
    }
    return docs;
  },

  async findActive(now: Date) {
    const snap = await col('schedule_events')
      .where('isActive', '==', true)
      .where('startAt', '<=', now.toISOString())
      .get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    docs = docs.filter((d) => !d.endAt || new Date(d.endAt as string) >= now);
    // Filter by recurrence
    const dayOfWeek = now.getDay();
    docs = docs.filter((d) => {
      const rec = (d.recurrence as string) ?? 'once';
      if (rec === 'once') return true;
      if (rec === 'daily') return true;
      if (rec === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
      if (rec === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
      if (rec === 'weekly') {
        const days = (d.daysOfWeek as number[]) ?? [];
        return days.includes(dayOfWeek);
      }
      return true;
    });
    return docs[0] ?? null;
  },

  async findUnique(id: string) {
    return docToObj(await col('schedule_events').doc(id).get());
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('schedule_events').doc();
    await ref.set(clean({ ...data, isActive: true, createdAt: now, updatedAt: now }));
    return docToObj(await ref.get())!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('schedule_events').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('schedule_events').doc(id).get())!;
  },

  async delete(id: string) {
    await col('schedule_events').doc(id).delete();
  },
};

// ─── LiveChannel ─────────────────────────────────────────────────────────────

export const liveChannel = {
  async findMany(opts?: { where?: { isActive?: boolean; provider?: string } }) {
    const snap = await col('live_channels').orderBy('title', 'asc').get();
    let docs = snap.docs.map((d) => docToObj(d)!);
    if (opts?.where?.isActive !== undefined) docs = docs.filter((d) => d.isActive === opts.where!.isActive);
    if (opts?.where?.provider) docs = docs.filter((d) => d.provider === opts.where!.provider);
    return docs;
  },

  async findUnique(id: string) {
    return docToObj(await col('live_channels').doc(id).get());
  },

  async create(data: Record<string, unknown>) {
    const now = FieldValue.serverTimestamp();
    const ref = col('live_channels').doc();
    await ref.set(clean({ ...data, isActive: data.isActive ?? true, createdAt: now, updatedAt: now }));
    return docToObj(await ref.get())!;
  },

  async update(id: string, data: Record<string, unknown>) {
    await col('live_channels').doc(id).update(clean({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    return docToObj(await col('live_channels').doc(id).get())!;
  },

  async delete(id: string) {
    await col('live_channels').doc(id).delete();
  },
};

// ─── Composite export (drop-in for prisma) ────────────────────────────────────

export const db = {
  advertisement,
  content,
  setting,
  tickerMessage,
  screen,
  screenGroup,
  youTubeVideo,
  videoPlaylist,
  instagramPost,
  analyticsEvent,
  systemLog,
  channelHealthLog,
  channelHealthDailyAggregate,
  scheduleEvent,
  liveChannel,
};
