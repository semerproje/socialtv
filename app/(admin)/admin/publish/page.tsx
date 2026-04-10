'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ScreenData, LayoutType, ScheduleEvent, LiveChannel } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'instagram' | 'tiktok' | 'youtube' | 'content' | 'announcement';

interface ContentItem {
  id: string;
  kind: 'instagram' | 'youtube' | 'content';
  platform?: string;
  title: string;
  thumbnailUrl?: string;
  author?: string;
  authorHandle?: string;
  isApproved?: boolean;
  isFeatured?: boolean;
  stats?: { likes?: number; comments?: number; views?: number };
  raw: Record<string, unknown>;
}

interface BroadcastHistoryEntry {
  id: string;
  event: string;
  label: string;
  targetLabel: string;
  sentAt: Date;
}

interface EnrichedScreen extends ScreenData {
  sseInfo?: { connectedAt: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformColor(p: string): string {
  const map: Record<string, string> = {
    instagram: 'text-pink-400 bg-pink-500/15 border-pink-500/25',
    tiktok: 'text-white bg-white/10 border-white/20',
    twitter: 'text-sky-400 bg-sky-500/15 border-sky-500/25',
    youtube: 'text-red-400 bg-red-500/15 border-red-500/25',
    custom: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25',
    announcement: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
  };
  return map[p] ?? 'text-white/50 bg-white/5 border-white/10';
}

function platformLabel(p: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    twitter: 'Twitter/X',
    youtube: 'YouTube',
    custom: 'Özel',
    announcement: 'Duyuru',
  };
  return map[p] ?? p;
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Quick-add TikTok Modal ───────────────────────────────────────────────────

function AddTikTokModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchPreview = async () => {
    if (!url.trim() || !url.includes('tiktok.com')) {
      toast.error('Geçerli bir TikTok URL girin');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/social/tiktok?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.success) setPreview(data.data);
      else toast.error('TikTok bilgisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await fetch('/api/social/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          author: preview.author,
          authorHandle: preview.authorHandle,
          title: preview.title,
          thumbnailUrl: preview.thumbnailUrl,
          isApproved: true,
        }),
      });
      if (res.ok) {
        toast.success('TikTok içeriği eklendi');
        onAdded();
        onClose();
      } else {
        toast.error('İçerik eklenemedi');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: '#0f1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-4">🎵 TikTok Video Ekle</h3>
        <div className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/..."
            className="input flex-1 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && fetchPreview()}
          />
          <button onClick={fetchPreview} disabled={loading} className="btn-secondary text-sm">
            {loading ? '…' : 'Getir'}
          </button>
        </div>

        {preview && (
          <div className="rounded-xl border border-white/10 overflow-hidden mb-4">
            {preview.thumbnailUrl && (
              <img src={preview.thumbnailUrl} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-3">
              <p className="text-white/60 text-xs font-medium mb-1">@{preview.authorHandle}</p>
              <p className="text-white text-sm line-clamp-2">{preview.title}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button
            onClick={handleImport}
            disabled={!preview || importing}
            className="btn-primary flex-1"
          >
            {importing ? 'Ekleniyor…' : 'Kütüphaneye Ekle'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Quick-add Announcement Modal ─────────────────────────────────────────────

function AddAnnouncementModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) { toast.error('Metin gerekli'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'announcement',
          author: author || 'Yönetim',
          text,
          mediaUrl: mediaUrl || undefined,
          isApproved: true,
          isFeatured: false,
        }),
      });
      if (res.ok) {
        toast.success('Duyuru eklendi');
        onAdded();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: '#0f1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-4">📢 Yeni Duyuru</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Duyuran</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Yönetim" className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Mesaj *</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="input w-full text-sm resize-none"
              placeholder="Duyuru metnini girin…"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Görsel URL (opsiyonel)</label>
            <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." className="input w-full text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Kaydediliyor…' : 'Yayınla'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────

function BroadcastModal({
  item,
  screens,
  onClose,
}: {
  item: ContentItem;
  screens: ScreenData[];
  onClose: () => void;
}) {
  const [targetScreenId, setTargetScreenId] = useState<string>('all');
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    setSending(true);
    try {
      const screenIds = targetScreenId === 'all' ? screens.map((s) => s.id) : [targetScreenId];
      let event = '';
      let payload: Record<string, unknown> = {};

      if (item.kind === 'youtube') {
        event = 'play_youtube';
        payload = { videoId: item.raw.videoId, title: item.title };
      } else if (item.kind === 'instagram') {
        event = 'show_instagram';
        payload = {};
      } else {
        event = 'update_content';
        payload = { contentId: item.id };
      }

      const results = await Promise.allSettled(
        screenIds.map((id) =>
          fetch('/api/sync/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, screenId: id, data: payload }),
          })
        )
      );

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      toast.success(`${ok} ekrana gönderildi`);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 p-5 shadow-2xl"
        style={{ background: '#0f1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold mb-1">▶ Ekrana Gönder</h3>
        <p className="text-white/40 text-xs mb-4 truncate">{item.title}</p>

        <div className="space-y-2 mb-4">
          <label
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
              targetScreenId === 'all'
                ? 'border-indigo-500/60 bg-indigo-500/10'
                : 'border-white/10 hover:border-white/20'
            )}
            onClick={() => setTargetScreenId('all')}
          >
            <div className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0', targetScreenId === 'all' ? 'border-indigo-500 bg-indigo-500' : 'border-white/30')} />
            <div>
              <p className="text-white text-sm font-medium">Tüm Ekranlar</p>
              <p className="text-white/40 text-xs">{screens.filter((s) => s.isOnline).length} aktif</p>
            </div>
          </label>
          {screens.map((s) => (
            <label
              key={s.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
                targetScreenId === s.id
                  ? 'border-indigo-500/60 bg-indigo-500/10'
                  : 'border-white/10 hover:border-white/20'
              )}
              onClick={() => setTargetScreenId(s.id)}
            >
              <div className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0', targetScreenId === s.id ? 'border-indigo-500 bg-indigo-500' : 'border-white/30')} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{s.name}</p>
                <p className="text-white/40 text-xs">{s.layoutType} · {s.location ?? '—'}</p>
              </div>
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', s.isOnline ? 'bg-emerald-400' : 'bg-white/20')} />
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button onClick={handleBroadcast} disabled={sending} className="btn-primary flex-1">
            {sending ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({
  item,
  screens,
  onApprove,
  onFeature,
  onDelete,
  onBroadcast,
}: {
  item: ContentItem;
  screens: ScreenData[];
  onApprove: (id: string, v: boolean) => void;
  onFeature: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onBroadcast: (item: ContentItem) => void;
}) {
  const platform = item.kind === 'instagram' ? 'instagram' : item.kind === 'youtube' ? 'youtube' : (item.platform ?? 'custom');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl border border-white/8 overflow-hidden hover:border-white/15 transition-all duration-200"
      style={{ background: '#0f1117' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black/50 overflow-hidden">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-white/10">
            {platform === 'youtube' ? '▶' : platform === 'instagram' ? '◈' : platform === 'tiktok' ? '♪' : '◻'}
          </div>
        )}
        {/* Platform badge */}
        <div className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold border', platformColor(platform))}>
          {platformLabel(platform)}
        </div>
        {/* Featured badge */}
        {item.isFeatured && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            ★ Öne Çıkan
          </div>
        )}
        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onBroadcast(item)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-400 transition-colors"
          >
            ▶ Yayınla
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {item.author && (
          <p className="text-white/50 text-[11px] mb-1 truncate">@{item.authorHandle || item.author}</p>
        )}
        <p className="text-white/90 text-sm line-clamp-2 mb-2">{item.title}</p>
        {item.stats && (
          <div className="flex items-center gap-3 text-[11px] text-white/30 mb-2">
            {item.stats.likes != null && <span>❤️ {fmtN(item.stats.likes)}</span>}
            {item.stats.comments != null && <span>💬 {fmtN(item.stats.comments)}</span>}
            {item.stats.views != null && <span>👁 {fmtN(item.stats.views)}</span>}
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex items-center gap-1.5">
          {item.kind === 'content' && (
            <>
              <button
                onClick={() => onApprove(item.id, !(item.isApproved))}
                className={cn(
                  'flex-1 text-[11px] rounded-lg py-1 border transition-all',
                  item.isApproved
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                    : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                )}
              >
                {item.isApproved ? '✓ Onaylı' : 'Onayla'}
              </button>
              <button
                onClick={() => onFeature(item.id, !(item.isFeatured))}
                className={cn(
                  'px-2 py-1 text-[11px] rounded-lg border transition-all',
                  item.isFeatured
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-white/5 text-white/30 border-white/10 hover:border-white/20'
                )}
                title="Öne Çıkar"
              >
                ★
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="px-2 py-1 text-[11px] rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all"
            title="Sil"
          >
            🗑
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublishPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastItem, setBroadcastItem] = useState<ContentItem | null>(null);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [contentRes, igRes, ytRes, screensRes] = await Promise.allSettled([
        fetch('/api/content?pageSize=50'),
        fetch('/api/instagram?limit=30'),
        fetch('/api/youtube'),
        fetch('/api/screens'),
      ]);

      const allItems: ContentItem[] = [];

      if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
        const d = await contentRes.value.json();
        for (const c of d.data ?? []) {
          allItems.push({
            id: c.id,
            kind: 'content',
            platform: c.platform,
            title: c.text || c.aiSummary || '(içerik yok)',
            author: c.author,
            authorHandle: c.authorHandle,
            thumbnailUrl: c.mediaUrl || c.authorAvatar,
            isApproved: c.isApproved,
            isFeatured: c.isFeatured,
            stats: { likes: c.likes, comments: c.comments, views: c.views },
            raw: c,
          });
        }
      }

      if (igRes.status === 'fulfilled' && igRes.value.ok) {
        const d = await igRes.value.json();
        for (const p of d.data ?? []) {
          allItems.push({
            id: p.id,
            kind: 'instagram',
            platform: 'instagram',
            title: p.caption || p.username,
            author: p.displayName || p.username,
            authorHandle: p.username,
            thumbnailUrl: p.thumbnailUrl || p.mediaUrl,
            isApproved: p.isApproved,
            stats: { likes: p.likeCount, comments: p.commentCount },
            raw: p,
          });
        }
      }

      if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
        const d = await ytRes.value.json();
        for (const v of d.data ?? []) {
          allItems.push({
            id: v.id,
            kind: 'youtube',
            platform: 'youtube',
            title: v.title,
            author: v.channelName,
            thumbnailUrl: v.thumbnailUrl,
            raw: v,
          });
        }
      }

      if (screensRes.status === 'fulfilled' && screensRes.value.ok) {
        const d = await screensRes.value.json();
        setScreens(d.data ?? []);
      }

      setItems(allItems);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Close add menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApprove = async (id: string, value: boolean) => {
    await fetch(`/api/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: value }),
    });
    toast.success(value ? 'Onaylandı' : 'Onay kaldırıldı');
    fetchAll();
  };

  const handleFeature = async (id: string, value: boolean) => {
    await fetch(`/api/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFeatured: value }),
    });
    toast.success(value ? 'Öne çıkarıldı' : 'Kaldırıldı');
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istiyor musunuz?')) return;
    const item = items.find((i) => i.id === id);
    const endpoint = item?.kind === 'instagram' ? `/api/instagram/${id}` : item?.kind === 'youtube' ? `/api/youtube/${id}` : `/api/content/${id}`;
    await fetch(endpoint, { method: 'DELETE' });
    toast.success('Silindi');
    fetchAll();
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'all', label: 'Tümü', icon: '⊞' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'youtube', label: 'YouTube', icon: '▶' },
    { id: 'content', label: 'İçerik', icon: '🖼' },
    { id: 'announcement', label: 'Duyurular', icon: '📢' },
  ];

  const filtered = items.filter((item) => {
    const matchTab =
      tab === 'all' ||
      (tab === 'instagram' && item.platform === 'instagram') ||
      (tab === 'tiktok' && item.platform === 'tiktok') ||
      (tab === 'youtube' && item.kind === 'youtube') ||
      (tab === 'content' && item.kind === 'content' && !['instagram', 'tiktok', 'announcement'].includes(item.platform ?? '')) ||
      (tab === 'announcement' && item.platform === 'announcement');

    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.author ?? '').toLowerCase().includes(q) ||
      (item.authorHandle ?? '').toLowerCase().includes(q);

    return matchTab && matchSearch;
  });

  const onlineScreens = screens.filter((s) => s.isOnline);

  return (
    <div className="flex h-screen overflow-hidden bg-[#030712]">
      {/* ── Left: Screen status panel ── */}
      <aside
        className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#070b12' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <h2 className="text-white font-bold text-sm">📺 Ekranlar</h2>
          <p className="text-white/40 text-xs mt-0.5">{onlineScreens.length} / {screens.length} çevrimiçi</p>
        </div>
        <div className="flex-1 p-3 space-y-2">
          {screens.length === 0 ? (
            <p className="text-white/25 text-xs text-center pt-8">Ekran bulunamadı</p>
          ) : (
            screens.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border p-3 space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: s.isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', s.isOnline ? 'bg-emerald-400' : 'bg-white/15')} />
                  <span className="text-white text-sm font-medium truncate">{s.name}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-white/35 text-[11px] truncate">{s.layoutType}</span>
                  {s.location && <span className="text-white/25 text-[10px] truncate">{s.location}</span>}
                </div>
                {s.isOnline && (
                  <a
                    href={`/screen?screenId=${s.id}`}
                    target="_blank"
                    className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    ↗ Görüntüle
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Schedule link */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <a
            href="/admin/schedule"
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-white/8 text-white/50 hover:text-white hover:border-white/15 transition-all text-sm"
          >
            <span>📅</span>
            <span>Yayın Takvimi</span>
            <span className="ml-auto text-xs">→</span>
          </a>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#070b12' }}
        >
          <div>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Yayın Merkezi
            </h1>
            <p className="text-white/35 text-xs mt-0.5">{items.length} içerik · {onlineScreens.length} aktif ekran</p>
          </div>
          <div className="flex items-center gap-2" ref={addMenuRef}>
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <span>+</span>
                <span>Yeni Ekle</span>
                <span className="text-xs opacity-60">▾</span>
              </button>
              <AnimatePresence>
                {showAddMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/10 shadow-2xl z-30 overflow-hidden"
                    style={{ background: '#0f1117' }}
                  >
                    {[
                      { icon: '🎵', label: 'TikTok Video', action: () => { setShowTikTokModal(true); setShowAddMenu(false); } },
                      { icon: '📸', label: 'Instagram', href: '/admin/instagram' },
                      { icon: '▶', label: 'YouTube', href: '/admin/youtube' },
                      { icon: '📢', label: 'Duyuru', action: () => { setShowAnnouncementModal(true); setShowAddMenu(false); } },
                      { icon: '🖼', label: 'Özel İçerik', href: '/admin/content' },
                    ].map((m, i) => (
                      <button
                        key={i}
                        onClick={m.action ? m.action : () => { window.location.href = m.href!; }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Tabs + Search */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0 overflow-x-auto"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-1 flex-shrink-0">
            {TABS.map((t) => {
              const count = t.id === 'all' ? items.length
                : items.filter((item) =>
                  (t.id === 'instagram' && item.platform === 'instagram') ||
                  (t.id === 'tiktok' && item.platform === 'tiktok') ||
                  (t.id === 'youtube' && item.kind === 'youtube') ||
                  (t.id === 'content' && item.kind === 'content' && !['instagram', 'tiktok', 'announcement'].includes(item.platform ?? '')) ||
                  (t.id === 'announcement' && item.platform === 'announcement')
                ).length;

              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all whitespace-nowrap',
                    tab === t.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-white/40 hover:text-white/70 border border-transparent'
                  )}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {count > 0 && (
                    <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', tab === t.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/10 text-white/30')}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="h-5 w-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ara…"
            className="input text-sm py-1.5 flex-1 min-w-36 max-w-64"
          />
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <p className="text-4xl text-white/10">
                {tab === 'instagram' ? '📸' : tab === 'tiktok' ? '🎵' : tab === 'youtube' ? '▶' : '📋'}
              </p>
              <p className="text-white/30 text-sm">İçerik bulunamadı</p>
              <p className="text-white/15 text-xs">Yeni içerik eklemek için "Yeni Ekle" düğmesini kullanın</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((item) => (
                <ContentCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  screens={screens}
                  onApprove={handleApprove}
                  onFeature={handleFeature}
                  onDelete={handleDelete}
                  onBroadcast={setBroadcastItem}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {broadcastItem && (
          <BroadcastModal item={broadcastItem} screens={screens} onClose={() => setBroadcastItem(null)} />
        )}
        {showTikTokModal && (
          <AddTikTokModal onClose={() => setShowTikTokModal(false)} onAdded={fetchAll} />
        )}
        {showAnnouncementModal && (
          <AddAnnouncementModal onClose={() => setShowAnnouncementModal(false)} onAdded={fetchAll} />
        )}
      </AnimatePresence>
    </div>
  );
}
