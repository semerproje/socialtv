'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { formatNumber, formatDuration } from '@/lib/utils';

interface StatsData {
  totalImpressions: number;
  totalPlayTime: number;
  totalCompletions: number;
  totalContentViews: number;
  approvedContent: number;
  topAds: { id: string; title: string; impressions: number; completions: number }[];
  dailyData: { date: string; count: number; type: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => {
        setStats(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statCards = [
            { href: '/admin/monitoring', icon: '🩺', label: 'Monitoring', color: '#10b981' },
    {
      title: 'Toplam Gösterim',
      value: stats ? formatNumber(stats.totalImpressions) : '—',
      icon: '👁',
      color: '#6366f1',
      sub: 'Reklam izlenimi',
    },
    {
      title: 'Toplam Yayın Süresi',
      value: stats ? formatDuration(stats.totalPlayTime) : '—',
      icon: '⏱️',
      color: '#22d3ee',
      sub: 'Reklam süresi',
    },
    {
      title: 'Tamamlanma',
      value: stats ? formatNumber(stats.totalCompletions) : '—',
      icon: '✅',
      color: '#10b981',
      sub: 'Tam izleme',
    },
    {
      title: 'Onaylı İçerik',
      value: stats ? formatNumber(stats.approvedContent) : '—',
      icon: '🖼️',
      color: '#f59e0b',
      sub: 'Aktif içerik',
    },
  ];

  // Build chart data
  const chartData: { date: string; impressions: number; views: number }[] = [];
  if (stats?.dailyData) {
    const dateMap: Record<string, { impressions: number; views: number }> = {};
    for (const d of stats.dailyData) {
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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-tv-muted text-sm mt-1">Social Lounge TV — Genel Bakış</p>
        </div>
        <div className="flex gap-3">
          <a href="/screen" target="_blank" className="btn-secondary">
            🖥️ Ekranı Görüntüle
          </a>
          <Link href="/admin/ads" className="btn-primary">
            + Yeni Reklam
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="admin-card relative overflow-hidden">
            {/* Background glow */}
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-8 translate-x-8 opacity-10 blur-2xl"
              style={{ background: card.color }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${card.color}20`, border: `1px solid ${card.color}30` }}
                >
                  {card.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {loading ? (
                  <span className="inline-block w-16 h-7 bg-white/10 animate-pulse rounded" />
                ) : card.value}
              </p>
              <p className="text-sm font-medium text-tv-text mt-1">{card.title}</p>
              <p className="text-xs text-tv-muted mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Top Ads */}
      <div className="grid grid-cols-3 gap-6">
        {/* Chart */}
        <div className="col-span-2 admin-card">
          <h2 className="text-base font-semibold text-tv-text mb-6">Son 7 Günlük Aktivite</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                />
                <Bar dataKey="impressions" name="Reklam Gösterimi" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="views" name="İçerik Görüntüleme" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-tv-muted text-sm">
              Henüz analitik verisi yok. Ekran yayına girince veriler görünecek.
            </div>
          )}
        </div>

        {/* Top Ads */}
        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-tv-text">En İyi Reklamlar</h2>
            <Link href="/admin/ads" className="text-xs text-tv-primary hover:text-indigo-400 transition-colors">
              Tümü →
            </Link>
          </div>
          {stats?.topAds && stats.topAds.length > 0 ? (
            <div className="space-y-3">
              {stats.topAds.map((ad, i) => (
                <div key={ad.id} className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: i === 0 ? '#f59e0b20' : 'rgba(255,255,255,0.05)', color: i === 0 ? '#f59e0b' : '#64748b' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tv-text truncate">{ad.title}</p>
                    <p className="text-xs text-tv-muted">{formatNumber(ad.impressions)} gösterim</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-tv-muted text-sm">Henüz reklam yok</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-card">
        <h2 className="text-base font-semibold text-tv-text mb-4">Hızlı İşlemler</h2>
        <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            { href: '/admin/ads?new=1', icon: '📺', label: 'Reklam Ekle', color: '#6366f1' },
            { href: '/admin/content?new=1', icon: '🖼️', label: 'İçerik Ekle', color: '#22d3ee' },
            { href: '/admin/ai-studio', icon: '🤖', label: 'AI ile Üret', color: '#8b5cf6' },
            { href: '/admin/ticker?new=1', icon: '📢', label: 'Ticker Ekle', color: '#f59e0b' },
            { href: '/admin/monitoring', icon: '🩺', label: 'Monitoring', color: '#10b981' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-4 py-4 rounded-xl border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-all duration-200"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${action.color}15`, border: `1px solid ${action.color}25` }}
              >
                {action.icon}
              </div>
              <span className="text-sm font-medium text-tv-text">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
