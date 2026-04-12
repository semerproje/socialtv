'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { formatNumber, formatDuration } from '@/lib/utils';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
const DAYS_OF_WEEK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TABS = ['Genel Bakış', 'Ekran Bazlı', 'Reklam Performansı', 'İçerik', 'Dışa Aktar'];

interface DailyRow { date: string; type: string; count: number }
interface HourlyRow { dayOfWeek: number; hour: number; count: number }
interface AdPerfRow { id: string; title: string; impressions: number; completions: number; totalPlayTime: number; cr: number }
interface PlatformRow { platform: string; count: number }
interface SentimentRow { sentiment: string; count: number }
interface ScreenRow { screenId: string; screenName: string; layoutType: string; isOnline: boolean; lastSeen: string | null; impressionCount: number; contentViewCount: number }

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map((row) => Object.values(row).map((v) => JSON.stringify(v ?? '')).join(','));
  const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 60; const h = 28;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/analytics?days=${days}`).then((r) => r.json()),
      fetch(`/api/analytics/screens?days=${days}`).then((r) => r.json()),
    ]).then(([a, s]) => {
      setStats(a.data ?? null);
      setScreens(s.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dailyData = (stats?.dailyData as DailyRow[] | undefined) ?? [];
  const hourlyData = (stats?.hourlyData as HourlyRow[] | undefined) ?? [];
  const adPerformance = (stats?.adPerformance as AdPerfRow[] | undefined) ?? [];
  const platformBreakdown = (stats?.platformBreakdown as PlatformRow[] | undefined) ?? [];
  const contentSentiment = (stats?.contentSentiment as SentimentRow[] | undefined) ?? [];

  const chartData = (() => {
    const map: Record<string, { impressions: number; completions: number }> = {};
    for (const r of dailyData) {
      if (!map[r.date]) map[r.date] = { impressions: 0, completions: 0 };
      if (r.type === 'ad_impression') map[r.date].impressions += r.count;
      if (r.type === 'ad_complete') map[r.date].completions += r.count;
    }
    return Object.entries(map).map(([date, v]) => ({
      date: date.slice(5),
      impressions: v.impressions,
      completionRate: v.impressions > 0 ? +((v.completions / v.impressions) * 100).toFixed(1) : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const sparkFor = (type: string) => {
    const map: Record<string, number> = {};
    for (const r of dailyData) {
      if (r.type === type) map[r.date] = (map[r.date] ?? 0) + r.count;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  };

  const heatmapMax = Math.max(...hourlyData.map((r) => r.count), 1);
  const heatCell = (dow: number, hour: number) => hourlyData.find((r) => r.dayOfWeek === dow && r.hour === hour)?.count ?? 0;

  const kpis = [
    { label: 'Gösterim', key: 'totalImpressions', icon: '👁', color: '#6366f1', fmt: formatNumber, sparkType: 'ad_impression' },
    { label: 'Tamamlanma', key: 'totalCompletions', icon: '✅', color: '#10b981', fmt: formatNumber, sparkType: 'ad_complete' },
    { label: 'İçerik Görüntüleme', key: 'totalContentViews', icon: '🎬', color: '#22d3ee', fmt: formatNumber, sparkType: 'content_view' },
    { label: 'QR Tarama', key: 'totalQRScans', icon: '📲', color: '#f59e0b', fmt: formatNumber, sparkType: 'qr_scan' },
    { label: 'Yayın Süresi', key: 'totalPlayTime', icon: '⏱️', color: '#8b5cf6', fmt: formatDuration, sparkType: 'ad_impression' },
  ];

  const funnelImpressions = (stats?.totalImpressions as number) ?? 0;
  const funnelCompletions = (stats?.totalCompletions as number) ?? 0;
  const funnelQR = (stats?.totalQRScans as number) ?? 0;
  const funnelItems = [
    { label: 'Gösterim', value: funnelImpressions, pct: 100 },
    { label: 'Tamamlanma', value: funnelCompletions, pct: funnelImpressions ? +((funnelCompletions / funnelImpressions) * 100).toFixed(1) : 0 },
    { label: 'QR Tarama', value: funnelQR, pct: funnelImpressions ? +((funnelQR / funnelImpressions) * 100).toFixed(1) : 0 },
  ];

  const avgCR = adPerformance.length ? adPerformance.reduce((s, a) => s + a.cr, 0) / adPerformance.length : 0;
  const lowCR = adPerformance.filter((a) => a.impressions > 0 && a.cr < avgCR * 0.7);
  const maxAdImpressions = Math.max(...adPerformance.map((a) => a.impressions), 1);
  const platformTotal = platformBreakdown.reduce((s, p) => s + p.count, 0) || 1;
  const sentimentTotal = contentSentiment.reduce((s, p) => s + p.count, 0) || 1;
  const sentimentColors: Record<string, string> = { positive: '#10b981', pozitif: '#10b981', neutral: '#6366f1', nötr: '#6366f1', negative: '#ef4444', negatif: '#ef4444' };
  const skel = <span className="inline-block w-16 h-6 bg-white/10 animate-pulse rounded" />;

  const fetchAISuggestions = useCallback(async () => {
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const totalImpressions = (stats?.totalImpressions as number) ?? 0;
      const totalCompletions = (stats?.totalCompletions as number) ?? 0;
      const cr = totalImpressions > 0 ? ((totalCompletions / totalImpressions) * 100).toFixed(1) : '0';
      const topPlatform = platformBreakdown[0]?.platform ?? 'bilinmiyor';
      const dominantSentiment = contentSentiment.sort((a, b) => b.count - a.count)[0]?.sentiment ?? 'nötr';
      const lowCRads = adPerformance.filter((a) => a.impressions > 0 && a.cr < avgCR * 0.7).map((a) => a.title).slice(0, 3);
      const context = `Son ${days} günlük analitik: ${totalImpressions} gösterim, %${cr} tamamlanma oranı. ` +
        `En çok içerik platformu: ${topPlatform}. Baskın duygu: ${dominantSentiment}. ` +
        (lowCRads.length ? `Düşük performanslı reklamlar: ${lowCRads.join(', ')}.` : 'Tüm reklamlar performanslı.');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Aşağıdaki analitik veriye göre içerik stratejisi önerileri ver. Somut, uygulanabilir 5 öneri oluştur. Her öneriyi kısa madde olarak sun.\n\n${context}` }],
          includeContext: false,
        }),
      });
      const d = await res.json();
      if (d.success) setAiSuggestions(d.data.reply);
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  }, [stats, days, platformBreakdown, contentSentiment, adPerformance, avgCR]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Analitik Merkezi
          </h1>
          <p className="text-tv-muted text-sm mt-1">Kapsamlı performans ve yayın istatistikleri</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${days === d ? 'bg-tv-primary text-white border-tv-primary' : 'border-white/10 text-tv-muted hover:text-tv-text'}`}>
              {d} Gün
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${tab === i ? 'bg-tv-primary text-white' : 'text-tv-muted hover:text-tv-text'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Genel Bakış ── */}
      {tab === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {kpis.map((kpi) => {
              const val = stats ? (stats[kpi.key] as number) : null;
              const spark = sparkFor(kpi.sparkType);
              return (
                <div key={kpi.label} className="admin-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${kpi.color}15` }}>
                      {kpi.icon}
                    </div>
                    <Sparkline data={spark} color={kpi.color} />
                  </div>
                  <p className="text-xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {loading || val === null ? skel : kpi.fmt(val)}
                  </p>
                  <p className="text-xs text-tv-muted mt-1">{kpi.label}</p>
                </div>
              );
            })}
          </div>

          <div className="admin-card">
            <h2 className="font-semibold text-tv-text mb-4 text-sm">Günlük Gösterim &amp; Tamamlanma Oranı</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#10b981', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }} />
                  <Bar yAxisId="left" dataKey="impressions" name="Gösterim" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Line yAxisId="right" type="monotone" dataKey="completionRate" name="Tamamlanma %" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-tv-muted text-sm">Veri yok</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="admin-card col-span-2">
              <h2 className="font-semibold text-tv-text mb-4 text-sm">Prime Time Haritası</h2>
              <div className="overflow-x-auto">
                <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(24, 1fr)', gap: 3, minWidth: 560 }}>
                  <div />
                  {HOURS.map((h) => (
                    <div key={h} className="text-center text-tv-muted" style={{ fontSize: 9 }}>{h}</div>
                  ))}
                  {DAYS_OF_WEEK.map((dayLabel, dow) => (
                    <div key={`row-${dow}`} style={{ display: 'contents' }}>
                      <div className="text-tv-muted flex items-center justify-end pr-1" style={{ fontSize: 10 }}>{dayLabel}</div>
                      {HOURS.map((h) => {
                        const count = heatCell(dow, h);
                        const opacity = count === 0 ? 0.04 : 0.1 + (count / heatmapMax) * 0.9;
                        return (
                          <div key={`${dow}-${h}`} title={`${dayLabel} ${h}:00 — ${count}`}
                            style={{ background: `rgba(99,102,241,${opacity})`, borderRadius: 3, height: 16 }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-tv-muted" style={{ fontSize: 10 }}>Düşük</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[0.08, 0.25, 0.45, 0.65, 0.85].map((op) => (
                    <div key={op} style={{ width: 14, height: 10, borderRadius: 2, background: `rgba(99,102,241,${op})` }} />
                  ))}
                </div>
                <span className="text-tv-muted" style={{ fontSize: 10 }}>Yüksek</span>
              </div>
            </div>

            <div className="admin-card">
              <h2 className="font-semibold text-tv-text mb-5 text-sm">Dönüşüm Hunisi</h2>
              <div className="space-y-4">
                {funnelItems.map((item, i) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-tv-muted">{item.label}</span>
                      <span className="text-xs font-semibold text-tv-text">{item.pct}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white/5 rounded-full h-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, background: COLORS[i] }} />
                      </div>
                      <span className="text-xs font-bold text-tv-text w-14 text-right">{formatNumber(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: Ekran Bazlı ── */}
      {tab === 1 && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="admin-card h-40 animate-pulse bg-white/5" />)}</div>
          ) : screens.length === 0 ? (
            <div className="admin-card text-center py-16 text-tv-muted">Kayıtlı ekran bulunamadı</div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {screens.map((scr) => (
                <div key={scr.screenId} className="admin-card space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-tv-text text-sm">{scr.screenName}</p>
                      <p className="text-xs text-tv-muted mt-0.5">{scr.layoutType}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scr.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-tv-muted'}`}>
                      {scr.isOnline ? '● Çevrimiçi' : '○ Çevrimdışı'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-lg font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatNumber(scr.impressionCount)}</p>
                      <p className="text-xs text-tv-muted">Gösterim</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-lg font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatNumber(scr.contentViewCount)}</p>
                      <p className="text-xs text-tv-muted">İçerik Görüntüleme</p>
                    </div>
                  </div>
                  {scr.lastSeen && (
                    <p className="text-xs text-tv-muted">Son görülme: {new Date(scr.lastSeen).toLocaleString('tr-TR')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Reklam Performansı ── */}
      {tab === 2 && (
        <div className="space-y-6">
          <div className="admin-card overflow-x-auto">
            <h2 className="font-semibold text-tv-text mb-4 text-sm">Reklam Performans Tablosu</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Reklam', 'Gösterim', 'Tamamlanma', 'CR%', 'Süre Toplamı'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-tv-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-tv-muted text-sm">Yükleniyor…</td></tr>
                ) : adPerformance.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-tv-muted text-sm">Veri yok</td></tr>
                ) : adPerformance.map((ad, i) => (
                  <tr key={ad.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>{i + 1}</div>
                        <div>
                          <p className="text-tv-text font-medium truncate max-w-[180px]">{ad.title}</p>
                          <div className="bg-white/5 rounded-full h-1 mt-1" style={{ maxWidth: 180 }}>
                            <div className="h-full rounded-full" style={{ width: `${(ad.impressions / maxAdImpressions) * 100}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-tv-text">{formatNumber(ad.impressions)}</td>
                    <td className="py-2.5 px-3 text-tv-text">{formatNumber(ad.completions)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ad.cr >= avgCR ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {ad.cr}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-tv-muted">{formatDuration(ad.totalPlayTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lowCR.length > 0 && (
            <div className="admin-card border border-amber-500/20">
              <h2 className="font-semibold text-amber-400 mb-3 text-sm">⚠️ Performans Uyarıları</h2>
              <div className="space-y-2">
                {lowCR.map((ad) => (
                  <div key={ad.id} className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl">
                    <span className="text-amber-400 text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-tv-text">{ad.title}</p>
                      <p className="text-xs text-tv-muted">CR% {ad.cr} — ortalama ({avgCR.toFixed(1)}%) altında</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: İçerik ── */}
      {tab === 3 && (
        <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="admin-card">
            <h2 className="font-semibold text-tv-text mb-4 text-sm">Platform Dağılımı</h2>
            {platformBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-tv-muted text-sm">Veri yok</div>
            ) : (
              <div className="space-y-3">
                {[...platformBreakdown].sort((a, b) => b.count - a.count).map((p, i) => {
                  const pct = Math.round((p.count / platformTotal) * 100);
                  return (
                    <div key={p.platform}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-tv-text capitalize">{p.platform}</span>
                        <span className="text-sm font-semibold text-tv-text">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white/5 rounded-full h-2">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs text-tv-muted w-10 text-right">{p.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-card">
            <h2 className="font-semibold text-tv-text mb-4 text-sm">Duygu Analizi</h2>
            {contentSentiment.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-tv-muted text-sm">Veri yok</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={contentSentiment} dataKey="count" nameKey="sentiment" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                      {contentSentiment.map((s) => (
                        <Cell key={s.sentiment} fill={sentimentColors[s.sentiment.toLowerCase()] ?? '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center flex-wrap mt-2">
                  {contentSentiment.map((s) => (
                    <div key={s.sentiment} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: sentimentColors[s.sentiment.toLowerCase()] ?? '#6366f1' }} />
                      <span className="text-xs text-tv-muted capitalize">{s.sentiment}</span>
                      <span className="text-xs font-semibold text-tv-text">{Math.round((s.count / sentimentTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI Önerileri panel */}
        <div className="admin-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-tv-text text-sm">🤖 AI İçerik Önerileri</h2>
              <p className="text-xs text-tv-muted mt-0.5">Mevcut analitik veriye dayanarak AI'dan içerik stratejisi al</p>
            </div>
            <button
              onClick={fetchAISuggestions}
              disabled={aiLoading || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analiz ediliyor…
                </>
              ) : (
                '✨ AI Analiz Et'
              )}
            </button>
          </div>
          {aiSuggestions ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="space-y-2">
                {aiSuggestions.split('\n').filter(Boolean).map((line, i) => {
                  const isBullet = /^[-•*\d]/.test(line.trim());
                  return (
                    <p
                      key={i}
                      className={`text-sm leading-relaxed ${isBullet ? 'pl-3 border-l-2 border-indigo-500/40 text-tv-text/85' : 'text-tv-muted'}`}
                    >
                      {line.replace(/^[-•*]\s*/, '')}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-tv-muted">
              <p className="text-3xl mb-3 opacity-30">🎯</p>
              <p className="text-sm">Analitik verilerinize göre kişiselleştirilmiş öneriler almak için</p>
              <p className="text-sm font-medium text-indigo-400 mt-1">AI Analiz Et butonuna tıklayın</p>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── TAB 4: Dışa Aktar ── */}
      {tab === 4 && (
        <div className="admin-card max-w-lg">
          <h2 className="font-semibold text-tv-text mb-1 text-sm">Veri Dışa Aktarımı</h2>
          <p className="text-xs text-tv-muted mb-6">Seçilen döneme ait verileri CSV olarak indirin</p>
          <div className="space-y-3">
            {[
              { label: 'Reklam Performans Verisi', icon: '📊', data: () => adPerformance as unknown as Record<string, unknown>[], file: `ads-${days}d.csv` },
              { label: 'Günlük Analitik', icon: '📅', data: () => dailyData as unknown as Record<string, unknown>[], file: `daily-${days}d.csv` },
              { label: 'Saatlik Isı Haritası', icon: '🌡️', data: () => hourlyData as unknown as Record<string, unknown>[], file: `heatmap-${days}d.csv` },
              { label: 'Platform Dağılımı', icon: '📱', data: () => platformBreakdown as unknown as Record<string, unknown>[], file: `platform-${days}d.csv` },
              { label: 'Ekran Analytics', icon: '📺', data: () => screens as unknown as Record<string, unknown>[], file: `screens-${days}d.csv` },
            ].map((item) => (
              <button key={item.label} onClick={() => exportToCSV(item.data(), item.file)}
                className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-left">
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-tv-text">{item.label}</p>
                  <p className="text-xs text-tv-muted">{item.file}</p>
                </div>
                <span className="text-tv-muted text-sm">↓ İndir</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
