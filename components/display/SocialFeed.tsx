'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Content } from '@/types';
import { getPlatformColor, getPlatformIcon, formatNumber, formatRelative } from '@/lib/utils';

interface SocialFeedProps {
  content: Content[];
  compact?: boolean;
  sidebar?: boolean;
}

export default function SocialFeed({ content, compact, sidebar }: SocialFeedProps) {
  if (!content || content.length === 0) {
    return (
      <div className="glass-dark rounded-2xl p-4 flex items-center justify-center h-full min-h-[80px]">
        <p className="text-tv-muted text-sm">İçerik bekleniyor…</p>
      </div>
    );
  }

  if (sidebar) {
    return (
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        <AnimatePresence mode="popLayout">
          {content.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.08 }}
              className="glass-dark rounded-xl p-4 flex-1 min-h-0 overflow-hidden"
            >
              <SidebarCard post={post} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {content.slice(0, 3).map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-dark rounded-xl p-4"
          >
            <CompactCard post={post} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {content.slice(0, 4).map((post, i) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="glass-dark rounded-2xl overflow-hidden"
        >
          <FullCard post={post} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Sidebar Card ──────────────────────────────────────────────────────────────
function SidebarCard({ post }: { post: Content }) {
  const platformColor = getPlatformColor(post.platform);
  const platformIcon = getPlatformIcon(post.platform);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {post.authorAvatar ? (
          <img
            src={post.authorAvatar}
            alt={post.author}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: `${platformColor}30`, color: platformColor }}
          >
            {post.author.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-tv-text truncate max-w-[90px]">{post.author}</p>
            {post.isVerified && <span className="text-[10px]">✓</span>}
          </div>
          <p className="text-[10px]" style={{ color: platformColor }}>{platformIcon} {post.platform}</p>
        </div>
      </div>

      <p className="text-xs text-tv-text/80 leading-relaxed line-clamp-3 flex-1">{post.text}</p>

      <div className="flex items-center gap-3 text-[10px] text-white/30">
        {post.likes > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/25"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {formatNumber(post.likes)}
          </span>
        )}
        {post.comments > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-white/25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {formatNumber(post.comments)}
          </span>
        )}
        {post.views > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-white/25"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {formatNumber(post.views)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Compact Card ──────────────────────────────────────────────────────────────
function CompactCard({ post }: { post: Content }) {
  const platformColor = getPlatformColor(post.platform);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {post.authorAvatar ? (
          <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: `${platformColor}30`, color: platformColor }}
          >
            {post.author.charAt(0)}
          </div>
        )}
        <span className="text-xs font-medium text-tv-text truncate">{post.author}</span>
      </div>
      <p className="text-xs text-tv-text/80 line-clamp-2 leading-relaxed">{post.text}</p>
      <div className="flex gap-3 text-[10px] text-white/30">
        {post.likes > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {formatNumber(post.likes)}
          </span>
        )}
        {post.comments > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-white/20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {formatNumber(post.comments)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Full Card ─────────────────────────────────────────────────────────────────
function FullCard({ post }: { post: Content }) {
  const platformColor = getPlatformColor(post.platform);
  const platformIcon = getPlatformIcon(post.platform);

  return (
    <div className="flex flex-col h-full">
      {post.mediaUrl && post.mediaType === 'image' && (
        <div className="relative h-32 flex-shrink-0 overflow-hidden">
          <img
            src={post.mediaUrl}
            alt="Post media"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-tv-card/80" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-center gap-2">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: `${platformColor}30`, color: platformColor }}
            >
              {post.author.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold text-tv-text">{post.author}</p>
              {post.isVerified && (
                <span className="text-xs px-1 rounded-full" style={{ color: platformColor }}>✓</span>
              )}
            </div>
            <p className="text-xs" style={{ color: platformColor }}>
              {platformIcon} {post.authorHandle ?? post.platform}
            </p>
          </div>
        </div>
        <p className="text-sm text-tv-text/90 leading-relaxed line-clamp-3 flex-1">{post.text}</p>
        <div className="flex items-center gap-5 text-xs text-white/30 pt-2 border-t border-white/5">
          {post.likes > 0 && (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white/25"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span className="font-medium text-white/50">{formatNumber(post.likes)}</span>
            </div>
          )}
          {post.comments > 0 && (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-white/25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span className="font-medium text-white/50">{formatNumber(post.comments)}</span>
            </div>
          )}
          {post.shares > 0 && (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-white/25"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span className="font-medium text-white/50">{formatNumber(post.shares)}</span>
            </div>
          )}
          {post.views > 0 && (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-white/25"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="font-medium text-white/50">{formatNumber(post.views)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
