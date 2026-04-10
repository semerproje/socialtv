'use client';

import { useMemo } from 'react';
import type { TickerMessage } from '@/types';

interface NewsTickerProps {
  messages: TickerMessage[];
  primaryColor?: string;
  speed?: number;
}

export default function NewsTicker({ messages, primaryColor = '#6366f1', speed = 40 }: NewsTickerProps) {
  const activeMessages = useMemo(() =>
    messages
      .filter((m) => m.isActive)
      .sort((a, b) => b.priority - a.priority),
    [messages],
  );

  if (activeMessages.length === 0) {
    return (
      <div
        className="h-9 flex items-center px-6"
        style={{ background: 'rgba(2,8,23,0.95)', borderTop: `1px solid ${primaryColor}20` }}
      >
        <span className="text-white/20 text-xs uppercase tracking-widest">Social Lounge TV</span>
      </div>
    );
  }

  const tickerContent = [...activeMessages, ...activeMessages];

  return (
    <div
      className="relative h-10 flex items-center overflow-hidden"
      style={{
        background: 'rgba(2, 8, 23, 0.95)',
        borderTop: `1px solid ${primaryColor}25`,
      }}
    >
      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 w-28 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(2,8,23,1), transparent)' }}
      />

      {/* CANLI badge */}
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm"
        style={{
          background: `${primaryColor}20`,
          border: `1px solid ${primaryColor}40`,
          color: primaryColor,
        }}
      >
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
        CANLI
      </div>

      {/* Scrolling text */}
      <div className="ticker-wrapper ml-24 flex-1">
        <div
          className="ticker-track"
          style={{ '--ticker-duration': `${speed}s` } as React.CSSProperties}
        >
          {tickerContent.map((msg, i) => (
            <span key={`${msg.id}-${i}`} className="inline-flex items-center">
              <span
                className="text-[13px] font-medium mr-10 whitespace-nowrap tracking-wide"
                style={{ color: msg.color ?? 'rgba(255,255,255,0.75)' }}
              >
                {msg.text}
              </span>
              <span className="mr-10 text-white/15">—</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, rgba(2,8,23,1), transparent)' }}
      />
    </div>
  );
}
