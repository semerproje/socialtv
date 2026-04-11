'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Playlist, PlaylistItem, PlaylistItemType, PlaylistTransition, ScreenData } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSITION_OPTIONS: { value: PlaylistTransition; label: string; icon: string }[] = [
  { value: 'fade', label: 'Fade', icon: '✨' },
  { value: 'slide_left', label: 'Sola Kayan', icon: '←' },
  { value: 'slide_up', label: 'Yukarı Kayan', icon: '↑' },
  { value: 'zoom', label: 'Zoom', icon: '🔍' },
  { value: 'blur', label: 'Blur', icon: '🌫' },
  { value: 'none', label: 'Anında', icon: '⚡' },
];

const ITEM_TYPES: { value: PlaylistItemType; label: string; icon: string; color: string }[] = [
  { value: 'image',        label: 'Görsel',       icon: '🖼️',  color: '#6366f1' },
  { value: 'video',        label: 'Video',        icon: '🎬',  color: '#ec4899' },
  { value: 'youtube',      label: 'YouTube',      icon: '▶️',  color: '#ef4444' },
  { value: 'content',      label: 'Sosyal İçerik',icon: '💬',  color: '#3b82f6' },
  { value: 'instagram',    label: 'Instagram',    icon: '📸',  color: '#f59e0b' },
  { value: 'ad',           label: 'Reklam',       icon: '📺',  color: '#8b5cf6' },
  { value: 'layout',       label: 'Layout Geçişi',icon: '⊞',   color: '#10b981' },
  { value: 'announcement', label: 'Duyuru',       icon: '📢',  color: '#f97316' },
  { value: 'url',          label: 'Web Sayfası',  icon: '🌐',  color: '#14b8a6' },
  { value: 'scene',        label: 'Sahne',        icon: '🎭',  color: '#a855f7' },
];

const LAYOUTS = [
  'default', 'youtube', 'instagram', 'split_2', 'fullscreen', 'digital_signage',
  'social_wall', 'ambient', 'promo', 'triple', 'news_focus', 'portrait', 'markets',
  'breaking_news', 'event_countdown', 'split_scoreboard',
];

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

function fmtDuration(sec: number): string {
  if (sec === 0) return 'Tam video';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}d ${s}s` : `${m}d`;
}

function fmtTotalDuration(sec: number): string {
  if (sec === 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} saniye`;
  return s ? `${m} dk ${s} sn` : `${m} dakika`;
}

function getItemTypeInfo(type: PlaylistItemType) {
  return ITEM_TYPES.find((t) => t.value === type) ?? { label: type, icon: '📄', color: '#6b7280' };
}

function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

// ─── Playlist Form Modal ──────────────────────────────────────────────────────

interface PlaylistFormProps {
  initial?: Partial<Playlist>;
  screens: ScreenData[];
  onSave: (data: Partial<Playlist>) => void;
  onClose: () => void;
}

function PlaylistForm({ initial, screens, onSave, onClose }: PlaylistFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    loop: initial?.loop ?? true,
    shuffle: initial?.shuffle ?? false,
    transition: (initial?.transition ?? 'fade') as PlaylistTransition,
    defaultDuration: initial?.defaultDuration ?? 10,
    screenIds: initial?.screenIds ? (JSON.parse(initial.screenIds) as string[]) : [] as string[],
  });

  const toggleScreen = (id: string) => {
    setForm((f) => ({
      ...f,
      screenIds: f.screenIds.includes(id)
        ? f.screenIds.filter((s) => s !== id)
        : [...f.screenIds, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Playlist adı giriniz'); return; }
    onSave({ ...form, screenIds: JSON.stringify(form.screenIds) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {initial?.id ? 'Playlist Düzenle' : 'Yeni Playlist'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Playlist Adı *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Sabah Yayın Listesi"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Açıklama</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opsiyonel açıklama..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm resize-none"
            />
          </div>

          {/* Row: defaultDuration + transition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Varsayılan Süre (sn)</label>
              <input
                type="number"
                min={1}
                max={3600}
                value={form.defaultDuration}
                onChange={(e) => setForm({ ...form, defaultDuration: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Geçiş Efekti</label>
              <select
                value={form.transition}
                onChange={(e) => setForm({ ...form, transition: e.target.value as PlaylistTransition })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              >
                {TRANSITION_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Loop + Shuffle */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm({ ...form, loop: !form.loop })}
                className={cn('w-10 h-5 rounded-full transition-colors relative', form.loop ? 'bg-indigo-500' : 'bg-white/10')}
              >
                <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', form.loop ? 'left-5' : 'left-0.5')} />
              </div>
              <span className="text-sm text-white/70">Döngü</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm({ ...form, shuffle: !form.shuffle })}
                className={cn('w-10 h-5 rounded-full transition-colors relative', form.shuffle ? 'bg-purple-500' : 'bg-white/10')}
              >
                <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', form.shuffle ? 'left-5' : 'left-0.5')} />
              </div>
              <span className="text-sm text-white/70">Karıştır</span>
            </label>
          </div>

          {/* Screen Assignment */}
          {screens.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Ekranlar</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {screens.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleScreen(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all',
                      form.screenIds.includes(s.id)
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', s.isOnline ? 'bg-emerald-400' : 'bg-white/20')} />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm"
            >
              {initial?.id ? 'Kaydet' : 'Oluştur'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────

interface AddItemFormProps {
  playlist: Playlist;
  onAdd: (data: Partial<PlaylistItem>) => void;
  onClose: () => void;
}

function AddItemForm({ playlist, onAdd, onClose }: AddItemFormProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<PlaylistItemType | null>(null);
  const [form, setForm] = useState({
    title: '',
    mediaUrl: '',
    youtubeInput: '',
    youtubeVideoId: '',
    layoutType: 'default',
    contentRef: '',
    duration: playlist.defaultDuration,
    transition: '' as PlaylistTransition | '',
    thumbnailUrl: '',
    announcement: '',
  });
  const [ytThumb, setYtThumb] = useState('');

  const handleYtInput = (val: string) => {
    setForm((f) => ({ ...f, youtubeInput: val }));
    const id = extractYouTubeId(val);
    if (id) {
      setForm((f) => ({ ...f, youtubeVideoId: id, thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg` }));
      setYtThumb(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
    } else {
      setYtThumb('');
      setForm((f) => ({ ...f, youtubeVideoId: '' }));
    }
  };

  const handleAdd = () => {
    if (!selectedType) return;
    const data: Partial<PlaylistItem> = {
      type: selectedType,
      duration: form.duration,
      transition: (form.transition || undefined) as PlaylistTransition | undefined,
      title: form.title || undefined,
      thumbnailUrl: form.thumbnailUrl || undefined,
    };

    switch (selectedType) {
      case 'image':
      case 'video':
      case 'url':
        if (!form.mediaUrl) { toast.error('URL giriniz'); return; }
        data.mediaUrl = form.mediaUrl;
        data.title = data.title || form.mediaUrl.split('/').pop();
        break;
      case 'youtube':
        if (!form.youtubeVideoId) { toast.error('Geçerli YouTube linki giriniz'); return; }
        data.youtubeVideoId = form.youtubeVideoId;
        data.thumbnailUrl = ytThumb;
        data.title = data.title || `YouTube: ${form.youtubeVideoId}`;
        break;
      case 'layout':
        data.layoutType = form.layoutType;
        data.title = data.title || `${form.layoutType} layout`;
        break;
      case 'announcement':
        if (!form.announcement) { toast.error('Duyuru metni giriniz'); return; }
        data.payload = JSON.stringify({ text: form.announcement });
        data.title = data.title || form.announcement.slice(0, 40);
        break;
      case 'content':
      case 'instagram':
      case 'ad':
      case 'scene':
        if (!form.contentRef) { toast.error('ID giriniz'); return; }
        data.contentRef = form.contentRef;
        break;
    }

    onAdd(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <button onClick={() => setStep('type')} className="text-white/40 hover:text-white transition-colors text-sm">← Geri</button>
            )}
            <h2 className="text-lg font-semibold text-white">
              {step === 'type' ? 'İçerik Türü Seç' : `${getItemTypeInfo(selectedType!).icon} ${getItemTypeInfo(selectedType!).label} Ekle`}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="p-6">
          {step === 'type' ? (
            <div className="grid grid-cols-2 gap-3">
              {ITEM_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setSelectedType(t.value); setStep('details'); }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-left group"
                  style={{ '--accent': t.color } as React.CSSProperties}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{t.label}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Başlık (opsiyonel)</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Otomatik üretilir..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Type-specific fields */}
              {(selectedType === 'image' || selectedType === 'video' || selectedType === 'url') && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">
                    {selectedType === 'image' ? 'Görsel URL' : selectedType === 'video' ? 'Video URL' : 'Web Sayfası URL'}
                  </label>
                  <input
                    value={form.mediaUrl}
                    onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>
              )}

              {selectedType === 'youtube' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">YouTube Link veya Video ID</label>
                  <input
                    value={form.youtubeInput}
                    onChange={(e) => handleYtInput(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... veya video ID"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                  {ytThumb && (
                    <div className="mt-2 relative rounded-lg overflow-hidden h-28 bg-black/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ytThumb} alt="thumbnail" className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl bg-black/50 rounded-full px-3 py-1">▶</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedType === 'layout' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Layout</label>
                  <select
                    value={form.layoutType}
                    onChange={(e) => setForm({ ...form, layoutType: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    {LAYOUTS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedType === 'announcement' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Duyuru Metni</label>
                  <textarea
                    value={form.announcement}
                    onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                    placeholder="Duyuru metninizi yazın..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                  />
                </div>
              )}

              {(selectedType === 'content' || selectedType === 'instagram' || selectedType === 'ad' || selectedType === 'scene') && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">
                    {selectedType === 'content' ? 'İçerik ID' : selectedType === 'instagram' ? 'Instagram Post ID' : selectedType === 'ad' ? 'Reklam ID' : 'Sahne ID'}
                  </label>
                  <input
                    value={form.contentRef}
                    onChange={(e) => setForm({ ...form, contentRef: e.target.value })}
                    placeholder="ID..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">
                  Gösterim Süresi {selectedType === 'video' || selectedType === 'youtube' ? '(0 = tam video)' : ''}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                    className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {DURATION_PRESETS.slice(0, 6).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm({ ...form, duration: d })}
                        className={cn(
                          'px-2 py-1 rounded text-xs transition-colors',
                          form.duration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                        )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transition override */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Geçiş (liste varsayılanını geçersiz kılar)</label>
                <select
                  value={form.transition}
                  onChange={(e) => setForm({ ...form, transition: e.target.value as PlaylistTransition })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="">Playlist varsayılanı</option>
                  {TRANSITION_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<PlaylistItem | null>(null);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);

  // For drag-drop reorder
  const [orderedItems, setOrderedItems] = useState<PlaylistItem[]>([]);
  const reorderTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists?active=0');
      if (res.ok) {
        const d = await res.json();
        setPlaylists(d.data ?? []);
      }
    } catch {
      toast.error('Playlist listesi alınamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScreens = useCallback(async () => {
    try {
      const res = await fetch('/api/screens');
      if (res.ok) {
        const d = await res.json();
        setScreens(d.screens ?? d.data ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const loadPlaylist = useCallback(async (id: string) => {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedPlaylist(d.data);
        const its: PlaylistItem[] = d.data.items ?? [];
        setItems(its);
        setOrderedItems(its);
      }
    } catch {
      toast.error('Playlist yüklenemedi');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
    fetchScreens();
  }, [fetchPlaylists, fetchScreens]);

  // ── Create / Edit playlist ────────────────────────────────────────────────

  const handleSavePlaylist = async (data: Partial<Playlist>) => {
    setSaving(true);
    try {
      const isEdit = !!editingPlaylist?.id;
      const res = isEdit
        ? await fetch(`/api/playlists/${editingPlaylist!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        : await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

      if (!res.ok) throw new Error();
      const d = await res.json();

      toast.success(isEdit ? 'Playlist güncellendi' : 'Playlist oluşturuldu');
      setShowCreateModal(false);
      setEditingPlaylist(null);
      await fetchPlaylists();

      if (isEdit && selectedPlaylist?.id === editingPlaylist?.id) {
        setSelectedPlaylist(d.data);
      } else if (!isEdit) {
        // Auto-select after create
        loadPlaylist(d.data.id);
      }
    } catch {
      toast.error('Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      toast.success('Playlist silindi');
      setDeletingPlaylistId(null);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
        setItems([]);
        setOrderedItems([]);
      }
      await fetchPlaylists();
    } catch {
      toast.error('Silme başarısız');
    }
  };

  // ── Playlist item operations ──────────────────────────────────────────────

  const handleAddItem = async (data: Partial<PlaylistItem>) => {
    if (!selectedPlaylist) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Öğe eklendi');
      setShowAddItem(false);
      await loadPlaylist(selectedPlaylist.id);
      await fetchPlaylists();
    } catch {
      toast.error('Eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (itemId: string, data: Partial<PlaylistItem>) => {
    if (!selectedPlaylist) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_item', itemId, ...data }),
      });
      if (!res.ok) throw new Error();
      toast.success('Güncellendi');
      setEditingItem(null);
      await loadPlaylist(selectedPlaylist.id);
    } catch {
      toast.error('Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedPlaylist) return;
    try {
      await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_item', itemId }),
      });
      toast.success('Öğe silindi');
      await loadPlaylist(selectedPlaylist.id);
      await fetchPlaylists();
    } catch {
      toast.error('Silme başarısız');
    }
  };

  // ── Drag-drop reorder ──────────────────────────────────────────────────────

  const handleReorder = (newOrder: PlaylistItem[]) => {
    setOrderedItems(newOrder);
    if (reorderTimeout.current) clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(async () => {
      if (!selectedPlaylist) return;
      const reorderData = newOrder.map((item, idx) => ({ id: item.id, order: idx }));
      try {
        await fetch(`/api/playlists/${selectedPlaylist.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', items: reorderData }),
        });
        setItems(newOrder);
      } catch {
        toast.error('Sıralama kaydedilemedi');
        setOrderedItems(items);
      }
    }, 600);
  };

  // ── Toggle item active ─────────────────────────────────────────────────────

  const toggleItemActive = async (item: PlaylistItem) => {
    await handleUpdateItem(item.id, { isActive: !item.isActive });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getAssignedScreenNames = (p: Playlist): string => {
    if (!p.screenIds) return '—';
    try {
      const ids: string[] = JSON.parse(p.screenIds);
      if (!ids.length) return '—';
      const names = ids.map((id) => screens.find((s) => s.id === id)?.name ?? id);
      return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    } catch { return '—'; }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#080f1e]">
      {/* ── Left panel: Playlist list ────────────────────────────────────────── */}
      <div className="w-80 border-r border-white/8 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-white/8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-base font-semibold text-white">Playlist Yönetimi</h1>
            <span className="text-xs text-white/30">{playlists.length} liste</span>
          </div>
          <button
            onClick={() => { setEditingPlaylist(null); setShowCreateModal(true); }}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            <span className="text-lg">+</span> Yeni Playlist
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-white/30 text-sm">Yükleniyor...</div>
          ) : playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm gap-2">
              <span className="text-3xl">🎵</span>
              <p>Henüz playlist yok</p>
            </div>
          ) : (
            playlists.map((p) => (
              <div
                key={p.id}
                onClick={() => loadPlaylist(p.id)}
                className={cn(
                  'group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border',
                  selectedPlaylist?.id === p.id
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-transparent hover:border-white/8 hover:bg-white/5'
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 mt-0.5',
                  selectedPlaylist?.id === p.id ? 'bg-indigo-500/30' : 'bg-white/8'
                )}>
                  🎵
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                    {!p.isActive && <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">Pasif</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-white/30">
                    <span>{p.itemCount ?? 0} öğe</span>
                    <span>·</span>
                    <span>{fmtTotalDuration(p.totalDuration ?? 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-white/20">
                    <span className="truncate">{getAssignedScreenNames(p)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPlaylist(p); setShowCreateModal(true); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors text-xs"
                  >✏</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingPlaylistId(p.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: Playlist editor ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPlaylist ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 gap-4">
            <span className="text-6xl">🎵</span>
            <p className="text-lg">Düzenlemek için bir playlist seçin</p>
            <p className="text-sm">veya yeni bir tane oluşturun</p>
          </div>
        ) : (
          <>
            {/* Playlist header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{selectedPlaylist.name}</h2>
                    {!selectedPlaylist.isActive && (
                      <span className="text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded-full">Pasif</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30 mt-0.5">
                    <span>{items.length} öğe</span>
                    <span>·</span>
                    <span>{fmtTotalDuration(items.filter((i) => i.isActive).reduce((s, i) => s + (i.duration ?? 0), 0))}</span>
                    <span>·</span>
                    <span>{selectedPlaylist.loop ? '🔁 Döngü' : '→ Bir kez'}</span>
                    {selectedPlaylist.shuffle && <><span>·</span><span>🔀 Karışık</span></>}
                    <span>·</span>
                    <span>{TRANSITION_OPTIONS.find((t) => t.value === selectedPlaylist.transition)?.icon} {TRANSITION_OPTIONS.find((t) => t.value === selectedPlaylist.transition)?.label}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingPlaylist(selectedPlaylist); setShowCreateModal(true); }}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
                >
                  ✏ Düzenle
                </button>
                <button
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <span>+</span> Öğe Ekle
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {itemsLoading ? (
                <div className="flex items-center justify-center h-32 text-white/30 text-sm">Yükleniyor...</div>
              ) : orderedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/25">
                  <span className="text-5xl">🎞</span>
                  <p className="text-base">Bu playlist henüz boş</p>
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="mt-2 px-5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                  >
                    İlk öğeyi ekle
                  </button>
                </div>
              ) : (
                <Reorder.Group axis="y" values={orderedItems} onReorder={handleReorder} className="space-y-2">
                  {orderedItems.map((item, idx) => {
                    const typeInfo = getItemTypeInfo(item.type);
                    return (
                      <Reorder.Item key={item.id} value={item}>
                        <motion.div
                          layout
                          className={cn(
                            'group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-grab active:cursor-grabbing',
                            item.isActive
                              ? 'border-white/8 bg-white/4 hover:border-white/12 hover:bg-white/6'
                              : 'border-white/4 bg-white/2 opacity-50'
                          )}
                        >
                          {/* Order number */}
                          <span className="w-6 text-center text-xs text-white/20 font-mono flex-shrink-0">
                            {idx + 1}
                          </span>

                          {/* Drag handle */}
                          <div className="flex-shrink-0 text-white/20 hover:text-white/50 cursor-grab select-none px-1">
                            ⋮⋮
                          </div>

                          {/* Thumbnail / type icon */}
                          <div
                            className="w-14 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: typeInfo.color + '22', border: `1px solid ${typeInfo.color}44` }}
                          >
                            {item.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <span className="text-lg">{typeInfo.icon}</span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: typeInfo.color + '33', color: typeInfo.color }}
                              >
                                {typeInfo.label}
                              </span>
                              <span className="text-sm text-white truncate">{item.title || item.mediaUrl || item.youtubeVideoId || item.layoutType || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-white/30">
                              <span>{fmtDuration(item.duration)}</span>
                              {item.transition && (
                                <>
                                  <span>·</span>
                                  <span>{TRANSITION_OPTIONS.find((t) => t.value === item.transition)?.icon} {item.transition}</span>
                                </>
                              )}
                              {item.mediaUrl && <span className="truncate max-w-[120px] font-mono">{item.mediaUrl}</span>}
                              {item.youtubeVideoId && <span className="font-mono">{item.youtubeVideoId}</span>}
                            </div>
                          </div>

                          {/* Duration badge */}
                          <div className="flex-shrink-0 text-sm font-mono text-white/40">
                            {fmtDuration(item.duration)}
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Toggle active */}
                            <button
                              onClick={() => toggleItemActive(item)}
                              className={cn(
                                'w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors',
                                item.isActive
                                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                                  : 'text-white/20 hover:bg-white/10'
                              )}
                            >
                              {item.isActive ? '✓' : '○'}
                            </button>
                            {/* Edit duration */}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              ✏
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </motion.div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>

            {/* Timeline bar */}
            {orderedItems.length > 0 && (
              <div className="flex-shrink-0 border-t border-white/8 px-6 py-3 bg-black/20">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-white/30">Zaman Çizelgesi</span>
                  <span className="text-xs text-white/50">
                    Toplam: {fmtTotalDuration(orderedItems.filter((i) => i.isActive).reduce((s, i) => s + (i.duration ?? 0), 0))}
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {(() => {
                    const total = orderedItems.filter((i) => i.isActive).reduce((s, i) => s + (i.duration ?? 0), 0);
                    if (!total) return null;
                    return orderedItems.filter((i) => i.isActive).map((item) => {
                      const pct = ((item.duration ?? 0) / total) * 100;
                      const typeInfo = getItemTypeInfo(item.type);
                      return (
                        <div
                          key={item.id}
                          title={`${item.title || item.type}: ${fmtDuration(item.duration)}`}
                          style={{ width: `${pct}%`, backgroundColor: typeInfo.color, minWidth: '2px' }}
                          className="rounded-sm h-full transition-all"
                        />
                      );
                    });
                  })()}
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {ITEM_TYPES.filter((t) => orderedItems.some((i) => i.isActive && i.type === t.value)).map((t) => (
                    <div key={t.value} className="flex items-center gap-1 text-xs text-white/30">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.color }} />
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Edit item duration/transition modal ──────────────────────────────── */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-80 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-base font-semibold text-white mb-4">Öğe Düzenle</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Süre (saniye)</label>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={editingItem.duration}
                    onChange={(e) => setEditingItem({ ...editingItem, duration: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {DURATION_PRESETS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setEditingItem({ ...editingItem, duration: d })}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs transition-colors',
                          editingItem.duration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                        )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Geçiş Efekti</label>
                  <select
                    value={editingItem.transition ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, transition: (e.target.value || undefined) as PlaylistTransition | undefined })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="">Playlist varsayılanı</option>
                    {TRANSITION_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleUpdateItem(editingItem.id, { duration: editingItem.duration, transition: editingItem.transition })}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm"
                >
                  Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create/Edit playlist modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <PlaylistForm
            initial={editingPlaylist ?? undefined}
            screens={screens}
            onSave={handleSavePlaylist}
            onClose={() => { setShowCreateModal(false); setEditingPlaylist(null); }}
          />
        )}
      </AnimatePresence>

      {/* ── Add item modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddItem && selectedPlaylist && (
          <AddItemForm
            playlist={selectedPlaylist}
            onAdd={handleAddItem}
            onClose={() => setShowAddItem(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingPlaylistId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-80 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 text-center"
            >
              <div className="text-3xl mb-3">⚠️</div>
              <h3 className="text-base font-semibold text-white mb-1">Playlist Silinecek</h3>
              <p className="text-sm text-white/40 mb-5">
                Bu playlist ve tüm öğeleri kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingPlaylistId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDeletePlaylist(deletingPlaylistId)}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors text-sm"
                >
                  Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
