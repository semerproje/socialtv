'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  showControls?: boolean;
  onEnded?: () => void;
}

export default function VideoPlayer({
  src,
  title,
  poster,
  autoPlay = true,
  muted = true,
  loop = false,
  className = '',
  showControls = false,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    setStreamError(null);

    if (src.endsWith('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!hls) return;
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              setStreamError('Yayın bağlantısı yeniden kuruluyor');
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              setStreamError('Yayın akışı toparlanıyor');
            } else {
              setStreamError('Yayın açılamadı');
              hls.destroy();
              hls = null;
            }
          }
        });
      } else {
        setStreamError('Bu tarayıcı HLS yayını desteklemiyor');
      }
    } else {
      video.src = src;
    }

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded_ = () => { setPlaying(false); onEnded?.(); };
    const onTimeUpdate = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    const onLoadedMetadata = () => setDuration(video.duration);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration);
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded_);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('progress', onProgress);

    return () => {
      hls?.destroy();
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded_);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('progress', onProgress);
    };
  }, [onEnded, src]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden group ${className}`}>
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        controls={showControls}
        className="w-full h-full object-cover"
      />

      {streamError && (
        <div className="absolute inset-x-4 top-4 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-3 backdrop-blur-md">
          <p className="text-amber-200 text-sm font-medium">{streamError}</p>
        </div>
      )}

      {/* Title overlay */}
      {title && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        >
          <div className="px-5 py-4">
            <p className="text-white font-semibold text-base line-clamp-1">{title}</p>
          </div>
        </motion.div>
      )}

      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${buffered * 100}%` }} />
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-cyan-400"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Duration badge */}
      {duration > 0 && (
        <div className="absolute top-3 right-3 bg-black/60 rounded-md px-2 py-0.5">
          <span className="text-white text-xs font-mono">
            {formatTime(progress * duration)} / {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
