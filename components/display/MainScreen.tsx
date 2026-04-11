'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DisplayData, LivePlaybackSource } from '@/types';
import LayoutManager, { LayoutType } from './LayoutManager';
import type { InstagramPostData } from './InstagramCarousel';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';

const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? '30000', 10);
const AD_INTERVAL = 90_000;

// ─── Screen ID management ─────────────────────────────────────────────────────
function getOrCreateScreenId(urlScreenId: string | null): string {
  if (urlScreenId) {
    localStorage.setItem('screenId', urlScreenId);
    return urlScreenId;
  }
  const stored = localStorage.getItem('screenId');
  if (stored) return stored;
  const newId = `screen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('screenId', newId);
  return newId;
}

interface MainScreenProps {
  screenId?: string | null;
}

export default function MainScreen({ screenId: urlScreenId }: MainScreenProps) {
  const [data, setData] = useState<DisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAd, setShowAd] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [layout, setLayout] = useState<LayoutType>('default');
  const [youtubeQueue, setYoutubeQueue] = useState<Array<{ videoId: string; title?: string }>>([]);
  const [instagramPosts, setInstagramPosts] = useState<InstagramPostData[]>([]);
  const [liveStream, setLiveStream] = useState<LivePlaybackSource | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<{ text: string; color?: string } | null>(null);

  const screenIdRef = useRef<string>('');
  const adTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchTimerRef = useRef<ReturnType<typeof setInterval>>();
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>();
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const wakeLockRef = useRef<any>(null);
  const lastScheduledEventRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('reconnecting');
  const [showControls, setShowControls] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [screenName, setScreenName] = useState('Display');

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as any;
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      } else {
        const d = document as any;
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      }
    } catch {}
  }, []);

  const handleActivity = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // ── Fetch display data ──────────────────────────────────────────────────────
  const fetchDisplay = useCallback(async () => {
    try {
      const res = await fetch('/api/display', { cache: 'no-store' });
      if (res.ok) {
        const json: DisplayData = await res.json();
        setData(json);
        setLoading(false);
      }
    } catch { /* keep showing current */ }
  }, []);

  // ── Fetch Instagram posts ───────────────────────────────────────────────────
  const fetchInstagram = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram?approved=1&limit=20');
      if (res.ok) {
        const json = await res.json();
        setInstagramPosts(json.data ?? []);
      }
    } catch {}
  }, []);

  // ── Fetch YouTube queue ─────────────────────────────────────────────────────
  const fetchYouTube = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube?active=1');
      if (res.ok) {
        const json = await res.json();
        const videos = (json.videos ?? []).map((v: any) => ({
          videoId: v.videoId,
          title: v.title,
        }));
        if (videos.length > 0) setYoutubeQueue(videos);
      }
    } catch {}
  }, []);

  const setStreamPlayback = useCallback((source: LivePlaybackSource) => {
    setLiveStream(source);
    if (source.playbackMode === 'youtube' && source.videoId) {
      setYoutubeQueue([{ videoId: source.videoId, title: source.title }]);
    }
    setLayout('fullscreen');
  }, []);

  const clearScheduledPlayback = useCallback(() => {
    setLiveStream(null);
    setLayout(((data?.settings?.layout as LayoutType | undefined) ?? 'default'));
  }, [data?.settings?.layout]);

  const fetchScheduleState = useCallback(async () => {
    if (!screenIdRef.current) return;
    try {
      const res = await fetch(`/api/schedule/active?screenId=${encodeURIComponent(screenIdRef.current)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const event = json.data;
      const channel = json.channel;

      if (!event) {
        if (lastScheduledEventRef.current) {
          lastScheduledEventRef.current = null;
          clearScheduledPlayback();
        }
        return;
      }

      if (lastScheduledEventRef.current === event.id) return;
      lastScheduledEventRef.current = event.id;

      switch (event.type) {
        case 'layout':
          if (event.layoutType) {
            setLiveStream(null);
            setLayout(event.layoutType as LayoutType);
          }
          break;
        case 'markets':
          setLiveStream(null);
          setLayout('markets');
          break;
        case 'news':
          setLiveStream(null);
          setLayout('news_focus');
          break;
        case 'instagram':
          setLiveStream(null);
          fetchInstagram();
          setLayout('instagram');
          break;
        case 'youtube': {
          const payload = typeof event.payload === 'string' ? JSON.parse(event.payload || '{}') : (event.payload ?? {});
          if (payload.videoId) {
            setLiveStream(null);
            setYoutubeQueue([{ videoId: payload.videoId, title: payload.title ?? event.title }]);
            setLayout('youtube');
          }
          break;
        }
        case 'live_tv':
          if (channel) {
            setStreamPlayback({
              title: channel.title,
              provider: channel.provider,
              playbackMode: channel.playbackMode,
              streamUrl: channel.streamUrl,
              embedUrl: channel.embedUrl,
              videoId: channel.videoId,
              posterUrl: channel.posterUrl,
              logoUrl: channel.logoUrl,
            });
          }
          break;
      }
    } catch {}
  }, [clearScheduledPlayback, fetchInstagram, setStreamPlayback]);

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchDisplay();
    fetchInstagram();
    fetchYouTube();
    fetchScheduleState();

    fetchTimerRef.current = setInterval(() => {
      fetchDisplay();
      fetchInstagram();
      fetchScheduleState();
    }, REFRESH_INTERVAL);

    return () => clearInterval(fetchTimerRef.current);
  }, [fetchDisplay, fetchInstagram, fetchScheduleState, fetchYouTube]);

  // ── Screen registration (one-time, non-blocking) ────────────────────────────
  useEffect(() => {
    const sid = getOrCreateScreenId(urlScreenId ?? null);
    screenIdRef.current = sid;
    setScreenName(localStorage.getItem('screenName') ?? 'Display');
    const screenName = localStorage.getItem('screenName') ?? 'Display';
    const ping = () => fetch(
      `/api/sync?screenId=${encodeURIComponent(sid)}&name=${encodeURIComponent(screenName)}`,
      { method: 'HEAD' },
    ).catch(() => {});
    ping();
    pingTimerRef.current = setInterval(ping, 30_000);
    return () => { clearInterval(pingTimerRef.current); clearTimeout(overlayTimerRef.current); };
  }, [urlScreenId]);

  // ── Firestore realtime listener (primary command channel) ──────────────────
  useEffect(() => {
    if (!db) return;
    const sid = screenIdRef.current || getOrCreateScreenId(urlScreenId ?? null);

    function processCommand(cmd: { type: string; data?: Record<string, unknown>; sentAt?: Timestamp } | undefined, lastRef: { ts: number }) {
      if (!cmd) return;
      const ts = cmd.sentAt?.toMillis() ?? 0;
      if (ts <= lastRef.ts) return;
      lastRef.ts = ts;

      switch (cmd.type) {
        case 'reload': window.location.reload(); break;
        case 'update_content': fetchDisplay(); fetchInstagram(); fetchYouTube(); break;
        case 'play_youtube': {
          const d = cmd.data ?? {};
          if (d.videoId) {
            setLiveStream(null);
            setYoutubeQueue((q) => [{ videoId: d.videoId as string, title: d.title as string }, ...q]);
            setLayout('youtube');
          }
          break;
        }
        case 'play_stream': {
          const d = cmd.data ?? {};
          setStreamPlayback({
            title: String(d.title ?? 'Canlı Yayın'),
            provider: d.provider as LivePlaybackSource['provider'],
            playbackMode: (d.playbackMode as LivePlaybackSource['playbackMode']) ?? 'native',
            streamUrl: d.streamUrl as string | undefined,
            embedUrl: d.embedUrl as string | undefined,
            videoId: d.videoId as string | undefined,
            posterUrl: d.posterUrl as string | undefined,
            logoUrl: d.logoUrl as string | undefined,
          });
          break;
        }
        case 'show_instagram': fetchInstagram(); setLayout('instagram'); break;
        case 'show_ad': setShowAd(true); break;
        case 'change_layout':
          setLiveStream(null);
          if (cmd.data?.layoutType) setLayout(cmd.data.layoutType as LayoutType);
          break;
        case 'fullscreen_video': {
          const d = cmd.data ?? {};
          if (d.videoId) { setYoutubeQueue([{ videoId: d.videoId as string, title: d.title as string }]); setLayout('fullscreen'); }
          break;
        }
        case 'overlay_message': {
          const d = cmd.data ?? {};
          setOverlayMessage({ text: d.text as string, color: d.color as string });
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = setTimeout(() => setOverlayMessage(null), ((d.duration as number) ?? 5) * 1000);
          break;
        }
        case 'clear_overlay': setOverlayMessage(null); break;
      }
    }

    // Only process commands sent AFTER mount — ignore all historical commands
    // (ts:0 was the root cause of the infinite reload loop)
    const bootTs = Date.now() - 2000;
    const screenLastRef = { ts: bootTs };
    const broadcastLastRef = { ts: bootTs };
    let firestoreReady = false;

    const unsubScreen = onSnapshot(doc(db, 'screens', sid), (snap) => {
      if (!firestoreReady) { firestoreReady = true; setConnectionStatus('connected'); }
      if (snap.exists()) processCommand(snap.data()?.lastCommand, screenLastRef);
    }, () => {
      setConnectionStatus((current) => (current === 'connected' ? 'reconnecting' : current));
    });

    const unsubBroadcast = onSnapshot(doc(db, 'broadcast', 'current'), (snap) => {
      if (snap.exists()) processCommand(snap.data()?.lastCommand, broadcastLastRef);
    }, () => {});

    return () => { unsubScreen(); unsubBroadcast(); };
  }, [urlScreenId, fetchDisplay, fetchInstagram, fetchScheduleState, fetchYouTube, setStreamPlayback]);

  // ── Fullscreen change listener ─────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // ── Wake lock (keep screen awake) ────────────────────────────────────────────
  useEffect(() => {
    async function acquire() {
      try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {}
    }
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'i' || e.key === 'I') setShowInfo((v) => !v);
      if (e.key === 'r' || e.key === 'R') window.location.reload();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  // ── Ad cycle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    adTimerRef.current = setTimeout(() => setShowAd(true), AD_INTERVAL);
    return () => clearTimeout(adTimerRef.current);
  }, [adIndex]);

  const handleAdComplete = useCallback(() => {
    setShowAd(false);
    setAdIndex((i) => i + 1);
    if (data?.currentAd) {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ad_complete',
          advertisementId: data.currentAd.id,
          screenId: screenIdRef.current,
          duration: data.currentAd.duration,
        }),
      }).catch(() => {});
    }
  }, [data?.currentAd]);

  const handleYouTubeEnded = useCallback(() => {
    setYoutubeQueue((q) => {
      if (q.length <= 1) return q; // loop single video
      return [...q.slice(1), q[0]]; // rotate
    });
  }, []);

  const settings = data?.settings ?? {};
  const primaryColor = settings.primary_color ?? '#6366f1';
  const secondaryColor = settings.secondary_color ?? '#22d3ee';
  const appName = settings.app_name ?? 'Social TV';

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-tv-bg">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          {/* Animated logo */}
          <div className="relative w-24 h-24 mx-auto">
            <div
              className="absolute inset-0 rounded-2xl animate-pulse"
              style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${secondaryColor}40)` }}
            />
            <div
              className="absolute inset-2 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              <img src="/logo.png" alt="Social Lounge" className="w-full h-full object-contain p-1" />
            </div>
            <div
              className="absolute -inset-1 rounded-3xl opacity-30 blur-lg"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-tv-bg z-0"
      onMouseMove={handleActivity}
      onDoubleClick={toggleFullscreen}
      onTouchStart={handleActivity}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-3xl"
            style={{
              width: `${300 + i * 120}px`,
              height: `${300 + i * 120}px`,
              left: `${[8, 55, 25][i]}%`,
              top: `${[15, 55, 75][i]}%`,
              background: i % 2 === 0 ? primaryColor : secondaryColor,
              opacity: 0.035,
              animation: `float ${10 + i * 3}s ease-in-out ${i * 2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Live indicator badge ── */}
      <div className="absolute top-3.5 left-4 z-30 flex items-center gap-2 px-3 py-1.5"
        style={{
          background: 'rgba(2,8,23,0.72)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '6px',
        }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          connectionStatus === 'connected'
            ? 'bg-emerald-400 animate-pulse'
            : connectionStatus === 'reconnecting'
            ? 'bg-amber-400 animate-ping'
            : 'bg-red-400'
        }`} />
        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
          connectionStatus === 'connected' ? 'text-emerald-400' :
          connectionStatus === 'reconnecting' ? 'text-amber-400' :
          'text-red-400'
        }`}>
          {connectionStatus === 'connected' ? 'LIVE' :
           connectionStatus === 'reconnecting' ? 'BAĞlANİYOR' : 'ÇEVRİMDİŞİ'}
        </span>
        {screenName && connectionStatus === 'connected' && (
          <span className="text-white/25 text-[9px] tracking-wide">· {screenName}</span>
        )}
      </div>

      {/* ── Fullscreen controls (auto-hide) ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 right-3 z-40 flex items-center gap-2"
          >
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
              title={isFullscreen ? 'Tam ekrandan çık (F)' : 'Tam ekran (F)'}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="w-9 h-9 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
              title="Ekran bilgisi (I)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4m0-4h.01" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Screen info panel ── */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute top-14 right-3 z-40 bg-black/80 backdrop-blur-md rounded-2xl p-4 min-w-[220px] border border-white/10 shadow-2xl"
          >
            <div className="space-y-2.5 text-xs">
              <p className="text-white/50 uppercase tracking-wider font-semibold text-[11px]">Ekran Bilgisi</p>
              <div className="h-px bg-white/10" />
              {([
                ['ID', screenIdRef.current ? screenIdRef.current.slice(0, 20) + '…' : '–'],
                ['Ad', screenName || '–'],
                ['Layout', layout],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 items-center">
                  <span className="text-white/40">{label}</span>
                  <span className="text-white/80 font-mono text-[11px] text-right truncate max-w-[130px]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 items-center">
                <span className="text-white/40">Bağlantı</span>
                <span className={`font-medium ${
                  connectionStatus === 'connected' ? 'text-emerald-400' :
                  connectionStatus === 'reconnecting' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {connectionStatus === 'connected' ? '● Bağlı' :
                   connectionStatus === 'reconnecting' ? '● Bağlanıyor…' : '● Bağlantı Yok'}
                </span>
              </div>
              <div className="flex justify-between gap-4 items-center">
                <span className="text-white/40">Tam Ekran</span>
                <span className="text-white/80">{isFullscreen ? 'Evet' : 'Hayır'}</span>
              </div>
              <div className="h-px bg-white/10" />
              <p className="text-white/25 text-[10px] text-center">F · Tam Ekran &nbsp;·&nbsp; I · Bilgi &nbsp;·&nbsp; R · Yenile</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content via LayoutManager ── */}
      <div className="relative z-10 w-full h-full">
        <LayoutManager
          layout={layout}
          data={data!}
          youtubeQueue={youtubeQueue}
          instagramPosts={instagramPosts}
          liveStream={liveStream}
          showAd={showAd}
          overlayMessage={overlayMessage}
          onAdComplete={handleAdComplete}
          onYouTubeEnded={handleYouTubeEnded}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
      </div>
    </div>
  );
}

