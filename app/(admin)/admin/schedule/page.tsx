'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { detectScheduleConflicts } from '@/lib/schedule-engine';
import type { LiveChannel, ScheduleEvent, SchedulePriority, ScreenData } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const EVENT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

const EVENT_TYPES = [
  { value: 'layout', label: 'Düzen Değiştir', icon: '⊞' },
  { value: 'youtube', label: 'YouTube Video', icon: '▶' },
  { value: 'instagram', label: 'Instagram', icon: '◈' },
  { value: 'content', label: 'İçerik', icon: '🖼' },
  { value: 'announcement', label: 'Duyuru', icon: '📢' },
  { value: 'live_tv', label: 'Canlı TV', icon: '📡' },
  { value: 'markets', label: 'Piyasalar', icon: '📈' },
  { value: 'news', label: 'Haberler', icon: '📰' },
];

const PRIORITY_OPTIONS: Array<{ value: SchedulePriority; label: string }> = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
];

const LAYOUTS = [
  'default', 'youtube', 'instagram', 'split_2', 'fullscreen', 'digital_signage',
  'social_wall', 'ambient', 'promo', 'triple', 'news_focus', 'portrait', 'markets',
];

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Bir Kez' },
  { value: 'daily', label: 'Her Gün' },
  { value: 'weekdays', label: 'Hafta İçi (Pzt-Cum)' },
  { value: 'weekends', label: 'Hafta Sonu (Cmt-Paz)' },
  { value: 'weekly', label: 'Her Hafta' },
];

const HOURS_VISIBLE = Array.from({ length: 24 }, (_, i) => i); // 0-23

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon
  return new Date(d.setDate(diff));
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(date: Date): string {
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
}

function fmtIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getEventColor(event: ScheduleEvent, idx: number): string {
  return event.color ?? EVENT_COLORS[idx % EVENT_COLORS.length];
}

function eventTop(startAt: string, dayStart: Date): number {
  const start = new Date(startAt);
  const diffMs = start.getTime() - dayStart.getTime();
  return Math.max(0, (diffMs / (24 * 60 * 60 * 1000)) * 100);
}

function eventHeight(startAt: string, endAt?: string): number {
  if (!endAt) return 4; // 1 hour default visual
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Math.max(2, (diff / (24 * 60 * 60 * 1000)) * 100);
}

function getPriorityScore(priority?: SchedulePriority | string): number {
  if (priority === 'critical') return 4;
  if (priority === 'high') return 3;
  if (priority === 'normal') return 2;
  return 1;
}

// ─── AI Weekly Generator Modal ────────────────────────────────────────────────

interface AIWeekPreview {
  title: string;
  type: string;
  layoutType?: string;
  startAt: string;
  endAt?: string;
  recurrence: string;
  priority: string;
  color?: string;
}

interface AIWeeklyModalProps {
  weekStart: Date;
  onClose: () => void;
  onImport: (events: AIWeekPreview[]) => Promise<void>;
}

function AIWeeklyModal({ weekStart, onClose, onImport }: AIWeeklyModalProps) {
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [preview, setPreview] = useState<AIWeekPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [businessCtx, setBusinessCtx] = useState('Social Lounge — modern bar & lounge');

  const generate = async () => {
    setGenerating(true);
    setPreview([]);
    setNarrative(null);
    try {
      const res = await fetch('/api/ai/schedule-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly',
          weekStart: weekStart.toISOString().slice(0, 10),
          businessContext: businessCtx,
          autoSave: false,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error ?? 'Üretim başarısız');
      const evs: AIWeekPreview[] = d.data.events ?? [];
      setPreview(evs);
      setNarrative(d.data.narrative ?? null);
      setSelected(new Set(evs.map((_, i) => i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hata');
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    const toImport = preview.filter((_, i) => selected.has(i));
    if (toImport.length === 0) { toast.error('En az bir etkinlik seçin'); return; }
    setImporting(true);
    try {
      await onImport(toImport);
      toast.success(`${toImport.length} etkinlik takvime eklendi`);
      onClose();
    } catch {
      toast.error('İçe aktarma başarısız');
    } finally {
      setImporting(false);
    }
  };

  const toggleAll = () => {
    if (selected.size === preview.length) setSelected(new Set());
    else setSelected(new Set(preview.map((_, i) => i)));
  };

  const typeIcon: Record<string, string> = {
    layout: '⊞', youtube: '▶', instagram: '◈', markets: '📈',
    news: '📰', announcement: '📢', content: '🖼', live_tv: '📡',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[88vh]"
        style={{ background: '#0f1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              🤖 AI Haftalık Program Oluştur
            </h3>
            <p className="text-white/35 text-xs mt-0.5">Yapay zeka ile otomatik haftalık yayın takvimi</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Business context */}
          <div>
            <label className="text-xs text-white/40 font-medium mb-1.5 block">İşletme Bağlamı</label>
            <input
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 placeholder:text-white/20"
              value={businessCtx}
              onChange={(e) => setBusinessCtx(e.target.value)}
              placeholder="Örn: Espresso Bar, canlı müzik, genç kitle..."
            />
          </div>

          {/* Generate button */}
          {preview.length === 0 && (
            <button
              onClick={generate}
              disabled={generating}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Program oluşturuluyor…
                </>
              ) : '✨ Haftalık Program Oluştur'}
            </button>
          )}

          {/* Narrative */}
          {narrative && (
            <div className="px-4 py-3 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 text-indigo-200/70 text-xs leading-relaxed">
              {narrative}
            </div>
          )}

          {/* Preview list */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 font-medium">{preview.length} etkinlik oluşturuldu</span>
                <button onClick={toggleAll} className="text-xs text-indigo-400 hover:text-indigo-300">
                  {selected.size === preview.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {preview.map((ev, i) => {
                  const d = new Date(ev.startAt);
                  const dateStr = `${DAYS_TR[d.getDay()]} ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  return (
                    <label
                      key={i}
                      className={cn(
                        'flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all',
                        selected.has(i)
                          ? 'border-indigo-500/30 bg-indigo-500/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02] opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                        className="mt-0.5 accent-indigo-500 flex-shrink-0 cursor-pointer"
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: ev.color ?? '#6366f1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white/85 text-xs font-medium truncate">
                          {typeIcon[ev.type] ?? '•'} {ev.title}
                        </p>
                        <p className="text-white/30 text-[11px] mt-0.5">{dateStr}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-white/30 flex-shrink-0 capitalize">
                        {ev.type}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {preview.length > 0 && (
            <button
              onClick={generate}
              disabled={generating}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
            >
              {generating ? '⏳' : '↺ Yeniden Oluştur'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-secondary text-sm">İptal</button>
          {preview.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {importing ? '⏳ Ekleniyor…' : `✓ ${selected.size} Etkinlik Ekle`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Event Form Modal ─────────────────────────────────────────────────────────

interface EventFormProps {
  initial?: Partial<ScheduleEvent>;
  screens: ScreenData[];
  channels: LiveChannel[];
  onSave: (data: Partial<ScheduleEvent>) => void;
  onClose: () => void;
  onDelete?: () => void;
  onCopyToNextWeek?: () => void;
}

function EventFormModal({ initial, screens, channels, onSave, onClose, onDelete, onCopyToNextWeek }: EventFormProps) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    screenId: initial?.screenId ?? '',
    type: initial?.type ?? 'layout',
    layoutType: initial?.layoutType ?? 'default',
    contentRef: initial?.contentRef ?? '',
    sourceRef: initial?.sourceRef ?? '',
    startAt: initial?.startAt ? initial.startAt.slice(0, 16) : fmtIso(new Date()),
    endAt: initial?.endAt ? initial.endAt.slice(0, 16) : '',
    recurrence: initial?.recurrence ?? 'once',
    priority: initial?.priority ?? 'normal',
    autoSwitch: initial?.autoSwitch ?? true,
    color: initial?.color ?? EVENT_COLORS[0],
    isActive: initial?.isActive ?? true,
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Başlık gerekli'); return; }
    if (!form.startAt) { toast.error('Başlangıç zamanı gerekli'); return; }
    if (form.type === 'live_tv' && !form.sourceRef) { toast.error('Canlı TV için yayın kaynağı seçin'); return; }
    onSave({
      ...form,
      screenId: form.screenId || undefined,
      endAt: form.endAt || undefined,
      contentRef: form.contentRef || undefined,
      sourceRef: form.sourceRef || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#0f1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <h3 className="text-white font-bold">{initial?.id ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="label">Başlık *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input w-full" placeholder="Etkinlik adı" />
          </div>

          {/* Color picker */}
          <div>
            <label className="label">Renk</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className={cn('w-6 h-6 rounded-full flex-shrink-0 transition-transform', form.color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Screen + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ekran</label>
              <select value={form.screenId} onChange={(e) => set('screenId', e.target.value)} className="input w-full">
                <option value="">Tüm Ekranlar</option>
                {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tür</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input w-full">
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Layout selector (only for layout type) */}
          {form.type === 'layout' && (
            <div>
              <label className="label">Düzen</label>
              <select value={form.layoutType} onChange={(e) => set('layoutType', e.target.value)} className="input w-full">
                {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          {form.type === 'live_tv' && (
            <div>
              <label className="label">Yayın Kaynağı</label>
              <select value={form.sourceRef} onChange={(e) => set('sourceRef', e.target.value)} className="input w-full">
                <option value="">Kaynak seçin</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>{channel.title} · {channel.provider}</option>
                ))}
              </select>
              <p className="text-[11px] text-white/30 mt-1.5">Sadece resmi embed veya lisanslı stream tanımlı kaynaklar listelenir.</p>
            </div>
          )}

          {/* Start + End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Başlangıç *</label>
              <input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">Bitiş (opsiyonel)</label>
              <input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} className="input w-full" />
            </div>
          </div>

          {/* Prime time quick fill */}
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">📈 Hızlı Doldur — Önerilen Saatler:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Sabah Açılış', start: '09:00', end: '11:00', icon: '🌅' },
                { label: 'Öğle',         start: '12:00', end: '14:00', icon: '🌞' },
                { label: 'Akşam Üstü',  start: '17:00', end: '19:00', icon: '🌇' },
                { label: 'Prime Time',   start: '19:00', end: '22:00', icon: '⭐' },
                { label: 'Gece',         start: '22:00', end: '01:00', icon: '🌙' },
              ].map(slot => {
                const today = new Date().toISOString().slice(0, 10);
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => { set('startAt', `${today}T${slot.start}`); set('endAt', `${today}T${slot.end}`); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/8 text-white/40 hover:border-indigo-500/40 hover:text-indigo-300 transition-all text-[10px]"
                  >
                    <span>{slot.icon}</span><span>{slot.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="label">Tekrar</label>
            <div className="flex gap-2 flex-wrap">
              {RECURRENCE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => set('recurrence', r.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs transition-all',
                    form.recurrence === r.value
                      ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Öncelik</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className="input w-full">
                {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Akıllı Geçiş</label>
              <label className="input w-full flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.autoSwitch)} onChange={(e) => set('autoSwitch', e.target.checked)} />
                Etkin olduğunda ekranı otomatik devral
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Not (opsiyonel)</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className="input w-full resize-none text-sm" placeholder="Açıklama..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {onDelete && (
            <button onClick={onDelete} className="btn-secondary text-red-400 hover:text-red-300 border-red-500/20">
              Sil
            </button>
          )}
          {onCopyToNextWeek && initial?.id && (
            <button
              onClick={onCopyToNextWeek}
              className="btn-secondary text-indigo-300 border-indigo-500/25 hover:border-indigo-500/50"
              title="Bu etkinliği 7 gün sonrasına kopyala"
            >
              📋 Haftaya Kopyala
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-secondary">İptal</button>
          <button onClick={handleSave} className="btn-primary">
            {initial?.id ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateSlot {
  title: string;
  type: string;
  description?: string;
  color?: string;
  layoutType?: string;
  recurrence?: string;
  priority?: string;
  dayOffset: number;     // 0=Mon...6=Sun relative to week start
  startHour: number;
  startMinute: number;
  durationMinutes?: number;
}

interface WeeklyTemplate {
  id: string;
  name: string;
  createdAt: string;
  slots: TemplateSlot[];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Prime Time Strip ─────────────────────────────────────────────────────────

interface PrimeTimeSlot {
  hour: number;
  score: number;  // 0–100
  label: string;
}

function computePrimeSlots(hourlyData: Array<{ hour: number; impressions?: number; views?: number }>): PrimeTimeSlot[] {
  if (!hourlyData?.length) return [];
  const HOUR_LABELS: Record<number, string> = {
    6: 'Sabah', 7: 'Sabah', 8: 'Sabah', 9: 'Sabah Üstü', 10: 'Sabah Üstü', 11: 'Öğle Öncesi',
    12: 'Öğle', 13: 'Öğle', 14: 'Öğleden Sonra', 15: 'İkindi', 16: 'İkindi',
    17: 'Akşamüstü', 18: 'Akşamüstü', 19: 'Akşam', 20: 'Akşam', 21: 'Akşam',
    22: 'Gece', 23: 'Gece', 0: 'Gece Yarısı', 1: 'Gece Yarısı',
  };
  const maxVal = Math.max(...hourlyData.map((d) => (d.impressions ?? 0) + (d.views ?? 0)), 1);
  return hourlyData
    .map((d) => ({
      hour: d.hour,
      score: Math.round(((d.impressions ?? 0) + (d.views ?? 0)) / maxVal * 100),
      label: HOUR_LABELS[d.hour] ?? String(d.hour),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function PrimeTimeStrip({ primeSlots, show, onToggle }: { primeSlots: PrimeTimeSlot[]; show: boolean; onToggle: () => void }) {
  if (primeSlots.length === 0) return null;
  const top3 = [...primeSlots].slice(0, 3).sort((a, b) => a.hour - b.hour);
  return (
    <div className="flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(16,185,129,0.03)' }}>
      <div className="px-6 py-2.5 flex items-center gap-4">
        <button onClick={onToggle} className="flex items-center gap-1.5 text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors flex-shrink-0 font-medium">
          <span>📈</span>
          <span className="uppercase tracking-[0.12em]">Prime Time</span>
          <span className="text-emerald-400/40 ml-0.5">{show ? '▲' : '▼'}</span>
        </button>
        {!show && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {top3.map((slot) => (
              <div key={slot.hour} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 flex-shrink-0">
                <span className="text-emerald-300 font-bold text-xs tabular-nums">{String(slot.hour).padStart(2, '0')}:00</span>
                <span className="text-emerald-400/50 text-[10px]">·</span>
                <span className="text-emerald-400/60 text-[10px]">{slot.label}</span>
                <div className="ml-1 flex gap-px">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 rounded-sm" style={{ height: 10, background: i < Math.round(slot.score / 20) ? '#10b981' : 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
              </div>
            ))}
            <span className="text-[10px] text-white/20 flex-shrink-0">← geçen 7 gün izlenme verisi</span>
          </div>
        )}
        {show && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {primeSlots.map((slot) => (
              <div key={slot.hour} className="flex flex-col items-center rounded-xl border px-2.5 py-2 flex-shrink-0 transition-all"
                style={{ borderColor: slot.score >= 70 ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)', background: slot.score >= 70 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)' }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: slot.score >= 70 ? '#10b981' : '#9ca3af' }}>{String(slot.hour).padStart(2,'0')}:00</span>
                <div className="flex gap-px my-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1.5 rounded-sm" style={{ height: 12, background: i < Math.round(slot.score / 20) ? (slot.score >= 70 ? '#10b981' : '#6366f1') : 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
                <span className="text-[9px]" style={{ color: slot.score >= 70 ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.2)' }}>{slot.label}</span>
              </div>
            ))}
            <span className="text-[10px] text-white/20 ml-2 flex-shrink-0">Son 7 gün saatlik izlenme yoğunluğu</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAIWeekly, setShowAIWeekly] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConflictDetails, setShowConflictDetails] = useState(false);
  const [conflictAiLoading, setConflictAiLoading] = useState(false);
  const [conflictAiSuggestions, setConflictAiSuggestions] = useState<string | null>(null);
  const [showPrimeTime, setShowPrimeTime] = useState(false);
  const [primeSlots, setPrimeSlots] = useState<PrimeTimeSlot[]>([]);
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [newEventDefaults, setNewEventDefaults] = useState<Partial<ScheduleEvent>>({});

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, scrRes, tvRes, analyticsRes] = await Promise.allSettled([
        fetch('/api/schedule'),
        fetch('/api/screens'),
        fetch('/api/tv-channels?active=1'),
        fetch('/api/analytics?days=7'),
      ]);
      if (evRes.status === 'fulfilled' && evRes.value.ok) {
        const d = await evRes.value.json();
        setEvents(d.data ?? []);
      }
      if (scrRes.status === 'fulfilled' && scrRes.value.ok) {
        const d = await scrRes.value.json();
        setScreens(d.data ?? []);
      }
      if (tvRes.status === 'fulfilled' && tvRes.value.ok) {
        const d = await tvRes.value.json();
        setChannels(d.data ?? []);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
        const d = await analyticsRes.value.json();
        if (d.success && d.data?.hourlyData) {
          setPrimeSlots(computePrimeSlots(d.data.hourlyData));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleBulkImport = useCallback(async (evs: AIWeekPreview[]) => {
    await Promise.all(evs.map((ev) =>
      fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ev.title,
          type: ev.type,
          layoutType: ev.layoutType,
          startAt: ev.startAt,
          endAt: ev.endAt,
          recurrence: ev.recurrence ?? 'once',
          priority: ev.priority ?? 'normal',
          color: ev.color,
          isActive: true,
        }),
      })
    ));
    await fetchAll();
  }, [fetchAll]);

  const handleSave = async (data: Partial<ScheduleEvent>) => {
    if (editingEvent?.id) {
      const res = await fetch(`/api/schedule/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) { toast.success('Güncellendi'); fetchAll(); }
      else toast.error('Güncellenemedi');
    } else {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) { toast.success('Etkinlik oluşturuldu'); fetchAll(); }
      else toast.error('Oluşturulamadı');
    }
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return;
    const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Silindi'); fetchAll(); }
    setShowForm(false);
    setEditingEvent(null);
  };

  // ── Template handlers ──────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule/templates');
      if (res.ok) {
        const d = await res.json();
        setTemplates(d.data ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) { toast.error('Şablon adı girin'); return; }
    setSavingTemplate(true);
    try {
      // collect events for the current week
      const weekEnd = addDays(weekStart, 7);
      const weekEvents = events.filter((e) => {
        const d = new Date(e.startAt);
        return d >= weekStart && d < weekEnd;
      });
      const slots: TemplateSlot[] = weekEvents.map((e) => {
        const start = new Date(e.startAt);
        const dayOffset = Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
        const durationMs = e.endAt ? new Date(e.endAt).getTime() - start.getTime() : undefined;
        return {
          title: e.title,
          type: e.type,
          description: e.description ?? undefined,
          color: e.color ?? undefined,
          layoutType: e.layoutType ?? undefined,
          recurrence: e.recurrence ?? 'once',
          priority: e.priority ?? 'normal',
          dayOffset,
          startHour: start.getHours(),
          startMinute: start.getMinutes(),
          durationMinutes: durationMs ? Math.round(durationMs / 60_000) : undefined,
        };
      });
      const res = await fetch('/api/schedule/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slots }),
      });
      if (res.ok) {
        toast.success(`"${name}" şablonu kaydedildi`);
        setTemplateName('');
        fetchTemplates();
      } else {
        toast.error('Kaydedilemedi');
      }
    } finally {
      setSavingTemplate(false);
    }
  }, [templateName, weekStart, events, fetchTemplates]);

  const handleApplyTemplate = useCallback(async (tpl: WeeklyTemplate) => {
    if (!confirm(`"${tpl.name}" şablonunu bu haftaya uygulamak istiyor musunuz? ${tpl.slots.length} etkinlik oluşturulacak.`)) return;
    setApplyingTemplate(tpl.id);
    try {
      await Promise.all(tpl.slots.map((slot) => {
        const startAt = new Date(weekStart);
        startAt.setDate(startAt.getDate() + slot.dayOffset);
        startAt.setHours(slot.startHour, slot.startMinute, 0, 0);
        const endAt = slot.durationMinutes
          ? new Date(startAt.getTime() + slot.durationMinutes * 60_000)
          : undefined;
        return fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: slot.title,
            type: slot.type,
            description: slot.description,
            color: slot.color,
            layoutType: slot.layoutType,
            recurrence: slot.recurrence ?? 'once',
            priority: slot.priority ?? 'normal',
            startAt: startAt.toISOString(),
            endAt: endAt?.toISOString(),
            isActive: true,
          }),
        });
      }));
      toast.success(`"${tpl.name}" uygulandı — ${tpl.slots.length} etkinlik oluşturuldu`);
      fetchAll();
      setShowTemplates(false);
    } catch {
      toast.error('Şablon uygulanamadı');
    } finally {
      setApplyingTemplate(null);
    }
  }, [weekStart, fetchAll]);

  const handleDeleteTemplate = useCallback(async (id: string, name: string) => {
    if (!confirm(`"${name}" şablonunu silmek istiyor musunuz?`)) return;
    const res = await fetch(`/api/schedule/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Şablon silindi'); fetchTemplates(); }
    else toast.error('Silinemedi');
  }, [fetchTemplates]);

  const handleCopyToNextWeek = useCallback(async () => {
    if (!editingEvent) return;
    const shift = 7 * 24 * 60 * 60 * 1000;
    const newStartAt = new Date(new Date(editingEvent.startAt).getTime() + shift).toISOString();
    const newEndAt = editingEvent.endAt
      ? new Date(new Date(editingEvent.endAt).getTime() + shift).toISOString()
      : undefined;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editingEvent, id: undefined, startAt: newStartAt, endAt: newEndAt }),
    });
    if (res.ok) {
      toast.success('Etkinlik haftaya kopyalandı');
      setShowForm(false);
      setEditingEvent(null);
      fetchAll();
    } else {
      toast.error('Kopyalanamadı');
    }
  }, [editingEvent, fetchAll]);

  const openCreate = (day: Date, hour: number) => {
    const startAt = new Date(day);
    startAt.setHours(hour, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(hour + 1);
    setNewEventDefaults({ startAt: fmtIso(startAt), endAt: fmtIso(endAt) });
    setEditingEvent(null);
    setShowForm(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  // ── Filter events for a specific day ──────────────────────────────────────
  const eventsForDay = (day: Date): ScheduleEvent[] => {
    const dayStr = day.toISOString().slice(0, 10);
    return events.filter((e) => {
      const eDay = e.startAt.slice(0, 10);
      if (e.recurrence === 'once') return eDay === dayStr;
      if (e.recurrence === 'daily') return true;
      const dow = day.getDay();
      if (e.recurrence === 'weekdays') return dow >= 1 && dow <= 5;
      if (e.recurrence === 'weekends') return dow === 0 || dow === 6;
      if (e.recurrence === 'weekly') {
        try {
          const days = e.daysOfWeek ? (typeof e.daysOfWeek === 'string' ? JSON.parse(e.daysOfWeek) : e.daysOfWeek) : [];
          return days.includes(dow);
        } catch { return false; }
      }
      return false;
    });
  };

  // ── Hour-based grid ────────────────────────────────────────────────────────
  // Each hour row = 60px
  const HOUR_H = 60;
  const GRID_H = HOUR_H * 24;

  function getTopPx(startAt: string) {
    const d = new Date(startAt);
    return (d.getHours() * 60 + d.getMinutes()) * (HOUR_H / 60);
  }

  function getHeightPx(startAt: string, endAt?: string) {
    if (!endAt) return HOUR_H;
    const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
    return Math.max(HOUR_H / 2, (diff / 3_600_000) * HOUR_H);
  }

  const screenMap = Object.fromEntries(screens.map((s) => [s.id, s]));
  const conflicts = detectScheduleConflicts(events);
  const liveTvCount = events.filter((event) => event.type === 'live_tv').length;
  const criticalCount = events.filter((event) => event.priority === 'critical' || event.priority === 'high').length;
  const nextLiveEvent = [...events]
    .filter((event) => event.type === 'live_tv' && new Date(event.startAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
  const nextLiveChannel = nextLiveEvent?.sourceRef ? channels.find((channel) => channel.id === nextLiveEvent.sourceRef) : null;
  const conflictRows = conflicts.slice(0, 6).map((c, i) => {
    const aStart = new Date(c.a.startAt);
    const bStart = new Date(c.b.startAt);
    const aScreen = c.a.screenId ? (screenMap[c.a.screenId]?.name ?? 'Bilinmeyen Ekran') : 'Tüm Ekranlar';
    const bScreen = c.b.screenId ? (screenMap[c.b.screenId]?.name ?? 'Bilinmeyen Ekran') : 'Tüm Ekranlar';
    return {
      key: `${c.a.id}-${c.b.id}-${i}`,
      conflict: c,
      left: `${c.a.title} (${String(aStart.getHours()).padStart(2, '0')}:${String(aStart.getMinutes()).padStart(2, '0')})`,
      right: `${c.b.title} (${String(bStart.getHours()).padStart(2, '0')}:${String(bStart.getMinutes()).padStart(2, '0')})`,
      scope: aScreen === bScreen ? aScreen : `${aScreen} ↔ ${bScreen}`,
    };
  });

  const autoResolveConflict = async (conflict: { a: ScheduleEvent; b: ScheduleEvent }) => {
    const first = new Date(conflict.a.startAt).getTime() <= new Date(conflict.b.startAt).getTime() ? conflict.a : conflict.b;
    const second = first.id === conflict.a.id ? conflict.b : conflict.a;
    const firstPriority = getPriorityScore(first.priority);
    const secondPriority = getPriorityScore(second.priority);
    const moveTarget = secondPriority < firstPriority ? second : firstPriority < secondPriority ? first : second;
    const anchor = moveTarget.id === second.id ? first : second;

    const moveStart = new Date(moveTarget.startAt);
    const moveEnd = moveTarget.endAt ? new Date(moveTarget.endAt) : new Date(moveStart.getTime() + 60 * 60 * 1000);
    const durationMs = Math.max(30 * 60 * 1000, moveEnd.getTime() - moveStart.getTime());
    const anchorEnd = anchor.endAt ? new Date(anchor.endAt) : new Date(new Date(anchor.startAt).getTime() + 60 * 60 * 1000);
    const nextStart = new Date(anchorEnd.getTime() + 15 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    try {
      const res = await fetch(`/api/schedule/${moveTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: nextStart.toISOString(),
          endAt: nextEnd.toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Çakışma çözümü kaydedilemedi');
      toast.success(`"${moveTarget.title}" ${String(nextStart.getHours()).padStart(2, '0')}:${String(nextStart.getMinutes()).padStart(2, '0')} saatine kaydırıldı`);
      setConflictAiSuggestions(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Çakışma çözülemedi');
    }
  };

  const fetchConflictSuggestions = async () => {
    if (conflicts.length === 0) {
      setConflictAiSuggestions('Çakışma yok. Mevcut takvim dengeli görünüyor.');
      return;
    }
    setConflictAiLoading(true);
    try {
      const lines = conflicts.slice(0, 10).map((c, i) => {
        const aStart = new Date(c.a.startAt);
        const bStart = new Date(c.b.startAt);
        const aScreen = c.a.screenId ? (screenMap[c.a.screenId]?.name ?? 'Bilinmeyen Ekran') : 'Tüm Ekranlar';
        const bScreen = c.b.screenId ? (screenMap[c.b.screenId]?.name ?? 'Bilinmeyen Ekran') : 'Tüm Ekranlar';
        const aTime = `${String(aStart.getHours()).padStart(2, '0')}:${String(aStart.getMinutes()).padStart(2, '0')}`;
        const bTime = `${String(bStart.getHours()).padStart(2, '0')}:${String(bStart.getMinutes()).padStart(2, '0')}`;
        return `${i + 1}. "${c.a.title}" (${aTime}, ${aScreen}) ↔ "${c.b.title}" (${bTime}, ${bScreen})`;
      });

      const prompt = [
        'Aşağıdaki yayın takvimi çakışmaları için kısa ve uygulanabilir çözüm önerileri üret.',
        'Kısıtlar: işletme ekranı yayını, mümkünse yüksek öncelikli etkinliği koru, kaydırma önerisi dakikayı net versin (ör: 15:30).',
        'Format:',
        '- Çakışma #N: Öneri',
        '- Gerekçe',
        '',
        'Çakışmalar:',
        ...lines,
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeContext: false,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error ?? 'AI önerisi alınamadı');
      setConflictAiSuggestions(d.data.reply ?? 'Öneri üretilemedi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI öneri hatası');
    } finally {
      setConflictAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#030712]">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#070b12' }}
      >
        <div>
          <h1 className="text-white font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Yayın Takvimi
          </h1>
          <p className="text-white/35 text-xs mt-0.5">{events.length} etkinlik planlandı</p>
          <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
            <span className="badge badge-muted">{liveTvCount} canlı TV yayını</span>
            <button
              onClick={() => setShowConflictDetails((v) => !v)}
              className={cn('badge transition-all', conflicts.length > 0 ? 'badge-warning hover:brightness-110' : 'badge-success hover:brightness-110')}
            >
              {conflicts.length} çakışma
            </button>
            <span className={cn('badge', criticalCount > 0 ? 'badge-danger' : 'badge-muted')}>
              {criticalCount} yüksek öncelik
            </span>
          </div>
          {showConflictDetails && (
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 max-w-[560px]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400/80 font-semibold">Çakışma Detayı</p>
                <button
                  onClick={fetchConflictSuggestions}
                  disabled={conflictAiLoading}
                  className="text-[10px] px-2 py-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-all disabled:opacity-40"
                >
                  {conflictAiLoading ? '⏳ AI analiz…' : '🤖 AI Çözüm Öner'}
                </button>
              </div>
              {conflictRows.length === 0 ? (
                <p className="text-xs text-emerald-300">Çakışma yok, takvim temiz.</p>
              ) : (
                <div className="space-y-2">
                  {conflictRows.map((row) => (
                    <div key={row.key} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-white/85">{row.left} <span className="text-white/25">↔</span> {row.right}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">Kapsam: {row.scope}</p>
                        </div>
                        <button
                          onClick={() => autoResolveConflict(row.conflict)}
                          className="text-[10px] px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all flex-shrink-0"
                        >
                          Hızlı Çöz
                        </button>
                      </div>
                    </div>
                  ))}
                  {conflicts.length > conflictRows.length && (
                    <p className="text-[10px] text-white/35">+{conflicts.length - conflictRows.length} çakışma daha</p>
                  )}
                </div>
              )}
              {conflictAiSuggestions && (
                <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-indigo-300/80 mb-1">AI Çözüm Önerileri</p>
                  <div className="space-y-1">
                    {conflictAiSuggestions.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="text-xs text-white/80 leading-relaxed">{line.replace(/^[-•*]\s*/, '')}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {nextLiveEvent && (
            <div className="hidden xl:flex flex-col rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 min-w-[250px]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">Sıradaki Canlı Yayın</p>
              <p className="text-white text-sm font-semibold mt-1">{nextLiveEvent.title}</p>
              <p className="text-white/35 text-xs mt-1">{nextLiveChannel?.title ?? 'Kaynak seçilmedi'} · {fmt(new Date(nextLiveEvent.startAt))}</p>
            </div>
          )}
          {/* Week navigation */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              ←
            </button>
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors text-xs border-x border-white/10"
            >
              Bugün
            </button>
            <button
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              →
            </button>
          </div>
          <button
            onClick={() => setShowAIWeekly(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-all text-sm font-medium"
          >
            🤖 AI Program
          </button>
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm font-medium',
              showTemplates
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            📋 Şablonlar {templates.length > 0 && <span className="text-[10px] opacity-60">({templates.length})</span>}
          </button>
          <button
            onClick={() => { setEditingEvent(null); setNewEventDefaults({}); setShowForm(true); }}
            className="btn-primary text-sm"
          >
            + Yeni Etkinlik
          </button>
        </div>
      </header>

      {/* Templates Panel */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden border-b"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(245,158,11,0.03)' }}
          >
            <div className="px-6 py-4 flex flex-wrap gap-5 items-start">
              {/* Save current week as template */}
              <div className="flex-shrink-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400/60 font-semibold mb-2">Bu Haftayı Kaydet</p>
                <div className="flex items-center gap-2">
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                    placeholder="Şablon adı (ör: Standart Hafta)"
                    className="input text-sm w-52"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !templateName.trim()}
                    className="btn-primary text-sm disabled:opacity-40"
                  >
                    {savingTemplate ? '…' : 'Kaydet'}
                  </button>
                </div>
                <p className="text-[10px] text-white/25 mt-1">
                  Bu haftadaki {events.filter(e => { const d = new Date(e.startAt); return d >= weekStart && d < addDays(weekStart, 7); }).length} etkinlik şablon olarak kaydedilir
                </p>
              </div>

              {/* Separator */}
              {templates.length > 0 && <div className="w-px self-stretch bg-white/[0.06] flex-shrink-0 mx-1" />}

              {/* Template list */}
              {templates.length > 0 && (
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400/60 font-semibold mb-2">Kayıtlı Şablonlar</p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.07] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-white/80 text-xs font-medium truncate max-w-[140px]">{tpl.name}</p>
                          <p className="text-white/30 text-[10px]">{tpl.slots.length} etkinlik</p>
                        </div>
                        <button
                          onClick={() => handleApplyTemplate(tpl)}
                          disabled={applyingTemplate === tpl.id}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-40 flex-shrink-0"
                        >
                          {applyingTemplate === tpl.id ? '…' : 'Uygula'}
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-all flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {templates.length === 0 && (
                <div className="flex items-center gap-2 text-white/20 text-xs">
                  <span>📋</span>
                  <span>Henüz şablon kaydedilmemiş. Haftanızı düzenleyip kaydedin.</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prime Time Strip */}
      <PrimeTimeStrip primeSlots={primeSlots} show={showPrimeTime} onToggle={() => setShowPrimeTime((v) => !v)} />

      {/* Calendar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Time gutter */}
        <div
          className="flex-shrink-0 w-16 overflow-hidden flex flex-col"
          style={{ background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Day header placeholder */}
          <div className="h-12 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
          {/* Hour labels */}
          <div className="flex-1 overflow-y-hidden relative" style={{ height: GRID_H }}>
            {HOURS_VISIBLE.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-white/20 tabular-nums"
                style={{ top: h * HOUR_H - 7 }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div className="flex-1 overflow-auto">
          <div className="flex min-w-0" style={{ minWidth: 700 }}>
            {days.map((day, di) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayEvents = eventsForDay(day);

              return (
                <div key={di} className="flex-1 min-w-0 flex flex-col border-r" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {/* Day header */}
                  <div
                    className={cn(
                      'h-12 flex-shrink-0 flex flex-col items-center justify-center border-b',
                      isToday ? 'bg-indigo-500/10' : ''
                    )}
                    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <p className={cn('text-[10px] font-medium uppercase tracking-widest', isToday ? 'text-indigo-400' : 'text-white/30')}>
                      {DAYS_TR[day.getDay()]}
                    </p>
                    <p className={cn('text-base font-bold', isToday ? 'text-indigo-300' : 'text-white/60')}>
                      {day.getDate()}
                    </p>
                  </div>

                  {/* Hourly grid */}
                  <div className="relative" style={{ height: GRID_H }}>
                    {/* Hour lines */}
                    {HOURS_VISIBLE.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t cursor-pointer hover:bg-white/[0.02] transition-colors group"
                        style={{ top: h * HOUR_H, height: HOUR_H, borderColor: 'rgba(255,255,255,0.04)' }}
                        onClick={() => openCreate(day, h)}
                      >
                        <div className="hidden group-hover:flex items-center justify-center h-full text-white/15 text-xs">
                          + {String(h).padStart(2, '0')}:00
                        </div>
                      </div>
                    ))}

                    {/* Events */}
                    {dayEvents.map((ev, ei) => {
                      const top = getTopPx(ev.startAt);
                      const height = getHeightPx(ev.startAt, ev.endAt);
                      const color = getEventColor(ev, ei);
                      const screenName = ev.screenId ? (screenMap[ev.screenId]?.name ?? 'Bilinmeyen Ekran') : 'Tüm Ekranlar';
                      const typeLabel = EVENT_TYPES.find((t) => t.value === ev.type)?.label ?? ev.type;
                      const channelLabel = ev.sourceRef ? channels.find((channel) => channel.id === ev.sourceRef)?.title : null;

                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer hover:brightness-110 transition-all z-10"
                          style={{ top, height: Math.max(height, 28), background: `${color}25`, border: `1px solid ${color}50` }}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                        >
                          <div className="px-1.5 py-1 h-full flex flex-col justify-start overflow-hidden">
                            <p className="text-[11px] font-semibold truncate" style={{ color }}>
                              {ev.title}
                            </p>
                            {height > 40 && (
                              <>
                                <p className="text-[10px] truncate" style={{ color: `${color}99` }}>{typeLabel}</p>
                                {channelLabel && <p className="text-[10px] truncate" style={{ color: `${color}82` }}>{channelLabel}</p>}
                                <p className="text-[10px] truncate" style={{ color: `${color}70` }}>{screenName}</p>
                              </>
                            )}
                          </div>
                          {/* Recurrence indicator */}
                          {ev.recurrence !== 'once' && (
                            <div
                              className="absolute top-1 right-1 text-[8px] rounded px-1 font-bold"
                              style={{ background: `${color}40`, color }}
                            >
                              ↺
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-6 py-2.5 border-t flex-shrink-0 overflow-x-auto"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#070b12' }}
      >
        <span className="text-white/25 text-[10px] uppercase tracking-widest flex-shrink-0">Ekranlar:</span>
        {screens.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_COLORS[i % EVENT_COLORS.length] }} />
            <span className="text-white/40 text-[11px]">{s.name}</span>
          </div>
        ))}
        <span className="text-white/15 text-[10px] ml-auto flex-shrink-0">* Hücreye tıkla: yeni etkinlik · Etkinliğe tıkla: düzenle</span>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <EventFormModal
            initial={editingEvent ?? newEventDefaults}
            screens={screens}
            channels={channels}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingEvent(null); }}
            onDelete={editingEvent?.id ? () => handleDelete(editingEvent.id) : undefined}
            onCopyToNextWeek={editingEvent?.id ? handleCopyToNextWeek : undefined}
          />
        )}
        {showAIWeekly && (
          <AIWeeklyModal
            weekStart={weekStart}
            onClose={() => setShowAIWeekly(false)}
            onImport={handleBulkImport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
