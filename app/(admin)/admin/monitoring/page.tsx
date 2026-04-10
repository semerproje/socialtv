'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatDuration } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { ChannelHealthDailyAggregate, ChannelHealthLog, MonitoringHealth, SystemLogEntry } from '@/types';

function levelTone(level: string) {
  if (level === 'error') return 'badge-danger';
  if (level === 'warn') return 'badge-warning';
  return 'badge-success';
}

export default function MonitoringPage() {
  const { adminRole } = useAuth();
  const [health, setHealth] = useState<MonitoringHealth | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [channelHealthSummaryRows, setChannelHealthSummaryRows] = useState<ChannelHealthDailyAggregate[]>([]);
  const [channelHealth, setChannelHealth] = useState<ChannelHealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: '240', days: '14' });
      if (channelFilter) query.set('channelId', channelFilter);
      if (providerFilter) query.set('provider', providerFilter);

      const [healthRes, logsRes, channelHealthRes, channelHealthSummaryRes] = await Promise.all([
        fetch('/api/monitoring/health', { cache: 'no-store' }),
        fetch('/api/monitoring/logs?limit=80', { cache: 'no-store' }),
        fetch(`/api/monitoring/channel-health?${query.toString()}`, { cache: 'no-store' }),
        fetch(`/api/monitoring/channel-health?summary=1&${query.toString()}`, { cache: 'no-store' }),
      ]);
      const healthJson = await healthRes.json();
      const logsJson = await logsRes.json();
      const channelHealthJson = await channelHealthRes.json();
      const channelHealthSummaryJson = await channelHealthSummaryRes.json();
      setHealth(healthJson.data ?? null);
      setLogs(logsJson.data ?? []);
      setChannelHealth(channelHealthJson.data ?? []);
      setChannelHealthSummaryRows(channelHealthSummaryJson.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, providerFilter]);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 30000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const filteredLogs = useMemo(
    () => logs.filter((entry) => !sourceFilter || entry.source.includes(sourceFilter)),
    [logs, sourceFilter]
  );

  const groupedSources = Array.from(new Set(logs.map((entry) => entry.source))).sort();
  const trendStats = useMemo(() => {
    const map = new Map<string, { info: number; warn: number; error: number }>();
    logs.forEach((entry) => {
      const date = new Date(entry.createdAt).toISOString().slice(5, 10);
      if (!map.has(date)) map.set(date, { info: 0, warn: 0, error: 0 });
      const row = map.get(date)!;
      if (entry.level === 'error') row.error += 1;
      else if (entry.level === 'warn') row.warn += 1;
      else row.info += 1;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [logs]);

  const logTrendChartData = useMemo(
    () => trendStats.map(([date, row]) => ({ date, ...row })),
    [trendStats]
  );

  const channelHealthSummary = useMemo(() => {
    const map = new Map<string, { title: string; provider: string; total: number; healthy: number; lastState: string; avgLatency: number }>();
    channelHealthSummaryRows.forEach((entry) => {
      const existing = map.get(entry.channelId) ?? {
        title: entry.channelTitle,
        provider: entry.provider,
        total: 0,
        healthy: 0,
        lastState: entry.lastState,
        avgLatency: 0,
      };
      const combinedTotal = existing.total + entry.totalChecks;
      existing.avgLatency = combinedTotal > 0
        ? ((existing.avgLatency * existing.total) + entry.totalLatencyMs) / combinedTotal
        : 0;
      existing.total = combinedTotal;
      existing.healthy += entry.healthyChecks;
      existing.lastState = entry.lastState;
      map.set(entry.channelId, existing);
    });
    return Array.from(map.entries()).map(([channelId, value]) => ({
      channelId,
      ...value,
      availability: value.total > 0 ? (value.healthy / value.total) * 100 : 0,
    })).sort((a, b) => b.availability - a.availability);
  }, [channelHealthSummaryRows]);

  const availabilityTrend = useMemo(() => {
    const grouped = new Map<string, { day: string; totalChecks: number; healthyChecks: number; totalLatencyMs: number }>();

    channelHealthSummaryRows.forEach((entry) => {
      const row = grouped.get(entry.day) ?? {
        day: entry.day.slice(5),
        totalChecks: 0,
        healthyChecks: 0,
        totalLatencyMs: 0,
      };

      row.totalChecks += entry.totalChecks;
      row.healthyChecks += entry.healthyChecks;
      row.totalLatencyMs += entry.totalLatencyMs;
      grouped.set(entry.day, row);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, row]) => ({
        day: row.day,
        availability: row.totalChecks > 0 ? Number(((row.healthyChecks / row.totalChecks) * 100).toFixed(1)) : 0,
        avgLatency: row.totalChecks > 0 ? Math.round(row.totalLatencyMs / row.totalChecks) : 0,
        checks: row.totalChecks,
      }));
  }, [channelHealthSummaryRows]);

  const recentChecks = useMemo(() => channelHealth.slice(0, 20), [channelHealth]);
  const availableChannels = useMemo(() => Array.from(new Map(channelHealth.map((entry) => [entry.channelId, entry.channelTitle])).entries()), [channelHealth]);
  const availableProviders = useMemo(() => Array.from(new Set(channelHealth.map((entry) => entry.provider))).sort(), [channelHealth]);

  const exportCsv = useCallback(() => {
    const rows = [
      ['channelId', 'channelTitle', 'provider', 'state', 'checkedAt', 'latencyMs', 'statusCode', 'message', 'target'],
      ...channelHealth.map((entry) => [
        entry.channelId,
        entry.channelTitle,
        entry.provider,
        entry.state,
        entry.checkedAt,
        String(entry.latencyMs),
        entry.statusCode ? String(entry.statusCode) : '',
        entry.message.replaceAll('"', '""'),
        entry.target ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `channel-health-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [channelHealth]);

  const runHealthChecks = useCallback(async () => {
    setRunningChecks(true);
    try {
      const res = await fetch('/api/monitoring/run-health-checks', { method: 'POST' });
      if (!res.ok) throw new Error('Health-check çalıştırılamadı');
      await fetchAll();
    } finally {
      setRunningChecks(false);
    }
  }, [fetchAll]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Monitoring
          </h1>
          <p className="text-tv-muted text-sm mt-1">Sistem sağlık durumu, uptime ve hata kayıtları</p>
          <p className="text-white/35 text-xs mt-2 uppercase tracking-[0.18em]">Rol: {adminRole ?? 'viewer'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runHealthChecks} disabled={runningChecks || adminRole !== 'ops'} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {runningChecks ? 'Health-check...' : 'Health-check Çalıştır'}
          </button>
          <button onClick={exportCsv} className="btn-secondary text-sm">CSV Export</button>
          <button onClick={fetchAll} className="btn-secondary text-sm">Yenile</button>
        </div>
      </div>

      <div className="admin-card flex flex-wrap items-center gap-3">
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="input text-sm min-w-[220px]">
          <option value="">Tüm kanallar</option>
          {availableChannels.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="input text-sm min-w-[180px]">
          <option value="">Tüm sağlayıcılar</option>
          {availableProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
        </select>
        {(channelFilter || providerFilter) && (
          <button onClick={() => { setChannelFilter(''); setProviderFilter(''); }} className="btn-secondary text-sm">Filtreleri Temizle</button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Durum', value: health?.status === 'ok' ? 'Sağlıklı' : health?.status === 'degraded' ? 'Degraded' : '—', tone: health?.status === 'ok' ? 'text-emerald-300' : 'text-amber-300' },
          { label: 'Uptime', value: health ? formatDuration(health.uptimeSeconds) : '—', tone: 'text-white' },
          { label: 'Bağlı Ekran', value: health ? String(health.connectedScreens) : '—', tone: 'text-white' },
          { label: 'Aktif Yayın Kaynağı', value: health ? String(health.activeChannels) : '—', tone: 'text-white' },
        ].map((card) => (
          <div key={card.label} className="admin-card">
            <p className="text-xs uppercase tracking-widest text-white/25">{card.label}</p>
            <p className={cn('mt-3 text-2xl font-bold', card.tone)}>{loading ? '…' : card.value}</p>
          </div>
        ))}
      </div>

      <div className="admin-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-tv-text">Log Trendleri</h2>
          <p className="text-xs text-white/30">Son yüklenen kayıtlar üzerinden günlük dağılım</p>
        </div>
        <div className="h-64 rounded-2xl border border-white/10 bg-black/10 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={logTrendChartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              />
              <Bar dataKey="info" stackId="logs" fill="rgba(16,185,129,0.75)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warn" stackId="logs" fill="rgba(245,158,11,0.75)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="error" stackId="logs" fill="rgba(239,68,68,0.8)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {trendStats.length === 0 && <p className="text-sm text-white/35">Trend verisi yok</p>}
          {trendStats.map(([date, row]) => {
            const total = Math.max(1, row.info + row.warn + row.error);
            return (
              <div key={date} className="grid grid-cols-[54px_minmax(0,1fr)_88px] items-center gap-3">
                <span className="text-xs text-white/35">{date}</span>
                <div className="h-3 rounded-full overflow-hidden bg-white/5 flex">
                  <div className="bg-emerald-500/70" style={{ width: `${(row.info / total) * 100}%` }} />
                  <div className="bg-amber-500/70" style={{ width: `${(row.warn / total) * 100}%` }} />
                  <div className="bg-red-500/70" style={{ width: `${(row.error / total) * 100}%` }} />
                </div>
                <span className="text-xs text-white/35 text-right">i:{row.info} w:{row.warn} e:{row.error}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6">
        <div className="admin-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-tv-text">Kanal Erişilebilirlik Özeti</h2>
            <p className="text-xs text-white/30">Günlük aggregate geçmişi</p>
          </div>
          <div className="h-64 rounded-2xl border border-white/10 bg-black/10 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={availabilityTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="availability" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="latency" orientation="right" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                />
                <Line yAxisId="availability" type="monotone" dataKey="availability" stroke="rgba(16,185,129,0.9)" strokeWidth={3} dot={{ r: 3 }} name="Erisilebilirlik %" />
                <Line yAxisId="latency" type="monotone" dataKey="avgLatency" stroke="rgba(96,165,250,0.9)" strokeWidth={2} dot={false} name="Ort. gecikme ms" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {channelHealthSummary.length === 0 && <p className="text-sm text-white/35">Henüz kalıcı health-check verisi yok</p>}
            {channelHealthSummary.map((row) => (
              <div key={row.channelId} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{row.title}</p>
                    <p className="text-xs text-white/35 mt-1">{row.provider} · ort. {Math.round(row.avgLatency)}ms · {row.total} kontrol</p>
                  </div>
                  <span className={cn('badge text-[10px]', row.lastState === 'healthy' ? 'badge-success' : row.lastState === 'auth-required' ? 'badge-warning' : 'badge-danger')}>
                    {row.lastState}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-white/35 mb-1.5">
                    <span>Erişilebilirlik</span>
                    <span>%{row.availability.toFixed(0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${Math.min(100, row.availability)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-tv-text">Son Health-check Kayıtları</h2>
            <p className="text-xs text-white/30">En son 20 kontrol</p>
          </div>
          <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
            {recentChecks.length === 0 && <p className="text-sm text-white/35">Kayıt bulunamadı</p>}
            {recentChecks.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn('badge text-[10px]', entry.state === 'healthy' ? 'badge-success' : entry.state === 'auth-required' ? 'badge-warning' : 'badge-danger')}>
                        {entry.state}
                      </span>
                      <span className="text-[11px] text-white/35 uppercase tracking-[0.18em]">{entry.provider}</span>
                    </div>
                    <p className="text-white text-sm mt-2">{entry.channelTitle}</p>
                    <p className="text-white/35 text-xs mt-1">{entry.message}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/35 whitespace-nowrap">{new Date(entry.checkedAt).toLocaleString('tr-TR')}</p>
                    <p className="text-[11px] text-white/25 mt-1">{entry.latencyMs}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-tv-text">Sistem Logları</h2>
          <div className="flex items-center gap-2">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="input text-sm min-w-[180px]">
              <option value="">Tüm kaynaklar</option>
              {groupedSources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
          {filteredLogs.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge text-[10px]', levelTone(entry.level))}>{entry.level}</span>
                    <span className="text-[11px] text-white/35 uppercase tracking-[0.18em]">{entry.source}</span>
                  </div>
                  <p className="text-white text-sm mt-2">{entry.message}</p>
                </div>
                <span className="text-[11px] text-white/35 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString('tr-TR')}</span>
              </div>
              {entry.metadataJson && (
                <pre className="mt-3 rounded-xl bg-black/30 p-3 text-[11px] text-white/45 overflow-auto">{entry.metadataJson}</pre>
              )}
            </div>
          ))}
          {filteredLogs.length === 0 && <p className="text-white/35 text-sm py-10 text-center">Kayıt bulunamadı</p>}
        </div>
      </div>
    </div>
  );
}