'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { formatNumber, formatDuration } from '@/lib/utils';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setStats(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const kpis = [
    { label: 'Toplam Gösterim', value: stats ? formatNumber(stats.totalImpressions as number) : '—', icon: '👁', color: '#6366f1' },
    { label: 'Yayın Süresi', value: stats ? formatDuration(stats.totalPlayTime as number) : '—', icon: '⏱️', color: '#22d3ee' },
    { label: 'Tamamlanma', value: stats ? formatNumber(stats.totalCompletions as number) : '—', icon: '✅', color: '#10b981' },
    { label: 'QR Tarama', value: stats ? formatNumber(stats.totalQRScans as number) : '—', icon: '📲', color: '#f59e0b' },
  ];

  const chartData: { date: string; impressions: number; views: number }[] = [];
  if (stats?.dailyData) {
    const dateMap: Record<string, { impressions: number; views: number }> = {};
    for (const d of stats.dailyData as { date: string; count: number; type: string }[]) {
      if (!dateMap[d.date]) dateMap[d.date] = { impressions: 0, views: 0 };
      if (d.type === 'ad_impression') dateMap[d.date].impressions += Number(d.count);
      if (d.type === 'content_view') dateMap[d.date].views += Number(d.count);
    }
    for (const [date, vals] of Object.entries(dateMap)) {
      chartData.push({ date: date.slice(5), ...vals });
    }
    chartData.sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Analitik
          </h1>
          <p className="text-tv-muted text-sm mt-1">Performans ve yayın istatistikleri</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${days === d ? 'bg-tv-primary text-white border-tv-primary' : 'border-white/10 text-tv-muted hover:text-tv-text'}`}
            >
              {d} Gün
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="admin-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${kpi.color}15` }}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {loading ? <span className="inline-block w-16 h-7 bg-white/10 animate-pulse rounded" /> : kpi.value}
            </p>
            <p className="text-xs text-tv-muted mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="admin-card">
          <h2 className="font-semibold text-tv-text mb-4 text-sm">Günlük Gösterim</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }} />
                <Bar dataKey="impressions" name="Reklam" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-tv-muted text-sm">Veri yok</div>
          )}
        </div>

        <div className="admin-card">
          <h2 className="font-semibold text-tv-text mb-4 text-sm">En İyi Reklamlar</h2>
          {stats?.topAds && (stats.topAds as { id: string; title: string; impressions: number }[]).length > 0 ? (
            <div className="space-y-3">
              {(stats.topAds as { id: string; title: string; impressions: number }[]).map((ad, i) => (
                <div key={ad.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tv-text truncate">{ad.title}</p>
                    <div className="w-full bg-white/5 rounded-full h-1.5 mt-1">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, (ad.impressions / Math.max(...(stats.topAds as { impressions: number }[]).map((a) => a.impressions), 1)) * 100)}%`,
                        background: COLORS[i % COLORS.length],
                      }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-tv-text flex-shrink-0">{formatNumber(ad.impressions)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-tv-muted text-sm">Veri yok</div>
          )}
        </div>
      </div>
    </div>
  );
}
