'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenData {
  id: string;
  name: string;
  location?: string;
  layoutType: string;
  orientation: string;
  resolution?: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeen?: string;
  ipAddress?: string;
  group?: { id: string; name: string } | null;
  groupId?: string;
  sseInfo?: { connectedAt: string };
}

interface GroupData {
  id: string;
  name: string;
  color?: string;
  description?: string;
  screenCount?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LAYOUTS = [
  { value: 'default',        label: 'Varsayılan',     icon: '⊞',  desc: 'Sosyal feed + widget',        color: 'indigo'  },
  { value: 'youtube',        label: 'YouTube',        icon: '▶',  desc: 'YouTube büyük, feed küçük',   color: 'red'     },
  { value: 'instagram',      label: 'Instagram',      icon: '◈',  desc: 'Instagram tam ekran',         color: 'pink'    },
  { value: 'split_2',        label: 'İkili',          icon: '⬜',  desc: 'İki eşit bölge',              color: 'sky'     },
  { value: 'fullscreen',     label: 'Tam Ekran',      icon: '⛶',  desc: 'Medya tam ekran',             color: 'violet'  },
  { value: 'digital_signage',label: 'Dijital Tabela', icon: '☰',  desc: 'Başlık + 2/3 büyük alan',     color: 'amber'   },
  { value: 'social_wall',    label: 'Sosyal Duvar',   icon: '⊡',  desc: 'Instagram mozaik 3×2 grid',   color: 'teal'    },
  { value: 'ambient',        label: 'Ortam',          icon: '◐',  desc: 'Büyük saat + hava durumu',    color: 'slate'   },
  { value: 'promo',          label: 'Promosyon',      icon: '★',  desc: 'Öne çıkan içerik döngüsü',   color: 'orange'  },
  { value: 'triple',         label: 'Üçlü',           icon: '⋮',  desc: 'Feed | Instagram | YouTube',  color: 'cyan'    },
  { value: 'news_focus',     label: 'Haber Odak',     icon: '≡',  desc: 'Sol marka + sağ içerik',      color: 'lime'    },
  { value: 'portrait',       label: 'Dikey',          icon: '▬',  desc: 'Dikey ekran optimizasyonu',   color: 'purple'  },
  { value: 'markets',        label: 'Piyasalar',      icon: '📈', desc: 'Canlı döviz & kripto verileri', color: 'emerald' },
  { value: 'breaking_news',  label: 'Son Dakika',     icon: '🔴', desc: 'Acil haber bandı',             color: 'red'     },
  { value: 'event_countdown',label: 'Geri Sayım',     icon: '⏳', desc: 'Etkinlik geri sayım',          color: 'violet'  },
  { value: 'split_scoreboard',label: 'Skorbord',      icon: '⚽', desc: 'Sol skor + sağ feed',          color: 'green'   },
];

const LAYOUT_COLOR: Record<string, string> = {
  default:        'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  youtube:        'bg-red-500/20 text-red-300 border-red-500/30',
  instagram:      'bg-pink-500/20 text-pink-300 border-pink-500/30',
  split_2:        'bg-sky-500/20 text-sky-300 border-sky-500/30',
  fullscreen:     'bg-violet-500/20 text-violet-300 border-violet-500/30',
  digital_signage:'bg-amber-500/20 text-amber-300 border-amber-500/30',
  social_wall:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  ambient:        'bg-slate-500/20 text-slate-300 border-slate-500/30',
  promo:          'bg-orange-500/20 text-orange-300 border-orange-500/30',
  triple:         'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  news_focus:     'bg-lime-500/20 text-lime-300 border-lime-500/30',
  portrait:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  markets:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  breaking_news:  'bg-red-500/20 text-red-300 border-red-500/30',
  event_countdown:'bg-violet-500/20 text-violet-300 border-violet-500/30',
  split_scoreboard:'bg-green-500/20 text-green-300 border-green-500/30',
};

const COMMANDS = [
  { event: 'reload',         label: 'Yenile',          icon: '↺',  color: 'text-slate-300' },
  { event: 'update_content', label: 'İçerik Güncelle', icon: '⟳',  color: 'text-blue-300'  },
  { event: 'show_instagram', label: 'Instagramı Göster',icon: '◈', color: 'text-pink-300'  },
  { event: 'mute',           label: 'Sessiz',           icon: '⊘',  color: 'text-amber-300' },
  { event: 'unmute',         label: 'Sesi Aç',          icon: '♪',  color: 'text-emerald-300'},
  { event: 'blackout',       label: 'Karart',           icon: '●',  color: 'text-red-300'   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? (url.length === 11 ? url : null);
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s önce`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}dk önce`;
  return `${Math.round(diff / 3_600_000)}sa önce`;
}

// ─── Layout Visual Preview ─────────────────────────────────────────────────

function LayoutPreview({ type }: { type: string }) {
  const base = 'bg-white/20 rounded-sm';
  const layouts: Record<string, React.ReactNode> = {
    default: (
      <div className="flex gap-0.5 w-full h-full">
        <div className={`${base} flex-1`} />
        <div className="flex flex-col gap-0.5 w-1/3">
          <div className={`${base} flex-1`} />
          <div className={`${base} flex-1`} />
        </div>
      </div>
    ),
    youtube: (
      <div className="flex gap-0.5 w-full h-full">
        <div className={`${base} flex-[3]`} />
        <div className={`${base} flex-1`} />
      </div>
    ),
    instagram: <div className={`${base} w-full h-full`} />,
    split_2: (
      <div className="flex gap-0.5 w-full h-full">
        <div className={`${base} flex-1`} />
        <div className={`${base} flex-1`} />
      </div>
    ),
    fullscreen: <div className={`${base} w-full h-full`} />,
    digital_signage: (
      <div className="flex flex-col gap-0.5 w-full h-full">
        <div className={`${base} h-1.5`} />
        <div className="flex gap-0.5 flex-1">
          <div className={`${base} flex-[2]`} />
          <div className="flex flex-col gap-0.5 flex-1">
            <div className={`${base} flex-1`} />
            <div className={`${base} flex-1`} />
          </div>
        </div>
      </div>
    ),
    social_wall: <div className="grid grid-cols-3 grid-rows-2 gap-0.5 w-full h-full">{Array(6).fill(0).map((_,i) => <div key={i} className={base} />)}</div>,
    ambient: (
      <div className="w-full h-full flex items-center justify-center">
        <div className={`${base} w-5 h-2.5 mx-auto`} />
      </div>
    ),
    promo: <div className={`${base} w-full h-full`} />,
    triple: (
      <div className="flex gap-0.5 w-full h-full">
        <div className={`${base} flex-1`} />
        <div className={`${base} flex-1`} />
        <div className={`${base} flex-1`} />
      </div>
    ),
    news_focus: (
      <div className="flex gap-0.5 w-full h-full">
        <div className={`${base} w-1/3`} />
        <div className={`${base} flex-1`} />
      </div>
    ),
    portrait: (
      <div className="flex flex-col gap-0.5 w-full h-full">
        <div className={`${base} flex-1`} />
        <div className={`${base} h-1.5`} />
        <div className={`${base} flex-1`} />
      </div>
    ),
    markets: (
      <div className="flex gap-0.5 w-full h-full">
        <div className="flex flex-col gap-0.5 flex-[2]">
          <div className={`${base} h-1.5`} />
          <div className={`${base} flex-1`} />
        </div>
        <div className={`${base} flex-1`} />
      </div>
    ),
  };
  return (
    <div className="w-10 h-7 p-0.5 bg-black/40 rounded border border-white/10">
      {layouts[type] ?? <div className={`${base} w-full h-full`} />}
    </div>
  );
}

// ─── Screen Card ──────────────────────────────────────────────────────────────

function ScreenCard({
  screen,
  selected,
  onSelect,
  onCommand,
  onLayoutChange,
  onDelete,
  onEdit,
  onCopyUrl,
  onShowQr,
}: {
  screen: ScreenData;
  selected: boolean;
  onSelect: () => void;
  onCommand: (event: string, data?: Record<string, unknown>) => void;
  onLayoutChange: (layout: string, mainContentSource?: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onCopyUrl: () => void;
  onShowQr: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [contentSource, setContentSource] = useState('auto');

  const sendYt = () => {
    const id = extractYouTubeId(ytUrl);
    if (!id) { toast.error('Geçersiz URL'); return; }
    onCommand('play_youtube', { videoId: id, title: 'YouTube Video' });
    setYtUrl('');
    toast.success('Video gönderildi');
  };

  const sendMsg = () => {
    if (!msg.trim()) return;
    onCommand('overlay_message', { text: msg, duration: 10 });
    setMsg('');
    toast.success('Mesaj gönderildi');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        selected
          ? 'border-indigo-500/60 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          : screen.isOnline
          ? 'border-white/10 bg-[#0f1117] hover:border-white/20'
          : 'border-white/5 bg-[#0a0b0f] opacity-80 hover:opacity-100'
      }`}
    >
      {/* Online glow strip */}
      {screen.isOnline && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      )}

      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onSelect}
            className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
              selected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 hover:border-indigo-400'
            }`}
          >
            {selected && <span className="text-white text-xs">✓</span>}
          </button>

          {/* Screen icon + name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-tv-text text-sm truncate">{screen.name}</span>
              {screen.group && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                  {screen.group.name}
                </span>
              )}
            </div>
            {screen.location && (
              <p className="text-xs text-tv-muted mt-0.5 truncate">📍 {screen.location}</p>
            )}
          </div>

          {/* Online badge */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border flex-shrink-0 ${
            screen.isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/5 text-slate-500 border-white/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              screen.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
            }`} />
            {screen.isOnline ? 'Canlı' : 'Offline'}
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 mt-3">
          <LayoutPreview type={screen.layoutType} />
          <div className={`px-2 py-0.5 rounded-lg text-[11px] border ${LAYOUT_COLOR[screen.layoutType] ?? 'bg-white/5 text-slate-400 border-white/10'}`}>
            {LAYOUTS.find((l) => l.value === screen.layoutType)?.label ?? screen.layoutType}
          </div>
          {screen.isOnline && screen.sseInfo?.connectedAt && (
            <span className="text-[11px] text-emerald-400/70 ml-auto">
              ⏱ {timeAgo(screen.sseInfo.connectedAt)} bağlandı
            </span>
          )}
          {!screen.isOnline && screen.lastSeen && (
            <span className="text-[11px] text-slate-500 ml-auto">
              {timeAgo(screen.lastSeen)}
            </span>
          )}
        </div>

        {/* Quick action bar */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
          {COMMANDS.slice(0, 4).map((c) => (
            <button
              key={c.event}
              onClick={() => { onCommand(c.event); toast.success(c.label + ' gönderildi'); }}
              title={c.label}
              className={`flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-all ${c.color} border border-transparent hover:border-white/10 text-center`}
            >
              <span className="text-sm">{c.icon}</span>
            </button>
          ))}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-tv-muted border border-transparent hover:border-white/10 text-center transition-all"
          >
            {expanded ? '▲' : '···'}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-4">
              {/* Layout grid */}
              <div>
                <p className="text-[11px] text-tv-muted uppercase tracking-wider mb-2">Layout</p>
                {/* Content source selector */}
                <div className="flex gap-1.5 mb-2.5">
                  {[
                    { value: 'auto',      label: '◉ Otomatik', title: 'Mevcut içeriğe göre otomatik seçer' },
                    { value: 'youtube',   label: '▶ YouTube',  title: 'Ana alanda YouTube videosu' },
                    { value: 'instagram', label: '◈ Instagram', title: 'Ana alanda Instagram içeriği' },
                    { value: 'news',      label: '📰 Haber',   title: 'Ana alanda Google News haberleri' },
                    { value: 'social',    label: '◎ Sosyal',   title: 'Ana alanda sosyal medya içerikleri' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      title={s.title}
                      onClick={() => setContentSource(s.value)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all truncate ${
                        contentSource === s.value
                          ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/3 border-white/8 text-tv-muted hover:bg-white/8'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => { onLayoutChange(l.value, contentSource); toast.success(`${l.label} layout uygulandı`); }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all ${
                        screen.layoutType === l.value
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-white/3 border-white/8 text-tv-muted hover:bg-white/8 hover:text-tv-text'
                      }`}
                    >
                      <LayoutPreview type={l.value} />
                      <span className="text-[10px] font-medium">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* YouTube */}
              <div>
                <p className="text-[11px] text-tv-muted uppercase tracking-wider mb-2">YouTube</p>
                <div className="flex gap-2">
                  <input
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="URL veya Video ID..."
                    className="input-field flex-1 text-xs py-2"
                    onKeyDown={(e) => e.key === 'Enter' && sendYt()}
                  />
                  <button onClick={sendYt} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs border border-red-500/20 transition-all">
                    ▶
                  </button>
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-[11px] text-tv-muted uppercase tracking-wider mb-2">Overlay Mesajı</p>
                <div className="flex gap-2">
                  <input
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder="Ekranda gösterilecek mesaj..."
                    className="input-field flex-1 text-xs py-2"
                    onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                  />
                  <button onClick={sendMsg} className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-xs border border-indigo-500/20 transition-all">
                    ↗
                  </button>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={onShowQr} className="btn-secondary text-xs py-1.5 px-3 justify-center" title="QR Kod Göster">
                  📱
                </button>
                <button onClick={onCopyUrl} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                  📋 URL Kopyala
                </button>
                <a
                  href={`/screen?id=${screen.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3 justify-center"
                  title="Ekranı Yeni Sekmede Aç"
                >
                  ↗
                </a>
                <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-3 justify-center" title="Düzenle">
                  ✎
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs py-1.5 px-3 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                  title="Sil"
                >
                  🗑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScreensPage() {
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedCount, setConnectedCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'screens' | 'broadcast' | 'groups' | 'setup'>('screens');

  // Group CRUD state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', color: '#6366f1', description: '' });

  const GROUP_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#f59e0b', '#10b981', '#14b8a6', '#22d3ee', '#3b82f6',
  ];
  const [filterOnline, setFilterOnline] = useState<'all' | 'online' | 'offline'>('all');
  const [filterGroup, setFilterGroup] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editingScreen, setEditingScreen] = useState<ScreenData | null>(null);
  const [qrScreen, setQrScreen]           = useState<ScreenData | null>(null);

  // Broadcast inputs
  const [broadcastYt, setBroadcastYt]   = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // New/edit form
  const [formName,     setFormName]     = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formLayout,   setFormLayout]   = useState('default');
  const [formGroupId,  setFormGroupId]  = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [screensRes, connRes] = await Promise.all([
        fetch('/api/screens'),
        fetch('/api/sync/broadcast'),
      ]);
      if (screensRes.ok) {
        const d = await screensRes.json();
        setScreens(d.data ?? []);
        setGroups(d.groups ?? []);
      }
      if (connRes.ok) {
        const c = await connRes.json();
        setConnectedCount(c.connectedCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  // Firestore real-time listener for screen commands/status
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'screens'), () => {
      fetchData();
    });
    return () => unsub();
  }, [fetchData]);

  // ── Broadcast ─────────────────────────────────────────────────────────────

  const broadcast = useCallback(async (
    event: string,
    data: Record<string, unknown> = {},
    screenId?: string,
  ) => {
    if (db) {
      try {
        const cmd = { type: event, data, sentAt: serverTimestamp() };
        if (screenId) {
          await setDoc(doc(db, 'screens', screenId), { lastCommand: cmd }, { merge: true });
        } else {
          await setDoc(doc(db, 'broadcast', 'current'), { lastCommand: cmd });
        }
      } catch { /* fall through */ }
    }
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, screenId }),
    });
  }, []);

  // Batch command to all selected or all online
  const batchCommand = useCallback(async (event: string, data: Record<string, unknown> = {}) => {
    if (selected.size > 0) {
      await Promise.all(Array.from(selected).map((id) => broadcast(event, data, id)));
      toast.success(`${selected.size} ekrana gönderildi`);
    } else {
      await broadcast(event, data);
      toast.success('Tüm ekranlara gönderildi');
    }
  }, [selected, broadcast]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setFormName(''); setFormLocation(''); setFormLayout('default'); setFormGroupId('');
    setEditingScreen(null);
    setShowAddModal(true);
  };

  const openEditModal = (screen: ScreenData) => {
    setFormName(screen.name);
    setFormLocation(screen.location ?? '');
    setFormLayout(screen.layoutType);
    setFormGroupId(screen.groupId ?? '');
    setEditingScreen(screen);
    setShowAddModal(true);
  };

  const saveScreen = async () => {
    if (!formName.trim()) { toast.error('Ekran adı gerekli'); return; }
    if (editingScreen) {
      await fetch(`/api/screens?id=${editingScreen.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, location: formLocation, layoutType: formLayout, groupId: formGroupId || null }),
      });
      toast.success('Ekran güncellendi');
    } else {
      await fetch('/api/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, location: formLocation, layoutType: formLayout, groupId: formGroupId || null }),
      });
      toast.success('Ekran eklendi');
    }
    setShowAddModal(false);
    fetchData();
  };

  const deleteScreen = async (id: string) => {
    if (!confirm('Bu ekranı silmek istediğinizden emin misiniz?')) return;
    await fetch(`/api/screens?id=${id}`, { method: 'DELETE' });
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    toast.success('Ekran silindi');
    fetchData();
  };

  const changeLayout = async (screenId: string, layoutType: string, mainContentSource?: string) => {
    await fetch(`/api/screens?id=${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutType }),
    });
    await broadcast('change_layout', { layoutType, ...(mainContentSource ? { mainContentSource } : {}) }, screenId);
    fetchData();
  };

  const copyUrl = (path: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success('URL kopyalandı!');
  };

  // ── Multi-select ──────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selectAll = () =>
    setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map((s) => s.id)));

  // ── Filtered screens ──────────────────────────────────────────────────────

  const filtered = screens.filter((s) => {
    if (filterOnline === 'online' && !s.isOnline) return false;
    if (filterOnline === 'offline' && s.isOnline) return false;
    if (filterGroup !== 'all' && s.groupId !== filterGroup) return false;
    return true;
  });

  const onlineCount  = screens.filter((s) => s.isOnline).length;
  const offlineCount = screens.length - onlineCount;

  // ── Broadcast tab helpers ─────────────────────────────────────────────────

  const broadcastYouTube = () => {
    const id = extractYouTubeId(broadcastYt);
    if (!id) { toast.error('Geçersiz YouTube URL'); return; }
    batchCommand('play_youtube', { videoId: id, title: 'YouTube Video' });
    setBroadcastYt('');
  };

  const broadcastMessage = () => {
    if (!broadcastMsg.trim()) return;
    batchCommand('overlay_message', { text: broadcastMsg, duration: 10 });
    setBroadcastMsg('');
  };

  // ── Group CRUD ────────────────────────────────────────────────────────────

  const openNewGroup = () => {
    setGroupForm({ name: '', color: '#6366f1', description: '' });
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const openEditGroup = (g: GroupData) => {
    setGroupForm({ name: g.name, color: g.color ?? '#6366f1', description: g.description ?? '' });
    setEditingGroup(g);
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Grup adı gerekli'); return; }
    setGroupSaving(true);
    try {
      if (editingGroup) {
        await fetch(`/api/screen-groups?id=${editingGroup.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupForm),
        });
        toast.success('Grup güncellendi');
      } else {
        await fetch('/api/screen-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupForm),
        });
        toast.success('Grup oluşturuldu');
      }
      setShowGroupModal(false);
      fetchData();
    } finally { setGroupSaving(false); }
  };

  const deleteGroup = async (g: GroupData) => {
    if (!confirm(`"${g.name}" grubunu silmek istiyor musunuz? Gruptaki ekranlar grubundan çıkarılır.`)) return;
    await fetch(`/api/screen-groups?id=${g.id}`, { method: 'DELETE' });
    toast.success('Grup silindi');
    fetchData();
  };

  const broadcastToGroup = async (groupId: string, event: string, data: Record<string, unknown> = {}) => {
    const groupScreens = screens.filter((s) => s.groupId === groupId);
    if (groupScreens.length === 0) { toast('Grupta ekran yok'); return; }
    await Promise.all(groupScreens.map((s) => broadcast(event, data, s.id)));
    toast.success(`${groupScreens.length} ekrana gönderildi`);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-tv-text tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ekran Yönetimi
          </h1>
          <p className="text-tv-muted text-sm mt-1">Tüm ekranları tek yerden kontrol et · Gerçek zamanlı senkronizasyon</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats chips */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[13px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-semibold">{onlineCount}</span>
            <span className="text-emerald-400/60">çevrimiçi</span>
          </div>
          {offlineCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[13px]">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400 font-semibold">{offlineCount}</span>
              <span className="text-slate-500">çevrimdışı</span>
            </div>
          )}
          <button onClick={openAddModal} className="btn-primary">
            <span className="text-lg leading-none">+</span> Ekran Ekle
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {[
          { key: 'screens',   label: 'Ekranlar',       icon: '⬛' },
          { key: 'broadcast', label: 'Yayın Merkezi',  icon: '📡' },
          { key: 'groups',    label: 'Gruplar',         icon: '🗂️' },
          { key: 'setup',     label: 'Kurulum',        icon: '⚙' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-tv-muted hover:text-tv-text'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.key === 'groups' && groups.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold">{groups.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ SCREENS TAB ════════════════ */}
      {activeTab === 'screens' && (
        <div className="space-y-4">

          {/* Toolbar */}
          {!loading && screens.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filters */}
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                {[{ v: 'all', l: 'Tümü' }, { v: 'online', l: 'Çevrimiçi' }, { v: 'offline', l: 'Çevrimdışı' }].map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setFilterOnline(f.v as typeof filterOnline)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterOnline === f.v ? 'bg-white/10 text-tv-text' : 'text-tv-muted hover:text-tv-text'
                    }`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>

              {groups.length > 0 && (
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="bg-white/5 border border-white/10 text-tv-muted text-xs rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="all">Tüm Gruplar</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              <div className="ml-auto flex items-center gap-2">
                {/* Select all */}
                <button
                  onClick={selectAll}
                  className="text-xs text-tv-muted hover:text-tv-text px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all"
                >
                  {selected.size === filtered.length && filtered.length > 0 ? '✓ Tümü seçili' : 'Tümünü seç'}
                </button>

                {/* Batch actions */}
                <AnimatePresence>
                  {selected.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
                    >
                      <span className="text-xs text-indigo-300">{selected.size} seçili</span>
                      <span className="text-white/20">|</span>
                      {COMMANDS.slice(0, 3).map((c) => (
                        <button
                          key={c.event}
                          onClick={() => batchCommand(c.event)}
                          title={c.label}
                          className={`text-sm hover:scale-110 transition-transform ${c.color}`}
                        >
                          {c.icon}
                        </button>
                      ))}
                      <button onClick={() => setSelected(new Set())} className="text-xs text-tv-muted hover:text-tv-text ml-1">✕</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-[#0f1117] h-44 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="admin-card text-center py-20"
            >
              <div className="text-5xl mb-4 opacity-30">⬛</div>
              <p className="text-tv-text font-medium">
                {screens.length === 0 ? 'Henüz ekran yok' : 'Filtrelerle eşleşen ekran bulunamadı'}
              </p>
              <p className="text-tv-muted text-sm mt-2 mb-6">
                {screens.length === 0 ? 'Kurulum sekmesinden bir ekran bağlayın' : 'Filtreleri temizleyin'}
              </p>
              {screens.length === 0 && (
                <button onClick={() => setActiveTab('setup')} className="btn-secondary">
                  Kurulum Rehberi →
                </button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((screen) => (
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  selected={selected.has(screen.id)}
                  onSelect={() => toggleSelect(screen.id)}
                  onCommand={(event, data) => broadcast(event, data ?? {}, screen.id)}
                  onLayoutChange={(layout, mainContentSource) => changeLayout(screen.id, layout, mainContentSource)}
                  onDelete={() => deleteScreen(screen.id)}
                  onEdit={() => openEditModal(screen)}
                  onCopyUrl={() => copyUrl(`/screen?id=${screen.id}`)}
                  onShowQr={() => setQrScreen(screen)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ BROADCAST TAB ════════════════ */}
      {activeTab === 'broadcast' && (
        <div className="grid md:grid-cols-2 gap-4">

          {/* Quick commands */}
          <div className="admin-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-tv-text">Hızlı Komutlar</h2>
              <span className="text-xs text-tv-muted bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {selected.size > 0 ? `${selected.size} ekran seçili` : `${connectedCount} ekran aktif`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COMMANDS.map((c) => (
                <button
                  key={c.event}
                  onClick={() => batchCommand(c.event)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 transition-all text-left group"
                >
                  <span className={`text-xl ${c.color} group-hover:scale-110 transition-transform`}>{c.icon}</span>
                  <span className="text-sm text-tv-text font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layout broadcast */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text">Layout Değiştir</h2>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => batchCommand('change_layout', { layoutType: l.value })}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-left group"
                >
                  <LayoutPreview type={l.value} />
                  <div>
                    <p className="text-sm text-tv-text font-medium">{l.label}</p>
                    <p className="text-[11px] text-tv-muted">{l.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* YouTube */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text">YouTube Video Oynat</h2>
            <p className="text-xs text-tv-muted">
              {selected.size > 0 ? `${selected.size} seçili ekrana` : 'Tüm aktif ekranlara'} gönderilebilir
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={broadcastYt}
                onChange={(e) => setBroadcastYt(e.target.value)}
                placeholder="YouTube URL veya Video ID..."
                className="input-field flex-1"
                onKeyDown={(e) => e.key === 'Enter' && broadcastYouTube()}
              />
              <button onClick={broadcastYouTube} className="btn-primary px-5">▶ Oynat</button>
            </div>
          </div>

          {/* Overlay message */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text">Overlay Mesajı</h2>
            <p className="text-xs text-tv-muted">Ekranda 10 saniye gösterilir</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Duyuru veya mesaj metni..."
                className="input-field flex-1"
                onKeyDown={(e) => e.key === 'Enter' && broadcastMessage()}
              />
              <button onClick={broadcastMessage} className="btn-primary px-5">↗ Gönder</button>
            </div>
          </div>

          {/* Preset modes */}
          <div className="admin-card space-y-4">
            <h2 className="font-semibold text-tv-text">Hazır Modlar</h2>
            <p className="text-xs text-tv-muted">Seçili ekranlara (ya da tümüne) hızlı layout ön ayarı uygula</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sabah Modu', icon: '🌅', layout: 'news_focus',  desc: 'Haberler + piyasalar' },
                { label: 'Akşam Modu', icon: '🌇', layout: 'social_wall', desc: 'Sosyal medya duvarı' },
                { label: 'Hafta Sonu', icon: '🎉', layout: 'promo',       desc: 'Promosyon döngüsü'   },
              ].map((p) => (
                <button
                  key={p.layout}
                  onClick={() => { batchCommand('change_layout', { layoutType: p.layout }); toast.success(`${p.label} uygulandı`); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all"
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className="text-xs font-semibold text-tv-text">{p.label}</span>
                  <span className="text-[10px] text-tv-muted text-center">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Screen-specific targeting */}
          {screens.length > 0 && (
            <div className="admin-card space-y-4 md:col-span-2">
              <h2 className="font-semibold text-tv-text">Ekrana Özel Kontrol</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {screens.map((screen) => (
                  <div
                    key={screen.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      screen.isOnline
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/2 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${screen.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-sm text-tv-text font-medium truncate">{screen.name}</span>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { broadcast('reload', {}, screen.id); toast.success('Yenilendi'); }} title="Yenile" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted hover:text-tv-text text-sm transition-all flex items-center justify-center">↺</button>
                      <button onClick={() => { broadcast('update_content', {}, screen.id); toast.success('Güncellendi'); }} title="İçerik Güncelle" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted hover:text-tv-text text-sm transition-all flex items-center justify-center">⟳</button>
                      <a href={`/screen?id=${screen.id}`} target="_blank" rel="noopener noreferrer" title="Ekranı Aç" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted hover:text-tv-text text-sm transition-all flex items-center justify-center">↗</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ GROUPS TAB ════════════════ */}
      {activeTab === 'groups' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-tv-muted text-sm">Ekranları grupla, tek komutla tüm gruba yayın yap</p>
            </div>
            <button onClick={openNewGroup} className="btn-primary">
              + Grup Oluştur
            </button>
          </div>

          {/* Empty */}
          {groups.length === 0 && (
            <div className="admin-card text-center py-16">
              <div className="text-5xl mb-4 opacity-30">🗂️</div>
              <p className="text-tv-text font-medium">Henüz grup yok</p>
              <p className="text-tv-muted text-sm mt-2 mb-6">Ekranlarınızı konuma veya işleve göre gruplandırın</p>
              <button onClick={openNewGroup} className="btn-primary">Grup Oluştur</button>
            </div>
          )}

          {/* Group cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => {
              const groupScreens = screens.filter((s) => s.groupId === g.id);
              const onlineGroupScreens = groupScreens.filter((s) => s.isOnline);
              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="admin-card space-y-4 relative overflow-hidden hover:border-white/20 transition-all"
                >
                  {/* Color accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: g.color ?? '#6366f1' }} />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-bold" style={{ background: `${g.color ?? '#6366f1'}30`, border: `1px solid ${g.color ?? '#6366f1'}40` }}>
                        {g.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-tv-text text-sm">{g.name}</p>
                        {g.description && <p className="text-xs text-tv-muted mt-0.5 line-clamp-1">{g.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEditGroup(g)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-tv-muted text-sm flex items-center justify-center transition-all">✏️</button>
                      <button onClick={() => deleteGroup(g)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-tv-muted hover:text-red-400 text-sm flex items-center justify-center transition-all">🗑️</button>
                    </div>
                  </div>

                  {/* Screen count */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-tv-muted">
                      <span className="text-lg">⬛</span>
                      {groupScreens.length} ekran
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {onlineGroupScreens.length} çevrimiçi
                    </span>
                  </div>

                  {/* Screen mini-list */}
                  {groupScreens.length > 0 && (
                    <div className="space-y-1">
                      {groupScreens.slice(0, 4).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/3">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className="text-xs text-tv-text truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-tv-muted">{s.layoutType}</span>
                        </div>
                      ))}
                      {groupScreens.length > 4 && (
                        <p className="text-[10px] text-tv-muted text-center">+{groupScreens.length - 4} daha</p>
                      )}
                    </div>
                  )}

                  {/* Broadcast buttons */}
                  <div className="flex gap-2 pt-1 border-t border-white/5">
                    <button
                      onClick={() => broadcastToGroup(g.id, 'reload')}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-tv-muted hover:text-tv-text transition-all border border-transparent hover:border-white/10"
                    >
                      ↺ Yenile
                    </button>
                    <button
                      onClick={() => broadcastToGroup(g.id, 'update_content')}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-tv-muted hover:text-tv-text transition-all border border-transparent hover:border-white/10"
                    >
                      ⟳ Güncelle
                    </button>
                    <select
                      className="flex-[2] text-[11px] bg-white/5 border border-white/10 text-tv-muted rounded-lg px-2 focus:outline-none"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          broadcastToGroup(g.id, 'change_layout', { layoutType: e.target.value });
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="" disabled>Layout değiştir…</option>
                      {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Unassigned screens */}
          {screens.filter((s) => !s.groupId).length > 0 && (
            <div className="admin-card space-y-3">
              <h3 className="text-sm font-semibold text-tv-muted">Gruba Atanmamış Ekranlar</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {screens.filter((s) => !s.groupId).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/8">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-xs text-tv-text flex-1 truncate">{s.name}</span>
                    <select
                      className="text-[10px] bg-white/5 border border-white/10 text-tv-muted rounded-lg px-1.5 py-1 focus:outline-none max-w-[110px]"
                      defaultValue=""
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        await fetch(`/api/screens?id=${s.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ groupId: e.target.value }),
                        });
                        toast.success('Gruba atandı');
                        fetchData();
                      }}
                    >
                      <option value="" disabled>Gruba ata…</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ SETUP TAB ════════════════ */}
      {activeTab === 'setup' && (
        <div className="grid md:grid-cols-2 gap-4">

          <div className="admin-card space-y-5">
            <h2 className="font-semibold text-tv-text text-base">Ekran Bağlantı Adresleri</h2>
            {[
              { label: 'Ana Ekran',        path: '/screen',           desc: 'Varsayılan layout' },
              { label: 'Kiosk Modu',       path: '/screen?kiosk=1',   desc: 'Tam ekran, kursoruz' },
              { label: 'Ekran ID Örneği',  path: '/screen?id=tv-01',  desc: 'Her TV için benzersiz ID' },
            ].map((item) => (
              <div key={item.path} className="p-4 rounded-xl bg-white/3 border border-white/8">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-tv-text">{item.label}</p>
                    <p className="text-xs text-tv-muted">{item.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyUrl(item.path)} className="btn-secondary text-xs py-1.5 px-3">📋</button>
                    <a href={item.path} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5 px-3">↗</a>
                  </div>
                </div>
                <p className="font-mono text-xs text-indigo-300 bg-black/30 px-3 py-2 rounded-lg break-all">
                  {typeof window !== 'undefined' ? window.location.origin : 'http://SERVER_IP:3000'}{item.path}
                </p>
              </div>
            ))}
          </div>

          {/* QR codes for all actual screens */}
          {screens.length > 0 && (
            <div className="admin-card space-y-4">
              <h2 className="font-semibold text-tv-text text-base">📱 Ekran QR Kodları</h2>
              <p className="text-xs text-tv-muted">Her ekranın URL'sini QR kod ile TV tarayıcısına kolayca yükleyin.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {screens.map((s) => {
                  const url = typeof window !== 'undefined'
                    ? `${window.location.origin}/screen?id=${s.id}`
                    : `/screen?id=${s.id}`;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setQrScreen(s)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/3 border border-white/8 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group"
                    >
                      <div className="bg-white p-2 rounded-xl group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all">
                        <QRCodeSVG value={url} size={80} bgColor="#ffffff" fgColor="#030712" level="M" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-tv-text truncate max-w-[100px]">{s.name}</p>
                        {s.location && <p className="text-[10px] text-tv-muted truncate max-w-[100px]">{s.location}</p>}
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className={`text-[10px] ${s.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {s.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="admin-card space-y-4">
              <h2 className="font-semibold text-tv-text text-base">Kurulum Adımları</h2>
              <div className="space-y-3">
                {[
                  { n: 1, t: 'Chrome tarayıcısını açın', d: 'Herhangi bir OS — Windows, macOS, Linux, ChromeOS' },
                  { n: 2, t: 'Ekran URL\'sini girin', d: 'SERVER_IP:3000/screen?id=benzersiz-isim' },
                  { n: 3, t: 'Ekran listesi otomatik güncellenir', d: 'Bu sayfada yeni ekran görünür' },
                  { n: 4, t: 'Admin\'den kontrol edin', d: 'Layout, video, mesaj — gerçek zamanlı' },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{step.n}</span>
                    <div>
                      <p className="text-sm text-tv-text font-medium">{step.t}</p>
                      <p className="text-xs text-tv-muted">{step.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card space-y-3">
              <h2 className="font-semibold text-tv-text text-base">🪟 Windows Kiosk Script</h2>
              <pre className="bg-black/50 p-4 rounded-xl text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre border border-white/5 leading-relaxed">
{`@echo off
set SERVER=http://localhost:3000
set SCREEN_ID=tv-01

start chrome --kiosk ^
  --disable-infobars ^
  --noerrdialogs ^
  --disable-session-crashed-bubble ^
  --app=%SERVER%/screen?id=%SCREEN_ID%

:: 2. ekran için:
:: start chrome --kiosk ^
::   --app=%SERVER%/screen?id=tv-02`}
              </pre>
              <button
                onClick={() => {
                  const txt = `@echo off\nset SERVER=http://localhost:3000\nset SCREEN_ID=tv-01\n\nstart chrome --kiosk --disable-infobars --noerrdialogs --disable-session-crashed-bubble --app=%SERVER%/screen?id=%SCREEN_ID%`;
                  navigator.clipboard.writeText(txt);
                  toast.success('Script kopyalandı!');
                }}
                className="btn-secondary text-xs w-full justify-center"
              >
                📋 Script'i Kopyala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ ADD / EDIT MODAL ════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="admin-card w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-tv-text">
                  {editingScreen ? `Ekranı Düzenle — ${editingScreen.name}` : 'Yeni Ekran Ekle'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-tv-muted hover:text-tv-text text-xl leading-none">✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Ekran Adı *</label>
                  <input
                    autoFocus
                    placeholder="Örn: Lobi Ekranı 1"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-field w-full"
                    onKeyDown={(e) => e.key === 'Enter' && saveScreen()}
                  />
                </div>
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Konum</label>
                  <input
                    placeholder="Örn: 3. Kat, Giriş Holü"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Varsayılan Layout</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LAYOUTS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setFormLayout(l.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center text-xs transition-all ${
                          formLayout === l.value
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/3 border-white/8 text-tv-muted hover:bg-white/8'
                        }`}
                      >
                        <LayoutPreview type={l.value} />
                        <span className="font-medium">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {groups.length > 0 && (
                  <div>
                    <label className="text-xs text-tv-muted mb-1.5 block">Grup (Opsiyonel)</label>
                    <select
                      value={formGroupId}
                      onChange={(e) => setFormGroupId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">Grup yok</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1 justify-center">İptal</button>
                <button onClick={saveScreen} className="btn-primary flex-1 justify-center">
                  {editingScreen ? 'Kaydet' : '+ Ekle'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ GROUP CREATE/EDIT MODAL ════════════════ */}
      <AnimatePresence>
        {showGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="admin-card w-full max-w-sm space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-tv-text">
                  {editingGroup ? 'Grubu Düzenle' : 'Yeni Grup Oluştur'}
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="text-tv-muted hover:text-tv-text text-xl leading-none">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Grup Adı *</label>
                  <input
                    autoFocus
                    placeholder="Örn: Giriş Katı, Bar Bölümü…"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-field w-full"
                    onKeyDown={(e) => e.key === 'Enter' && saveGroup()}
                  />
                </div>
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Renk</label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setGroupForm((f) => ({ ...f, color: c }))}
                        className="w-7 h-7 rounded-lg transition-all hover:scale-110"
                        style={{
                          background: c,
                          outline: groupForm.color === c ? `2px solid ${c}` : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="color"
                      value={groupForm.color}
                      onChange={(e) => setGroupForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                    />
                    <input
                      type="text"
                      value={groupForm.color}
                      onChange={(e) => setGroupForm((f) => ({ ...f, color: e.target.value }))}
                      className="input-field flex-1 font-mono text-xs"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block">Açıklama (opsiyonel)</label>
                  <input
                    placeholder="Grup hakkında kısa not…"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1 justify-center">İptal</button>
                <button
                  onClick={saveGroup}
                  disabled={groupSaving || !groupForm.name.trim()}
                  className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {groupSaving ? '⏳' : editingGroup ? 'Kaydet' : '+ Oluştur'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ QR CODE MODAL ════════════════ */}
      <AnimatePresence>
        {qrScreen && (() => {
          const screenUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/screen?id=${qrScreen.id}`
            : `/screen?id=${qrScreen.id}`;
          return (
            <motion.div
              key="qr-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setQrScreen(null)}
            >
              <motion.div
                initial={{ scale: 0.88, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.88, y: 20 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="admin-card w-full max-w-sm space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-tv-text">{qrScreen.name}</h3>
                    {qrScreen.location && (
                      <p className="text-xs text-tv-muted mt-0.5">{qrScreen.location}</p>
                    )}
                  </div>
                  <button onClick={() => setQrScreen(null)} className="text-tv-muted hover:text-tv-text text-xl leading-none">✕</button>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl shadow-xl shadow-black/40">
                    <QRCodeSVG
                      value={screenUrl}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#030712"
                      level="M"
                    />
                  </div>
                </div>

                <p className="text-xs text-tv-muted text-center">TV tarayıcısını bu URL'ye yönlendirin ya da QR kodu taratın</p>

                <div className="bg-black/30 px-3 py-2.5 rounded-xl border border-white/8">
                  <p className="font-mono text-[11px] text-indigo-300 break-all leading-relaxed">{screenUrl}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(screenUrl); toast.success('URL kopyalandı!'); }}
                    className="btn-secondary flex-1 justify-center text-sm"
                  >
                    📋 URL Kopyala
                  </button>
                  <a
                    href={screenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 justify-center text-sm"
                  >
                    ↗ Aç
                  </a>
                </div>

                <button onClick={() => setQrScreen(null)} className="btn-secondary w-full justify-center text-sm">Kapat</button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}

