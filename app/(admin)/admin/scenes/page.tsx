'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LayoutType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scene {
  id: string;
  name: string;
  icon: string;
  color: string;
  layout: LayoutType;
  ticker: { active: boolean; priority?: number };
  ads: { mode: 'normal' | 'heavy' | 'off' };
  youtubePlaylistId?: string | null;
  broadcastToGroups: string[];
  createdAt: string | null;
}

interface GroupData {
  id: string;
  name: string;
  color?: string;
}

type AdMode = 'normal' | 'heavy' | 'off';

// ─── Constants ────────────────────────────────────────────────────────────────

const ICONS = ['🎭','🎉','🌙','☀️','🍸','🎵','🏆','📺','🎬','📡','⚡','🌟','🌅','🍔','🎸','🏖️','🎪','🌃','🎯','🔥'];

const AD_MODE_OPTIONS: { value: AdMode; label: string; desc: string }[] = [
  { value: 'normal', label: 'Normal', desc: 'Standart reklam döngüsü' },
  { value: 'heavy',  label: 'Yoğun',  desc: 'Reklam sıklığı artırıldı' },
  { value: 'off',    label: 'Kapalı', desc: 'Reklam gösterilmez' },
];

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: string }[] = [
  { value: 'default',          label: 'Varsayılan',     icon: '⊞' },
  { value: 'youtube',          label: 'YouTube',        icon: '▶' },
  { value: 'instagram',        label: 'Instagram',      icon: '📸' },
  { value: 'split_2',          label: "2'li Bölme",     icon: '⊟' },
  { value: 'social_wall',      label: 'Sosyal Duvar',   icon: '⊞' },
  { value: 'markets',          label: 'Piyasalar',      icon: '📈' },
  { value: 'news_focus',       label: 'Haberler',       icon: '📰' },
  { value: 'digital_signage',  label: 'Dijital Tabela', icon: '🖥' },
  { value: 'ambient',          label: 'Ambient',        icon: '🌙' },
  { value: 'promo',            label: 'Promosyon',      icon: '✨' },
  { value: 'fullscreen',       label: 'Tam Ekran',      icon: '⛶' },
  { value: 'triple',           label: 'Üçlü',           icon: '⊟' },
  { value: 'portrait',         label: 'Dikey',          icon: '▯' },
  { value: 'breaking_news',    label: 'Son Dakika',     icon: '🔴' },
  { value: 'event_countdown',  label: 'Geri Sayım',     icon: '⏳' },
  { value: 'split_scoreboard', label: 'Skorbord',       icon: '⚽' },
];

// ─── Scene Form Modal ─────────────────────────────────────────────────────────

function SceneModal({
  initial,
  groups,
  onClose,
  onSaved,
}: {
  initial: Partial<Scene> | null;
  groups: GroupData[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '🎭');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [layout, setLayout] = useState<LayoutType>(initial?.layout ?? 'default');
  const [adMode, setAdMode] = useState<AdMode>(initial?.ads?.mode ?? 'normal');
  const [tickerActive, setTickerActive] = useState(initial?.ticker?.active ?? true);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initial?.broadcastToGroups ?? []);
  const [saving, setSaving] = useState(false);

  const toggleGroup = (id: string) =>
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Sahne adı gerekli'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        icon,
        color,
        layout,
        ticker: { active: tickerActive },
        ads: { mode: adMode },
        broadcastToGroups: selectedGroups,
      };

      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/scenes?id=${initial!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast.success(isEdit ? 'Sahne güncellendi' : 'Sahne oluşturuldu');
        onSaved();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? 'İşlem başarısız');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#0b0f1a' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-5">
          {isEdit ? '✏️ Sahne Düzenle' : '🎭 Yeni Sahne'}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Ad <span className="text-indigo-400">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Happy Hour, Sabah Modu, Konser Gecesi…"
              className="input w-full"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Icon + Color */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-white/50 mb-1.5 block">İkon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-base flex items-center justify-center border transition-all',
                      icon === ic
                        ? 'border-indigo-500/60 bg-indigo-500/15 scale-110'
                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                    )}
                  >{ic}</button>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <label className="text-xs text-white/50 mb-1.5 block">Renk</label>
              <div className="flex flex-col items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border border-white/15"
                />
                <div className="w-12 h-6 rounded-md border border-white/10" style={{ background: color }} />
              </div>
            </div>
          </div>

          {/* Layout */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Layout</label>
            <select
              value={layout}
              onChange={e => setLayout(e.target.value as LayoutType)}
              className="input w-full"
            >
              {LAYOUT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
              ))}
            </select>
          </div>

          {/* Ticker + Ads row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Haber Bandı</label>
              <button
                onClick={() => setTickerActive(p => !p)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm transition-all',
                  tickerActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-white/40'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', tickerActive ? 'bg-emerald-400' : 'bg-white/20')} />
                {tickerActive ? 'Aktif' : 'Kapalı'}
              </button>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Reklam Modu</label>
              <select
                value={adMode}
                onChange={e => setAdMode(e.target.value as AdMode)}
                className="input w-full"
              >
                {AD_MODE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Groups */}
          {groups.length > 0 && (
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">
                Hedef Gruplar <span className="text-white/25">(boş = tüm ekranlar)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {groups.map(g => {
                  const sel = selectedGroups.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all',
                        sel
                          ? 'text-white border-current font-medium'
                          : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                      )}
                      style={sel ? {
                        background: `${g.color ?? '#6366f1'}20`,
                        borderColor: `${g.color ?? '#6366f1'}60`,
                        color: g.color ?? '#6366f1',
                      } : {}}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color ?? '#6366f1' }} />
                      {g.name}
                      {sel && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Preview card */}
        <div className="mt-4 p-3 rounded-xl border border-white/8 bg-white/3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Önizleme</p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border"
              style={{ background: `${color}20`, borderColor: `${color}40` }}
            >
              {icon}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{name || 'Sahne Adı'}</p>
              <p className="text-white/40 text-xs">
                {LAYOUT_OPTIONS.find(l => l.value === layout)?.label} ·{' '}
                Reklam: {AD_MODE_OPTIONS.find(a => a.value === adMode)?.label} ·{' '}
                Ticker: {tickerActive ? 'Açık' : 'Kapalı'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1"
          >
            {saving ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ scene, onConfirm, onCancel }: {
  scene: Scene;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0b0f1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl mx-4"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 mx-auto border"
          style={{ background: `${scene.color}20`, borderColor: `${scene.color}40` }}
        >
          {scene.icon}
        </div>
        <p className="text-white font-semibold text-center text-base mb-1">"{scene.name}" silinsin mi?</p>
        <p className="text-white/40 text-center text-sm mb-5">Bu işlem geri alınamaz.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">İptal</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all">
            Sil
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Scene Card ───────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  groups,
  isActive,
  onEdit,
  onDelete,
  onActivate,
}: {
  scene: Scene;
  groups: GroupData[];
  isActive: boolean;
  onEdit: (s: Scene) => void;
  onDelete: (s: Scene) => void;
  onActivate: (s: Scene) => void;
}) {
  const layoutLabel = LAYOUT_OPTIONS.find(l => l.value === scene.layout)?.label ?? scene.layout;
  const adLabel = AD_MODE_OPTIONS.find(a => a.value === scene.ads?.mode)?.label ?? 'Normal';
  const groupNames = (scene.broadcastToGroups ?? [])
    .map(gid => groups.find(g => g.id === gid)?.name ?? gid);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border p-5 flex flex-col gap-3 transition-all group',
        isActive
          ? 'shadow-lg'
          : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
      )}
      style={isActive ? {
        background: `${scene.color}12`,
        borderColor: `${scene.color}50`,
        boxShadow: `0 0 20px ${scene.color}15`,
      } : {}}
    >
      {/* Active badge */}
      {isActive && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: `${scene.color}30`, color: scene.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          AKTİF
        </div>
      )}

      {/* Icon + name */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border"
          style={{ background: `${scene.color}20`, borderColor: `${scene.color}40` }}
        >
          {scene.icon}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{scene.name}</p>
          <p className="text-white/40 text-xs">
            {scene.createdAt ? new Date(scene.createdAt).toLocaleDateString('tr-TR') : '—'}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/50 text-[11px]">
          {LAYOUT_OPTIONS.find(l => l.value === scene.layout)?.icon} {layoutLabel}
        </span>
        <span className={cn(
          'px-2 py-0.5 rounded-md border text-[11px]',
          scene.ads?.mode === 'off'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : scene.ads?.mode === 'heavy'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-white/5 border-white/8 text-white/50'
        )}>
          📺 {adLabel}
        </span>
        <span className={cn(
          'px-2 py-0.5 rounded-md border text-[11px]',
          scene.ticker?.active
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-white/5 border-white/8 text-white/40'
        )}>
          📢 {scene.ticker?.active ? 'Ticker Açık' : 'Ticker Kapalı'}
        </span>
      </div>

      {/* Target groups */}
      {groupNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {groupNames.map((name, i) => {
            const g = groups.find(gr => gr.name === name);
            return (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-white/8 bg-white/5"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: g?.color ?? '#6366f1' }} />
                <span className="text-white/50">{name}</span>
              </span>
            );
          })}
        </div>
      )}
      {groupNames.length === 0 && (
        <p className="text-white/25 text-xs">→ Tüm ekranlar</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onActivate(scene)}
          className={cn(
            'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
            isActive
              ? 'bg-white/8 text-white/50 cursor-default'
              : 'text-white'
          )}
          style={!isActive ? { background: `${scene.color}25`, color: scene.color } : {}}
          disabled={isActive}
        >
          {isActive ? '✓ Aktif' : '▶ Aktif Et'}
        </button>
        <button
          onClick={() => onEdit(scene)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all border border-white/8"
          title="Düzenle"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(scene)}
          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-all border border-white/8 hover:border-red-500/25"
          title="Sil"
        >
          🗑️
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | Scene | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Scene | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, gRes] = await Promise.all([
        fetch('/api/scenes'),
        fetch('/api/screen-groups'),
      ]);
      if (sRes.ok) { const d = await sRes.json(); setScenes(d.data ?? []); }
      if (gRes.ok) { const d = await gRes.json(); setGroups(d.data ?? []); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleActivate = async (scene: Scene) => {
    setActivating(scene.id);
    setActiveSceneId(scene.id);
    try {
      const payload: Record<string, unknown> = {
        event: 'change_layout',
        data: { layoutType: scene.layout },
      };

      if (scene.broadcastToGroups?.length > 0) {
        // We don't have screens here, so broadcast to all and note the group target
        await fetch('/api/sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const groupNames = scene.broadcastToGroups
          .map(gid => groups.find(g => g.id === gid)?.name ?? gid)
          .join(', ');
        toast.success(`🎭 ${scene.name} aktif → ${groupNames}`);
      } else {
        await fetch('/api/sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.success(`🎭 ${scene.name} tüm ekranlara uygulandı`);
      }
    } catch {
      toast.error('Sahne uygulanamadı');
      setActiveSceneId(null);
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scenes?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${deleteTarget.name}" silindi`);
        setScenes(prev => prev.filter(s => s.id !== deleteTarget.id));
        if (activeSceneId === deleteTarget.id) setActiveSceneId(null);
      } else {
        toast.error('Silinemedi');
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">🎭 Sahne Yönetimi</h1>
          <p className="text-white/40 text-sm mt-1">
            Tek tıkla layout, ticker ve reklam modunu değiştiren sahne presetleri
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="btn-primary flex items-center gap-2"
        >
          <span>+</span>
          <span>Yeni Sahne</span>
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-4 py-3 flex items-start gap-3">
        <span className="text-indigo-400 text-lg flex-shrink-0 mt-0.5">💡</span>
        <div>
          <p className="text-indigo-300 text-sm font-medium">Sahneler nasıl çalışır?</p>
          <p className="text-indigo-300/60 text-xs mt-0.5">
            Her sahne bir layout + ticker durumu + reklam modu içerir. "Aktif Et" butonuna bastığınızda
            seçilen sahnenin ayarları tüm ekranlara (veya seçili gruplara) anında yayınlanır.
            Yayın Merkezi sayfasından da sahneleri hızlıca aktif edebilirsiniz.
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-white/40 text-sm">Sahneler yükleniyor…</p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && scenes.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="text-6xl">🎭</span>
          <div>
            <p className="text-white font-semibold text-lg">Henüz sahne yok</p>
            <p className="text-white/40 text-sm mt-1">
              "Sabah Modu", "Happy Hour", "Konser Gecesi" gibi sahneler oluşturun
            </p>
          </div>
          <button onClick={() => setModal('create')} className="btn-primary mt-2">
            🎭 İlk Sahneyi Oluştur
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && scenes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {scenes.map(s => (
              <SceneCard
                key={s.id}
                scene={s}
                groups={groups}
                isActive={activeSceneId === s.id}
                onEdit={scene => setModal(scene)}
                onDelete={setDeleteTarget}
                onActivate={handleActivate}
              />
            ))}
          </AnimatePresence>

          {/* Add new card */}
          <motion.button
            layout
            onClick={() => setModal('create')}
            className="rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 p-5 flex flex-col items-center justify-center gap-3 text-white/30 hover:text-indigo-400 transition-all min-h-[160px]"
          >
            <span className="text-4xl">+</span>
            <span className="text-sm font-medium">Yeni Sahne</span>
          </motion.button>
        </div>
      )}

      {/* Stats */}
      {!loading && scenes.length > 0 && (
        <div className="flex gap-6 text-sm text-white/30 pt-2 border-t border-white/5">
          <span>{scenes.length} sahne</span>
          {activeSceneId && (
            <span className="text-indigo-400">
              Aktif: {scenes.find(s => s.id === activeSceneId)?.name}
            </span>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal !== null && (
          <SceneModal
            key="scene-modal"
            initial={modal === 'create' ? null : modal}
            groups={groups}
            onClose={() => setModal(null)}
            onSaved={fetchAll}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            key="delete-confirm"
            scene={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
        {deleting && (
          <div key="deleting-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 bg-[#0b0f1a] border border-white/10 rounded-2xl p-8">
              <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              <p className="text-white/50 text-sm">Siliniyor…</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
