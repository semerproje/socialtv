'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlaylistItem, PlaylistTransition } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlaylistData {
  id: string;
  name: string;
  loop: boolean;
  shuffle: boolean;
  transition: PlaylistTransition;
  defaultDuration: number;
  items: PlaylistItem[];
}

interface PlaylistPlayerProps {
  playlistId: string;
  playlistName: string;
  primaryColor: string;
  secondaryColor: string;
  onLayoutChange: (layoutType: string) => void;
  onStop: () => void;
}

// ─── Transition variants ────────────────────────────────────────────────────────

type MotionProps = { initial: Record<string, unknown>; animate: Record<string, unknown>; exit: Record<string, unknown>; transition: Record<string, unknown> };

const TRANSITION_VARIANTS: Record<PlaylistTransition, MotionProps> = {
  fade: {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    exit:       { opacity: 0 },
    transition: { duration: 0.6 },
  },
  slide_left: {
    initial:    { x: '100%', opacity: 0 },
    animate:    { x: 0, opacity: 1 },
    exit:       { x: '-100%', opacity: 0 },
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
  slide_up: {
    initial:    { y: '100%', opacity: 0 },
    animate:    { y: 0, opacity: 1 },
    exit:       { y: '-100%', opacity: 0 },
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
  zoom: {
    initial:    { scale: 1.12, opacity: 0 },
    animate:    { scale: 1, opacity: 1 },
    exit:       { scale: 0.9, opacity: 0 },
    transition: { duration: 0.55, ease: 'easeOut' },
  },
  blur: {
    initial:    { filter: 'blur(18px)', opacity: 0 },
    animate:    { filter: 'blur(0px)', opacity: 1 },
    exit:       { filter: 'blur(18px)', opacity: 0 },
    transition: { duration: 0.5 },
  },
  none: {
    initial:    { opacity: 1 },
    animate:    { opacity: 1 },
    exit:       { opacity: 1 },
    transition: { duration: 0 },
  },
};

// ─── Item renderers ─────────────────────────────────────────────────────────────

function ImageItem({ item }: { item: PlaylistItem }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.mediaUrl!}
        alt={item.title ?? ''}
        className="w-full h-full object-contain"
        style={{ background: '#000' }}
      />
      {item.title && (
        <div className="absolute bottom-0 left-0 right-0 px-10 py-6"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
          <p className="text-white text-2xl font-semibold tracking-wide">{item.title}</p>
        </div>
      )}
    </div>
  );
}

function VideoItem({ item, onEnded }: { item: PlaylistItem; onEnded: () => void }) {
  return (
    <div className="absolute inset-0 bg-black">
      <video
        key={item.id}
        src={item.mediaUrl!}
        className="w-full h-full object-contain"
        autoPlay
        muted
        playsInline
        loop={item.duration === 0}
        onEnded={item.duration === 0 ? undefined : onEnded}
      />
      {item.title && (
        <div className="absolute bottom-0 left-0 right-0 px-10 py-6"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
          <p className="text-white text-2xl font-semibold">{item.title}</p>
        </div>
      )}
    </div>
  );
}

function YouTubeItem({ item, onEnded }: { item: PlaylistItem; onEnded: () => void }) {
  const autoEnded = item.duration === 0;
  return (
    <div className="absolute inset-0 bg-black">
      <iframe
        key={item.id}
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${item.youtubeVideoId}?autoplay=1&mute=0&rel=0&modestbranding=1&enablejsapi=1${autoEnded ? '&loop=1' : ''}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {item.duration > 0 && (
        <iframe
          className="hidden"
          // Dummy: duration-based advance is handled by the timer in PlaylistPlayer
          onLoad={() => {}}
          src=""
        />
      )}
      {item.title && (
        <div className="absolute top-4 left-4 right-4 flex items-center gap-3 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.64)', backdropFilter: 'blur(12px)' }}>
          <span className="text-red-500 text-sm font-bold">▶</span>
          <p className="text-white text-sm font-medium truncate">{item.title}</p>
        </div>
      )}
    </div>
  );
}

function AnnouncementItem({ item, primaryColor }: { item: PlaylistItem; primaryColor: string }) {
  let announcementText = item.title ?? '';
  try {
    if (item.payload) {
      const parsed = JSON.parse(item.payload);
      announcementText = parsed.text ?? announcementText;
    }
  } catch {}

  const bgColor = (() => {
    try { if (item.payload) { const p = JSON.parse(item.payload); return p.bgColor ?? null; } } catch {}
    return null;
  })();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-16"
      style={{
        background: bgColor ?? `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}99)`,
      }}
    >
      <div className="text-center max-w-4xl">
        <div className="w-16 h-1.5 rounded-full bg-white/40 mx-auto mb-8" />
        <p className="text-white text-5xl font-bold leading-tight tracking-wide">
          {announcementText}
        </p>
        <div className="w-16 h-1.5 rounded-full bg-white/40 mx-auto mt-8" />
      </div>
    </div>
  );
}

function UrlItem({ item }: { item: PlaylistItem }) {
  return (
    <div className="absolute inset-0 bg-white">
      <iframe
        key={item.id}
        src={item.mediaUrl!}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms"
        title={item.title ?? 'Web sayfası'}
      />
    </div>
  );
}

function MediaFallbackItem({ item, primaryColor }: { item: PlaylistItem; primaryColor: string }) {
  const typeLabels: Record<string, string> = {
    content: '💬 Sosyal İçerik', instagram: '📸 Instagram', ad: '📺 Reklam', scene: '🎭 Sahne', layout: '⊞ Layout',
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: `linear-gradient(135deg, ${primaryColor}15, rgba(6,12,24,0.97))` }}>
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
      ) : null}
      <div className="z-10 text-center">
        <p className="text-6xl mb-4">{typeLabels[item.type]?.split(' ')[0] ?? '📄'}</p>
        <p className="text-white/60 text-lg">{typeLabels[item.type]?.split(' ').slice(1).join(' ') ?? item.type}</p>
        {item.title && <p className="text-white/80 text-2xl font-semibold mt-3">{item.title}</p>}
      </div>
    </div>
  );
}

// ─── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ duration, color }: { duration: number; color: string }) {
  if (!duration) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-30">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration, ease: 'linear' }}
      />
    </div>
  );
}

// ─── Now Playing badge ──────────────────────────────────────────────────────────

function NowPlayingBadge({
  playlistName, currentIdx, total, itemTitle, color,
}: {
  playlistName: string; currentIdx: number; total: number; itemTitle?: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: color }} />
      <span className="text-white/50 text-[10px] font-medium uppercase tracking-wider">▶ Playlist</span>
      <span className="text-white/25 text-[10px]">·</span>
      <span className="text-white/70 text-[10px]">{playlistName}</span>
      <span className="text-white/25 text-[10px]">·</span>
      <span className="text-white/40 text-[10px] font-mono">{currentIdx + 1}/{total}</span>
      {itemTitle && (
        <>
          <span className="text-white/15 text-[10px]">·</span>
          <span className="text-white/50 text-[10px] truncate max-w-[120px]">{itemTitle}</span>
        </>
      )}
    </motion.div>
  );
}

// ─── Main PlaylistPlayer component ─────────────────────────────────────────────

export default function PlaylistPlayer({
  playlistId,
  playlistName,
  primaryColor,
  secondaryColor,
  onLayoutChange,
  onStop,
}: PlaylistPlayerProps) {
  const [playlist, setPlaylist]       = useState<PlaylistData | null>(null);
  const [items, setItems]             = useState<PlaylistItem[]>([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [loaded, setLoaded]           = useState(false);

  const timerRef    = useRef<ReturnType<typeof setTimeout>>();
  const itemsRef    = useRef<PlaylistItem[]>([]);
  const loopRef     = useRef(true);
  const idxRef      = useRef(0);

  // Keep refs in sync
  itemsRef.current = items;
  idxRef.current   = currentIdx;
  loopRef.current  = playlist?.loop ?? true;

  // ── Advance to next item ───────────────────────────────────────────────────

  const advance = useCallback(() => {
    const its  = itemsRef.current;
    const next = idxRef.current + 1;
    if (next >= its.length) {
      if (loopRef.current) {
        setCurrentIdx(0);
      } else {
        onStop();
      }
    } else {
      setCurrentIdx(next);
    }
  }, [onStop]);

  // ── Schedule advance timer ────────────────────────────────────────────────

  const scheduleAdvance = useCallback((item: PlaylistItem, defaultDuration: number) => {
    clearTimeout(timerRef.current);
    const dur = item.duration > 0 ? item.duration : defaultDuration;
    // layout type changes immediately after brief show
    const effectiveDur = (item.type === 'layout' ? 1.2 : dur) * 1000;
    if (effectiveDur > 0) {
      timerRef.current = setTimeout(advance, effectiveDur);
    }
  }, [advance]);

  // ── Fetch playlist ────────────────────────────────────────────────────────

  useEffect(() => {
    setLoaded(false);
    setError(null);
    fetch(`/api/display/playlist/${playlistId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Unknown error');
        const data: PlaylistData = json.data;
        let its = [...data.items];
        if (data.shuffle) {
          // Fisher-Yates shuffle
          for (let i = its.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [its[i], its[j]] = [its[j], its[i]];
          }
        }
        setPlaylist(data);
        setItems(its);
        setCurrentIdx(0);
        setLoaded(true);
      })
      .catch((err) => {
        console.error('[PlaylistPlayer] fetch error', err);
        setError('Playlist yüklenemedi');
      });
    return () => clearTimeout(timerRef.current);
  }, [playlistId]);

  // ── Start timer when item changes ─────────────────────────────────────────

  useEffect(() => {
    if (!loaded || !playlist || items.length === 0) return;
    const item = items[currentIdx];
    if (!item) return;

    // Layout items: trigger layout change on underlying screen
    if (item.type === 'layout' && item.layoutType) {
      onLayoutChange(item.layoutType);
    }

    // For youtube/video with duration=0, don't set a timer — wait for media ended
    if ((item.type === 'youtube' || item.type === 'video') && item.duration === 0) {
      return; // advance triggered by onEnded callback
    }

    scheduleAdvance(item, playlist.defaultDuration);

    return () => clearTimeout(timerRef.current);
  }, [currentIdx, loaded, items, playlist, scheduleAdvance, onLayoutChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060c18]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-white/30 text-sm">{error ?? 'Playlist yükleniyor…'}</p>
        {error && (
          <button onClick={onStop}
            className="mt-6 px-5 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors">
            Kapat
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060c18]">
        <p className="text-white/30 text-lg">Bu playlist henüz boş</p>
      </div>
    );
  }

  const currentItem  = items[currentIdx];
  const transitionKey = currentItem?.transition ?? playlist?.transition ?? 'fade';
  const variants     = TRANSITION_VARIANTS[transitionKey as PlaylistTransition] ?? TRANSITION_VARIANTS.fade;
  const effectiveDur = currentItem.duration > 0 ? currentItem.duration : playlist!.defaultDuration;

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-black">
      {/* Item renderer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentItem.id}-${currentIdx}`}
          className="absolute inset-0"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={variants.initial as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          animate={variants.animate as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exit={variants.exit as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transition={variants.transition as any}
        >
          {currentItem.type === 'image' && (
            <ImageItem item={currentItem} />
          )}
          {currentItem.type === 'video' && (
            <VideoItem item={currentItem} onEnded={advance} />
          )}
          {currentItem.type === 'youtube' && (
            <YouTubeItem item={currentItem} onEnded={advance} />
          )}
          {currentItem.type === 'announcement' && (
            <AnnouncementItem item={currentItem} primaryColor={primaryColor} />
          )}
          {currentItem.type === 'url' && (
            <UrlItem item={currentItem} />
          )}
          {['content', 'instagram', 'ad', 'scene', 'layout'].includes(currentItem.type) && (
            <MediaFallbackItem item={currentItem} primaryColor={primaryColor} />
          )}

          <ProgressBar
            duration={currentItem.type === 'youtube' || currentItem.type === 'video' ? 0 : effectiveDur}
            color={primaryColor}
          />
        </motion.div>
      </AnimatePresence>

      {/* Now Playing badge */}
      <NowPlayingBadge
        playlistName={playlistName}
        currentIdx={currentIdx}
        total={items.length}
        itemTitle={currentItem.title}
        color={primaryColor}
      />

      {/* Stop button (touch/mouse double-tap corner) */}
      <button
        onDoubleClick={onStop}
        className="absolute bottom-4 left-4 z-30 w-8 h-8 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
        title="Playlist'i durdur (çift tıkla)"
        aria-label="Stop playlist"
      />
    </div>
  );
}
