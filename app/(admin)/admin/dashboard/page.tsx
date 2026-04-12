'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatNumber, formatDuration, formatRelative } from '@/lib/utils';

interface StatsData {
  totalImpressions: number;
  totalPlayTime: number;
  totalCompletions: number;
  totalContentViews: number;
  totalQRScans: number;
  approvedContent: number;
  topAds: { id: string; title: string; impressions: number; completions: number }[];
  dailyData: { date: string; count: number; type: string }[];
}

interface ScreenInfo {
  id: string;
  name: string;
  layoutType: string;
  lastSeen?: string;
  isOnline: boolean;
}

const LAYOUT_LABELS: Record<string, string> = {
  default: 'Varsayılan', youtube: 'YouTube', instagram: 'Instagram',
  split_2: 'Bölünmüş', fullscreen: 'Tam Ekran', digital_signage: 'Tabela',
  social_wall: 'Sosyal Duvar', ambient: 'Ortam', promo: 'Promo',
  triple: 'Üçlü', news_focus: 'Haber', portrait: 'Dikey', markets: 'Piyasa',
};

type Period = '7' | '30';

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('7');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');

  const fetchStats = useCallback(async () => {
    setStatsError(null);
    try {
      const res = await fetch(`/api/analytics?days=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.data) setStats(d.data);
      else throw new Error('Veri alınamadı');
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Analitik yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchScreens = useCallback(async () => {
    try {
      const res = await fetch('/api/screens');
      if (!res.ok) return;
      const d = await res.json();
      if (d.data) {
        const now = Date.now();
        setScreens(
          (d.data as ScreenInfo[]).map((s) => ({
            ...s,
            isOnline: s.lastSeen ? now - new Date(s.lastSeen).getTime() < 90_000 : false,
          })),
        );
      }
    } catch (err) {
      console.warn('Ekran listesi alınamadı:', err);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists');
      if (!res.ok) return;
      const d = await res.json();
      if (d.data) {
        const active = (d.data as { id: string; name: string; isActive: boolean }[])
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name }));
        setPlaylists(active);
        if (active.length > 0 && !selectedPlaylistId) setSelectedPlaylistId(active[0].id);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    fetchScreens();
    fetchPlaylists();
    const t = setInterval(fetchScreens, 30_000);
    return () => clearInterval(t);
  }, [fetchScreens, fetchPlaylists]);

  const quickBroadcast = async (layoutType: string, label: string) => {
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/sync/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'change_layout', data: { layoutType } }),
      });
      if (res.ok) setBroadcastResult(`✓ ${label} tüm ekranlara gönderildi`);
      else setBroadcastResult('✗ Gönderim başarısız');
    } catch {
      setBroadcastResult('✗ Bağlantı hatası');
    } finally {
      setBroadcasting(false);
      setTimeout(() => setBroadcastResult(null), 4000);
    }
  };

  const sendPlaylist = async () => {
    if (!selectedPlaylistId) return;
    const pl = playlists.find((p) => p.id === selectedPlaylistId);
    if (!pl) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/sync/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'start_playlist', data: { playlistId: pl.id, playlistName: pl.name } }),
      });
      if (res.ok) setBroadcastResult(`✓ "${pl.name}" tüm ekranlara gönderildi`);
      else setBroadcastResult('✗ Gönderim başarısız');
    } catch {
      setBroadcastResult('✗ Bağlantı hatası');
    } finally {
      setBroadcasting(false);
      setTimeout(() => setBroadcastResult(null), 4000);
    }
  };

  const stopPlaylist = async () => {
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/sync/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'stop_playlist', data: {} }),
      });
      if (res.ok) setBroadcastResult('✓ Playlist durduruldu');
      else setBroadcastResult('✗ Gönderim başarısız');
    } catch {
      setBroadcastResult('✗ Bağlantı hatası');
    } finally {
      setBroadcasting(false);
      setTimeout(() => setBroadcastResult(null), 4000);
    }
  };

  // Build chart data
  const chartData: { date: string; impressions: number; views: number; cr: number }[] = [];
  if (stats?.dailyData) {
    const dateMap: Record<string, { impressions: number; views: number }> = {};
    for (const d of stats.dailyData) {
      if (!dateMap[d.date]) dateMap[d.date] = { impressions: 0, views: 0 };
      if (d.type === 'ad_impression') dateMap[d.date].impressions += Number(d.count);
      if (d.type === 'content_view') dateMap[d.date].views += Number(d.count);
    }
    for (const [date, vals] of Object.entries(dateMap)) {
      const cr = vals.impressions > 0 ? Math.round((vals.views / vals.impressions) * 100) : 0;
      chartData.push({ date: date.slice(5), ...vals, cr });
    }
    chartData.sort((a, b) => a.date.localeCompare(b.date));
  }

  const onlineScreens = screens.filter((s) => s.isOnline);
  const offlineScreens = screens.filter((s) => !s.isOnline);
  const completionRate =
    stats && stats.totalImpressions > 0
      ? Math.round((stats.totalCompletions / stats.totalImpressions) * 100)
      : 0;

  const statCards = [
    {
      title: 'Toplam Gösterim',
      value: stats ? formatNumber(stats.totalImpressions) : '—',
      sub: `%${completionRate} tamamlanma`,
      icon: '👁',
      color: '#6366f1',
      href: '/admin/ads',
    },
    {
      title: 'Yayın Süresi',
      value: stats ? formatDuration(stats.totalPlayTime) : '—',
      sub: 'Toplam reklam süresi',
      icon: '⏱️',
      color: '#22d3ee',
      href: '/admin/analytics',
    },
    {
      title: 'İçerik Görüntüleme',
      value: stats ? formatNumber(stats.totalContentViews) : '—',
      sub: `${stats?.approvedContent ?? 0} onaylı içerik`,
      icon: '🖼️',
      color: '#f59e0b',
      href: '/admin/content',
    },
    {
      title: 'QR Tarama',
      value: stats ? formatNumber(stats.totalQRScans ?? 0) : '—',
      sub: 'Ziyaretçi etkileşimi',
      icon: '📱',
      color: '#8b5cf6',
      href: '/admin/analytics',
    },
    {
      title: 'Aktif Ekranlar',
      value: `${onlineScreens.length}/${screens.length}`,
      sub: screens.length === 0 ? 'Henüz ekran yok' : `${offlineScreens.length} çevrimdışı`,
      icon: '🖥️',
      color: onlineScreens.length > 0 ? '#10b981' : '#ef4444',
      href: '/admin/screens',
    },
  ];

  return (
    <div className="p-6 xl:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-tv-muted text-sm mt-0.5">Social Lounge TV — Genel Bakış</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['7', '30'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setLoading(true); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'text-tv-muted hover:text-tv-text hover:bg-white/5'
                }`}
              >
                {p === '7' ? 'Bu Hafta' : 'Bu Ay'}
              </button>
            ))}
          </div>
          <a href="/screen" target="_blank" className="btn-secondary text-sm py-1.5">
            🖥️ Ekranı Görüntüle
          </a>
          <Link href="/admin/publish" className="btn-primary text-sm py-1.5">
            🎬 Yayın Merkezi
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {statsError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span>⚠️</span>
          <span className="flex-1">Analitik veriler yüklenemedi: {statsError}</span>
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-all"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="admin-card relative overflow-hidden group hover:border-white/20 transition-all"
          >
            <div
              className="absolute top-0 right-0 w-28 h-28 rounded-full -translate-y-8 translate-x-8 opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"
              style={{ background: card.color }}
            />
            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3"
                style={{ background: `${card.color}20`, border: `1px solid ${card.color}30` }}
              >
                {card.icon}
              </div>
              <p className="text-xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {loading ? <span className="inline-block w-16 h-6 bg-white/10 animate-pulse rounded" /> : card.value}
              </p>
              <p className="text-xs font-medium text-tv-text mt-0.5">{card.title}</p>
              <p className="text-xs text-tv-muted mt-0.5">{card.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Chart + Live Screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Composed Activity Chart */}
        <div className="xl:col-span-2 admin-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-tv-text">
              {period === '7' ? 'Son 7 Günlük' : 'Son 30 Günlük'} Aktivite
            </h2>
            <div className="flex items-center gap-4 text-xs text-tv-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" /> Gösterim
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-cyan-400" /> Görüntüleme
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 bg-emerald-400" /> Tamamlanma %
              </span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                />
                <Bar yAxisId="left" dataKey="impressions" name="Gösterim" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="left" dataKey="views" name="Görüntüleme" fill="#22d3ee" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="cr" name="Tamamlanma %" stroke="#10b981" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2 opacity-30">📊</div>
                <p className="text-tv-muted text-sm">Henüz analitik verisi yok</p>
                <p className="text-tv-muted text-xs mt-1">Ekran yayına girince veriler görünecek</p>
              </div>
            </div>
          )}
        </div>

        {/* Live Screens Panel */}
        <div className="admin-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-tv-text">Canlı Ekranlar</h2>
            <span className="text-xs text-tv-muted">{onlineScreens.length}/{screens.length} aktif</span>
          </div>
          {screens.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-6">
                <div className="text-2xl mb-2 opacity-30">🖥️</div>
                <p className="text-tv-muted text-xs">Henüz ekran yok</p>
                <Link href="/admin/screens" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block">
                  Ekran ekle →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-52 pr-1">
              {[...onlineScreens, ...offlineScreens].map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-tv-text truncate">{s.name}</p>
                    <p className="text-xs text-tv-muted truncate">
                      {LAYOUT_LABELS[s.layoutType] ?? s.layoutType}
                      {s.lastSeen && !s.isOnline && ` · ${formatRelative(s.lastSeen)}`}
                    </p>
                  </div>
                  {s.isOnline && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-medium flex-shrink-0">
                      CANLI
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/screens"
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-center"
          >
            Ekran yönetimi →
          </Link>
        </div>
      </div>

      {/* Top Ads + Quick Broadcast */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Ads Leaderboard */}
        <div className="xl:col-span-2 admin-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-tv-text">En İyi Reklamlar</h2>
            <Link href="/admin/ads" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Tümünü gör →
            </Link>
          </div>
          {stats?.topAds && stats.topAds.length > 0 ? (
            <div className="space-y-3">
              {stats.topAds.map((ad, i) => {
                const cr = ad.impressions > 0 ? Math.round((ad.completions / ad.impressions) * 100) : 0;
                const maxImp = stats.topAds[0].impressions || 1;
                const barWidth = Math.round((ad.impressions / maxImp) * 100);
                return (
                  <div key={ad.id} className="flex items-center gap-4">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: i === 0 ? '#f59e0b20' : 'rgba(255,255,255,0.05)',
                        color: i === 0 ? '#f59e0b' : '#64748b',
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-tv-text truncate">{ad.title}</p>
                        <span className="text-xs text-tv-muted ml-2 flex-shrink-0">
                          {formatNumber(ad.impressions)} göst. · %{cr} tamamlanma
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, background: i === 0 ? '#6366f1' : '#334155' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-tv-muted text-sm text-center py-6">Henüz reklam performans verisi yok</p>
          )}
        </div>

        {/* Quick Broadcast Panel */}
        <div className="admin-card">
          <h2 className="text-sm font-semibold text-tv-text mb-1">Hızlı Yayın</h2>
          <p className="text-xs text-tv-muted mb-4">Tüm ekranlara anında layout gönder</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { layout: 'default', label: 'Varsayılan', icon: '📺' },
              { layout: 'markets', label: 'Piyasalar', icon: '📈' },
              { layout: 'news_focus', label: 'Haberler', icon: '📰' },
              { layout: 'social_wall', label: 'Sosyal Duvar', icon: '🖼️' },
            ].map((item) => (
              <button
                key={item.layout}
                onClick={() => quickBroadcast(item.layout, item.label)}
                disabled={broadcasting}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium text-tv-text">{item.label}</span>
              </button>
            ))}
          </div>
          {broadcastResult && (
            <div
              className={`text-xs px-3 py-2 rounded-lg text-center font-medium mb-3 ${
                broadcastResult.startsWith('✓')
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {broadcastResult}
            </div>
          )}
          {/* Playlist send */}
          {playlists.length > 0 && (
            <div className="mb-3 pt-3 border-t border-white/[0.06]">
              <p className="text-xs text-tv-muted mb-2">Playlist gönder</p>
              <div className="flex gap-2">
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="flex-1 text-xs bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-tv-text focus:outline-none focus:border-indigo-500/50"
                >
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#1e293b]">{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={sendPlaylist}
                  disabled={broadcasting || !selectedPlaylistId}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  ▶
                </button>
                <button
                  onClick={stopPlaylist}
                  disabled={broadcasting}
                  title="Playlist durdur"
                  className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/5 text-tv-muted text-xs disabled:opacity-50 transition-colors"
                >
                  ■
                </button>
              </div>
            </div>
          )}
          <Link
            href="/admin/publish"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-indigo-500/30 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors font-medium"
          >
            🎬 Gelişmiş Yayın Merkezi
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-card">
        <h2 className="text-sm font-semibold text-tv-text mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {[
            { href: '/admin/ads?new=1', icon: '📺', label: 'Yeni Reklam', color: '#6366f1' },
            { href: '/admin/content?new=1', icon: '🖼️', label: 'İçerik Ekle', color: '#22d3ee' },
            { href: '/admin/ai-studio', icon: '🤖', label: 'AI Studio', color: '#8b5cf6' },
            { href: '/admin/ticker?new=1', icon: '📢', label: 'Ticker Ekle', color: '#f59e0b' },
            { href: '/admin/playlist', icon: '▶', label: 'Playlist', color: '#6366f1' },
            { href: '/admin/schedule', icon: '📅', label: 'Takvim', color: '#ec4899' },
            { href: '/admin/monitoring', icon: '🩺', label: 'Monitoring', color: '#10b981' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-all group"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: `${action.color}15`, border: `1px solid ${action.color}25` }}
              >
                {action.icon}
              </div>
              <span className="text-xs font-medium text-tv-text group-hover:text-white transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
