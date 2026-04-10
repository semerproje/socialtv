'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ClockWidgetProps {
  compact?: boolean;
  header?: boolean;
}

export default function ClockWidget({ compact = false, header = false }: ClockWidgetProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = format(now, 'HH:mm', { locale: tr });
  const seconds = format(now, 'ss');
  const date = format(now, 'EEEE, d MMMM yyyy', { locale: tr });

  if (header) {
    return (
      <div className="text-right">
        <div
          className="text-[22px] font-semibold tabular-nums leading-none tracking-tight text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
        >
          {time}
          <span className="text-base text-white/30 ml-0.5">:{seconds}</span>
        </div>
        <div className="text-[11px] text-white/30 mt-0.5 capitalize tracking-wide">{date}</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="text-right">
        <div
          className="text-xl font-semibold tabular-nums leading-none tracking-tight text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {time}
          <span className="text-sm text-white/30 ml-0.5">:{seconds}</span>
        </div>
        <div className="text-[11px] text-white/30 mt-0.5 capitalize">{date}</div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        className="text-7xl font-bold tabular-nums tracking-tight leading-none"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          background: 'linear-gradient(135deg, #ffffff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.03em',
        }}
      >
        {time}
        <span className="text-4xl opacity-40">:{seconds}</span>
      </div>
      <p className="text-xs text-white/30 mt-3 capitalize tracking-widest uppercase">{date}</p>
    </div>
  );
}
