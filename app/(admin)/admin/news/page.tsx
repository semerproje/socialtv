'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { NewsItem } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'gundem',    label: 'Gündem',    emoji: '🗞️' },
  { key: 'dunya',     label: 'Dünya',     emoji: '🌍' },
  { key: 'ekonomi',   label: 'Ekonomi',   emoji: '💹' },
  { key: 'teknoloji', label: 'Teknoloji', emoji: '💻' },
  { key: 'spor',      label: 'Spor',      emoji: '⚽' },
  { key: 'eglence',   label: 'Eğlence',   emoji: '🎬' },
  { key: 'bilim',     label: 'Bilim',     emoji: '🔬' },
  { key: 'saglik',    label: 'Sağlık',    emoji: '🏥' },
];

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return `${m}dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}sa önce`;
    return `${Math.floor(h / 24)}g önce`;
  } catch { return ''; }
}

// ─── Action helpers ────────────────────────────────────────────────────────────

async function addToTicker(item: NewsItem): Promise<void> {
  const cat = CATEGORIES.find((c) => c.key === item.category);
  const emoji = cat?.emoji ?? '📰';
  const text = `${item.title} — ${item.source}`;
  const res = await fetch('/api/ticker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, emoji, isActive: true, priority: 8 }),
  });
  if (!res.ok) throw new Error('Ticker eklenemedi');
}

async function sendBreakingNews(item: NewsItem): Promise<void> {
  // 1. Update settings
  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      breaking_headline: item.title,
      breaking_summary: item.description ?? '',
      breaking_source: item.source,
    }),
  });
  // 2. Broadcast layout change
  await fetch('/api/sync/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'change_layout', data: { layoutType: 'breaking_news' } }),
  });
}

async function sendToNewsFocus(item: NewsItem): Promise<void> {
  await fetch('/api/sync/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'overlay_message',
      data: { text: `📰 ${item.title}`, duration: 8, color: '#6366f1' },
    }),
  });
  await fetch('/api/sync/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'change_layout', data: { layoutType: 'news_focus' } }),
  });
}

// ─── News Card ────────────────────────────────────────────────────────────────

function NewsCard({
  item,
  onTicker,
  onBreaking,
  onNewsFocus,
  loadingKey,
}: {
  item: NewsItem;
  onTicker: () => void;
  onBreaking: () => void;
  onNewsFocus: () => void;
  loadingKey: string | null;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-card overflow-hidden flex flex-col gap-0 group"
    >
      {/* Image */}
      {item.imageUrl && (
        <div className="h-36 overflow-hidden flex-shrink-0 relative bg-white/5">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: 'white' }}
          >
            {CATEGORIES.find((c) => c.key === item.category)?.emoji}{' '}
            {CATEGORIES.find((c) => c.key === item.category)?.label}
          </div>
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title */}
        <div className="flex-1">
          <p className="text-tv-text text-sm font-semibold leading-snug line-clamp-3 group-hover:text-white transition-colors">
            {item.title}
          </p>
          {item.description && (
            <p className="text-tv-muted text-xs leading-relaxed line-clamp-2 mt-1.5">{item.description}</p>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2 py-0.5 rounded-full truncate max-w-[140px]">
            {item.source}
          </span>
          <span className="text-tv-muted text-[11px]">{timeAgo(item.pubDate)}</span>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-white/20 hover:text-white/60 transition-colors text-[11px]"
          >
            ↗ Habere git
          </a>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-wrap border-t border-white/5 pt-3">
          <button
            onClick={onTicker}
            disabled={loadingKey === `ticker-${item.id}`}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
          >
            {loadingKey === `ticker-${item.id}` ? '⏳' : '📢'} Ticker
          </button>
          <button
            onClick={onNewsFocus}
            disabled={loadingKey === `focus-${item.id}`}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
            style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', color: '#67e8f9' }}
          >
            {loadingKey === `focus-${item.id}` ? '⏳' : '📺'} Ekrana Gönder
          </button>
          <button
            onClick={onBreaking}
            disabled={loadingKey === `breaking-${item.id}`}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
          >
            {loadingKey === `breaking-${item.id}` ? '⏳' : '🔴'} Son Dakika
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [category, setCategory] = useState('gundem');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshRef = useRef<ReturnType<typeof setInterval>>();

  const fetchNews = useCallback(async (cat: string, isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/news?category=${cat}&limit=24&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success) {
        setNews(json.data ?? []);
        setLastFetchTime(new Date());
      } else {
        toast.error('Haberler alınamadı');
      }
    } catch {
      toast.error('Bağlantı hatası');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setNews([]);
    fetchNews(category);
  }, [category, fetchNews]);

  useEffect(() => {
    if (!autoRefresh) { clearInterval(refreshRef.current); return; }
    refreshRef.current = setInterval(() => fetchNews(category), REFRESH_INTERVAL);
    return () => clearInterval(refreshRef.current);
  }, [autoRefresh, category, fetchNews]);

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setLoadingKey(key);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata oluştu');
    } finally {
      setLoadingKey(null);
    }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? news.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.source.toLowerCase().includes(search.toLowerCase()),
      )
    : news;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text">📰 Google Haberler</h1>
          <p className="text-tv-muted text-sm mt-1">
            Canlı Google News akışı — Ticker, ekran veya Son Dakika olarak yayınla
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lastFetchTime && (
            <span className="text-tv-muted text-xs">
              {lastFetchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} güncellendi
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              autoRefresh
                ? 'bg-emerald-400/15 border-emerald-400/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            {autoRefresh ? '🟢 Otomatik' : '⏸ Durdu'}
          </button>
          <button
            onClick={() => fetchNews(category, true)}
            disabled={refreshing}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold admin-btn-secondary disabled:opacity-50"
          >
            {refreshing ? '⏳ Yükleniyor…' : '↺ Yenile'}
          </button>
        </div>
      </div>

      {/* ── Category tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
              category === cat.key
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-lg shadow-indigo-500/10'
                : 'bg-white/[0.04] border-white/[0.08] text-tv-muted hover:text-tv-text hover:bg-white/[0.07]'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-muted text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Başlık veya kaynak ara…"
            className="w-full admin-input pl-9 text-sm"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-tv-muted text-xs hover:text-tv-text">
            Temizle
          </button>
        )}
        <span className="text-tv-muted text-xs ml-auto">{filtered.length} haber</span>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="admin-card h-64 animate-pulse">
              <div className="h-36 bg-white/[0.04] rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-full" />
                <div className="h-4 bg-white/[0.04] rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="text-5xl opacity-30">📰</span>
          <p className="text-tv-muted">
            {search ? `"${search}" için sonuç bulunamadı` : 'Haber bulunamadı'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                loadingKey={loadingKey}
                onTicker={() =>
                  handleAction(
                    `ticker-${item.id}`,
                    () => addToTicker(item),
                    '✅ Ticker\'a eklendi!',
                  )
                }
                onBreaking={() =>
                  handleAction(
                    `breaking-${item.id}`,
                    () => sendBreakingNews(item),
                    '🔴 Son Dakika yayında!',
                  )
                }
                onNewsFocus={() =>
                  handleAction(
                    `focus-${item.id}`,
                    () => sendToNewsFocus(item),
                    '📺 Ekrana gönderildi!',
                  )
                }
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Quick actions bar ─────────────────────────────────────────────── */}
      <div
        className="admin-card p-4 flex flex-wrap gap-3 items-center"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-tv-text text-sm font-semibold">Toplu İşlemler</p>
          <p className="text-tv-muted text-xs mt-0.5">Tüm haberleri ticker akışına ekle veya news_focus düzenini etkinleştir</p>
        </div>
        <button
          onClick={async () => {
            const top5 = filtered.slice(0, 5);
            for (const item of top5) {
              await addToTicker(item).catch(() => {});
            }
            toast.success(`${top5.length} haber ticker'a eklendi!`);
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}
        >
          📢 İlk 5&apos;i Ticker&apos;a Ekle
        </button>
        <button
          onClick={async () => {
            await fetch('/api/sync/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'change_layout', data: { layoutType: 'news_focus' } }),
            });
            toast.success('News Focus düzeni etkinleştirildi!');
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', color: '#67e8f9' }}
        >
          📺 News Focus Düzenini Aç
        </button>
      </div>
    </div>
  );
}
