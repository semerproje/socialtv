import type { ChannelHealthCheck, LiveChannel } from '@/types';

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timeout) };
}

export async function checkChannelHealth(channel: LiveChannel): Promise<ChannelHealthCheck> {
  const startedAt = Date.now();
  const videoId = typeof channel.videoId === 'string' ? channel.videoId : undefined;
  const embedUrl = typeof channel.embedUrl === 'string' ? channel.embedUrl : undefined;
  const streamUrl = typeof channel.streamUrl === 'string' ? channel.streamUrl : undefined;

  try {
    if (channel.playbackMode === 'youtube' && videoId) {
      const timeout = withTimeout(8000);
      try {
        const res = await fetch(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, {
          cache: 'no-store',
          signal: timeout.controller.signal,
        });
        return {
          state: res.ok ? 'healthy' : 'degraded',
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          statusCode: res.status,
          message: res.ok ? 'YouTube thumbnail reachable' : 'YouTube resource returned non-OK response',
          target: videoId,
        };
      } finally {
        timeout.clear();
      }
    }

    const target = channel.playbackMode === 'iframe' ? embedUrl : streamUrl;
    if (!target) {
      return {
        state: 'unreachable',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: 'No playback target configured',
      };
    }

    if (channel.requiresAuth) {
      return {
        state: 'auth-required',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: 'Provider requires authenticated browser session; URL format stored successfully',
        target,
      };
    }

    const timeout = withTimeout(8000);
    try {
      const res = await fetch(target, {
        cache: 'no-store',
        redirect: 'follow',
        signal: timeout.controller.signal,
        headers: { 'user-agent': 'Social-Lounge-Monitor/1.0' },
      });
      return {
        state: res.ok ? 'healthy' : res.status >= 500 ? 'unreachable' : 'degraded',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        statusCode: res.status,
        message: res.ok ? 'Playback target reachable' : `Target responded with HTTP ${res.status}`,
        target,
      };
    } finally {
      timeout.clear();
    }
  } catch (error) {
    return {
      state: channel.requiresAuth ? 'auth-required' : 'unreachable',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Health check failed',
      target: channel.playbackMode === 'iframe' ? embedUrl : streamUrl,
    };
  }
}