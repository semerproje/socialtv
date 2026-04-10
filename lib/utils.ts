import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, pattern = 'dd MMM yyyy, HH:mm') {
  return format(new Date(date), pattern, { locale: tr });
}

export function formatRelative(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function isAdActiveNow(ad: {
  isActive: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  scheduleJson?: string | null;
}): boolean {
  if (!ad.isActive) return false;

  const now = new Date();

  if (ad.startDate && new Date(ad.startDate) > now) return false;
  if (ad.endDate && new Date(ad.endDate) < now) return false;

  if (ad.scheduleJson) {
    try {
      const schedule = JSON.parse(ad.scheduleJson);
      const currentDay = now.getDay();
      const currentHour = now.getHours();

      if (schedule.days && !schedule.days.includes(currentDay)) return false;
      if (schedule.startHour !== undefined && currentHour < schedule.startHour) return false;
      if (schedule.endHour !== undefined && currentHour >= schedule.endHour) return false;
    } catch {
      // Invalid schedule JSON, ignore
    }
  }

  return true;
}

export function getWeatherDescription(code: number): string {
  const codes: Record<number, string> = {
    0: 'Açık',
    1: 'Çoğunlukla Açık',
    2: 'Parçalı Bulutlu',
    3: 'Bulutlu',
    45: 'Sisli',
    48: 'Kırağılı Sis',
    51: 'Hafif Çisenti',
    53: 'Çisenti',
    55: 'Yoğun Çisenti',
    61: 'Hafif Yağmur',
    63: 'Yağmur',
    65: 'Şiddetli Yağmur',
    71: 'Hafif Kar',
    73: 'Kar',
    75: 'Yoğun Kar',
    80: 'Sağanak',
    81: 'Kuvvetli Sağanak',
    82: 'Çok Kuvvetli Sağanak',
    95: 'Fırtınalı',
    96: 'Dolulu Fırtına',
    99: 'Şiddetli Dolulu Fırtına',
  };
  return codes[code] ?? 'Bilinmiyor';
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌨️';
  return '⛈️';
}

export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    instagram: '📸',
    twitter: '🐦',
    tiktok: '🎵',
    custom: '✨',
    announcement: '📢',
  };
  return icons[platform] ?? '💬';
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: '#e1306c',
    twitter: '#1da1f2',
    tiktok: '#ff0050',
    custom: '#6366f1',
    announcement: '#f59e0b',
  };
  return colors[platform] ?? '#6366f1';
}

export function getSentimentColor(sentiment?: string): string {
  if (sentiment === 'positive') return '#10b981';
  if (sentiment === 'negative') return '#ef4444';
  return '#64748b';
}

export function getSentimentEmoji(sentiment?: string): string {
  if (sentiment === 'positive') return '😊';
  if (sentiment === 'negative') return '😞';
  return '😐';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
const PROXIED_MEDIA_HOSTS = ['fbcdn.net', 'cdninstagram.com', 'instagram.com'];

export function shouldProxyExternalMedia(url?: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return PROXIED_MEDIA_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function getDisplaySafeMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!shouldProxyExternalMedia(url)) return url;
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}
