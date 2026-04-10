'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  muted?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  startSeconds?: number;
  className?: string;
  showOverlay?: boolean;
  onEnded?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTEvent = any;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer({
  videoId,
  title,
  muted = true,
  loop = true,
  autoplay = true,
  startSeconds = 0,
  className = '',
  showOverlay = true,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;

    function initPlayer() {
      if (!mounted || !containerRef.current) return;
      const div = document.createElement('div');
      div.id = `yt-player-${videoId}-${Date.now()}`;
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div.id, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: muted ? 1 : 0,
          loop: loop ? 1 : 0,
          playlist: loop ? videoId : undefined,
          start: startSeconds,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: () => {
            if (!mounted) return;
            setReady(true);
            if (muted) playerRef.current?.mute();
          },
          onStateChange: (e: YTEvent) => {
            const PLAYING = 1;
            const ENDED = 0;
            setIsPlaying(e.data === PLAYING);
            if (e.data === ENDED) {
              onEnded?.();
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      // Load YouTube IFrame API
      if (!document.getElementById('yt-api-script')) {
        const script = document.createElement('script');
        script.id = 'yt-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <style>{`
        #yt-container-${videoId} > div,
        #yt-container-${videoId} iframe {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
      `}</style>
      <div id={`yt-container-${videoId}`} ref={containerRef} className="absolute inset-0" />

      {/* Loading state */}
      {!ready && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin" />
            <p className="text-white/60 text-sm">YouTube yükleniyor…</p>
          </div>
        </div>
      )}

      {/* Overlay with title */}
      {showOverlay && title && ready && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        >
          <div
            className="px-6 py-4"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 pl-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight line-clamp-1">{title}</p>
                <p className="text-white/50 text-xs">YouTube</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* YouTube logo watermark */}
      <div className="absolute top-3 right-3 z-20 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/60 rounded-md px-2 py-1">
          <div className="w-4 h-4 bg-red-600 rounded-sm flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5 pl-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-white text-[10px] font-bold tracking-wide">YouTube</span>
        </div>
      </div>
    </div>
  );
}
