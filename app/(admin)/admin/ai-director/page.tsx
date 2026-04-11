'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AIActionPlan, DirectorLayoutRecommendation, DirectorScheduleEvent, DirectorPlaylistSuggestion, DirectorBroadcastCommand, DirectorTickerSuggestion } from '@/lib/ai-engine';

// ─── Types re-exported for client ────────────────────────────────────────────
type LayoutRec = DirectorLayoutRecommendation;
type SchedEvent = DirectorScheduleEvent;
type PlaylistSug = DirectorPlaylistSuggestion;
type BroadcastCmd = DirectorBroadcastCommand;
type TickerSug = DirectorTickerSuggestion;

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYOUT_COLORS: Record<string, string> = {
  default: '#6366f1', youtube: '#ef4444', instagram: '#f59e0b',
  split_2: '#3b82f6', fullscreen: '#8b5cf6', digital_signage: '#10b981',
  social_wall: '#ec4899', ambient: '#14b8a6', promo: '#f97316',
  triple: '#a855f7', news_focus: '#0ea5e9', portrait: '#84cc16',
  markets: '#22c55e', breaking_news: '#dc2626', event_countdown: '#7c3aed',
  split_scoreboard: '#059669',
};

const PRIORITY_COLORS = {
  immediate: 'text-red-400 bg-red-500/15 border-red-500/30',
  suggested: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  scheduled: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
};

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${DAYS_TR[d.getDay()]} ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}d` : `${Math.floor(m/60)}s ${m%60}d`;
}

// ─── Week Picker ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400';
  const bg = value >= 80 ? 'bg-emerald-500/15' : value >= 60 ? 'bg-amber-500/15' : 'bg-red-500/15';
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', color, bg, `border-current/30`)}>
      %{value} güven
    </span>
  );
}

// ─── Layout Card ──────────────────────────────────────────────────────────────

function LayoutRecCard({ rec, onApply, applying }: { rec: LayoutRec; onApply: (r: LayoutRec) => void; applying: boolean }) {
  const color = LAYOUT_COLORS[rec.layout] ?? '#6366f1';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div
              className="px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}
            >
              {rec.layout}
            </div>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', PRIORITY_COLORS[rec.priority])}>
              {rec.priority === 'immediate' ? '🔴 Hemen' : rec.priority === 'suggested' ? '🟡 Öneri' : '🟢 Planlı'}
            </span>
            {rec.duration && (
              <span className="text-xs text-white/30">{rec.duration} dk</span>
            )}
          </div>
          <div className="text-sm text-white font-medium truncate">
            {rec.screenName ?? (rec.screenId ? `Ekran: ${rec.screenId.slice(0,8)}` : 'Tüm ekranlar')}
          </div>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">{rec.reason}</p>
          {rec.scheduledFor && (
            <p className="text-xs text-indigo-400 mt-1">📅 {fmtDateTime(rec.scheduledFor)}</p>
          )}
        </div>
        <button
          onClick={() => onApply(rec)}
          disabled={applying}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          {applying ? '⏳' : '▶ Uygula'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Schedule Event Card ──────────────────────────────────────────────────────

function SchedEventCard({ ev, onSave, saving }: { ev: SchedEvent; onSave: (e: SchedEvent) => void; saving: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {ev.color && (
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ev.color }} />
            )}
            <span className="text-sm font-medium text-white">{ev.title}</span>
            <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{ev.type}</span>
            {ev.layoutType && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: (LAYOUT_COLORS[ev.layoutType] ?? '#6366f1') + '22', color: LAYOUT_COLORS[ev.layoutType] ?? '#6366f1' }}
              >
                {ev.layoutType}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-1">{fmtDateTime(ev.startAt)} → {ev.endAt ? fmtDateTime(ev.endAt) : '—'} · {ev.recurrence}</p>
          <p className="text-xs text-white/30 italic">{ev.reason}</p>
        </div>
        <button
          onClick={() => onSave(ev)}
          disabled={saving}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          {saving ? '⏳' : '💾 Kaydet'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Playlist Suggestion Card ──────────────────────────────────────────────────

function PlaylistSugCard({ sug, onSave, saving }: { sug: PlaylistSug; onSave: (s: PlaylistSug) => void; saving: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-white/8 bg-white/3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎵</span>
            <span className="text-sm font-medium text-white">{sug.name}</span>
          </div>
          <p className="text-xs text-white/40 mb-1">{sug.description}</p>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span>{sug.items?.length ?? 0} öğe</span>
            <span>·</span>
            <span>{fmtDuration(sug.totalDuration)}</span>
            <span>·</span>
            <span>✨ {sug.transition}</span>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
          >
            {expanded ? '▲ Öğeleri gizle' : '▼ Öğeleri göster'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-1 overflow-hidden"
              >
                {(sug.items ?? []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="w-4 text-right text-white/20">{i+1}.</span>
                    <span className="bg-white/5 px-1 rounded">{item.type}</span>
                    <span className="truncate flex-1">{item.title}</span>
                    <span className="text-white/30 flex-shrink-0">{fmtDuration(item.duration)}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => onSave(sug)}
          disabled={saving}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          {saving ? '⏳' : '💾 Kaydet'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Broadcast Command Card ────────────────────────────────────────────────────

function BroadcastCmdCard({ cmd, onExecute, executing }: { cmd: BroadcastCmd; onExecute: (c: BroadcastCmd) => void; executing: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded">{cmd.command}</span>
            <span className="text-xs text-white/30">{cmd.target === 'all' ? 'Tüm ekranlar' : `Ekran: ${cmd.target}`}</span>
          </div>
          <p className="text-xs text-white/40">{cmd.reason}</p>
          {Object.keys(cmd.payload ?? {}).length > 0 && (
            <pre className="text-xs text-white/25 mt-1 font-mono">{JSON.stringify(cmd.payload, null, 0).slice(0, 80)}</pre>
          )}
          {cmd.executeAt && (
            <p className="text-xs text-indigo-400 mt-1">📅 {fmtDateTime(cmd.executeAt)}</p>
          )}
        </div>
        <button
          onClick={() => onExecute(cmd)}
          disabled={executing}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          {executing ? '⏳' : '▶ Gönder'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Ticker Card ──────────────────────────────────────────────────────────────

function TickerSugCard({ sug, onSave, saving }: { sug: TickerSug; onSave: (s: TickerSug) => void; saving: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3"
    >
      <span className="text-xl">{sug.emoji ?? '📢'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{sug.text}</p>
        <p className="text-xs text-white/30 mt-0.5">{sug.reason} · öncelik: {sug.priority}</p>
      </div>
      <button
        onClick={() => onSave(sug)}
        disabled={saving}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
      >
        {saving ? '⏳' : '💾'}
      </button>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'director' | 'schedule' | 'playlist' | 'tickers';

export default function AIDirectorPage() {
  const [tab, setTab] = useState<Tab>('director');
  const [analyzing, setAnalyzing] = useState(false);
  const [plan, setPlan] = useState<AIActionPlan | null>(null);
  const [businessContext, setBusinessContext] = useState('');
  const [userInstruction, setUserInstruction] = useState('');
  const [autoExecute, setAutoExecute] = useState(false);

  // Schedule generation
  const [schedGenerating, setSchedGenerating] = useState(false);
  const [schedResult, setSchedResult] = useState<{ events: SchedEvent[]; narrative: string } | null>(null);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [schedAutoSave, setSchedAutoSave] = useState(false);

  // Playlist generation
  const [plGenerating, setPlGenerating] = useState(false);
  const [plResult, setPlResult] = useState<PlaylistSug | null>(null);
  const [plTheme, setPlTheme] = useState('');
  const [plDuration, setPlDuration] = useState(60);
  const [plAutoSave, setPlAutoSave] = useState(false);

  // Ticker generation
  const [tickGenerating, setTickGenerating] = useState(false);
  const [tickResults, setTickResults] = useState<TickerSug[]>([]);
  const [tickContext, setTickContext] = useState('');

  // Applying states
  const [applyingLayout, setApplyingLayout] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [savingPlaylist, setSavingPlaylist] = useState<string | null>(null);
  const [executingCmd, setExecutingCmd] = useState<string | null>(null);
  const [savingTicker, setSavingTicker] = useState<string | null>(null);

  // ── AI Director Analyze ────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setPlan(null);
    try {
      const res = await fetch('/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          execute: autoExecute,
          businessContext: businessContext || undefined,
          userInstruction: userInstruction || undefined,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setPlan(d.data.plan);
      if (autoExecute) toast.success('AI direktörü komutları uygulandı');
      else toast.success('Analiz tamamlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analiz başarısız');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Apply layout recommendation ────────────────────────────────────────────

  const applyLayout = async (rec: LayoutRec) => {
    const key = rec.screenId ?? 'all';
    setApplyingLayout(key);
    try {
      const res = await fetch('/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_command',
          command: 'change_layout',
          target: rec.screenId ?? 'all',
          payload: { layout: rec.layout },
        }),
      });
      if (!res.ok) throw new Error();
      // Also update screen in DB
      if (rec.screenId) {
        await fetch(`/api/screens?id=${rec.screenId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layoutType: rec.layout }),
        });
      }
      toast.success(`Layout "${rec.layout}" uygulandı`);
    } catch {
      toast.error('Layout uygulanamadı');
    } finally {
      setApplyingLayout(null);
    }
  };

  // ── Save schedule event ────────────────────────────────────────────────────

  const saveScheduleEvent = async (ev: SchedEvent) => {
    const key = ev.startAt;
    setSavingEvent(key);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ev.title,
          type: ev.type,
          layoutType: ev.layoutType ?? undefined,
          startAt: ev.startAt,
          endAt: ev.endAt ?? undefined,
          recurrence: ev.recurrence ?? 'once',
          priority: ev.priority ?? 'normal',
          color: ev.color ?? undefined,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Schedule eventi kaydedildi');
    } catch {
      toast.error('Kayıt başarısız');
    } finally {
      setSavingEvent(null);
    }
  };

  // ── Save playlist ────────────────────────────────────────────────────────────

  const savePlaylist = async (sug: PlaylistSug) => {
    setSavingPlaylist(sug.name);
    try {
      const res = await fetch('/api/ai/schedule-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playlist',
          theme: sug.name,
          durationMinutes: Math.ceil(sug.totalDuration / 60),
          autoSave: true,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      toast.success(`Playlist kaydedildi: ${sug.name}`);
    } catch {
      toast.error('Playlist kaydedilemedi');
    } finally {
      setSavingPlaylist(null);
    }
  };

  // ── Execute broadcast command ──────────────────────────────────────────────

  const executeCommand = async (cmd: BroadcastCmd) => {
    const key = cmd.command + cmd.target;
    setExecutingCmd(key);
    try {
      const res = await fetch('/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_command',
          command: cmd.command,
          target: cmd.target,
          payload: cmd.payload,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Komut gönderildi: ${cmd.command}`);
    } catch {
      toast.error('Komut gönderilemedi');
    } finally {
      setExecutingCmd(null);
    }
  };

  // ── Save ticker ───────────────────────────────────────────────────────────

  const saveTicker = async (sug: TickerSug) => {
    setSavingTicker(sug.text.slice(0, 10));
    try {
      const res = await fetch('/api/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sug.text,
          emoji: sug.emoji ?? '📢',
          priority: sug.priority ?? 5,
          color: sug.color,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ticker mesajı kaydedildi');
    } catch {
      toast.error('Ticker kaydedilemedi');
    } finally {
      setSavingTicker(null);
    }
  };

  // ── Generate weekly schedule ───────────────────────────────────────────────

  const generateSchedule = async () => {
    setSchedGenerating(true);
    setSchedResult(null);
    try {
      const res = await fetch('/api/ai/schedule-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly',
          weekStart,
          businessContext: businessContext || 'Social Lounge TV',
          autoSave: schedAutoSave,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setSchedResult(d.data);
      toast.success(`${d.data.events.length} event oluşturuldu${schedAutoSave ? ' ve kaydedildi' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Üretim başarısız');
    } finally {
      setSchedGenerating(false);
    }
  };

  // ── Generate playlist ──────────────────────────────────────────────────────

  const generatePlaylist = async () => {
    if (!plTheme.trim()) { toast.error('Tema giriniz'); return; }
    setPlGenerating(true);
    setPlResult(null);
    try {
      const res = await fetch('/api/ai/schedule-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playlist',
          theme: plTheme,
          durationMinutes: plDuration,
          businessContext: businessContext || 'Social Lounge TV',
          autoSave: plAutoSave,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setPlResult(d.data.suggestion);
      toast.success(`Playlist oluşturuldu${plAutoSave ? ' ve kaydedildi' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Üretim başarısız');
    } finally {
      setPlGenerating(false);
    }
  };

  // ── Generate tickers ──────────────────────────────────────────────────────

  const generateTickers = async () => {
    setTickGenerating(true);
    setTickResults([]);
    try {
      const res = await fetch('/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_tickers',
          context: tickContext || businessContext || 'lounge/bar işletmesi',
          count: 8,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setTickResults(d.data.tickers ?? []);
      toast.success(`${d.data.tickers?.length ?? 0} ticker mesajı üretildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Üretim başarısız');
    } finally {
      setTickGenerating(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'director', label: 'AI Direktör', icon: '🤖' },
    { id: 'schedule', label: 'Takvim Üret', icon: '📅' },
    { id: 'playlist', label: 'Playlist Üret', icon: '🎵' },
    { id: 'tickers', label: 'Ticker Üret', icon: '📢' },
  ];

  return (
    <div className="min-h-screen bg-[#060c17] text-white">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/6 bg-[#070d1a] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span>Gemini AI Direktörü</span>
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                2.5 Pro
              </span>
            </h1>
            <p className="text-white/30 text-xs mt-0.5">Sisteminizi Gemini ile tam otomasyonlu yönetin</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 text-xs font-medium">Gemini 2.5 Pro</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
                tab === t.id
                  ? 'border-indigo-400 text-white'
                  : 'border-transparent text-white/40 hover:text-white/60'
              )}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Shared Context Input ──────────────────────────────────────────────── */}
        <div className="mb-6 p-4 rounded-2xl border border-white/8 bg-white/3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-white/60">İşletme Bağlamı</span>
            <span className="text-xs text-white/25">(Tüm sekmeler için ortak)</span>
          </div>
          <input
            value={businessContext}
            onChange={(e) => setBusinessContext(e.target.value)}
            placeholder="ör: Kadıköy'de modern lounge bar, akşam 18:00'den gece 02:00'ye kadar açık, 25-40 yaş arası..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        {/* ── AI DIRECTOR TAB ───────────────────────────────────────────────────── */}
        {tab === 'director' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Özel Talimat <span className="text-white/25">(opsiyonel)</span>
                </label>
                <textarea
                  value={userInstruction}
                  onChange={(e) => setUserInstruction(e.target.value)}
                  rows={2}
                  placeholder="ör: Bugün özel bir etkinlik var, prime time'ı 4 saat uzat ve promo layouta geç..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setAutoExecute(!autoExecute)}
                    className={cn('w-10 h-5 rounded-full transition-colors relative', autoExecute ? 'bg-red-500' : 'bg-white/10')}
                  >
                    <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', autoExecute ? 'left-5' : 'left-0.5')} />
                  </div>
                  <div>
                    <span className="text-sm text-white">Otomatik Uygula</span>
                    {autoExecute && <span className="ml-2 text-xs text-red-400">⚠️ Anlık yayın değiştirir</span>}
                  </div>
                </label>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
                >
                  {analyzing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analiz ediliyor...
                    </>
                  ) : (
                    <>🧠 Sistemi Analiz Et</>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            <AnimatePresence>
              {plan && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Summary */}
                  <div className="p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">🎯</span>
                      <h2 className="text-base font-bold text-white">AI Özet</h2>
                      <ConfidenceBadge value={plan.confidence ?? 80} />
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed mb-2">{plan.summary}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{plan.analysis}</p>
                    {(plan.optimizationTips ?? []).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/8 space-y-1">
                        {plan.optimizationTips.map((tip, i) => (
                          <p key={i} className="text-xs text-amber-300/70">💡 {tip}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Layout Recommendations */}
                  {(plan.layoutRecommendations ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                        ⊞ Layout Önerileri ({plan.layoutRecommendations.length})
                      </h3>
                      <div className="space-y-2">
                        {plan.layoutRecommendations.map((rec, i) => (
                          <LayoutRecCard
                            key={i}
                            rec={rec}
                            onApply={applyLayout}
                            applying={applyingLayout === (rec.screenId ?? 'all')}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Broadcast Commands */}
                  {(plan.broadcastCommands ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                        📡 Yayın Komutları ({plan.broadcastCommands.length})
                      </h3>
                      <div className="space-y-2">
                        {plan.broadcastCommands.map((cmd, i) => (
                          <BroadcastCmdCard
                            key={i}
                            cmd={cmd}
                            onExecute={executeCommand}
                            executing={executingCmd === cmd.command + cmd.target}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schedule Events */}
                  {(plan.scheduleEvents ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                        📅 Yayın Takvimi Önerileri ({plan.scheduleEvents.length})
                      </h3>
                      <div className="space-y-2">
                        {plan.scheduleEvents.map((ev, i) => (
                          <SchedEventCard
                            key={i}
                            ev={ev}
                            onSave={saveScheduleEvent}
                            saving={savingEvent === ev.startAt}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playlist Suggestions */}
                  {(plan.playlistSuggestions ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                        🎵 Playlist Önerileri ({plan.playlistSuggestions.length})
                      </h3>
                      <div className="space-y-2">
                        {plan.playlistSuggestions.map((sug, i) => (
                          <PlaylistSugCard
                            key={i}
                            sug={sug}
                            onSave={savePlaylist}
                            saving={savingPlaylist === sug.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ticker Suggestions */}
                  {(plan.tickerSuggestions ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                        📢 Ticker Önerileri ({plan.tickerSuggestions.length})
                      </h3>
                      <div className="space-y-2">
                        {plan.tickerSuggestions.map((sug, i) => (
                          <TickerSugCard
                            key={i}
                            sug={sug}
                            onSave={saveTicker}
                            saving={savingTicker === sug.text.slice(0, 10)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-white/20 text-center pt-2">
                    Oluşturulma: {new Date(plan.generatedAt).toLocaleString('tr-TR')} · Gemini 2.5 Pro
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!plan && !analyzing && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/20">
                <span className="text-6xl">🧠</span>
                <p className="text-base">Sistemi analiz etmek için butona basın</p>
                <p className="text-sm">Gemini 2.5 Pro tüm ekranları, içerikleri ve takviminizi inceler</p>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE GENERATION TAB ───────────────────────────────────────────── */}
        {tab === 'schedule' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
              <h2 className="text-base font-bold text-white">📅 Haftalık Takvim Üret</h2>
              <p className="text-xs text-white/40">Gemini 2.5 Pro, işletmenize özel 1 haftalık tam yayın takvimi oluşturur.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Hafta Başlangıcı</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <div
                      onClick={() => setSchedAutoSave(!schedAutoSave)}
                      className={cn('w-10 h-5 rounded-full transition-colors relative', schedAutoSave ? 'bg-emerald-500' : 'bg-white/10')}
                    >
                      <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', schedAutoSave ? 'left-5' : 'left-0.5')} />
                    </div>
                    <span className="text-sm text-white">Otomatik kaydet</span>
                  </label>
                </div>
              </div>

              <button
                onClick={generateSchedule}
                disabled={schedGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
              >
                {schedGenerating ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Haftalık takvim oluşturuluyor...</>
                ) : (
                  <>📅 Haftalık Takvim Oluştur (Gemini 2.5 Pro)</>
                )}
              </button>
            </div>

            <AnimatePresence>
              {schedResult && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {schedResult.narrative && (
                    <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                      <h3 className="text-sm font-bold text-emerald-300 mb-2">📝 AI Yorum</h3>
                      <p className="text-sm text-white/70 leading-relaxed">{schedResult.narrative}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                      Oluşturulan Eventler ({schedResult.events.length})
                    </h3>
                    <div className="space-y-2">
                      {schedResult.events.map((ev, i) => (
                        <SchedEventCard key={i} ev={ev} onSave={saveScheduleEvent} saving={savingEvent === ev.startAt} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── PLAYLIST GENERATION TAB ───────────────────────────────────────────── */}
        {tab === 'playlist' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
              <h2 className="text-base font-bold text-white">🎵 AI Playlist Üret</h2>
              <p className="text-xs text-white/40">Gemini tema ve süreye göre eksiksiz bir playlist oluşturur.</p>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Tema *</label>
                <input
                  value={plTheme}
                  onChange={(e) => setPlTheme(e.target.value)}
                  placeholder="ör: Cuma akşamı prime time, müzik ağırlıklı, sosyal medya karışımı..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Süre (dakika)</label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={plDuration}
                    onChange={(e) => setPlDuration(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                  <div className="flex gap-1 mt-1">
                    {[30, 60, 90, 120, 240].map((d) => (
                      <button
                        key={d}
                        onClick={() => setPlDuration(d)}
                        className={cn('px-2 py-0.5 rounded text-xs transition-colors', plDuration === d ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10')}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setPlAutoSave(!plAutoSave)}
                      className={cn('w-10 h-5 rounded-full transition-colors relative', plAutoSave ? 'bg-purple-500' : 'bg-white/10')}
                    >
                      <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', plAutoSave ? 'left-5' : 'left-0.5')} />
                    </div>
                    <span className="text-sm text-white">Otomatik kaydet</span>
                  </label>
                </div>
              </div>

              <button
                onClick={generatePlaylist}
                disabled={plGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
              >
                {plGenerating ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Playlist oluşturuluyor...</>
                ) : (
                  <>🎵 AI Playlist Oluştur</>
                )}
              </button>
            </div>

            <AnimatePresence>
              {plResult && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <PlaylistSugCard
                    sug={plResult}
                    onSave={savePlaylist}
                    saving={savingPlaylist === plResult.name}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── TICKER GENERATION TAB ─────────────────────────────────────────────── */}
        {tab === 'tickers' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
              <h2 className="text-base font-bold text-white">📢 AI Ticker Mesajları Üret</h2>
              <p className="text-xs text-white/40">Gemini bağlama özel ticker mesajları oluşturur, doğrudan sisteme kaydedebilirsiniz.</p>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Konu / Bağlam</label>
                <input
                  value={tickContext}
                  onChange={(e) => setTickContext(e.target.value)}
                  placeholder="ör: Kadir Gecesi özel, bugün canlı müzik var, mutfak kapanış saati değişti..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-teal-500/50 transition-colors"
                />
              </div>

              <button
                onClick={generateTickers}
                disabled={tickGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
              >
                {tickGenerating ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ticker mesajları üretiliyor...</>
                ) : (
                  <>📢 Ticker Mesajları Üret (8 adet)</>
                )}
              </button>
            </div>

            <AnimatePresence>
              {tickResults.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                    Üretilen Mesajlar ({tickResults.length})
                  </h3>
                  {tickResults.map((sug, i) => (
                    <TickerSugCard
                      key={i}
                      sug={sug}
                      onSave={saveTicker}
                      saving={savingTicker === sug.text.slice(0, 10)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
