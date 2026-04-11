'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ScreenData, LayoutType, ScheduleEvent, LiveChannel } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface GroupData {
  id: string;
  name: string;
  color?: string;
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

type ModalState =
  | { type: 'none' }
  | { type: 'broadcast'; item: ContentItem }
  | { type: 'broadcast_bulk'; items: ContentItem[] }
  | { type: 'tiktok' }
  | { type: 'announcement' }
  | { type: 'overlay' }
  | { type: 'channel'; channel: LiveChannel }
  | { type: 'layout'; screenId: string; screenName: string }
  | { type: 'countdown' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function platformColor(p: string) {
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

function platformLabel(p: string) {
  const map: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', twitter: 'X/Twitter',
    youtube: 'YouTube', custom: 'Özel', announcement: 'Duyuru',
  };
  return map[p] ?? p;
}

function fmtN(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: string }[] = [
  { value: 'default',         label: 'Varsayılan',     icon: '⊞' },
  { value: 'youtube',         label: 'YouTube',        icon: '▶' },
  { value: 'instagram',       label: 'Instagram',      icon: '📸' },
  { value: 'split_2',         label: "2'li Bölme",     icon: '⊟' },
  { value: 'social_wall',     label: 'Sosyal Duvar',   icon: '⊞' },
  { value: 'markets',         label: 'Piyasalar',      icon: '📈' },
  { value: 'news_focus',      label: 'Haberler',       icon: '📰' },
  { value: 'digital_signage', label: 'Dijital Tabela', icon: '🖥' },
  { value: 'ambient',         label: 'Ambient',        icon: '🌙' },
  { value: 'promo',           label: 'Promosyon',      icon: '✨' },
  { value: 'fullscreen',      label: 'Tam Ekran',      icon: '⛶' },
  { value: 'triple',          label: 'Üçlü',           icon: '⊟' },
  { value: 'portrait',        label: 'Dikey',          icon: '▯' },
  { value: 'breaking_news',   label: 'Son Dakika',     icon: '🔴' },
  { value: 'event_countdown', label: 'Geri Sayım',     icon: '⏳' },
  { value: 'split_scoreboard',label: 'Skorbord',       icon: '⚽' },
];

// ─── Modal Wrapper ───────────────────────────────────────────────────────────

function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: '#0b0f1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── TikTok Modal ─────────────────────────────────────────────────────────────

function AddTikTokModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchPreview = async () => {
    if (!url.includes('tiktok.com')) { toast.error('Geçerli TikTok URL girin'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/social/tiktok?url=${encodeURIComponent(url)}`);
      const d = await res.json();
      if (d.success) setPreview(d.data); else toast.error('TikTok bilgisi alınamadı');
    } finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await fetch('/api/social/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, author: preview.author, authorHandle: preview.authorHandle, title: preview.title, thumbnailUrl: preview.thumbnailUrl, isApproved: true }),
      });
      if (res.ok) { toast.success('TikTok eklendi'); onAdded(); onClose(); }
      else toast.error('Eklenemedi');
    } finally { setImporting(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-4">🎵 TikTok Video Ekle</h3>
      <div className="flex gap-2 mb-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/..." className="input flex-1 text-sm" onKeyDown={(e) => e.key === 'Enter' && fetchPreview()} />
        <button onClick={fetchPreview} disabled={loading} className="btn-secondary text-sm px-4">{loading ? '…' : 'Getir'}</button>
      </div>
      {preview && (
        <div className="rounded-xl border border-white/10 overflow-hidden mb-4">
          {(preview.thumbnailUrl as string) && <img src={preview.thumbnailUrl as string} alt="" className="w-full h-36 object-cover" />}
          <div className="p-3">
            <p className="text-white/50 text-xs mb-1">@{preview.authorHandle as string}</p>
            <p className="text-white text-sm line-clamp-2">{preview.title as string}</p>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleImport} disabled={!preview || importing} className="btn-primary flex-1">{importing ? 'Ekleniyor…' : 'Ekle'}</button>
      </div>
    </ModalWrapper>
  );
}

// ─── Announcement Modal ───────────────────────────────────────────────────────

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
        body: JSON.stringify({ platform: 'announcement', author: author || 'Yönetim', text, mediaUrl: mediaUrl || undefined, isApproved: true, isFeatured: false }),
      });
      if (res.ok) { toast.success('Duyuru yayınlandı'); onAdded(); onClose(); }
    } finally { setSaving(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-4">📢 Yeni Duyuru</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Duyuran</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Yönetim" className="input w-full text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Mesaj <span className="text-indigo-400">*</span></label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="input w-full text-sm resize-none" placeholder="Duyuru metnini girin…" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Görsel URL (opsiyonel)</label>
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" className="input w-full text-sm" />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Kaydediliyor…' : 'Yayınla'}</button>
      </div>
    </ModalWrapper>
  );
}

// ─── Overlay Modal ────────────────────────────────────────────────────────────

function OverlayModal({ screens, onClose, onSent }: { screens: EnrichedScreen[]; onClose: () => void; onSent: (e: BroadcastHistoryEntry) => void }) {
  const [text, setText] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [duration, setDuration] = useState(8);
  const [targetId, setTargetId] = useState('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) { toast.error('Mesaj gerekli'); return; }
    setSending(true);
    try {
      const body: Record<string, unknown> = { event: 'overlay_message', data: { text, color, duration: duration * 1000 } };
      if (targetId !== 'all') body.screenId = targetId;
      const res = await fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success('Mesaj gönderildi');
        onSent({ id: Date.now().toString(), event: 'overlay_message', label: text, targetLabel: targetId === 'all' ? 'Tüm Ekranlar' : screens.find(s => s.id === targetId)?.name ?? targetId, sentAt: new Date() });
        onClose();
      }
    } finally { setSending(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-4">💬 Overlay Mesaj Gönder</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Mesaj <span className="text-indigo-400">*</span></label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="input w-full text-sm resize-none" placeholder="Ekranlarda gösterilecek mesaj…" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1 block">Süre (saniye)</label>
            <input type="number" min={2} max={60} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Renk</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/15" />
              <span className="text-white/40 text-xs font-mono">{color}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Hedef</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input w-full text-sm">
            <option value="all">Tüm Ekranlar</option>
            {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="rounded-xl p-3 border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-white/30 text-xs mb-1">Önizleme</p>
          <div className="rounded-lg p-2.5 text-center text-sm font-bold" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
            {text || 'Mesaj metni burada görünecek'}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleSend} disabled={sending || !text.trim()} className="btn-primary flex-1">{sending ? 'Gönderiliyor…' : '📡 Gönder'}</button>
      </div>
    </ModalWrapper>
  );
}

// ─── Channel Broadcast Modal ──────────────────────────────────────────────────

function ChannelBroadcastModal({ channel, screens, onClose, onSent }: { channel: LiveChannel; screens: EnrichedScreen[]; onClose: () => void; onSent: (e: BroadcastHistoryEntry) => void }) {
  const [targetId, setTargetId] = useState('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        event: 'play_stream',
        data: { title: channel.title, provider: channel.provider, playbackMode: channel.playbackMode, streamUrl: channel.streamUrl, embedUrl: channel.embedUrl, videoId: channel.videoId, logoUrl: channel.logoUrl },
      };
      if (targetId !== 'all') body.screenId = targetId;
      const res = await fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success('Kanal gönderildi');
        onSent({ id: Date.now().toString(), event: 'play_stream', label: channel.title, targetLabel: targetId === 'all' ? 'Tüm Ekranlar' : screens.find(s => s.id === targetId)?.name ?? targetId, sentAt: new Date() });
        onClose();
      }
    } finally { setSending(false); }
  };

  const provClr: Record<string, string> = { youtube: 'text-red-400', bein: 'text-blue-400', tabii: 'text-indigo-400' };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-1">📡 Kanal Yayınla</h3>
      <p className={cn('text-sm mb-4', provClr[channel.provider] ?? 'text-white/50')}>{channel.title}</p>
      <div className="rounded-xl border border-white/8 p-3 mb-4 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <KeyVal label="Sağlayıcı" value={channel.provider} />
        <KeyVal label="Oynatma Modu" value={channel.playbackMode} />
        {channel.category && <KeyVal label="Kategori" value={channel.category} />}
      </div>
      <div className="mb-4">
        <label className="text-xs text-white/50 mb-1.5 block">Hedef Ekran</label>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input w-full text-sm">
          <option value="all">Tüm Ekranlar ({screens.filter(s => s.isOnline).length} aktif)</option>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}{!s.isOnline ? ' (çevrimdışı)' : ''}</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleSend} disabled={sending} className="btn-primary flex-1">{sending ? 'Gönderiliyor…' : '▶ Yayınla'}</button>
      </div>
    </ModalWrapper>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-white/40">{label}</span>
      <span className="text-white/70 capitalize">{value}</span>
    </div>
  );
}

// ─── Layout Picker Modal ──────────────────────────────────────────────────────

function LayoutPickerModal({ screenId, screenName, onClose, onChanged }: { screenId: string; screenName: string; onClose: () => void; onChanged: () => void }) {
  const [selected, setSelected] = useState<LayoutType | null>(null);
  const [sending, setSending] = useState(false);

  const handleApply = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await fetch('/api/sync/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'change_layout', screenId, data: { layoutType: selected } }),
      });
      await fetch(`/api/screens?id=${screenId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutType: selected }),
      });
      toast.success(`Layout: ${selected}`);
      onChanged();
      onClose();
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: '#0b0f1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-0.5">🖥 Layout Değiştir</h3>
        <p className="text-white/40 text-sm mb-5">{screenName}</p>
        <div className="grid grid-cols-3 gap-2 mb-5 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {LAYOUT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={cn(
                'rounded-xl p-3 text-left border transition-all',
                selected === opt.value
                  ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/8 text-white/45 hover:border-white/20 hover:text-white/75'
              )}
            >
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className="text-xs font-medium">{opt.label}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button onClick={handleApply} disabled={!selected || sending} className="btn-primary flex-1">{sending ? 'Uygulanıyor…' : 'Uygula'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Countdown Broadcast Modal ───────────────────────────────────────────────

function CountdownBroadcastModal({ screens, onClose, onSent }: { screens: EnrichedScreen[]; onClose: () => void; onSent: (e: BroadcastHistoryEntry) => void }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [bgUrl, setBgUrl] = useState('');
  const [targetId, setTargetId] = useState('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !target) { toast.error('Başlık ve hedef tarih gerekli'); return; }
    setSending(true);
    try {
      const settings = { countdown_title: title, countdown_target: new Date(target).toISOString(), ...(bgUrl ? { countdown_bg_url: bgUrl } : {}) };
      const body: Record<string, unknown> = { event: 'update_settings', data: { settings, layoutType: 'event_countdown' } };
      if (targetId !== 'all') body.screenId = targetId;
      const res = await fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success('Geri sayım yayınlandı');
        onSent({ id: Date.now().toString(), event: 'update_settings', label: `⏳ ${title}`, targetLabel: targetId === 'all' ? 'Tüm Ekranlar' : screens.find(s => s.id === targetId)?.name ?? targetId, sentAt: new Date() });
        onClose();
      }
    } finally { setSending(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-4">⏳ Geri Sayım Yayını</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Başlık <span className="text-indigo-400">*</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Etkinlik başlığı…" className="input w-full text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Hedef Tarih &amp; Saat <span className="text-indigo-400">*</span></label>
          <input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} className="input w-full text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Arka Plan URL (opsiyonel)</label>
          <input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="https://…" className="input w-full text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Hedef Ekran</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input w-full text-sm">
            <option value="all">Tüm Ekranlar ({screens.filter(s => s.isOnline).length} aktif)</option>
            {screens.map(s => <option key={s.id} value={s.id}>{s.name}{!s.isOnline ? ' (çevrimdışı)' : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleSend} disabled={sending || !title.trim() || !target} className="btn-primary flex-1">{sending ? 'Gönderiliyor…' : '⏳ Yayınla'}</button>
      </div>
    </ModalWrapper>
  );
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────

function BroadcastModal({ items, screens, onClose, onSent }: { items: ContentItem[]; screens: EnrichedScreen[]; onClose: () => void; onSent: (e: BroadcastHistoryEntry) => void }) {
  const [targetScreenId, setTargetScreenId] = useState('all');
  const [sending, setSending] = useState(false);
  const isBulk = items.length > 1;
  const item = items[0];

  const handleBroadcast = async () => {
    setSending(true);
    try {
      const screenIds = targetScreenId === 'all' ? screens.map(s => s.id) : [targetScreenId];

      if (isBulk) {
        const body: Record<string, unknown> = { event: 'update_content', data: {} };
        if (targetScreenId !== 'all') body.screenId = targetScreenId;
        await fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast.success(`${items.length} içerik — ekranlar güncellendi`);
        onSent({ id: Date.now().toString(), event: 'update_content', label: `${items.length} içerik`, targetLabel: targetScreenId === 'all' ? 'Tüm Ekranlar' : screens.find(s => s.id === targetScreenId)?.name ?? targetScreenId, sentAt: new Date() });
      } else {
        let event = 'update_content';
        let payload: Record<string, unknown> = {};
        if (item.kind === 'youtube') { event = 'play_youtube'; payload = { videoId: item.raw.videoId, title: item.title }; }
        else if (item.kind === 'instagram') { event = 'show_instagram'; }
        else { payload = { contentId: item.id }; }
        await Promise.allSettled(screenIds.map(id => fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, screenId: id, data: payload }) })));
        toast.success(`${screenIds.length} ekrana gönderildi`);
        onSent({ id: Date.now().toString(), event, label: item.title, targetLabel: targetScreenId === 'all' ? 'Tüm Ekranlar' : screens.find(s => s.id === targetScreenId)?.name ?? targetScreenId, sentAt: new Date() });
      }
      onClose();
    } finally { setSending(false); }
  };

  const targets = [{ id: 'all', name: 'Tüm Ekranlar', sub: `${screens.filter(s => s.isOnline).length} aktif`, isOnline: true }, ...screens];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 p-5 shadow-2xl"
        style={{ background: '#0b0f1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold mb-1">▶ Ekrana Gönder</h3>
        <p className="text-white/40 text-xs mb-4 truncate">{isBulk ? `${items.length} içerik seçildi` : item.title}</p>
        <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {targets.map(s => (
            <div
              key={s.id}
              className={cn('flex items-center gap-3 rounded-xl border p-2.5 cursor-pointer transition-all', targetScreenId === s.id ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/8 hover:border-white/15')}
              onClick={() => setTargetScreenId(s.id)}
            >
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 flex-shrink-0', targetScreenId === s.id ? 'border-indigo-500 bg-indigo-500' : 'border-white/25')} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.name}</p>
                {'sub' in s
                  ? <p className="text-white/40 text-[10px]">{(s as { sub: string }).sub}</p>
                  : <p className="text-white/40 text-[10px]">{(s as ScreenData).layoutType} · {(s as ScreenData).location ?? '—'}</p>
                }
              </div>
              {!('sub' in s) && <div className={cn('w-2 h-2 rounded-full', (s as ScreenData).isOnline ? 'bg-emerald-400' : 'bg-white/15')} />}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button onClick={handleBroadcast} disabled={sending} className="btn-primary flex-1">{sending ? 'Gönderiliyor…' : '▶ Gönder'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Screen Card ──────────────────────────────────────────────────────────────

function ScreenCard({ screen, onLayoutChange, onAction }: { screen: EnrichedScreen; onLayoutChange: (id: string, name: string) => void; onAction: (id: string | null, event: string, label: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isOnline = screen.isOnline;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center gap-2.5 p-3 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all', isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-white/15')} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{screen.name}</p>
          <p className="text-white/35 text-[10px] truncate">{screen.layoutType}{screen.location ? ` · ${screen.location}` : ''}</p>
        </div>
        <motion.span className="text-white/25 text-xs" animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-2 border-t border-white/5 space-y-2">
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: '🔄 Yenile', event: 'reload' },
                  { label: '📡 Güncelle', event: 'update_content' },
                  { label: '🔇 Sessiz', event: 'mute' },
                  { label: '🔊 Ses Aç', event: 'unmute' },
                  { label: '✕ Overlay', event: 'clear_overlay' },
                ].map(a => (
                  <button
                    key={a.event}
                    disabled={!isOnline}
                    onClick={() => onAction(screen.id, a.event, `${a.label} → ${screen.name}`)}
                    className="px-2 py-1.5 rounded-lg text-[11px] text-white/45 border border-white/8 hover:text-white hover:border-white/18 transition-all disabled:opacity-25 disabled:cursor-not-allowed text-left"
                  >{a.label}</button>
                ))}
                <button
                  disabled={!isOnline}
                  onClick={() => onLayoutChange(screen.id, screen.name)}
                  className="px-2 py-1.5 rounded-lg text-[11px] text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/10 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                >🖥 Layout</button>
              </div>
              <a href={`/screen?screenId=${screen.id}`} target="_blank" className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded-lg text-[11px] text-white/35 border border-white/8 hover:text-white/65 hover:border-white/15 transition-all">
                <span>↗</span><span>Görüntüle</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({ item, selected, onSelect, onApprove, onFeature, onDelete, onBroadcast }: {
  item: ContentItem; selected: boolean;
  onSelect: (id: string) => void;
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
      className={cn(
        'group relative rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer',
        selected ? 'border-indigo-500/60 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]' : 'border-white/8 hover:border-white/18'
      )}
      style={{ background: selected ? 'rgba(99,102,241,0.06)' : '#0f1117' }}
      onClick={() => onSelect(item.id)}
    >
      {/* Selection */}
      <div className={cn('absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all', selected ? 'border-indigo-500 bg-indigo-500' : 'border-white/30 bg-black/50 opacity-0 group-hover:opacity-100')}>
        {selected && <span className="text-white text-[9px] font-bold">✓</span>}
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-3xl text-white/10">{platform === 'youtube' ? '▶' : platform === 'instagram' ? '◈' : '◻'}</div>
        }
        <div className={cn('absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold border', platformColor(platform))}>
          {platformLabel(platform)}
        </div>
        {item.isFeatured && <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/25">★ Öne Çıkan</div>}
        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => { e.stopPropagation(); onBroadcast(item); }} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-400 transition-colors shadow-lg">▶ Yayınla</button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {item.author && <p className="text-white/40 text-[10px] mb-0.5 truncate">@{item.authorHandle || item.author}</p>}
        <p className="text-white/85 text-xs line-clamp-2 mb-2 leading-snug">{item.title}</p>
        {item.stats && (
          <div className="flex items-center gap-2 text-[10px] text-white/25 mb-2">
            {item.stats.likes != null && <span>❤ {fmtN(item.stats.likes)}</span>}
            {item.stats.comments != null && <span>💬 {fmtN(item.stats.comments)}</span>}
            {item.stats.views != null && <span>👁 {fmtN(item.stats.views)}</span>}
          </div>
        )}
        {item.kind === 'content' && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onApprove(item.id, !item.isApproved)} className={cn('flex-1 text-[10px] rounded-lg py-1 border transition-all', item.isApproved ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-white/4 text-white/35 border-white/8 hover:border-white/18')}>
              {item.isApproved ? '✓ Onaylı' : 'Onayla'}
            </button>
            <button onClick={() => onFeature(item.id, !item.isFeatured)} className={cn('px-2 py-1 text-[10px] rounded-lg border transition-all', item.isFeatured ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-white/4 text-white/30 border-white/8')}>★</button>
            <button onClick={() => onDelete(item.id)} className="px-2 py-1 text-[10px] rounded-lg border border-white/8 text-white/25 hover:text-red-400 hover:border-red-500/25 transition-all">🗑</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Scene Types ──────────────────────────────────────────────────────────────

interface Scene {
  id: string;
  name: string;
  icon: string;
  color: string;
  layout: LayoutType;
  ticker: { active: boolean; priority?: number };
  ads: { mode: 'normal' | 'heavy' | 'off' };
  youtubePlaylistId?: string;
  broadcastToGroups: string[];
}

// ─── Create Scene Modal ───────────────────────────────────────────────────────

function CreateSceneModal({ groups, onClose, onCreated }: { groups: GroupData[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎭');
  const [color, setColor] = useState('#6366f1');
  const [layout, setLayout] = useState<LayoutType>('default');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ICONS = ['🎭','🎉','🌙','☀️','🍸','🎵','🏆','📺','🎬','📡','⚡','🌟'];

  const toggleGroup = (id: string) =>
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Sahne adı gerekli'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon, color, layout, broadcastToGroups: selectedGroups }),
      });
      if (res.ok) { toast.success('Sahne oluşturuldu'); onCreated(); onClose(); }
      else toast.error('Sahne oluşturulamadı');
    } finally { setSaving(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="text-white font-bold text-lg mb-4">🎭 Yeni Sahne</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Ad <span className="text-indigo-400">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Happy Hour, Akşam Yayını…" className="input w-full text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">İkon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={cn('w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all', icon === ic ? 'border-indigo-500/60 bg-indigo-500/15' : 'border-white/10 hover:border-white/25')}
              >{ic}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1 block">Layout</label>
            <select value={layout} onChange={e => setLayout(e.target.value as LayoutType)} className="input w-full text-sm">
              {LAYOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Renk</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/15" />
          </div>
        </div>
        {groups.length > 0 && (
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Hedef Gruplar <span className="text-white/25">(seçilmezse tüm ekranlar)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => {
                const sel = selectedGroups.includes(g.id);
                return (
                  <button key={g.id} onClick={() => toggleGroup(g.id)}
                    className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all', sel ? 'text-white border-current' : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60')}
                    style={sel ? { background: `${g.color ?? '#6366f1'}20`, borderColor: `${g.color ?? '#6366f1'}60`, color: g.color ?? '#6366f1' } : {}}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color ?? '#6366f1' }} />
                    {g.name}
                    {sel && <span className="font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary flex-1">{saving ? 'Kaydediliyor…' : 'Oluştur'}</button>
      </div>
    </ModalWrapper>
  );
}

// ─── Command Panel (right) ────────────────────────────────────────────────────

function CommandPanel({ screens, channels, activeSchedule, history, onQuickAction, onOverlay, onChannelPlay, onCountdown, connectedCount }: {
  screens: EnrichedScreen[];
  channels: LiveChannel[];
  activeSchedule: ScheduleEvent | null;
  history: BroadcastHistoryEntry[];
  onQuickAction: (id: string | null, event: string, label: string) => void;
  onOverlay: () => void;
  onChannelPlay: (ch: LiveChannel) => void;
  onCountdown: () => void;
  connectedCount: number;
}) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [groups, setGroups] = useState<GroupData[]>([]);

  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch('/api/scenes');
      if (res.ok) { const d = await res.json(); setScenes(d.data ?? []); }
    } catch { /* silent */ }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/screen-groups');
      if (res.ok) { const d = await res.json(); setGroups(d.data ?? []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchScenes(); fetchGroups(); }, [fetchScenes, fetchGroups]);

  const activateScene = async (scene: Scene) => {
    setActiveScene(scene.id);
    try {
      const payload: Record<string, unknown> = { event: 'change_layout', data: { layoutType: scene.layout } };
      if (scene.broadcastToGroups && scene.broadcastToGroups.length > 0) {
        // Broadcast only to screens belonging to the specified groups
        const targetScreens = screens.filter(s => scene.broadcastToGroups.includes(s.groupId ?? ''));
        if (targetScreens.length > 0) {
          await Promise.allSettled(
            targetScreens.map(s => fetch('/api/sync/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, screenId: s.id }),
            }))
          );
          const groupNames = scene.broadcastToGroups
            .map(gid => groups.find(g => g.id === gid)?.name ?? gid)
            .join(', ');
          toast.success(`🎭 ${scene.name} → ${groupNames}`);
        } else {
          toast.error('Bu gruplarda ekran bulunamadı');
          setActiveScene(null);
          return;
        }
      } else {
        await fetch('/api/sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.success(`🎭 ${scene.name} sahnesi aktif`);
      }
    } catch { toast.error('Sahne uygulanamadı'); setActiveScene(null); }
  };

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-l overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#07090f', scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">⚡ Komuta Merkezi</h2>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-bold tabular-nums">{connectedCount}</span>
          </div>
        </div>
      </div>

      {/* Scenes */}
      <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/30">🎭 Sahneler</p>
          <button onClick={() => setShowCreateScene(true)} className="text-white/30 hover:text-indigo-400 text-xs transition-colors">+ Yeni</button>
        </div>
        {scenes.length === 0 ? (
          <button onClick={() => setShowCreateScene(true)} className="w-full py-2 rounded-lg border border-dashed border-white/10 text-white/20 text-xs hover:text-white/40 hover:border-white/20 transition-all">
            + Sahne oluştur
          </button>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {scenes.map(s => (
              <button
                key={s.id}
                onClick={() => activateScene(s)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all',
                  activeScene === s.id
                    ? 'text-white font-semibold shadow-sm'
                    : 'text-white/50 border-white/10 hover:text-white/80 hover:border-white/20'
                )}
                style={activeScene === s.id ? { background: `${s.color}20`, borderColor: `${s.color}50`, color: s.color } : {}}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
                {s.broadcastToGroups?.length > 0 && (
                  <span className="flex gap-0.5">
                    {s.broadcastToGroups.slice(0, 3).map(gid => {
                      const g = groups.find(g => g.id === gid);
                      return <span key={gid} className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: g?.color ?? '#6366f1' }} />;
                    })}
                  </span>
                )}
                {activeScene === s.id && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
              </button>
            ))}
          </div>
        )}
        {showCreateScene && (
          <AnimatePresence>
            <CreateSceneModal groups={groups} onClose={() => setShowCreateScene(false)} onCreated={fetchScenes} />
          </AnimatePresence>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/30 mb-2">Hızlı Komutlar</p>
        {[
          { icon: '🔄', label: 'Tüm Ekranları Yenile', event: 'reload', clr: 'text-indigo-400' },
          { icon: '📡', label: 'İçeriği Güncelle',     event: 'update_content', clr: 'text-blue-400' },
          { icon: '🔇', label: 'Tümünü Sessiz Yap',    event: 'mute',           clr: 'text-amber-400' },
          { icon: '🔊', label: 'Tüm Sesi Aç',          event: 'unmute',         clr: 'text-emerald-400' },
          { icon: '✕',  label: "Overlay'ları Kaldır",  event: 'clear_overlay',  clr: 'text-red-400' },
        ].map(a => (
          <button
            key={a.event}
            onClick={() => onQuickAction(null, a.event, a.label)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-white/7 text-white/50 hover:text-white hover:border-white/15 hover:bg-white/3 transition-all text-left"
          >
            <span className={cn('text-base flex-shrink-0', a.clr)}>{a.icon}</span>
            <span className="text-xs">{a.label}</span>
          </button>
        ))}
        <button
          onClick={onOverlay}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/12 transition-all"
        >
          <span className="text-base flex-shrink-0">💬</span>
          <span className="text-xs font-semibold">Overlay Mesaj Gönder</span>
        </button>
        <button
          onClick={onCountdown}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/12 transition-all"
        >
          <span className="text-base flex-shrink-0">⏳</span>
          <span className="text-xs font-semibold">Geri Sayım Yayını</span>
        </button>
      </div>

      {/* Active Schedule */}
      {activeSchedule && (
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/30 mb-2">📅 Aktif Program</p>
          <div className="rounded-xl p-3 border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0 animate-pulse" />
              <div>
                <p className="text-white text-sm font-semibold leading-snug">{activeSchedule.title}</p>
                <p className="text-white/40 text-[10px] mt-0.5 capitalize">{activeSchedule.type} · {activeSchedule.recurrence}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TV Channels */}
      {channels.length > 0 && (
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/30 mb-2">📺 TV Kanalları</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {channels.map(ch => {
              const provClr: Record<string, string> = { youtube: 'text-red-400', bein: 'text-blue-400', tabii: 'text-indigo-400' };
              return (
                <div key={ch.id} className="flex items-center gap-2.5 rounded-xl p-2.5 border border-white/7 hover:border-white/15 group transition-all" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {ch.logoUrl && <img src={ch.logoUrl} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{ch.title}</p>
                    <p className={cn('text-[10px] capitalize', provClr[ch.provider] ?? 'text-white/35')}>{ch.provider}</p>
                  </div>
                  <button onClick={() => onChannelPlay(ch)} className="px-2 py-1 rounded-lg text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/25 transition-all opacity-0 group-hover:opacity-100">▶</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="p-3 flex-1 min-h-0">
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/30 mb-2">🕘 Yayın Geçmişi</p>
        {history.length === 0
          ? <p className="text-white/20 text-xs text-center py-4">Henüz yayın yapılmadı</p>
          : (
            <div className="space-y-1.5">
              {[...history].reverse().slice(0, 12).map(h => (
                <div key={h.id} className="rounded-lg p-2 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-white/65 text-[11px] font-medium line-clamp-1">{h.label}</p>
                  <div className="flex justify-between mt-0.5">
                    <p className="text-white/30 text-[10px] truncate">{h.targetLabel}</p>
                    <p className="text-white/20 text-[10px] tabular-nums ml-2 flex-shrink-0">{fmtTime(h.sentAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublishPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [screens, setScreens] = useState<EnrichedScreen[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [history, setHistory] = useState<BroadcastHistoryEntry[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const addHistory = useCallback((entry: BroadcastHistoryEntry) => {
    setHistory(prev => [...prev, entry]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [contentRes, igRes, ytRes, screensRes, channelsRes, scheduleRes, sseRes] = await Promise.allSettled([
        fetch('/api/content?pageSize=60'),
        fetch('/api/instagram?limit=30'),
        fetch('/api/youtube'),
        fetch('/api/screens'),
        fetch('/api/tv-channels?active=1'),
        fetch('/api/schedule/active'),
        fetch('/api/sync/broadcast'),
      ]);

      const allItems: ContentItem[] = [];

      if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
        const d = await contentRes.value.json();
        for (const c of d.data ?? []) {
          allItems.push({ id: c.id, kind: 'content', platform: c.platform, title: c.text || c.aiSummary || '(içerik yok)', author: c.author, authorHandle: c.authorHandle, thumbnailUrl: c.mediaUrl || c.authorAvatar, isApproved: c.isApproved, isFeatured: c.isFeatured, stats: { likes: c.likes, comments: c.comments, views: c.views }, raw: c });
        }
      }
      if (igRes.status === 'fulfilled' && igRes.value.ok) {
        const d = await igRes.value.json();
        for (const p of d.data ?? []) {
          allItems.push({ id: p.id, kind: 'instagram', platform: 'instagram', title: p.caption || p.username, author: p.displayName || p.username, authorHandle: p.username, thumbnailUrl: p.thumbnailUrl || p.mediaUrl, isApproved: p.isApproved, stats: { likes: p.likeCount, comments: p.commentCount }, raw: p });
        }
      }
      if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
        const d = await ytRes.value.json();
        for (const v of d.data ?? []) {
          allItems.push({ id: v.id, kind: 'youtube', platform: 'youtube', title: v.title, author: v.channelName, thumbnailUrl: v.thumbnailUrl, raw: v });
        }
      }
      if (screensRes.status === 'fulfilled' && screensRes.value.ok) {
        const d = await screensRes.value.json();
        setScreens(d.data ?? []);
      }
      if (channelsRes.status === 'fulfilled' && channelsRes.value.ok) {
        const d = await channelsRes.value.json();
        setChannels(d.data ?? []);
      }
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
        const d = await scheduleRes.value.json();
        if (d.data) setActiveSchedule(d.data);
      }
      if (sseRes.status === 'fulfilled' && sseRes.value.ok) {
        const d = await sseRes.value.json();
        setConnectedCount(d.connectedCount ?? 0);
      }
      setItems(allItems);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const t = setInterval(() => {
      fetch('/api/sync/broadcast').then(r => r.json()).then(d => setConnectedCount(d.connectedCount ?? 0)).catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApprove = useCallback(async (id: string, value: boolean) => {
    await fetch(`/api/content/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isApproved: value }) });
    toast.success(value ? 'Onaylandı' : 'Onay kaldırıldı');
    fetchAll();
  }, [fetchAll]);

  const handleFeature = useCallback(async (id: string, value: boolean) => {
    await fetch(`/api/content/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFeatured: value }) });
    toast.success(value ? 'Öne çıkarıldı' : 'Kaldırıldı');
    fetchAll();
  }, [fetchAll]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Silmek istiyor musunuz?')) return;
    const item = items.find(i => i.id === id);
    const endpoint = item?.kind === 'instagram' ? `/api/instagram/${id}` : item?.kind === 'youtube' ? `/api/youtube/${id}` : `/api/content/${id}`;
    await fetch(endpoint, { method: 'DELETE' });
    toast.success('Silindi');
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    fetchAll();
  }, [items, fetchAll]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleQuickAction = useCallback(async (screenId: string | null, event: string, label: string) => {
    try {
      const body: Record<string, unknown> = { event, data: {} };
      if (screenId) body.screenId = screenId;
      const res = await fetch('/api/sync/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        const d: { targetedScreens?: number } = await res.json();
        toast.success(`${label} — ${d.targetedScreens ?? 0} ekran`);
        addHistory({ id: Date.now().toString(), event, label, targetLabel: screenId ? screens.find(s => s.id === screenId)?.name ?? screenId : 'Tüm Ekranlar', sentAt: new Date() });
      }
    } catch { toast.error('Komut gönderilemedi'); }
  }, [screens, addHistory]);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'all', label: 'Tümü', icon: '⊞' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'youtube', label: 'YouTube', icon: '▶' },
    { id: 'content', label: 'İçerik', icon: '🖼' },
    { id: 'announcement', label: 'Duyurular', icon: '📢' },
  ];

  const filtered = useMemo(() => items.filter(item => {
    const matchTab =
      tab === 'all' ||
      (tab === 'instagram' && item.platform === 'instagram') ||
      (tab === 'tiktok' && item.platform === 'tiktok') ||
      (tab === 'youtube' && item.kind === 'youtube') ||
      (tab === 'content' && item.kind === 'content' && !['instagram', 'tiktok', 'announcement'].includes(item.platform ?? '')) ||
      (tab === 'announcement' && item.platform === 'announcement');
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || (item.author ?? '').toLowerCase().includes(q) || (item.authorHandle ?? '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  }), [items, tab, searchQuery]);

  const selectedItems = useMemo(() => items.filter(i => selectedIds.has(i.id)), [items, selectedIds]);
  const onlineScreens = screens.filter(s => s.isOnline);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#030712' }}>

      {/* ── Left: Screens ─────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#07090f' }}>
        <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-sm">📺 Ekranlar</h2>
            <span className={cn('text-[10px] font-bold tabular-nums', onlineScreens.length > 0 ? 'text-emerald-400' : 'text-white/30')}>
              {onlineScreens.length}/{screens.length}
            </span>
          </div>
          {screens.length > 0 && (
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(onlineScreens.length / screens.length) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
          {screens.length === 0
            ? <div className="text-center pt-10"><p className="text-white/20 text-xs">Ekran bulunamadı</p><a href="/admin/screens" className="text-indigo-400/60 hover:text-indigo-400 text-[11px] mt-1 block transition-colors">+ Ekran Ekle →</a></div>
            : screens.map(s => (
              <ScreenCard key={s.id} screen={s} onLayoutChange={(id, name) => setModal({ type: 'layout', screenId: id, screenName: name })} onAction={handleQuickAction} />
            ))
          }
        </div>
        <div className="p-3 border-t space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <a href="/admin/schedule" className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-white/7 text-white/40 hover:text-white hover:border-white/15 transition-all text-xs">
            <span>📅</span><span>Yayın Takvimi</span><span className="ml-auto">→</span>
          </a>
          <a href="/admin/screens" className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-white/7 text-white/40 hover:text-white hover:border-white/15 transition-all text-xs">
            <span>🖥</span><span>Ekran Yönetimi</span><span className="ml-auto">→</span>
          </a>
        </div>
      </aside>

      {/* ── Center: Content ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#07090f' }}>
          <div>
            <h1 className="text-white font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Yayın Merkezi</h1>
            <p className="text-white/30 text-xs">{items.length} içerik · {onlineScreens.length} aktif ekran</p>
          </div>
          <div className="flex items-center gap-2" ref={addMenuRef}>
            <div className="relative">
              <button onClick={() => setShowAddMenu(!showAddMenu)} className="btn-primary flex items-center gap-1.5 text-sm">
                <span>+</span><span>Yeni Ekle</span><span className="text-xs opacity-50">▾</span>
              </button>
              <AnimatePresence>
                {showAddMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/10 shadow-2xl z-30 overflow-hidden"
                    style={{ background: '#0b0f1a' }}
                  >
                    {[
                      { icon: '🎵', label: 'TikTok Video', action: () => { setModal({ type: 'tiktok' }); setShowAddMenu(false); } },
                      { icon: '📸', label: 'Instagram', href: '/admin/instagram' },
                      { icon: '▶', label: 'YouTube', href: '/admin/youtube' },
                      { icon: '📢', label: 'Duyuru', action: () => { setModal({ type: 'announcement' }); setShowAddMenu(false); } },
                      { icon: '🖼', label: 'Özel İçerik', href: '/admin/content' },
                    ].map((m, i) => (
                      <button key={i} onClick={m.action ? m.action : () => { window.location.href = (m as { href: string }).href; }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/65 hover:text-white hover:bg-white/5 transition-colors text-left">
                        <span>{m.icon}</span><span>{m.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Tabs + Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.05)', scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-1 flex-shrink-0">
            {TABS.map(t => {
              const count = t.id === 'all' ? items.length : items.filter(item =>
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
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap', tab === t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/40 hover:text-white/65 border border-transparent')}
                >
                  <span>{t.icon}</span><span>{t.label}</span>
                  {count > 0 && <span className={cn('text-[10px] rounded-full px-1.5 py-px', tab === t.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/8 text-white/30')}>{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ara…" className="input text-sm py-1.5 flex-1 min-w-28 max-w-56" />
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(99,102,241,0.07)' }}
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-bold">{selectedIds.size}</span>
                </div>
                <span className="text-indigo-300 text-xs font-semibold">{selectedIds.size} içerik seçildi</span>
              </div>
              <button onClick={() => setModal({ type: 'broadcast_bulk', items: selectedItems })} className="px-3 py-1 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-400 transition-colors">▶ Toplu Yayınla</button>
              <button
                onClick={() => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(i => i.id))); }}
                className="px-3 py-1 rounded-lg border border-white/15 text-white/50 text-xs hover:text-white transition-colors"
              >{selectedIds.size === filtered.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-white/30 hover:text-white transition-colors text-sm px-1">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <p className="text-4xl text-white/8">{tab === 'instagram' ? '📸' : tab === 'tiktok' ? '🎵' : tab === 'youtube' ? '▶' : '📋'}</p>
              <p className="text-white/25 text-sm">İçerik bulunamadı</p>
              <p className="text-white/15 text-xs">Yeni içerik için "Yeni Ekle" düğmesini kullanın</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map(item => (
                <ContentCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  onApprove={handleApprove}
                  onFeature={handleFeature}
                  onDelete={handleDelete}
                  onBroadcast={ci => setModal({ type: 'broadcast', item: ci })}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Right: Command Panel ───────────────────────────────────────── */}
      <CommandPanel
        screens={screens}
        channels={channels}
        activeSchedule={activeSchedule}
        history={history}
        onQuickAction={handleQuickAction}
        onOverlay={() => setModal({ type: 'overlay' })}
        onChannelPlay={ch => setModal({ type: 'channel', channel: ch })}
        onCountdown={() => setModal({ type: 'countdown' })}
        connectedCount={connectedCount}
      />

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.type === 'broadcast' && <BroadcastModal key="bc" items={[modal.item]} screens={screens} onClose={() => setModal({ type: 'none' })} onSent={addHistory} />}
        {modal.type === 'broadcast_bulk' && <BroadcastModal key="bc-bulk" items={modal.items} screens={screens} onClose={() => { setModal({ type: 'none' }); setSelectedIds(new Set()); }} onSent={addHistory} />}
        {modal.type === 'tiktok' && <AddTikTokModal key="tiktok" onClose={() => setModal({ type: 'none' })} onAdded={fetchAll} />}
        {modal.type === 'announcement' && <AddAnnouncementModal key="ann" onClose={() => setModal({ type: 'none' })} onAdded={fetchAll} />}
        {modal.type === 'overlay' && <OverlayModal key="ov" screens={screens} onClose={() => setModal({ type: 'none' })} onSent={addHistory} />}
        {modal.type === 'channel' && <ChannelBroadcastModal key="ch" channel={modal.channel} screens={screens} onClose={() => setModal({ type: 'none' })} onSent={addHistory} />}
        {modal.type === 'layout' && <LayoutPickerModal key="lp" screenId={modal.screenId} screenName={modal.screenName} onClose={() => setModal({ type: 'none' })} onChanged={fetchAll} />}
        {modal.type === 'countdown' && <CountdownBroadcastModal key="cd" screens={screens} onClose={() => setModal({ type: 'none' })} onSent={addHistory} />}
      </AnimatePresence>
    </div>
  );
}
