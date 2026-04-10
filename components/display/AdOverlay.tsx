'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Advertisement, TextAdContent } from '@/types';

interface AdOverlayProps {
  ad: Advertisement;
  onComplete: () => void;
  primaryColor?: string;
}

export default function AdOverlay({ ad, onComplete, primaryColor = '#6366f1' }: AdOverlayProps) {
  const [remaining, setRemaining] = useState(ad.duration);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Log impression
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ad_impression', advertisementId: ad.id }),
    }).catch(() => {});

    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          onComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [ad.id, ad.duration, onComplete]);

  const progress = ((ad.duration - remaining) / ad.duration) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tv-bg/95 backdrop-blur-sm" />

      {/* Ad Content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {ad.type === 'image' ? (
          <ImageAd ad={ad} />
        ) : ad.type === 'video' ? (
          <VideoAd ad={ad} onComplete={onComplete} />
        ) : ad.type === 'html' ? (
          <HtmlAd ad={ad} />
        ) : (
          <TextAd ad={ad} primaryColor={primaryColor} />
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="h-1.5 bg-white/10">
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${primaryColor}, #22d3ee)` }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="absolute bottom-3 right-4 text-xs text-tv-muted font-mono">
          {remaining}s
        </div>
      </div>

      {/* Skip hint */}
      <div className="absolute top-4 right-4 z-20">
        <div className="glass px-3 py-1.5 rounded-full text-xs text-tv-muted flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest">REKLAM</span>
          <span className="w-px h-3 bg-tv-muted/40" />
          <span>{remaining}s</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Image Ad ─────────────────────────────────────────────────────────────────
function ImageAd({ ad }: { ad: Advertisement }) {
  return (
    <motion.div
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full h-full"
    >
      <img
        src={ad.content}
        alt={ad.title}
        className="w-full h-full object-contain"
      />
      {ad.title && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="glass px-6 py-3 rounded-2xl text-center">
            <p className="text-lg font-bold text-tv-text">{ad.title}</p>
            {ad.description && <p className="text-sm text-tv-muted mt-1">{ad.description}</p>}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Video Ad ─────────────────────────────────────────────────────────────────
function VideoAd({ ad, onComplete }: { ad: Advertisement; onComplete: () => void }) {
  return (
    <video
      src={ad.content}
      className="w-full h-full object-contain"
      autoPlay
      muted
      playsInline
      onEnded={onComplete}
    />
  );
}

// ─── HTML Ad ──────────────────────────────────────────────────────────────────
function HtmlAd({ ad }: { ad: Advertisement }) {
  return (
    <div
      className="w-full h-full"
      dangerouslySetInnerHTML={{ __html: ad.content }}
    />
  );
}

// ─── Text Ad ──────────────────────────────────────────────────────────────────
function TextAd({ ad, primaryColor }: { ad: Advertisement; primaryColor: string }) {
  let content: TextAdContent;
  try {
    content = JSON.parse(ad.content) as TextAdContent;
  } catch {
    content = { headline: ad.title, body: ad.description };
  }

  const bg = ad.backgroundColor ?? '#0f172a';
  const accent = ad.accentColor ?? primaryColor;
  const textColor = ad.textColor ?? '#ffffff';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center w-full h-full px-20 py-12"
      style={{ background: `radial-gradient(ellipse at center, ${accent}15 0%, transparent 70%)` }}
    >
      {/* Badge */}
      {content.badge && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8"
        >
          <div
            className="inline-block px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}80)`,
              color: '#fff',
              boxShadow: `0 0 30px ${accent}50`,
            }}
          >
            {content.badge}
          </div>
        </motion.div>
      )}

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-black uppercase tracking-wider leading-none mb-4"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(3rem, 8vw, 6rem)',
          background: `linear-gradient(135deg, ${textColor}, ${accent})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none',
        }}
      >
        {content.headline}
      </motion.h1>

      {/* Subheadline */}
      {content.subheadline && (
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-light mb-6"
          style={{ color: `${textColor}90` }}
        >
          {content.subheadline}
        </motion.h2>
      )}

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="h-0.5 w-32 mb-8 rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      {/* Body */}
      {content.body && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-2xl font-light leading-relaxed mb-10 max-w-2xl whitespace-pre-line"
          style={{ color: `${textColor}80` }}
        >
          {content.body}
        </motion.p>
      )}

      {/* CTA */}
      {content.cta && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
        >
          <div
            className="px-12 py-5 rounded-2xl text-xl font-bold"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}80)`,
              color: '#fff',
              boxShadow: `0 0 40px ${accent}40, 0 0 80px ${accent}20`,
            }}
          >
            {content.cta}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
