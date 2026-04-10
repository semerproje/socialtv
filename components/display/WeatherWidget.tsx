'use client';

import { motion } from 'framer-motion';
import type { WeatherData } from '@/types';
import { getWeatherIcon } from '@/lib/utils';

interface WeatherWidgetProps {
  weather?: WeatherData;
  city: string;
  compact?: boolean;
}

export default function WeatherWidget({ weather, city, compact = false }: WeatherWidgetProps) {
  if (!weather) {
    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-white/20 text-lg">—</span>
          <span className="text-[11px] text-white/25 uppercase tracking-wider">{city}</span>
        </div>
      );
    }
    return (
      <div className="glass-dark rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">🌀</span>
        <div>
          <p className="text-sm font-semibold text-tv-text">{city}</p>
          <p className="text-xs text-tv-muted">Hava durumu yükleniyor…</p>
        </div>
      </div>
    );
  }

  const icon = getWeatherIcon(weather.weatherCode);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="text-[22px] leading-none">{icon}</span>
        <div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-[22px] font-semibold tabular-nums leading-none text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
            >
              {Math.round(weather.temperature)}°
            </span>
            <span className="text-xs text-white/30">C</span>
          </div>
          <p className="text-[11px] text-white/30 uppercase tracking-wide">{city}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-dark rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-tv-muted uppercase tracking-widest mb-1">{city}</p>
          <div className="flex items-end gap-2">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                background: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {Math.round(weather.temperature)}°
            </span>
            <span className="text-tv-muted text-sm mb-1">C</span>
          </div>
          <p className="text-xs text-tv-muted mt-0.5">{weather.description}</p>
        </div>
        <div className="text-5xl">{icon}</div>
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.06]">
        <div className="text-center flex-1">
          <p className="text-xs text-tv-muted">Hissedilen</p>
          <p className="text-sm font-semibold text-tv-text">{Math.round(weather.feelsLike)}°</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs text-tv-muted">Nem</p>
          <p className="text-sm font-semibold text-tv-text">{weather.humidity}%</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs text-tv-muted">Rüzgar</p>
          <p className="text-sm font-semibold text-tv-text">{Math.round(weather.windSpeed)} km/s</p>
        </div>
      </div>
    </motion.div>
  );
}
