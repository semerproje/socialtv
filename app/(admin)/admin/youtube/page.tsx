'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VideoData {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number;
  displayOrder: number;
  isActive: boolean;
  muted: boolean;
  loop: boolean;
  startSeconds: number;
  playlistId?: string;
  playlist?: { id: string; name: string } | null;
  createdAt?: string;
}

interface PlaylistData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  videoCount?: number;
  loop?: boolean;
  shuffle?: boolean;
  color?: string;
}

type TabType = 'videos' | 'playlists' | 'broadcast';
type FilterType = 'all' | 'active' | 'inactive';
type ViewMode = 'grid' | 'list';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function YouTubePage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('videos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [playlistFilter, setPlaylistFilter] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    url: '',
    title: '',
    channelName: '',
    description: '',
    muted: true,
    loop: true,
    startSeconds: 0,
    playlistId: '',
  });
  const [thumbPreview, setThumbPreview] = useState('');
  const [autoFetching, setAutoFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [broadcastPreview, setBroadcastPreview] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastFetching, setBroadcastFetching] = useState(false);

  const [playlistForm, setPlaylistForm] = useState({ name: '', description: '', loop: true, shuffle: false, color: '#6366f1' });
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  // Playlist detail / edit
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistData | null>(null);
  const [detailPlaylist, setDetailPlaylist] = useState<PlaylistData | null>(null);
  const [detailVideos, setDetailVideos] = useState<VideoData[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [showPickVideos, setShowPickVideos] = useState(false);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout>>();

  const urlDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube?active=0');
      if (res.ok) {
        const d = await res.json();
        const allVideos: VideoData[] = d.videos ?? [];
        setVideos(allVideos);
        const enriched: PlaylistData[] = (d.playlists ?? []).map((p: PlaylistData) => ({
          ...p,
          videoCount: allVideos.filter((v) => v.playlistId === p.id).length,
        }));
        setPlaylists(enriched);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchYouTubeMeta(urlOrId: string, isForm = true) {
    const vid = extractYouTubeId(urlOrId);
    if (!vid) return;
    if (isForm) setAutoFetching(true); else setBroadcastFetching(true);
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        if (isForm) {
          setForm((f) => ({
            ...f,
            title: f.title || data.title || '',
            channelName: f.channelName || data.author_name || '',
          }));
          setThumbPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
        } else {
          setBroadcastTitle((t) => t || data.title || '');
          setBroadcastPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
        }
      } else {
        if (isForm) setThumbPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
        else setBroadcastPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
      }
    } catch {
      if (isForm) setThumbPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
      else setBroadcastPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
    }
    if (isForm) setAutoFetching(false); else setBroadcastFetching(false);
  }

  function handleFormUrlChange(val: string) {
    setForm((f) => ({ ...f, url: val }));
    clearTimeout(urlDebounceRef.current);
    const vid = extractYouTubeId(val);
    if (vid) {
      setThumbPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
      urlDebounceRef.current = setTimeout(() => fetchYouTubeMeta(val, true), 600);
    } else {
      setThumbPreview('');
    }
  }

  function handleBroadcastUrlChange(val: string) {
    setBroadcastUrl(val);
    clearTimeout(urlDebounceRef.current);
    const vid = extractYouTubeId(val);
    if (vid) {
      setBroadcastPreview(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
      urlDebounceRef.current = setTimeout(() => fetchYouTubeMeta(val, false), 600);
    } else {
      setBroadcastPreview('');
      setBroadcastTitle('');
    }
  }

  async function saveVideo() {
    const vid = editingVideo ? editingVideo.videoId : extractYouTubeId(form.url);
    if (!vid) { toast.error('Geçersiz YouTube URL'); return; }
    if (!form.title.trim()) { toast.error('Başlık gerekli'); return; }
    setSaving(true);
    try {
      if (editingVideo) {
        const res = await fetch(`/api/youtube?id=${editingVideo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            channelName: form.channelName || undefined,
            description: form.description || undefined,
            muted: form.muted,
            loop: form.loop,
            startSeconds: form.startSeconds,
            playlistId: form.playlistId || undefined,
            thumbnailUrl: thumbPreview || undefined,
          }),
        });
        if (res.ok) { toast.success('Video güncellendi'); closeModal(); fetchData(); }
        else { const e = await res.json(); toast.error(e.error ?? 'Güncelleme hatası'); }
      } else {
        const res = await fetch('/api/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: vid,
            title: form.title,
            channelName: form.channelName || undefined,
            description: form.description || undefined,
            thumbnailUrl: thumbPreview || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
            muted: form.muted,
            loop: form.loop,
            startSeconds: form.startSeconds,
            playlistId: form.playlistId || undefined,
          }),
        });
        if (res.ok) { toast.success('Video eklendi'); closeModal(); fetchData(); }
        else { const e = await res.json(); toast.error(e.error ?? 'Ekleme hatası'); }
      }
    } finally { setSaving(false); }
  }

  async function deleteVideo(id: string) {
    setDeletingId(id);
    await fetch(`/api/youtube?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    toast.success('Video silindi');
    fetchData();
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/youtube?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    });
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, isActive: !current } : v)));
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/youtube?id=${id}`, { method: 'DELETE' })));
    toast.success(`${selectedIds.size} video silindi`);
    setSelectedIds(new Set());
    fetchData();
  }

  async function bulkToggle(active: boolean) {
    if (selectedIds.size === 0) return;
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/youtube?id=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: active }),
        })
      )
    );
    toast.success(`${selectedIds.size} video ${active ? 'aktif edildi' : 'devre dışı bırakıldı'}`);
    setSelectedIds(new Set());
    fetchData();
  }

  async function savePlaylist() {
    if (!playlistForm.name.trim()) { toast.error('Playlist adı gerekli'); return; }
    setSavingPlaylist(true);
    try {
      if (editingPlaylist) {
        // Update existing playlist
        const res = await fetch(`/api/youtube?playlistId=${editingPlaylist.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playlistForm.name,
            description: playlistForm.description || undefined,
            loop: playlistForm.loop,
            shuffle: playlistForm.shuffle,
            color: playlistForm.color,
          }),
        });
        if (res.ok) {
          toast.success('Playlist güncellendi');
          closePlaylistModal();
          fetchData();
        } else {
          const e = await res.json();
          toast.error(e.error ?? 'Güncelleme hatası');
        }
      } else {
        // Create new playlist
        const res = await fetch('/api/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'playlist',
            name: playlistForm.name,
            description: playlistForm.description || undefined,
            loop: playlistForm.loop,
            shuffle: playlistForm.shuffle,
            color: playlistForm.color,
          }),
        });
        if (res.ok) {
          toast.success('Playlist oluşturuldu');
          closePlaylistModal();
          fetchData();
        } else {
          const e = await res.json();
          toast.error(e.error ?? 'Hata');
        }
      }
    } finally { setSavingPlaylist(false); }
  }

  function openCreatePlaylistModal() {
    setEditingPlaylist(null);
    setPlaylistForm({ name: '', description: '', loop: true, shuffle: false, color: '#6366f1' });
    setShowPlaylistModal(true);
  }

  function openEditPlaylistModal(pl: PlaylistData) {
    setEditingPlaylist(pl);
    setPlaylistForm({
      name: pl.name,
      description: pl.description ?? '',
      loop: pl.loop ?? true,
      shuffle: pl.shuffle ?? false,
      color: pl.color ?? '#6366f1',
    });
    setShowPlaylistModal(true);
  }

  function closePlaylistModal() {
    setShowPlaylistModal(false);
    setEditingPlaylist(null);
    setPlaylistForm({ name: '', description: '', loop: true, shuffle: false, color: '#6366f1' });
  }

  function openDetailView(pl: PlaylistData) {
    const sorted = videos
      .filter((v) => v.playlistId === pl.id)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    setDetailVideos(sorted);
    setDetailPlaylist(pl);
    setShowPickVideos(false);
  }

  function closeDetailView() {
    setDetailPlaylist(null);
    setDetailVideos([]);
    setShowPickVideos(false);
  }

  async function saveDetailOrder(items: VideoData[]) {
    setSavingOrder(true);
    try {
      await fetch('/api/youtube?action=reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((v, i) => ({ id: v.id, displayOrder: i })) }),
      });
      // Update local state
      setVideos((vs) =>
        vs.map((v) => {
          const idx = items.findIndex((item) => item.id === v.id);
          return idx >= 0 ? { ...v, displayOrder: idx } : v;
        })
      );
      toast.success('Sıralama kaydedildi');
    } catch {
      toast.error('Sıralama kaydedilemedi');
    } finally {
      setSavingOrder(false);
    }
  }

  async function removeVideoFromPlaylist(videoId: string) {
    await fetch(`/api/youtube?id=${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: null }),
    });
    setDetailVideos((vs) => vs.filter((v) => v.id !== videoId));
    setVideos((vs) => vs.map((v) => v.id === videoId ? { ...v, playlistId: undefined, playlist: null } : v));
    toast.success('Playlist\'ten çıkarıldı');
  }

  async function addVideoToPlaylist(videoId: string) {
    if (!detailPlaylist) return;
    await fetch(`/api/youtube?id=${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: detailPlaylist.id }),
    });
    const video = videos.find((v) => v.id === videoId);
    if (video) {
      const updated = { ...video, playlistId: detailPlaylist.id, playlist: { id: detailPlaylist.id, name: detailPlaylist.name } };
      setDetailVideos((vs) => [...vs, updated]);
      setVideos((vs) => vs.map((v) => v.id === videoId ? updated : v));
    }
    toast.success('Playlist\'e eklendi');
  }

  async function deletePlaylist(id: string) {
    await fetch(`/api/youtube?playlistId=${id}`, { method: 'DELETE' });
    toast.success('Playlist silindi');
    fetchData();
  }

  async function broadcastVideo(videoId: string, title: string) {
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'play_youtube', data: { videoId, title } }),
    });
    toast.success(`"${title.slice(0, 40)}" tüm ekranlarda oynatılıyor`);
  }

  async function broadcastActivePlaylist() {
    const active = videos.filter((v) => v.isActive);
    if (active.length === 0) { toast.error('Aktif video yok'); return; }
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'play_playlist', data: { videos: active.map((v) => ({ videoId: v.videoId, title: v.title })) } }),
    });
    toast.success(`${active.length} video playlist olarak yayınlandı`);
  }

  async function broadcastPlaylistById(pl: PlaylistData) {
    const plVideos = videos.filter((v) => v.playlistId === pl.id && v.isActive);
    if (plVideos.length === 0) { toast.error('Playlist boş veya tüm videolar pasif'); return; }
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'play_playlist', data: { videos: plVideos.map((v) => ({ videoId: v.videoId, title: v.title })) } }),
    });
    toast.success(`"${pl.name}" tüm ekranlarda oynatılıyor`);
  }

  async function changeLayout(layoutType: string) {
    await fetch('/api/sync/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'change_layout', data: { layoutType } }),
    });
    toast.success(`Layout: ${layoutType}`);
  }

  async function handleQuickBroadcast() {
    const vid = extractYouTubeId(broadcastUrl);
    if (!vid) { toast.error('Geçersiz YouTube URL'); return; }
    await broadcastVideo(vid, broadcastTitle || 'YouTube');
    setBroadcastUrl('');
    setBroadcastTitle('');
    setBroadcastPreview('');
  }

  function openAddModal() {
    setEditingVideo(null);
    setForm({ url: '', title: '', channelName: '', description: '', muted: true, loop: true, startSeconds: 0, playlistId: '' });
    setThumbPreview('');
    setShowAddModal(true);
  }

  function openEditModal(v: VideoData) {
    setEditingVideo(v);
    setForm({
      url: v.videoId,
      title: v.title,
      channelName: v.channelName ?? '',
      description: v.description ?? '',
      muted: v.muted,
      loop: v.loop,
      startSeconds: v.startSeconds ?? 0,
      playlistId: v.playlistId ?? '',
    });
    setThumbPreview(v.thumbnailUrl ?? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingVideo(null);
    setForm({ url: '', title: '', channelName: '', description: '', muted: true, loop: true, startSeconds: 0, playlistId: '' });
    setThumbPreview('');
  }

  const filteredVideos = videos.filter((v) => {
    if (filter === 'active' && !v.isActive) return false;
    if (filter === 'inactive' && v.isActive) return false;
    if (playlistFilter && v.playlistId !== playlistFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!v.title.toLowerCase().includes(q) && !(v.channelName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCount = videos.filter((v) => v.isActive).length;
  const inactiveCount = videos.length - activeCount;

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-600/30">
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              YouTube Yönetimi
            </h1>
            <p className="text-tv-muted text-sm mt-0.5">Video kütüphanesi, playlist yönetimi ve ekran yayını</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={broadcastActivePlaylist} className="btn-secondary flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
            Tümünü Oynat
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2z" /></svg>
            Video Ekle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Video', value: videos.length, bg: '#6366f115', icon: '\uD83C\uDFAC' },
          { label: 'Aktif', value: activeCount, bg: '#10b98115', icon: '\u25B6' },
          { label: 'Devre Dışı', value: inactiveCount, bg: '#ef444415', icon: '\u23F8' },
          { label: 'Playlist', value: playlists.length, bg: '#f59e0b15', icon: '\uD83D\uDCCB' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="admin-card !p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-tv-muted text-xs uppercase tracking-wider">{s.label}</p>
                <p className="text-3xl font-bold text-tv-text mt-1">{s.value}</p>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: s.bg }}>
                {s.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-1">
        {(
          [
            { key: 'videos' as TabType, label: '\uD83C\uDFAC Videolar', count: videos.length },
            { key: 'playlists' as TabType, label: '\uD83D\uDCCB Playlistler', count: playlists.length },
            { key: 'broadcast' as TabType, label: '\uD83D\uDCE1 Yayın Kontrolü', count: null },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.key
                ? 'text-tv-primary border-tv-primary'
                : 'text-tv-muted border-transparent hover:text-tv-text hover:border-white/10'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-tv-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* VIDEOS TAB */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-tv-muted pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Video veya kanal ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              {(['all', 'active', 'inactive'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${filter === f ? 'bg-white/10 text-tv-text' : 'text-tv-muted hover:bg-white/5'}`}
                >
                  {f === 'all' ? 'Tümü' : f === 'active' ? '\u25CF Aktif' : '\u25CB Pasif'}
                </button>
              ))}
            </div>
            {playlists.length > 0 && (
              <select
                value={playlistFilter}
                onChange={(e) => setPlaylistFilter(e.target.value)}
                className="input-field !py-2 w-44 text-sm"
              >
                <option value="">Tüm Listeler</option>
                {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-tv-text' : 'text-tv-muted hover:bg-white/5'}`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-white/10 text-tv-text' : 'text-tv-muted hover:bg-white/5'}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {filteredVideos.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds(selectedIds.size === filteredVideos.length ? new Set() : new Set(filteredVideos.map((v) => v.id)))}
                className="text-xs text-tv-muted hover:text-tv-text flex items-center gap-2 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedIds.size === filteredVideos.length && filteredVideos.length > 0 ? 'bg-indigo-500 border-indigo-500' : 'border-white/30'}`}>
                  {selectedIds.size === filteredVideos.length && filteredVideos.length > 0 && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </div>
                Tümünü Seç ({filteredVideos.length})
              </button>
              <span className="text-xs text-tv-muted ml-auto">{filteredVideos.length}/{videos.length} video</span>
            </div>
          )}

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex-wrap"
              >
                <span className="text-sm text-indigo-300 font-semibold">{selectedIds.size} video seçildi</span>
                <div className="flex gap-2 ml-auto flex-wrap">
                  <button onClick={() => bulkToggle(true)} className="btn-secondary text-xs py-1.5 px-3">Aktif Et</button>
                  <button onClick={() => bulkToggle(false)} className="btn-secondary text-xs py-1.5 px-3">Pasif Et</button>
                  <button onClick={bulkDelete} className="btn-danger text-xs py-1.5 px-3">Sil</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-tv-muted hover:text-tv-text ml-1 transition-colors">\u2715</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="admin-card h-52 animate-pulse rounded-2xl" />)}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="admin-card text-center py-20">
              <div className="text-6xl mb-4">\uD83C\uDFAC</div>
              <p className="text-tv-text font-semibold text-lg mb-1">Video bulunamadı</p>
              <p className="text-tv-muted text-sm mb-6">Filtreyi değiştirin veya yeni video ekleyin</p>
              <button onClick={openAddModal} className="btn-primary">+ Video Ekle</button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVideos.map((video, i) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={i}
                  selected={selectedIds.has(video.id)}
                  deleting={deletingId === video.id}
                  onSelect={() => { const s = new Set(selectedIds); s.has(video.id) ? s.delete(video.id) : s.add(video.id); setSelectedIds(s); }}
                  onBroadcast={() => broadcastVideo(video.videoId, video.title)}
                  onToggle={() => toggleActive(video.id, video.isActive)}
                  onEdit={() => openEditModal(video)}
                  onDelete={() => deleteVideo(video.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVideos.map((video, i) => (
                <VideoListRow
                  key={video.id}
                  video={video}
                  index={i}
                  selected={selectedIds.has(video.id)}
                  deleting={deletingId === video.id}
                  onSelect={() => { const s = new Set(selectedIds); s.has(video.id) ? s.delete(video.id) : s.add(video.id); setSelectedIds(s); }}
                  onBroadcast={() => broadcastVideo(video.videoId, video.title)}
                  onToggle={() => toggleActive(video.id, video.isActive)}
                  onEdit={() => openEditModal(video)}
                  onDelete={() => deleteVideo(video.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-tv-muted text-sm">{playlists.length} playlist · {videos.filter(v => v.playlistId).length} video atanmış</p>
            <button onClick={openCreatePlaylistModal} className="btn-primary flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2z" /></svg>
              Yeni Playlist
            </button>
          </div>
          {playlists.length === 0 ? (
            <div className="admin-card text-center py-20">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-tv-text font-semibold text-lg mb-1">Henüz playlist yok</p>
              <p className="text-tv-muted text-sm mb-6">Videoları gruplamak için playlist oluşturun</p>
              <button onClick={openCreatePlaylistModal} className="btn-primary">Playlist Oluştur</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl, i) => (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  index={i}
                  videos={videos.filter((v) => v.playlistId === pl.id)}
                  onBroadcast={() => broadcastPlaylistById(pl)}
                  onDelete={() => deletePlaylist(pl.id)}
                  onEdit={() => openEditPlaylistModal(pl)}
                  onDetail={() => openDetailView(pl)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* BROADCAST TAB */}
      {activeTab === 'broadcast' && (
        <div className="space-y-4 max-w-2xl">
          <div className="admin-card space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="font-semibold text-tv-text">Hızlı Yayın</h3>
            </div>
            <div>
              <label className="text-xs text-tv-muted mb-1.5 block">YouTube URL veya Video ID</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={broadcastUrl}
                  onChange={(e) => handleBroadcastUrlChange(e.target.value)}
                  className="input-field pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickBroadcast()}
                />
                {broadcastFetching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-tv-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
            <AnimatePresence>
              {broadcastPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-3 items-center bg-white/5 rounded-xl p-3"
                >
                  <img src={broadcastPreview} alt="preview" className="w-28 rounded-lg object-cover aspect-video flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Video başlığı (opsiyonel)"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="input-field flex-1 text-sm"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={handleQuickBroadcast}
              disabled={!broadcastUrl}
              className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
              Tüm Ekranlara Yayınla
            </button>
          </div>

          <div className="admin-card space-y-3">
            <h3 className="font-semibold text-tv-text">\uD83D\uDCCB Playlist Yayını</h3>
            <button onClick={broadcastActivePlaylist} className="btn-secondary w-full justify-center flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
              Tüm Aktif Videolar ({activeCount} video)
            </button>
            {playlists.length > 0 && (
              <div className="space-y-2 pt-1">
                {playlists.map((pl) => (
                  <div key={pl.id} className="flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-xl px-4 py-3 transition-colors">
                    <div>
                      <p className="text-sm text-tv-text font-medium">{pl.name}</p>
                      <p className="text-xs text-tv-muted">{pl.videoCount ?? 0} video</p>
                    </div>
                    <button onClick={() => broadcastPlaylistById(pl)} className="btn-primary text-xs py-1.5">\u25B6 Oynat</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card space-y-3">
            <div>
              <h3 className="font-semibold text-tv-text">\uD83C\uDFA8 Ekran Layoutu</h3>
              <p className="text-tv-muted text-xs mt-0.5">Tüm ekranlara layout komutu gönderir</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'youtube', label: 'YouTube + Feed', icon: '\uD83D\uDCFA' },
                { type: 'fullscreen', label: 'Tam Ekran Video', icon: '\u26F6' },
                { type: 'split_2', label: 'Split (2 Alan)', icon: '\u229F' },
                { type: 'default', label: 'Varsayılan', icon: '\uD83C\uDFE0' },
                { type: 'digital_signage', label: 'Digital Signage', icon: '\uD83D\uDDA5' },
                { type: 'instagram', label: 'Instagram', icon: '\uD83D\uDCF8' },
              ].map((l) => (
                <button
                  key={l.type}
                  onClick={() => changeLayout(l.type)}
                  className="btn-secondary flex items-center gap-2 justify-start text-sm"
                >
                  <span>{l.icon}</span> {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="admin-card w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-tv-text">
                  {editingVideo ? '\u270F\uFE0F Video Düzenle' : '+ Yeni Video Ekle'}
                </h3>
                <button onClick={closeModal} className="text-tv-muted hover:text-tv-text w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">\u2715</button>
              </div>

              {!editingVideo && (
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block font-medium">
                    YouTube URL veya Video ID <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://youtube.com/watch?v=... veya VIDEO_ID"
                      value={form.url}
                      onChange={(e) => handleFormUrlChange(e.target.value)}
                      className="input-field pr-10"
                      autoFocus
                    />
                    {autoFetching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-tv-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {!autoFetching && thumbPreview && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">\u2713</div>
                    )}
                  </div>
                  <p className="text-tv-muted text-xs mt-1">Başlık ve kanal otomatik doldurulur</p>
                </div>
              )}

              <AnimatePresence>
                {thumbPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative aspect-video rounded-xl overflow-hidden bg-black/40"
                  >
                    <img src={thumbPreview} alt="thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 pl-1"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="text-xs text-tv-muted mb-1.5 block font-medium">Başlık <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Video başlığı"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs text-tv-muted mb-1.5 block font-medium">Kanal Adı</label>
                <input
                  type="text"
                  placeholder="Kanal adı (opsiyonel)"
                  value={form.channelName}
                  onChange={(e) => setForm((f) => ({ ...f, channelName: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block font-medium">Başlangıç (saniye)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.startSeconds}
                    onChange={(e) => setForm((f) => ({ ...f, startSeconds: Math.max(0, +e.target.value) }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs text-tv-muted mb-1.5 block font-medium">Playlist</label>
                  <select value={form.playlistId} onChange={(e) => setForm((f) => ({ ...f, playlistId: e.target.value }))} className="input-field">
                    <option value="">Playlist yok</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm((f) => ({ ...f, muted: !f.muted }))}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${form.muted ? 'bg-indigo-500' : 'bg-white/15'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${form.muted ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm text-tv-text">\uD83D\uDD07 Sessiz</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm((f) => ({ ...f, loop: !f.loop }))}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${form.loop ? 'bg-indigo-500' : 'bg-white/15'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${form.loop ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm text-tv-text">\uD83D\uDD01 Döngü</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2 border-t border-white/10">
                <button onClick={closeModal} className="btn-secondary flex-1">İptal</button>
                <button onClick={saveVideo} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Kaydediliyor...
                    </span>
                  ) : editingVideo ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit Playlist Modal */}
      <AnimatePresence>
        {showPlaylistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closePlaylistModal()}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="admin-card w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-tv-text">
                  {editingPlaylist ? '✏️ Playlist Düzenle' : '📋 Yeni Playlist'}
                </h3>
                <button onClick={closePlaylistModal} className="text-tv-muted hover:text-tv-text w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">✕</button>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-tv-muted mb-2 block font-medium">Renk</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#14b8a6'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setPlaylistForm((f) => ({ ...f, color: c }))}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all ring-2 ring-offset-2 ring-offset-[#0d1629]',
                        playlistForm.color === c ? 'ring-white scale-110' : 'ring-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-tv-muted mb-1.5 block font-medium">Ad <span className="text-red-400">*</span></label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: playlistForm.color }} />
                  <input
                    type="text"
                    placeholder="ör. Müzik Videoları"
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-field pl-8"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && savePlaylist()}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-tv-muted mb-1.5 block font-medium">Açıklama</label>
                <input
                  type="text"
                  placeholder="İsteğe bağlı kısa açıklama"
                  value={playlistForm.description}
                  onChange={(e) => setPlaylistForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-field"
                />
              </div>

              {/* Loop & Shuffle */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div
                  onClick={() => setPlaylistForm((f) => ({ ...f, loop: !f.loop }))}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none',
                    playlistForm.loop
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/10 bg-white/3 hover:bg-white/5'
                  )}
                >
                  <span className="text-xl">🔁</span>
                  <div>
                    <p className="text-sm font-medium text-tv-text">Döngü</p>
                    <p className="text-[11px] text-tv-muted">Playlist bitti mi tekrar başlat</p>
                  </div>
                </div>
                <div
                  onClick={() => setPlaylistForm((f) => ({ ...f, shuffle: !f.shuffle }))}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none',
                    playlistForm.shuffle
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/3 hover:bg-white/5'
                  )}
                >
                  <span className="text-xl">🔀</span>
                  <div>
                    <p className="text-sm font-medium text-tv-text">Karıştır</p>
                    <p className="text-[11px] text-tv-muted">Sıralamayı rastgele oynat</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-white/10">
                <button onClick={closePlaylistModal} className="btn-secondary flex-1">İptal</button>
                <button onClick={savePlaylist} disabled={savingPlaylist} className="btn-primary flex-1 justify-center">
                  {savingPlaylist ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editingPlaylist ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist Detail Modal */}
      <AnimatePresence>
        {detailPlaylist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && closeDetailView()}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="admin-card w-full max-w-2xl max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-white/8 flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: (detailPlaylist.color ?? '#6366f1') + '22', border: `1px solid ${detailPlaylist.color ?? '#6366f1'}44` }}
                >
                  📋
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-tv-text truncate">{detailPlaylist.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-tv-muted">{detailVideos.length} video</span>
                    {detailPlaylist.loop && <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">🔁 Döngü</span>}
                    {detailPlaylist.shuffle && <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">🔀 Karıştır</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => saveDetailOrder(detailVideos)}
                    disabled={savingOrder}
                    className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                  >
                    {savingOrder ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : '💾'} Sıralamayı Kaydet
                  </button>
                  <button onClick={closeDetailView} className="text-tv-muted hover:text-tv-text w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">✕</button>
                </div>
              </div>

              {/* Video List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-1 min-h-0">
                {detailVideos.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-tv-muted text-sm">Bu playlist boş</p>
                    <button
                      onClick={() => setShowPickVideos(true)}
                      className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
                    >
                      + Video ekle
                    </button>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={detailVideos}
                    onReorder={setDetailVideos}
                    className="space-y-1"
                  >
                    {detailVideos.map((video, idx) => (
                      <Reorder.Item
                        key={video.id}
                        value={video}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 group cursor-grab active:cursor-grabbing select-none"
                        whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10, position: 'relative' }}
                      >
                        {/* Drag handle */}
                        <div className="text-tv-muted/30 group-hover:text-tv-muted/60 transition-colors flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M9 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6-16a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                          </svg>
                        </div>
                        {/* Order number */}
                        <span className="text-[11px] text-tv-muted/50 w-5 text-right flex-shrink-0">{idx + 1}</span>
                        {/* Thumbnail */}
                        <div className="w-16 aspect-video rounded-md overflow-hidden bg-black/40 flex-shrink-0">
                          <img
                            src={video.thumbnailUrl ?? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-tv-text text-sm font-medium line-clamp-1">{video.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-tv-muted text-[11px] line-clamp-1">{video.channelName || 'YouTube'}</span>
                            {video.muted && <span className="text-[10px] text-tv-muted/50">🔇</span>}
                            {video.loop && <span className="text-[10px] text-tv-muted/50">🔁</span>}
                            <span className={cn('text-[10px] px-1 rounded', video.isActive ? 'text-emerald-400' : 'text-red-400')}>
                              {video.isActive ? '●' : '○'}
                            </span>
                          </div>
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => removeVideoFromPlaylist(video.id)}
                          className="flex-shrink-0 text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                          </svg>
                        </button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </div>

              {/* Add videos section */}
              <div className="border-t border-white/8 pt-3 flex-shrink-0">
                <button
                  onClick={() => setShowPickVideos((v) => !v)}
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2z" />
                  </svg>
                  {showPickVideos ? 'Gizle' : 'Video Ekle'}
                  <span className="text-xs text-white/30">({videos.filter(v => !v.playlistId).length} atanmamış)</span>
                </button>
                <AnimatePresence>
                  {showPickVideos && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                        {videos.filter((v) => !v.playlistId && !detailVideos.find(dv => dv.id === v.id)).map((v) => (
                          <div key={v.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 group">
                            <div className="w-12 aspect-video rounded overflow-hidden bg-black/40 flex-shrink-0">
                              <img src={v.thumbnailUrl ?? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`} alt={v.title} className="w-full h-full object-cover" />
                            </div>
                            <p className="flex-1 text-sm text-tv-text line-clamp-1">{v.title}</p>
                            <button
                              onClick={() => addVideoToPlaylist(v.id)}
                              className="flex-shrink-0 text-xs text-indigo-400 hover:text-white hover:bg-indigo-500 px-2.5 py-1 rounded-lg border border-indigo-500/30 hover:border-indigo-500 transition-all opacity-0 group-hover:opacity-100"
                            >
                              Ekle
                            </button>
                          </div>
                        ))}
                        {videos.filter((v) => !v.playlistId).length === 0 && (
                          <p className="text-tv-muted text-xs text-center py-4">Eklenebilecek video yok</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── VideoCard ─────────────────────────────────────────────────────────────────
interface VideoActionProps {
  video: VideoData;
  index: number;
  selected: boolean;
  deleting: boolean;
  onSelect: () => void;
  onBroadcast: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VideoCard({ video, index, selected, deleting, onSelect, onBroadcast, onToggle, onEdit, onDelete }: VideoActionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`admin-card !p-0 overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 ${!video.isActive ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <div className="relative aspect-video bg-black/60 overflow-hidden cursor-pointer" onClick={onSelect}>
        <img
          src={video.thumbnailUrl ?? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onBroadcast(); }}
            className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 pl-0.5"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-500 border-indigo-500' : 'border-white/50 bg-black/40 opacity-0 group-hover:opacity-100'}`}>
          {selected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><path d="M20 6 9 17l-5-5" /></svg>}
        </div>
        {!video.isActive && (
          <div className="absolute top-2 right-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">KAPALI</div>
        )}
        {video.playlist && (
          <div className="absolute bottom-2 left-2 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full max-w-[8rem] truncate">
            {video.playlist.name}
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
          <div className="w-3.5 h-3.5 bg-red-600 rounded-sm flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-2 h-2 pl-px"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <span className="text-white text-[10px] font-medium">YT</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-tv-text text-sm font-semibold line-clamp-2 leading-snug">{video.title}</p>
        {video.channelName && (
          <p className="text-tv-muted text-xs line-clamp-1">{video.channelName}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {video.muted && <span className="text-[10px] bg-white/8 text-tv-muted px-2 py-0.5 rounded-full">\uD83D\uDD07 Sessiz</span>}
          {video.loop && <span className="text-[10px] bg-white/8 text-tv-muted px-2 py-0.5 rounded-full">\uD83D\uDD01 Döngü</span>}
          {(video.startSeconds ?? 0) > 0 && (
            <span className="text-[10px] bg-white/8 text-tv-muted px-2 py-0.5 rounded-full">\u23E9 {video.startSeconds}s</span>
          )}
        </div>
        <div className="flex gap-1.5 pt-1 border-t border-white/5">
          <button
            onClick={onBroadcast}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M8 5v14l11-7z" /></svg>
            Oynat
          </button>
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 text-tv-muted flex items-center justify-center text-xs transition-colors"
            title={video.isActive ? 'Devre Dışı' : 'Aktif Et'}
          >
            {video.isActive ? '\u23F8' : '\u25B6'}
          </button>
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 text-tv-muted flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="w-8 h-8 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {deleting ? (
              <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── VideoListRow ──────────────────────────────────────────────────────────────
function VideoListRow({ video, index, selected, deleting, onSelect, onBroadcast, onToggle, onEdit, onDelete }: VideoActionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
      className={`admin-card !p-3 flex items-center gap-3 group transition-all ${!video.isActive ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-indigo-500' : 'hover:border-white/20'}`}
    >
      <button
        onClick={onSelect}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 hover:border-white/40'}`}
      >
        {selected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><path d="M20 6 9 17l-5-5" /></svg>}
      </button>
      <div className="flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-black/40">
        <img
          src={video.thumbnailUrl ?? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-tv-text text-sm font-semibold line-clamp-1">{video.title}</p>
        <p className="text-tv-muted text-xs mt-0.5">{video.channelName || 'YouTube'}</p>
        <div className="flex gap-1.5 mt-1">
          {video.playlist && <span className="badge badge-primary !text-[10px] !py-0">{video.playlist.name}</span>}
          {video.muted && <span className="text-[10px] bg-white/8 text-tv-muted px-1.5 py-0.5 rounded-full">\uD83D\uDD07</span>}
          {video.loop && <span className="text-[10px] bg-white/8 text-tv-muted px-1.5 py-0.5 rounded-full">\uD83D\uDD01</span>}
        </div>
      </div>
      <span className={`flex-shrink-0 badge ${video.isActive ? 'badge-success' : 'badge-danger'} text-[11px] hidden md:inline-flex`}>
        {video.isActive ? '\u25CF Aktif' : '\u25CB Pasif'}
      </span>
      <div className="flex-shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onBroadcast}
          className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M8 5v14l11-7z" /></svg>
          Oynat
        </button>
        <button onClick={onToggle} className="btn-secondary text-xs py-1.5 px-2">{video.isActive ? '\u23F8' : '\u25B6'}</button>
        <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-red-400 hover:bg-red-500/10 text-xs px-2 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          {deleting ? '\u2026' : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── PlaylistCard ──────────────────────────────────────────────────────────────
function PlaylistCard({
  playlist,
  index,
  videos,
  onBroadcast,
  onDelete,
  onEdit,
  onDetail,
}: {
  playlist: PlaylistData;
  index: number;
  videos: VideoData[];
  onBroadcast: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDetail: () => void;
}) {
  const accent = playlist.color ?? '#6366f1';
  const activeCount = videos.filter((v) => v.isActive).length;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="admin-card !p-0 overflow-hidden hover:border-white/20 transition-colors relative"
    >
      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: accent + '20', border: `1px solid ${accent}40` }}
            >
              📋
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-tv-text truncate leading-tight">{playlist.name}</h3>
              {playlist.description && (
                <p className="text-tv-muted text-[11px] mt-0.5 line-clamp-1">{playlist.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="w-7 h-7 text-tv-muted hover:text-tv-text hover:bg-white/8 rounded-lg flex items-center justify-center transition-colors"
              title="Düzenle"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="text-[10px] bg-red-500 text-white px-1.5 py-1 rounded-md">Evet</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[10px] bg-white/10 text-tv-muted px-1.5 py-1 rounded-md">İptal</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-7 h-7 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center transition-colors"
                title="Sil"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-tv-muted">{videos.length} video</span>
          {activeCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{activeCount} aktif</span>}
          {playlist.loop && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">🔁 Döngü</span>}
          {playlist.shuffle && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">🔀 Karıştır</span>}
        </div>

        {/* Thumbnail mosaic */}
        {videos.length > 0 && (
          <div className="flex gap-1 overflow-hidden rounded-lg">
            {videos.slice(0, 4).map((v) => (
              <div key={v.id} className={cn('aspect-video overflow-hidden bg-black/40 flex-shrink-0', videos.length === 1 ? 'flex-1' : 'w-[calc(25%-3px)]')}>
                <img
                  src={v.thumbnailUrl ?? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt={v.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {videos.length > 4 && (
              <div className="w-[calc(25%-3px)] aspect-video bg-white/5 flex-shrink-0 flex items-center justify-center rounded-sm">
                <span className="text-tv-muted text-xs font-medium">+{videos.length - 4}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onDetail}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-tv-text text-xs font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Yönet
          </button>
          <button
            onClick={onBroadcast}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium text-xs text-white transition-colors"
            style={{ backgroundColor: accent, opacity: videos.length === 0 ? 0.4 : 1 }}
            disabled={videos.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z" /></svg>
            Oynat
          </button>
        </div>
      </div>
    </motion.div>
  );
}
