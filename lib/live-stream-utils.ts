import type { LiveChannel, LivePlaybackMode, LiveProvider } from '@/types';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function safeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((item) => String(item).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function sanitizeLiveChannelInput(input: Record<string, unknown>) {
  const title = String(input.title ?? '').trim();
  const provider = String(input.provider ?? '').trim() as LiveProvider;
  const playbackMode = String(input.playbackMode ?? '').trim() as LivePlaybackMode;
  const category = String(input.category ?? '').trim() || undefined;
  const description = String(input.description ?? '').trim() || undefined;
  const rightsNote = String(input.rightsNote ?? '').trim() || undefined;
  const videoId = String(input.videoId ?? '').trim() || undefined;
  const backupChannelId = typeof input.backupChannelId === 'string' && input.backupChannelId.trim()
    ? input.backupChannelId.trim()
    : undefined;

  return {
    title,
    provider,
    category,
    description,
    playbackMode,
    streamUrl: safeUrl(typeof input.streamUrl === 'string' ? input.streamUrl : undefined),
    embedUrl: safeUrl(typeof input.embedUrl === 'string' ? input.embedUrl : undefined),
    videoId,
    logoUrl: safeUrl(typeof input.logoUrl === 'string' ? input.logoUrl : undefined),
    posterUrl: safeUrl(typeof input.posterUrl === 'string' ? input.posterUrl : undefined),
    rightsNote,
    tags: normalizeTags(input.tags),
    requiresAuth: Boolean(input.requiresAuth),
    isActive: input.isActive !== false,
    backupChannelId,
    autoFailover: Boolean(input.autoFailover),
  };
}

export function validateLiveChannelInput(channel: ReturnType<typeof sanitizeLiveChannelInput>): string | null {
  if (!channel.title) return 'title is required';
  if (!channel.provider) return 'provider is required';
  if (!channel.playbackMode) return 'playbackMode is required';

  if (channel.playbackMode === 'native' && !channel.streamUrl) {
    return 'streamUrl is required for native playback';
  }
  if (channel.playbackMode === 'iframe' && !channel.embedUrl) {
    return 'embedUrl is required for iframe playback';
  }
  if (channel.playbackMode === 'youtube' && (!channel.videoId || !YOUTUBE_ID.test(channel.videoId))) {
    return 'valid videoId is required for youtube playback';
  }

  return null;
}

export function channelToBroadcastPayload(channel: LiveChannel) {
  return {
    title: channel.title,
    provider: channel.provider,
    playbackMode: channel.playbackMode,
    streamUrl: channel.streamUrl,
    embedUrl: channel.embedUrl,
    videoId: channel.videoId,
    posterUrl: channel.posterUrl,
    logoUrl: channel.logoUrl,
  };
}