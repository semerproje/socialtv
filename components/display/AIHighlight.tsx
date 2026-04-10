'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Content } from '@/types';
import { getPlatformColor, getPlatformIcon, formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface AIHighlightProps {
  content?: Content;
  primaryColor: string;
  secondaryColor: string;
}

export default function AIHighlight({ content, primaryColor, secondaryColor }: AIHighlightProps) {
  const [visible, setVisible] = useState(true);

  // Reset animation when content changes
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [content?.id]);

  if (!content) {
    return (
      <div
        className="glass-dark rounded-2xl h-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}05)`,
          border: `1px solid ${primaryColor}15`,
        }}
      >
        <div className="text-center space-y-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 mx-auto" style={{ color: primaryColor, opacity: 0.3 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
          </svg>
          <p className="text-white/25 text-sm font-light tracking-widest uppercase">İçerik bekleniyor</p>
        </div>
      </div>
    );
  }

  const platformColor = getPlatformColor(content.platform);
  const platformIcon = getPlatformIcon(content.platform);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={content.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative rounded-2xl overflow-hidden h-full"
          style={{
            background: content.mediaUrl
              ? undefined
              : `linear-gradient(135deg, ${primaryColor}12, ${secondaryColor}08, transparent)`,
            border: `1px solid ${primaryColor}20`,
          }}
        >
          {/* Media background */}
          {content.mediaUrl && content.mediaType === 'image' && (
            <>
              <img
                src={content.mediaUrl}
                alt="Featured"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, rgba(3,7,18,0.95) 0%, rgba(3,7,18,0.5) 50%, rgba(3,7,18,0.2) 100%)`,
                }}
              />
            </>
          )}

          {/* AI Badge */}
          {(content.isHighlight || content.isFeatured) && (
            <div className="absolute top-4 left-4 z-10">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}70, ${secondaryColor}50)`,
                  border: `1px solid ${primaryColor}30`,
                  color: '#fff',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                </svg>
                <span>Öne Çıkan</span>
              </div>
            </div>
          )}

          {/* Platform badge */}
          <div className="absolute top-4 right-4 z-10">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{ background: `${platformColor}30`, border: `1px solid ${platformColor}40`, color: platformColor }}
            >
              {platformIcon} {content.platform}
            </div>
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
            {/* Author */}
            <div className="flex items-center gap-3 mb-4">
              {content.authorAvatar ? (
                <img
                  src={content.authorAvatar}
                  alt={content.author}
                  className="w-12 h-12 rounded-full object-cover"
                  style={{ outline: `2px solid ${platformColor}`, outlineOffset: '2px' }}
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    background: `${platformColor}30`,
                    color: platformColor,
                    outline: `2px solid ${platformColor}`,
                    outlineOffset: '2px',
                  }}
                >
                  {content.author?.charAt(0) ?? '?'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-tv-text">{content.author}</h3>
                  {content.isVerified && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: `${platformColor}30`, color: platformColor }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                {content.authorHandle && (
                  <p className="text-sm" style={{ color: platformColor }}>{content.authorHandle}</p>
                )}
              </div>
            </div>

            {/* Text */}
            <p className="text-white text-lg leading-relaxed font-light line-clamp-4 mb-4">
              {content.text}
            </p>

            {/* AI Summary */}
            {content.aiSummary && (
              <div
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 text-sm"
                style={{
                  background: `${primaryColor}12`,
                  border: `1px solid ${primaryColor}20`,
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: primaryColor }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                </svg>
                <p className="text-xs leading-relaxed text-white/50">{content.aiSummary}</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-white/30">
              {content.likes > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/25"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <span className="font-semibold text-white/60">{formatNumber(content.likes)}</span>
                </div>
              )}
              {content.comments > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span className="font-semibold text-white/60">{formatNumber(content.comments)}</span>
                </div>
              )}
              {content.shares > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/25"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  <span className="font-semibold text-white/60">{formatNumber(content.shares)}</span>
                </div>
              )}
              {content.views > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/25"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className="font-semibold text-white/60">{formatNumber(content.views)}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
