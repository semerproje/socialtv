'use client';

import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getDisplaySafeMediaUrl } from '@/lib/utils';

export interface InstagramPostData {
  id: string;
  username: string;
  displayName?: string;
  profilePicUrl?: string;
  mediaUrl: string;
  mediaType: string;
  thumbnailUrl?: string;
  caption?: string;
  permalink?: string;
  likeCount: number;
  commentCount: number;
  postedAt: string | Date;
}

interface InstagramCarouselProps {
  posts: InstagramPostData[];
  autoSlide?: boolean;
  slideDuration?: number;
  className?: string;
}

function HeartIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CommentIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 6.5C21 5.12 19.88 4 18.5 4h-13C4.12 4 3 5.12 3 6.5v8C3 15.88 4.12 17 5.5 17H17l4 4V6.5z" />
    </svg>
  );
}

function InstagramIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function InstagramCarousel({
  posts,
  autoSlide = true,
  slideDuration = 8000,
  className = '',
}: InstagramCarouselProps) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!autoSlide || posts.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((i) => (i + 1) % posts.length);
    }, slideDuration);
    return () => clearInterval(timerRef.current);
  }, [autoSlide, posts.length, slideDuration]);

  if (!posts.length) return null;

  const post = posts[current];
  const profilePicUrl = getDisplaySafeMediaUrl(post.profilePicUrl);
  const imageUrl = getDisplaySafeMediaUrl(post.mediaUrl);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <AnimatePresence mode="sync">
        <motion.div
          key={post.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0"
        >
          {/* Background media */}
          {post.mediaType === 'VIDEO' ? (
            <video
              src={post.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={imageUrl ?? post.mediaUrl}
              alt={post.caption ?? ''}
              className="w-full h-full object-cover"
            />
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 30%, rgba(0,0,0,0.7) 100%)',
            }}
          />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
            {/* Author info */}
            <div className="flex items-center gap-3 mb-3">
              {profilePicUrl ? (
                <img
                  src={profilePicUrl}
                  alt={post.username}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {post.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-white font-semibold text-sm leading-none">
                  {post.displayName ?? post.username}
                </p>
                <p className="text-white/60 text-xs mt-0.5">@{post.username}</p>
              </div>
              {/* Instagram badge */}
              <div className="ml-auto flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full px-3 py-1">
                <InstagramIcon className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-bold tracking-wide">INSTAGRAM</span>
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <p className="text-white/90 text-sm leading-relaxed line-clamp-3 mb-3 max-w-2xl">
                {post.caption}
              </p>
            )}

            {/* Engagement stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-white/80">
                <HeartIcon className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium">{formatCount(post.likeCount)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/80">
                <CommentIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">{formatCount(post.commentCount)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide indicator dots */}
      {posts.length > 1 && (
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-20">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {autoSlide && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <motion.div
            key={`progress-${current}`}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: slideDuration / 1000, ease: 'linear' }}
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
          />
        </div>
      )}
    </div>
  );
}
