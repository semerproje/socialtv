'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { channelToBroadcastPayload } from '@/lib/live-stream-utils';
import type { ChannelHealthCheck, LiveChannel, LivePlaybackMode, LiveProvider } from '@/types';

const PROVIDERS: Array<{ value: LiveProvider; label: string }> = [
  { value: 'bein', label: 'beIN Sports / beIN Connect' },
  { value: 'tabii', label: 'tabii / TRT' },
  { value: 'youtube', label: 'YouTube Live' },
  { value: 'custom', label: 'Özel Yayın Sağlayıcı' },
  { value: 'other', label: 'Diğer' },
];

const PLAYBACK_MODES: Array<{ value: LivePlaybackMode; label: string; hint: string }> = [
  { value: 'native', label: 'Native Stream', hint: 'Yetkili mp4 / m3u8 / tarayıcı destekli stream URL' },
  { value: 'iframe', label: 'Embed / Iframe', hint: 'Sağlayıcının izin verdiği resmi embed URL' },
  { value: 'youtube', label: 'YouTube Live', hint: 'Canlı YouTube video ID' },
];

type FormState = {
  id?: string;
  title: string;
  provider: LiveProvider;
  category: string;
  description: string;
  playbackMode: LivePlaybackMode;
  streamUrl: string;
  embedUrl: string;
  videoId: string;
  logoUrl: string;
  posterUrl: string;
  rightsNote: string;
  tags: string;
  requiresAuth: boolean;
  isActive: boolean;
};

const INITIAL_FORM: FormState = {
  title: '',
  provider: 'bein',
  category: 'Mac Yayini',
  description: '',
  playbackMode: 'iframe',
  streamUrl: '',
  embedUrl: '',
  videoId: '',
  logoUrl: '',
  posterUrl: '',
  rightsNote: '',
  tags: '',
  requiresAuth: true,
  isActive: true,
};

function providerTone(provider: LiveProvider): string {
  const tones: Record<LiveProvider, string> = {
    bein: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    tabii: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    youtube: 'bg-red-500/15 text-red-300 border-red-500/30',
    custom: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    other: 'bg-white/10 text-white/70 border-white/15',
  };
  return tones[provider] ?? tones.other;
}

export default function TvPage() {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, ChannelHealthCheck>>({});
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tv-channels', { cache: 'no-store' });
      const data = await res.json();
      setChannels(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => setForm(INITIAL_FORM);

  const editChannel = (channel: LiveChannel) => {
    setForm({
      id: channel.id,
      title: channel.title,
      provider: channel.provider,
      category: channel.category ?? '',
      description: channel.description ?? '',
      playbackMode: channel.playbackMode,
      streamUrl: channel.streamUrl ?? '',
      embedUrl: channel.embedUrl ?? '',
      videoId: channel.videoId ?? '',
      logoUrl: channel.logoUrl ?? '',
      posterUrl: channel.posterUrl ?? '',
      rightsNote: channel.rightsNote ?? '',
      tags: Array.isArray(channel.tags) ? channel.tags.join(', ') : channel.tags ?? '',
      requiresAuth: Boolean(channel.requiresAuth),
      isActive: channel.isActive,
    });
  };

  const saveChannel = async () => {
    if (!form.title.trim()) {
      toast.error('Kanal adı gerekli');
      return;
    }
    if (form.playbackMode === 'native' && !form.streamUrl.trim()) {
      toast.error('Native yayın için stream URL gerekli');
      return;
    }
    if (form.playbackMode === 'iframe' && !form.embedUrl.trim()) {
      toast.error('Iframe yayın için embed URL gerekli');
      return;
    }
    if (form.playbackMode === 'youtube' && !form.videoId.trim()) {
      toast.error('YouTube canlı yayın için video ID gerekli');
      return;
    }

    setSaving(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `/api/tv-channels/${form.id}` : '/api/tv-channels';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Kaydedilemedi');
      }
      toast.success(form.id ? 'Yayın kaynağı güncellendi' : 'Yayın kaynağı eklendi');
      resetForm();
      fetchChannels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const deleteChannel = async (id: string) => {
    if (!confirm('Bu yayın kaynağını silmek istiyor musunuz?')) return;
    const res = await fetch(`/api/tv-channels/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Yayın kaynağı silindi');
      if (form.id === id) resetForm();
      fetchChannels();
    } else {
      toast.error('Silinemedi');
    }
  };

  const broadcastChannel = async (channel: LiveChannel) => {
    setBroadcastingId(channel.id);
    try {
      const res = await fetch('/api/sync/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'play_stream', data: channelToBroadcastPayload(channel) }),
      });
      if (!res.ok) throw new Error('Yayın gönderilemedi');
      toast.success(`${channel.title} tüm ekranlara gönderildi`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yayın gönderilemedi');
    } finally {
      setBroadcastingId(null);
    }
  };

  const checkChannelHealth = async (channel: LiveChannel) => {
    setCheckingId(channel.id);
    try {
      const res = await fetch(`/api/tv-channels/${channel.id}/health`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Sağlık testi başarısız');
      setHealthMap((prev) => ({ ...prev, [channel.id]: data.data }));
      const state = data.data.state as ChannelHealthCheck['state'];
      if (state === 'healthy') toast.success(`${channel.title} erişilebilir görünüyor`);
      else if (state === 'auth-required') toast(`Yetkili oturum gerekiyor: ${channel.title}`);
      else toast.error(`${channel.title}: ${data.data.message}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sağlık testi başarısız');
    } finally {
      setCheckingId(null);
    }
  };

  const healthTone = (state?: ChannelHealthCheck['state']) => {
    if (state === 'healthy') return 'badge-success';
    if (state === 'auth-required') return 'badge-warning';
    if (state === 'degraded') return 'badge-warning';
    if (state === 'unreachable') return 'badge-danger';
    return 'badge-muted';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            TV Yayın Yönetimi
          </h1>
          <p className="text-tv-muted text-sm mt-1 max-w-3xl">
            beIN, tabii ve diğer sağlayıcılar için sadece resmi embed veya lisanslı stream URL tanımlayın. DRM korumalı akışlar için sağlayıcının verdiği oynatılabilir web embed adresi kullanılmalı.
          </p>
        </div>
        <div className="admin-card px-4 py-3 min-w-[240px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Akıllı Yayın Hazırlığı</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/25">Aktif Kanal</p>
              <p className="text-white font-semibold">{channels.filter((item) => item.isActive).length}</p>
            </div>
            <div>
              <p className="text-white/25">Yetkili Embed</p>
              <p className="text-white font-semibold">{channels.filter((item) => item.playbackMode === 'iframe').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="admin-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">{form.id ? 'Yayın Kaynağını Düzenle' : 'Yeni Yayın Kaynağı'}</h2>
            {form.id && (
              <button onClick={resetForm} className="btn-secondary text-xs">
                Yeni Form
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Kanal / Yayın Adı</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input w-full" placeholder="beIN Sports 1 - Derbi Günü" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sağlayıcı</label>
                <select value={form.provider} onChange={(e) => set('provider', e.target.value as LiveProvider)} className="input w-full">
                  {PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kategori</label>
                <input value={form.category} onChange={(e) => set('category', e.target.value)} className="input w-full" placeholder="Maç, Haber, Özet" />
              </div>
            </div>

            <div>
              <label className="label">Oynatma Türü</label>
              <div className="grid gap-2">
                {PLAYBACK_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => set('playbackMode', mode.value)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all',
                      form.playbackMode === mode.value ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    )}
                  >
                    <p className="text-sm font-medium text-white">{mode.label}</p>
                    <p className="text-xs text-white/35 mt-1">{mode.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.playbackMode === 'native' && (
              <div>
                <label className="label">Stream URL</label>
                <input value={form.streamUrl} onChange={(e) => set('streamUrl', e.target.value)} className="input w-full" placeholder="https://.../live.m3u8" />
              </div>
            )}

            {form.playbackMode === 'iframe' && (
              <div>
                <label className="label">Embed URL</label>
                <input value={form.embedUrl} onChange={(e) => set('embedUrl', e.target.value)} className="input w-full" placeholder="https://provider.example.com/embed/..." />
              </div>
            )}

            {form.playbackMode === 'youtube' && (
              <div>
                <label className="label">YouTube Video ID</label>
                <input value={form.videoId} onChange={(e) => set('videoId', e.target.value)} className="input w-full" placeholder="abc123def45" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Logo URL</label>
                <input value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} className="input w-full" placeholder="https://.../logo.png" />
              </div>
              <div>
                <label className="label">Poster URL</label>
                <input value={form.posterUrl} onChange={(e) => set('posterUrl', e.target.value)} className="input w-full" placeholder="https://.../cover.jpg" />
              </div>
            </div>

            <div>
              <label className="label">Açıklama</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className="input w-full resize-none" placeholder="Örn: Süper Lig haftalık maç yayını" />
            </div>

            <div>
              <label className="label">Lisans / Hak Notu</label>
              <textarea value={form.rightsNote} onChange={(e) => set('rightsNote', e.target.value)} rows={2} className="input w-full resize-none" placeholder="Yalnızca kurum hesabı üzerinden erişilebilir embed bağlantısı" />
            </div>

            <div>
              <label className="label">Etiketler</label>
              <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="input w-full" placeholder="mac, derbi, super-lig" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-white/70">
                <input type="checkbox" checked={form.requiresAuth} onChange={(e) => set('requiresAuth', e.target.checked)} />
                Yetkili giriş gerekiyor
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-white/70">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                Aktif kaynak
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={saveChannel} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Kaydediliyor…' : form.id ? 'Güncelle' : 'Kaydet'}
            </button>
            <button onClick={resetForm} className="btn-secondary">Temizle</button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading && [...Array(3)].map((_, i) => (
              <div key={i} className="admin-card h-56 animate-pulse" />
            ))}

            {!loading && channels.map((channel) => (
              <motion.div key={channel.id} layout className="admin-card p-4 flex flex-col gap-3">
                {healthMap[channel.id] && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className={cn('badge text-[10px]', healthTone(healthMap[channel.id].state))}>{healthMap[channel.id].state}</span>
                    <span className="text-[11px] text-white/35 truncate">{healthMap[channel.id].message}</span>
                    <span className="text-[10px] text-white/25 whitespace-nowrap">{healthMap[channel.id].latencyMs}ms</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{channel.title}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('badge text-[10px] border', providerTone(channel.provider))}>{channel.provider}</span>
                      <span className="badge badge-muted text-[10px]">{channel.playbackMode}</span>
                      {!channel.isActive && <span className="badge badge-danger text-[10px]">Pasif</span>}
                    </div>
                  </div>
                  {channel.logoUrl && <img src={channel.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/5" />}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45 min-h-[74px]">
                  <p>{channel.description || 'Açıklama girilmemiş.'}</p>
                  {channel.rightsNote && <p className="mt-2 text-amber-300/70">Hak Notu: {channel.rightsNote}</p>}
                </div>

                <div className="space-y-1 text-[11px] text-white/40">
                  {channel.streamUrl && <p className="truncate">Stream: {channel.streamUrl}</p>}
                  {channel.embedUrl && <p className="truncate">Embed: {channel.embedUrl}</p>}
                  {channel.videoId && <p className="truncate">YouTube ID: {channel.videoId}</p>}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button onClick={() => editChannel(channel)} className="btn-secondary text-sm">Düzenle</button>
                  <button onClick={() => broadcastChannel(channel)} disabled={broadcastingId === channel.id || !channel.isActive} className="btn-primary text-sm">
                    {broadcastingId === channel.id ? 'Gönderiliyor…' : 'Yayınla'}
                  </button>
                  <button onClick={() => checkChannelHealth(channel)} disabled={checkingId === channel.id} className="btn-secondary text-sm">
                    {checkingId === channel.id ? 'Test Ediliyor…' : 'Sağlık Testi'}
                  </button>
                  <button onClick={() => deleteChannel(channel.id)} className="btn-secondary text-sm text-red-300 border-red-500/20 hover:border-red-500/40">
                    Sil
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/tv-channels/${channel.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isActive: !channel.isActive }),
                      });
                      if (res.ok) {
                        toast.success(channel.isActive ? 'Kaynak pasifleştirildi' : 'Kaynak aktifleştirildi');
                        fetchChannels();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        toast.error(data.error ?? 'Güncellenemedi');
                      }
                    }}
                    className="btn-secondary text-sm"
                  >
                    {channel.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {!loading && channels.length === 0 && (
            <div className="admin-card py-16 text-center">
              <p className="text-4xl mb-4">📡</p>
              <p className="text-white font-medium">Henüz yayın kaynağı eklenmedi</p>
              <p className="text-white/35 text-sm mt-2">İlk resmi embed veya lisanslı akış kaynağınızı soldaki formdan ekleyin.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}