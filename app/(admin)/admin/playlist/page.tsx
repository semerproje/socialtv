'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Playlist, PlaylistItem, PlaylistItemType, PlaylistTransition, ScreenData } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSITION_OPTIONS: { value: PlaylistTransition; label: string; icon: string }[] = [
  { value: 'fade',       label: 'Fade',         icon: '✨' },
  { value: 'slide_left', label: 'Sola Kayan',   icon: '←'  },
  { value: 'slide_up',   label: 'Yukarı Kayan', icon: '↑'  },
  { value: 'zoom',       label: 'Zoom',         icon: '🔍' },
  { value: 'blur',       label: 'Blur',         icon: '🌫' },
  { value: 'none',       label: 'Anında',       icon: '⚡' },
];

const ITEM_TYPES: { value: PlaylistItemType; label: string; icon: string; color: string; desc: string }[] = [
  { value: 'image',        label: 'Görsel',        icon: '🖼️',  color: '#6366f1', desc: 'Resim veya fotoğraf' },
  { value: 'video',        label: 'Video',         icon: '🎬',  color: '#ec4899', desc: 'MP4, MOV dosyası' },
  { value: 'youtube',      label: 'YouTube',       icon: '▶️',  color: '#ef4444', desc: 'YouTube video URL' },
  { value: 'content',      label: 'Sosyal İçerik', icon: '💬',  color: '#3b82f6', desc: 'Onaylı içerik' },
  { value: 'instagram',    label: 'Instagram',     icon: '📸',  color: '#f59e0b', desc: 'Instagram post' },
  { value: 'ad',           label: 'Reklam',        icon: '📺',  color: '#8b5cf6', desc: 'Reklam öğesi' },
  { value: 'layout',       label: 'Layout Geçişi', icon: '⊞',   color: '#10b981', desc: 'Ekran düzeni değiştir' },
  { value: 'announcement', label: 'Duyuru',        icon: '📢',  color: '#f97316', desc: 'Metin duyurusu' },
  { value: 'url',          label: 'Web Sayfası',   icon: '🌐',  color: '#14b8a6', desc: 'iframe embed' },
  { value: 'scene',        label: 'Sahne',         icon: '🎭',  color: '#a855f7', desc: 'Önceden tasarlanmış sahne' },
];

const LAYOUTS = [
  { value: 'default',          label: 'Varsayılan' },
  { value: 'youtube',          label: 'YouTube' },
  { value: 'instagram',        label: 'Instagram' },
  { value: 'split_2',          label: 'İkili Bölünmüş' },
  { value: 'fullscreen',       label: 'Tam Ekran' },
  { value: 'digital_signage',  label: 'Dijital Tabela' },
  { value: 'social_wall',      label: 'Sosyal Duvar' },
  { value: 'ambient',          label: 'Ortam' },
  { value: 'promo',            label: 'Promosyon' },
  { value: 'triple',           label: 'Üçlü' },
  { value: 'news_focus',       label: 'Haber Odak' },
  { value: 'portrait',         label: 'Dikey' },
  { value: 'markets',          label: 'Piyasalar' },
  { value: 'breaking_news',    label: 'Son Dakika' },
  { value: 'event_countdown',  label: 'Geri Sayım' },
  { value: 'split_scoreboard', label: 'Skorbord' },
];

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  if (sec === 0) return '∞ tam video';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}d ${s}s` : `${m}d`;
}

function fmtTotalDuration(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} saniye`;
  return s ? `${m} dk ${s} sn` : `${m} dakika`;
}

function getTypeInfo(type: PlaylistItemType) {
  return ITEM_TYPES.find((t) => t.value === type) ?? { label: type, icon: '📄', color: '#6b7280', desc: '' };
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

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, color = 'bg-indigo-500' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button onClick={onChange}
      className={cn('w-9 h-5 rounded-full transition-colors relative flex-shrink-0', on ? color : 'bg-white/10')}>
      <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all', on ? 'left-4' : 'left-0.5')} />
    </button>
  );
}

// ─── Playlist Form Modal ──────────────────────────────────────────────────────

function PlaylistForm({ initial, screens, onSave, onClose }: {
  initial?: Partial<Playlist>;
  screens: ScreenData[];
  onSave: (data: Partial<Playlist>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    loop: initial?.loop ?? true,
    shuffle: initial?.shuffle ?? false,
    transition: (initial?.transition ?? 'fade') as PlaylistTransition,
    defaultDuration: initial?.defaultDuration ?? 10,
    screenIds: initial?.screenIds ? (JSON.parse(initial.screenIds as string) as string[]) : [] as string[],
  });

  const toggleScreen = (id: string) =>
    setForm((f) => ({
      ...f,
      screenIds: f.screenIds.includes(id) ? f.screenIds.filter((s) => s !== id) : [...f.screenIds, id],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-lg bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">{initial?.id ? '✏ Playlist Düzenle' : '+ Yeni Playlist'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all">✕</button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Playlist Adı *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ör. Sabah Yayın Listesi"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 transition-colors text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Açıklama</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opsiyonel..." rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 transition-colors text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Varsayılan Süre (sn)</label>
              <input type="number" min={1} max={3600} value={form.defaultDuration}
                onChange={(e) => setForm({ ...form, defaultDuration: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/70 text-sm" />
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {[5, 10, 15, 30].map((d) => (
                  <button key={d} onClick={() => setForm({ ...form, defaultDuration: d })}
                    className={cn('px-2 py-0.5 rounded-md text-xs transition-colors',
                      form.defaultDuration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10')}>{d}s</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Geçiş Efekti</label>
              <select value={form.transition} onChange={(e) => setForm({ ...form, transition: e.target.value as PlaylistTransition })}
                className="w-full bg-[#0a1020] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/70 text-sm">
                {TRANSITION_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Toggle on={form.loop} onChange={() => setForm({ ...form, loop: !form.loop })} />
              <div>
                <p className="text-sm text-white/80 font-medium">Döngü</p>
                <p className="text-xs text-white/30">Liste bitince başa döner</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Toggle on={form.shuffle} onChange={() => setForm({ ...form, shuffle: !form.shuffle })} color="bg-purple-500" />
              <div>
                <p className="text-sm text-white/80 font-medium">Karıştır</p>
                <p className="text-xs text-white/30">Rastgele sırayla oynatır</p>
              </div>
            </label>
          </div>
          {screens.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                Atanan Ekranlar {form.screenIds.length > 0 && <span className="normal-case text-indigo-400 font-normal">({form.screenIds.length} seçili)</span>}
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {screens.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleScreen(s.id)}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all',
                      form.screenIds.includes(s.id)
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                        : 'border-white/8 bg-white/3 text-white/40 hover:border-white/15')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.isOnline ? 'bg-emerald-400' : 'bg-white/15')} />
                    <span className="truncate">{s.name}</span>
                    {form.screenIds.includes(s.id) && <span className="ml-auto text-indigo-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-white/8">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm">İptal</button>
          <button onClick={() => { if (!form.name.trim()) { toast.error('Playlist adı giriniz'); return; } onSave({ ...form, screenIds: JSON.stringify(form.screenIds) }); }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm">
            {initial?.id ? 'Kaydet' : '+ Oluştur'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Add Item Form Modal ──────────────────────────────────────────────────────

function AddItemForm({ playlist, onAdd, onClose }: {
  playlist: Playlist;
  onAdd: (data: Partial<PlaylistItem>) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<PlaylistItemType | null>(null);
  const [form, setForm] = useState({
    title: '', mediaUrl: '', youtubeInput: '', youtubeVideoId: '',
    layoutType: 'default', contentRef: '', duration: playlist.defaultDuration,
    transition: '' as PlaylistTransition | '', thumbnailUrl: '', announcement: '',
  });
  const [ytThumb, setYtThumb] = useState('');

  const handleYtInput = (val: string) => {
    setForm((f) => ({ ...f, youtubeInput: val }));
    const id = extractYouTubeId(val);
    if (id) {
      const thumb = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
      setForm((f) => ({ ...f, youtubeVideoId: id, thumbnailUrl: thumb }));
      setYtThumb(thumb);
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
      case 'image': case 'video': case 'url':
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
        data.title = data.title || `${LAYOUTS.find(l => l.value === form.layoutType)?.label ?? form.layoutType} layout`;
        break;
      case 'announcement':
        if (!form.announcement) { toast.error('Duyuru metni giriniz'); return; }
        data.payload = JSON.stringify({ text: form.announcement });
        data.title = data.title || form.announcement.slice(0, 40);
        break;
      default:
        if (!form.contentRef) { toast.error('ID giriniz'); return; }
        data.contentRef = form.contentRef;
        break;
    }
    onAdd(data);
  };

  const typeInfo = selectedType ? getTypeInfo(selectedType) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-xl bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <button onClick={() => setStep('type')} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">← Geri</button>
            )}
            <h2 className="text-base font-semibold text-white">
              {step === 'type' ? 'İçerik Türü Seç' : <span className="flex items-center gap-2"><span>{typeInfo?.icon}</span><span>{typeInfo?.label} Ekle</span></span>}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all">✕</button>
        </div>
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'type' ? (
              <motion.div key="type" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="grid grid-cols-2 gap-2.5">
                  {ITEM_TYPES.map((t) => (
                    <button key={t.value} onClick={() => { setSelectedType(t.value); setStep('details'); }}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/8 hover:border-white/20 bg-white/2 hover:bg-white/5 transition-all text-left">
                      <span className="text-2xl w-8 flex-shrink-0 text-center">{t.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{t.label}</div>
                        <div className="text-xs text-white/30 mt-0.5">{t.desc}</div>
                      </div>
                      <div className="w-2 h-2 rounded-full ml-auto flex-shrink-0" style={{ background: t.color }} />
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="details" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Başlık (opsiyonel)</label>
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Otomatik üretilir…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 text-sm" />
                  </div>

                  {(selectedType === 'image' || selectedType === 'video' || selectedType === 'url') && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                        {selectedType === 'image' ? 'Görsel URL' : selectedType === 'video' ? 'Video URL' : 'Web Sayfası URL'}
                      </label>
                      <input value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} placeholder="https://..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 text-sm font-mono" />
                      {selectedType === 'image' && form.mediaUrl && (
                        <div className="mt-2 rounded-xl overflow-hidden h-28 bg-black/40 border border-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={form.mediaUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedType === 'youtube' && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">YouTube Link veya Video ID</label>
                      <input value={form.youtubeInput} onChange={(e) => handleYtInput(e.target.value)}
                        placeholder="https://youtube.com/watch?v=... veya 11 karakter ID"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-red-500/70 text-sm font-mono" />
                      {ytThumb && (
                        <div className="mt-2 relative rounded-xl overflow-hidden h-32 bg-black border border-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ytThumb} alt="thumbnail" className="w-full h-full object-cover opacity-75" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg">
                              <span className="text-white text-lg ml-0.5">▶</span>
                            </div>
                          </div>
                          <div className="absolute bottom-2 left-3 text-xs text-white/70 font-mono bg-black/60 px-2 py-0.5 rounded">
                            {form.youtubeVideoId}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedType === 'layout' && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Layout</label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                        {LAYOUTS.map((l) => (
                          <button key={l.value} onClick={() => setForm({ ...form, layoutType: l.value })}
                            className={cn('px-3 py-2 rounded-xl border text-left text-xs transition-all',
                              form.layoutType === l.value
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                : 'border-white/8 bg-white/3 text-white/50 hover:border-white/15')}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedType === 'announcement' && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Duyuru Metni</label>
                      <textarea value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                        placeholder="Ekranda gösterilecek duyuru metni..." rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 text-sm resize-none" />
                    </div>
                  )}

                  {(selectedType === 'content' || selectedType === 'instagram' || selectedType === 'ad' || selectedType === 'scene') && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                        {selectedType === 'content' ? 'İçerik ID' : selectedType === 'instagram' ? 'Instagram Post ID' : selectedType === 'ad' ? 'Reklam ID' : 'Sahne ID'}
                      </label>
                      <input value={form.contentRef} onChange={(e) => setForm({ ...form, contentRef: e.target.value })} placeholder="ID..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/70 text-sm font-mono" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                      Gösterim Süresi {(selectedType === 'video' || selectedType === 'youtube') && <span className="text-white/25 font-normal normal-case">(0 = tam video)</span>}
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} max={3600} value={form.duration}
                        onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                        className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/70 text-sm" />
                      <span className="text-xs text-white/30">saniye</span>
                      <div className="flex gap-1 flex-wrap">
                        {DURATION_PRESETS.slice(0, 7).map((d) => (
                          <button key={d} onClick={() => setForm({ ...form, duration: d })}
                            className={cn('px-2 py-1 rounded-lg text-xs transition-colors',
                              form.duration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10')}>{d}s</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Geçiş (opsiyonel)</label>
                    <select value={form.transition} onChange={(e) => setForm({ ...form, transition: e.target.value as PlaylistTransition })}
                      className="w-full bg-[#0a1020] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/70 text-sm">
                      <option value="">Playlist varsayılanı ({TRANSITION_OPTIONS.find(t => t.value === (playlist.transition ?? 'fade'))?.label})</option>
                      {TRANSITION_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm">İptal</button>
                    <button onClick={handleAdd} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm">+ Ekle</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Item Preview Panel ────────────────────────────────────────────────────────

function ItemPreviewPanel({ item, playlist, onClose, onUpdate, onDelete, onDuplicate }: {
  item: PlaylistItem;
  playlist: Playlist;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<PlaylistItem>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: PlaylistItem) => void;
}) {
  const typeInfo = getTypeInfo(item.type);
  const [localDuration, setLocalDuration] = useState(item.duration);
  const [localTransition, setLocalTransition] = useState<PlaylistTransition | ''>(item.transition ?? '');

  useEffect(() => {
    setLocalDuration(item.duration);
    setLocalTransition(item.transition ?? '');
  }, [item.id, item.duration, item.transition]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2 }}
      className="w-80 flex-shrink-0 border-l border-white/8 flex flex-col bg-[#090e1c] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeInfo.icon}</span>
          <span className="text-sm font-medium text-white/80">{typeInfo.label}</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/8 transition-all text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative bg-black" style={{ paddingBottom: item.type === 'youtube' ? '56.25%' : '45%' }}>
          {item.type === 'youtube' && item.youtubeVideoId && (
            <iframe className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${item.youtubeVideoId}?autoplay=0&mute=1&rel=0`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          )}
          {item.type === 'image' && item.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
          )}
          {(item.type !== 'youtube' && item.type !== 'image') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${typeInfo.color}18, rgba(9,14,28,0.98))` }}>
              {item.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              )}
              <span className="text-5xl z-10">{typeInfo.icon}</span>
              <span className="text-xs text-white/30 z-10 uppercase tracking-wider">{typeInfo.label}</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-xs text-white/70 font-mono">
            {fmtDuration(item.duration)}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-white/30 mb-1">Başlık</p>
            <p className="text-sm text-white font-medium leading-snug">{item.title || '—'}</p>
          </div>
          {item.mediaUrl && (
            <div>
              <p className="text-xs text-white/30 mb-1">URL</p>
              <p className="text-xs text-white/50 font-mono break-all leading-relaxed">{item.mediaUrl}</p>
            </div>
          )}
          {item.youtubeVideoId && (
            <div>
              <p className="text-xs text-white/30 mb-1">Video ID</p>
              <p className="text-xs text-white/60 font-mono">{item.youtubeVideoId}</p>
            </div>
          )}
          {item.layoutType && (
            <div>
              <p className="text-xs text-white/30 mb-1">Layout</p>
              <p className="text-sm text-white">{LAYOUTS.find(l => l.value === item.layoutType)?.label ?? item.layoutType}</p>
            </div>
          )}

          <div className="h-px bg-white/5" />

          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Süre</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={3600} value={localDuration}
                onChange={(e) => setLocalDuration(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/70 text-sm" />
              <span className="text-xs text-white/25">sn</span>
            </div>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {DURATION_PRESETS.slice(0, 6).map((d) => (
                <button key={d} onClick={() => setLocalDuration(d)}
                  className={cn('px-2 py-0.5 rounded text-xs transition-colors',
                    localDuration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/30 hover:bg-white/10')}>{d}s</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Geçiş</label>
            <select value={localTransition} onChange={(e) => setLocalTransition(e.target.value as PlaylistTransition)}
              className="w-full bg-[#0a1020] border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/70 text-xs">
              <option value="">Playlist varsayılanı</option>
              {TRANSITION_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          <button onClick={() => onUpdate(item.id, { duration: localDuration, transition: (localTransition || undefined) as PlaylistTransition | undefined })}
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
            Kaydet
          </button>

          <div className="h-px bg-white/5" />

          <div className="flex gap-2">
            <button onClick={() => onDuplicate(item)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs">
              ⧉ Kopyala
            </button>
            <button onClick={() => { if (confirm('Bu öğeyi silmek istiyor musunuz?')) onDelete(item.id); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/8 transition-all text-xs">
              ✕ Sil
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlaylistPage() {
  const [playlists, setPlaylists]                   = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist]     = useState<Playlist | null>(null);
  const [items, setItems]                           = useState<PlaylistItem[]>([]);
  const [orderedItems, setOrderedItems]             = useState<PlaylistItem[]>([]);
  const [screens, setScreens]                       = useState<ScreenData[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [itemsLoading, setItemsLoading]             = useState(false);
  const [saving, setSaving]                         = useState(false);
  const [search, setSearch]                         = useState('');
  const [filterActive, setFilterActive]             = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [editingPlaylist, setEditingPlaylist]       = useState<Playlist | null>(null);
  const [showAddItem, setShowAddItem]               = useState(false);
  const [selectedItem, setSelectedItem]             = useState<PlaylistItem | null>(null);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [showSendMenu, setShowSendMenu]             = useState(false);
  const [timelineHover, setTimelineHover]           = useState<string | null>(null);

  const reorderTimeout = useRef<ReturnType<typeof setTimeout>>();
  const sendMenuRef    = useRef<HTMLDivElement>(null);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists?active=0');
      if (res.ok) { const d = await res.json(); setPlaylists(d.data ?? []); }
    } catch { toast.error('Playlist listesi alınamadı'); }
    finally { setLoading(false); }
  }, []);

  const fetchScreens = useCallback(async () => {
    try {
      const res = await fetch('/api/screens');
      if (res.ok) { const d = await res.json(); setScreens(d.screens ?? d.data ?? []); }
    } catch { /**/ }
  }, []);

  const loadPlaylist = useCallback(async (id: string) => {
    setItemsLoading(true);
    setSelectedItem(null);
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedPlaylist(d.data);
        const its: PlaylistItem[] = d.data.items ?? [];
        setItems(its);
        setOrderedItems(its);
      }
    } catch { toast.error('Playlist yüklenemedi'); }
    finally { setItemsLoading(false); }
  }, []);

  useEffect(() => { fetchPlaylists(); fetchScreens(); }, [fetchPlaylists, fetchScreens]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node)) setShowSendMenu(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

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
      setShowCreateModal(false); setEditingPlaylist(null);
      await fetchPlaylists();
      if (!isEdit) loadPlaylist(d.data.id);
      else if (selectedPlaylist?.id === editingPlaylist?.id) setSelectedPlaylist(d.data);
    } catch { toast.error('Kayıt başarısız'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (p: Playlist) => {
    try {
      await fetch(`/api/playlists/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await fetchPlaylists();
      if (selectedPlaylist?.id === p.id) setSelectedPlaylist({ ...selectedPlaylist, isActive: !p.isActive });
    } catch { toast.error('Güncelleme başarısız'); }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      toast.success('Playlist silindi');
      setDeletingPlaylistId(null);
      if (selectedPlaylist?.id === id) { setSelectedPlaylist(null); setItems([]); setOrderedItems([]); }
      await fetchPlaylists();
    } catch { toast.error('Silme başarısız'); }
  };

  const handleAddItem = async (data: Partial<PlaylistItem>) => {
    if (!selectedPlaylist) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Öğe eklendi');
      setShowAddItem(false);
      await loadPlaylist(selectedPlaylist.id);
      await fetchPlaylists();
    } catch { toast.error('Eklenemedi'); }
    finally { setSaving(false); }
  };

  const handleUpdateItem = async (itemId: string, data: Partial<PlaylistItem>) => {
    if (!selectedPlaylist) return;
    setSaving(true);
    try {
      await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_item', itemId, ...data }),
      });
      toast.success('Güncellendi');
      await loadPlaylist(selectedPlaylist.id);
      setSelectedItem(prev => prev?.id === itemId ? { ...prev, ...data } : prev);
    } catch { toast.error('Güncelleme başarısız'); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedPlaylist) return;
    if (selectedItem?.id === itemId) setSelectedItem(null);
    try {
      await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_item', itemId }),
      });
      toast.success('Öğe silindi');
      await loadPlaylist(selectedPlaylist.id);
      await fetchPlaylists();
    } catch { toast.error('Silme başarısız'); }
  };

  const handleDuplicateItem = async (item: PlaylistItem) => {
    if (!selectedPlaylist) return;
    const data: Partial<PlaylistItem> = {
      type: item.type, title: item.title ? `${item.title} (kopya)` : undefined,
      duration: item.duration, transition: item.transition,
      mediaUrl: item.mediaUrl, youtubeVideoId: item.youtubeVideoId,
      layoutType: item.layoutType, contentRef: item.contentRef,
      thumbnailUrl: item.thumbnailUrl, payload: item.payload,
    };
    try {
      await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      toast.success('Öğe kopyalandı');
      await loadPlaylist(selectedPlaylist.id);
      await fetchPlaylists();
    } catch { toast.error('Kopyalama başarısız'); }
  };

  const toggleItemActive = (item: PlaylistItem) => handleUpdateItem(item.id, { isActive: !item.isActive });

  const handleReorder = (newOrder: PlaylistItem[]) => {
    setOrderedItems(newOrder);
    clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(async () => {
      if (!selectedPlaylist) return;
      try {
        await fetch(`/api/playlists/${selectedPlaylist.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', items: newOrder.map((it, idx) => ({ id: it.id, order: idx })) }),
        });
        setItems(newOrder);
      } catch { toast.error('Sıralama kaydedilemedi'); setOrderedItems(items); }
    }, 600);
  };

  const sendToScreen = async (screenId: string | 'all') => {
    if (!selectedPlaylist) return;
    setShowSendMenu(false);
    try {
      const cmd = { type: 'start_playlist', data: { playlistId: selectedPlaylist.id, playlistName: selectedPlaylist.name }, sentAt: serverTimestamp() };
      if (db) {
        if (screenId === 'all') {
          await setDoc(doc(db, 'broadcast', 'current'), { lastCommand: cmd });
        } else {
          await setDoc(doc(db, 'screens', screenId), { lastCommand: cmd }, { merge: true });
        }
      }
      await fetch('/api/sync/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'start_playlist', data: { playlistId: selectedPlaylist.id }, screenId: screenId === 'all' ? undefined : screenId }),
      });
      toast.success(screenId === 'all' ? 'Tüm ekranlara gönderildi' : `${screens.find(s => s.id === screenId)?.name ?? 'Ekrana'} gönderildi`);
    } catch { toast.error('Gönderme başarısız'); }
  };

  const filteredPlaylists = playlists.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterActive === 'active' && !p.isActive) return false;
    if (filterActive === 'inactive' && p.isActive) return false;
    return true;
  });

  const activeItems         = orderedItems.filter((i) => i.isActive);
  const totalActiveDuration = activeItems.reduce((s, i) => s + (i.duration ?? 0), 0);

  const assignedScreens = (() => {
    if (!selectedPlaylist?.screenIds) return [] as string[];
    try { return JSON.parse(selectedPlaylist.screenIds as string) as string[]; } catch { return [] as string[]; }
  })();

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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#060c18]">

      {/* LEFT PANEL */}
      <div className="w-72 border-r border-white/6 flex flex-col flex-shrink-0 bg-[#080e1c]">
        <div className="px-4 pt-4 pb-3 border-b border-white/6 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold text-white">Playlistler</h1>
            <span className="text-xs text-white/25">{playlists.length} liste</span>
          </div>
          <button onClick={() => { setEditingPlaylist(null); setShowCreateModal(true); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20">
            <span className="text-base font-light">+</span> Yeni Playlist
          </button>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara..."
              className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors" />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button key={f} onClick={() => setFilterActive(f)}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  filterActive === f ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/30 hover:text-white/60')}>
                {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Pasif'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/20">
              <div className="w-6 h-6 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-xs">Yükleniyor…</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/20 gap-2">
              <span className="text-3xl">🎵</span>
              <p className="text-xs">{search ? 'Sonuç bulunamadı' : 'Henüz playlist yok'}</p>
            </div>
          ) : (
            filteredPlaylists.map((p) => (
              <div key={p.id} onClick={() => loadPlaylist(p.id)}
                className={cn('group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border',
                  selectedPlaylist?.id === p.id
                    ? 'border-indigo-500/40 bg-indigo-500/8'
                    : 'border-transparent hover:border-white/6 hover:bg-white/3')}>
                <div className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full transition-all',
                  p.isActive ? 'bg-emerald-400/60' : 'bg-white/10')} />
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5',
                  selectedPlaylist?.id === p.id ? 'bg-indigo-500/25' : 'bg-white/6')}>🎵</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-white truncate block">{p.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/25">
                    <span>{p.itemCount ?? 0} öğe</span><span>·</span><span>{fmtTotalDuration(p.totalDuration ?? 0)}</span>
                  </div>
                  <div className="text-[10px] text-white/15 truncate mt-0.5">{getAssignedScreenNames(p)}</div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleToggleActive(p); }}
                    title={p.isActive ? 'Pasife al' : 'Aktive al'}
                    className={cn('w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors',
                      p.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/20 hover:bg-white/8')}>
                    {p.isActive ? '●' : '○'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPlaylist(p); setShowCreateModal(true); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] text-white/20 hover:text-white/70 hover:bg-white/8 transition-colors">✏</button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingPlaylistId(p.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] text-white/20 hover:text-red-400 hover:bg-red-500/8 transition-colors">✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {playlists.length > 0 && (
          <div className="px-4 py-3 border-t border-white/6">
            <div className="flex items-center justify-between text-[10px] text-white/20">
              <span>{playlists.filter(p => p.isActive).length} aktif</span>
              <span>{playlists.filter(p => !p.isActive).length} pasif</span>
              <span>{screens.length} ekran</span>
            </div>
          </div>
        )}
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!selectedPlaylist ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-white/15">
            <div className="w-24 h-24 rounded-3xl bg-white/3 flex items-center justify-center">
              <span className="text-5xl">🎵</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-white/30">Playlist seçin</p>
              <p className="text-sm mt-1">Sol panelden bir playlist seçin veya yeni oluşturun</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 flex-shrink-0 bg-[#080e1c]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white truncate">{selectedPlaylist.name}</h2>
                  <button onClick={() => handleToggleActive(selectedPlaylist)}
                    className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all',
                      selectedPlaylist.isActive
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'
                        : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/8')}>
                    {selectedPlaylist.isActive ? '● Aktif' : '○ Pasif'}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/30 mt-0.5 flex-wrap">
                  <span><span className="font-semibold text-white/50">{activeItems.length}</span> öğe aktif</span>
                  <span className="text-white/10">·</span>
                  <span>{fmtTotalDuration(totalActiveDuration)}</span>
                  <span className="text-white/10">·</span>
                  <span>{selectedPlaylist.loop ? '🔁 Döngü' : '→ Bir kez'}</span>
                  {selectedPlaylist.shuffle && <><span className="text-white/10">·</span><span>🔀 Karışık</span></>}
                  {assignedScreens.length > 0 && <><span className="text-white/10">·</span><span>{assignedScreens.length} ekran</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative" ref={sendMenuRef}>
                  <button onClick={() => setShowSendMenu(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm">
                    <span>📡</span><span>Ekrana Gönder</span><span className="text-white/30 text-xs">▾</span>
                  </button>
                  <AnimatePresence>
                    {showSendMenu && (
                      <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1.5 w-56 bg-[#0d1424] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                        <button onClick={() => sendToScreen('all')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-sm text-white/80 hover:text-white border-b border-white/6">
                          <span>📡</span><span>Tüm Ekranlar</span>
                          <span className="ml-auto text-xs text-white/25">{screens.filter(s => s.isOnline).length} canlı</span>
                        </button>
                        {screens.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-white/25">Ekran bulunamadı</p>
                        ) : screens.map((s) => (
                          <button key={s.id} onClick={() => sendToScreen(s.id)}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-sm text-white/60 hover:text-white">
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.isOnline ? 'bg-emerald-400' : 'bg-white/20')} />
                            <span className="truncate">{s.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={() => { setEditingPlaylist(selectedPlaylist); setShowCreateModal(true); }}
                  className="px-3 py-1.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm">
                  ✏ Düzenle
                </button>
                <button onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-500/15">
                  + Öğe Ekle
                </button>
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {itemsLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/20">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs">Yükleniyor…</span>
                </div>
              ) : orderedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 gap-4 text-white/20">
                  <div className="w-16 h-16 rounded-2xl bg-white/3 flex items-center justify-center"><span className="text-4xl">🎞</span></div>
                  <div className="text-center">
                    <p className="text-base font-medium text-white/25">Bu playlist henüz boş</p>
                    <p className="text-sm mt-1">Görsel, video, YouTube veya layout ekleyin</p>
                  </div>
                  <button onClick={() => setShowAddItem(true)}
                    className="px-5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                    + İlk öğeyi ekle
                  </button>
                </div>
              ) : (
                <Reorder.Group axis="y" values={orderedItems} onReorder={handleReorder} className="space-y-1.5">
                  {orderedItems.map((item, idx) => {
                    const tInfo = getTypeInfo(item.type);
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <Reorder.Item key={item.id} value={item}>
                        <motion.div layout
                          onClick={() => setSelectedItem(isSelected ? null : item)}
                          className={cn('group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer',
                            isSelected ? 'border-indigo-500/50 bg-indigo-500/8 shadow-sm'
                              : item.isActive ? 'border-white/6 bg-white/2 hover:border-white/10 hover:bg-white/4'
                              : 'border-white/3 bg-transparent opacity-40 hover:opacity-60')}>
                          <span className="w-5 text-center text-[10px] text-white/15 font-mono flex-shrink-0">{idx + 1}</span>
                          <div className="flex-shrink-0 text-white/12 hover:text-white/40 cursor-grab active:cursor-grabbing select-none text-xs px-0.5"
                            onClick={e => e.stopPropagation()}>⠿</div>
                          <div className="w-12 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: tInfo.color + '20', border: `1px solid ${tInfo.color}35` }}>
                            {item.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">{tInfo.icon}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                                style={{ background: tInfo.color + '28', color: tInfo.color }}>{tInfo.label}</span>
                              <span className="text-sm text-white/80 truncate">
                                {item.title || item.mediaUrl?.split('/').pop() || item.youtubeVideoId || item.layoutType || '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-white/25">
                              <span className="font-mono">{fmtDuration(item.duration)}</span>
                              {item.transition && <><span>·</span><span>{TRANSITION_OPTIONS.find(t => t.value === item.transition)?.icon} {item.transition}</span></>}
                            </div>
                          </div>
                          <div className={cn('flex items-center gap-0.5 flex-shrink-0 transition-opacity',
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                            <button onClick={(e) => { e.stopPropagation(); toggleItemActive(item); }}
                              className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors',
                                item.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/20 hover:bg-white/8')}>
                              {item.isActive ? '✓' : '○'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDuplicateItem(item); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors">⧉</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-colors">✕</button>
                          </div>
                        </motion.div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>

            {/* Timeline */}
            {orderedItems.length > 0 && (
              <div className="flex-shrink-0 border-t border-white/6 px-5 py-3 bg-[#080e1c]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-white/25 uppercase tracking-wider">Zaman Çizelgesi</span>
                  <div className="flex items-center gap-3 text-[10px] text-white/30">
                    <span>{activeItems.length}/{orderedItems.length} aktif</span>
                    <span>·</span>
                    <span className="font-medium text-white/50">{fmtTotalDuration(totalActiveDuration)}</span>
                  </div>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                  {(() => {
                    const total = totalActiveDuration;
                    if (!total) return <div className="flex-1 bg-white/5 rounded-full" />;
                    return activeItems.map((i) => {
                      const pct = ((i.duration ?? 0) / total) * 100;
                      const tInfo = getTypeInfo(i.type);
                      return (
                        <div key={i.id}
                          onMouseEnter={() => setTimelineHover(i.id)}
                          onMouseLeave={() => setTimelineHover(null)}
                          onClick={() => setSelectedItem(i)}
                          title={`${i.title || i.type}: ${fmtDuration(i.duration)}`}
                          style={{ width: `${Math.max(pct, 0.8)}%`, backgroundColor: timelineHover === i.id ? '#fff' : tInfo.color, opacity: timelineHover === i.id ? 0.9 : 0.7 }}
                          className="h-full rounded-sm cursor-pointer transition-all duration-150" />
                      );
                    });
                  })()}
                </div>
                <div className="flex gap-4 mt-1.5 flex-wrap">
                  {ITEM_TYPES.filter(t => orderedItems.some(i => i.isActive && i.type === t.value)).map(t => (
                    <div key={t.value} className="flex items-center gap-1 text-[10px] text-white/25">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.color }} />
                      <span>{t.label}</span>
                      <span className="text-white/15">×{orderedItems.filter(i => i.isActive && i.type === t.value).length}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* RIGHT PANEL — item preview */}
      <AnimatePresence>
        {selectedItem && selectedPlaylist && (
          <ItemPreviewPanel key={selectedItem.id} item={selectedItem} playlist={selectedPlaylist}
            onClose={() => setSelectedItem(null)} onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem} onDuplicate={handleDuplicateItem} />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <PlaylistForm initial={editingPlaylist ?? undefined} screens={screens} onSave={handleSavePlaylist}
            onClose={() => { setShowCreateModal(false); setEditingPlaylist(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddItem && selectedPlaylist && (
          <AddItemForm playlist={selectedPlaylist} onAdd={handleAddItem} onClose={() => setShowAddItem(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingPlaylistId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-80 bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Playlist Silinecek</h3>
              <p className="text-sm text-white/35 mb-5 leading-relaxed">Bu playlist ve tüm öğeleri kalıcı olarak silinecek. Geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingPlaylistId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm">İptal</button>
                <button onClick={() => handleDeletePlaylist(deletingPlaylistId)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors text-sm">Sil</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saving && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/90 backdrop-blur-sm text-white text-sm shadow-xl z-40">
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Kaydediliyor…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
