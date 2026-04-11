'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import YouTubePlayer from './YouTubePlayer';
import InstagramCarousel, { InstagramPostData } from './InstagramCarousel';
import VideoPlayer from './VideoPlayer';
import SocialFeed from './SocialFeed';
import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import NewsTicker from './NewsTicker';
import AdOverlay from './AdOverlay';
import AIHighlight from './AIHighlight';
import QRWidget from './QRWidget';
import MarketWidget from './MarketWidget';
import type { DisplayData, LivePlaybackSource, MarketData } from '@/types';
import { getDisplaySafeMediaUrl } from '@/lib/utils';

// ─── Layout type ──────────────────────────────────────────────────────────────

export type LayoutType =
  | 'default'        // Header + AI Highlight + social feed sidebar
  | 'youtube'        // Big YouTube + narrow social sidebar
  | 'instagram'      // Instagram fullscreen carousel
  | 'split_2'        // Left: YouTube/highlight | Right: Instagram
  | 'fullscreen'     // Pure fullscreen media
  | 'digital_signage'// Header + 2/3 big + 1/3 side grid
  | 'social_wall'    // 3x2 Instagram mosaic grid
  | 'ambient'        // Big clock + weather (screensaver)
  | 'promo'          // Rotating full-screen promos/highlights
  | 'triple'         // Three equal columns
  | 'news_focus'     // Branded panel + content + thick ticker
  | 'portrait'       // Vertical-optimised single column
  | 'markets'        // Live market data full-screen
  | 'breaking_news'  // Red alert banner + large headline + ticker
  | 'event_countdown'// Countdown timer + background image
  | 'split_scoreboard'; // Left scoreboard + right social feed

// ─── Props ────────────────────────────────────────────────────────────────────

interface OverlayMessage { text: string; color?: string; }

interface LayoutManagerProps {
  layout: LayoutType;
  data: DisplayData;
  youtubeQueue: Array<{ videoId: string; title?: string }>;
  instagramPosts: InstagramPostData[];
  liveStream?: LivePlaybackSource | null;
  showAd: boolean;
  overlayMessage: OverlayMessage | null;
  onAdComplete: () => void;
  onYouTubeEnded: () => void;
  primaryColor: string;
  secondaryColor: string;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

type CommonProps = {
  tickers: DisplayData['tickers'];
  weather: DisplayData['weather'];
  primaryColor: string;
  secondaryColor: string;
  igSlideDuration: number;
};

function AccentLine({ primaryColor }: { primaryColor: string }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
      style={{ background: `linear-gradient(90deg, transparent 0%, ${primaryColor}50 30%, ${primaryColor}90 50%, ${primaryColor}50 70%, transparent 100%)` }}
    />
  );
}

function HeaderBar({ primaryColor, weather, logo = true }: { primaryColor: string; weather: DisplayData['weather']; logo?: boolean }) {
  return (
    <header
      className="flex items-center justify-between px-8 py-3.5 flex-shrink-0 relative z-10"
      style={{ background: 'rgba(2,8,23,0.92)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <AccentLine primaryColor={primaryColor} />
      {logo && <img src="/logo.png" alt="" className="h-8 w-auto object-contain" />}
      <div className="flex items-center gap-6">
        <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
        <div className="w-px h-8 bg-white/10" />
        <ClockWidget header />
      </div>
    </header>
  );
}

function TickerFooter({ tickers, primaryColor }: { tickers: DisplayData['tickers']; primaryColor: string }) {
  if (!tickers?.length) return null;
  return (
    <footer className="flex-shrink-0 h-10 z-10">
      <NewsTicker messages={tickers} primaryColor={primaryColor} />
    </footer>
  );
}

function EmptyState({ label = 'İçerik bekleniyor\u2026' }: { label?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-white/20 text-sm uppercase tracking-widest">{label}</p>
    </div>
  );
}

// ─── Instagram Mosaic (for social_wall) ───────────────────────────────────────

function InstagramMosaic({ posts, primaryColor }: { posts: InstagramPostData[]; primaryColor: string }) {
  const [offset, setOffset] = useState(0);
  const count = 6;

  useEffect(() => {
    if (posts.length <= count) return;
    const t = setInterval(() => setOffset((o) => (o + 1) % posts.length), 4500);
    return () => clearInterval(t);
  }, [posts.length]);

  const visible = Array.from({ length: count }, (_, i) => posts[(offset + i) % posts.length]).filter(Boolean);

  if (!visible.length) return <EmptyState label="Instagram postları bekleniyor\u2026" />;

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1 w-full h-full">
      {visible.map((post, i) => (
        <motion.div
          key={`${post.id}-${i}`}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: i * 0.07 }}
          className="relative overflow-hidden group"
        >
          {(() => {
            const mediaUrl = getDisplaySafeMediaUrl(post.mediaUrl) ?? post.mediaUrl;
            return post.mediaType === 'VIDEO' ? (
              <video src={post.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            );
          })()}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.85) 0%, transparent 50%)' }}
          />
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            {getDisplaySafeMediaUrl(post.profilePicUrl) && (
              <img src={getDisplaySafeMediaUrl(post.profilePicUrl)} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" onError={(event) => {
                event.currentTarget.style.display = 'none';
              }} />
            )}
            <span className="text-white/70 text-[10px] truncate font-medium">@{post.username}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function LayoutManager({
  layout,
  data,
  youtubeQueue,
  instagramPosts,
  liveStream,
  showAd,
  overlayMessage,
  onAdComplete,
  onYouTubeEnded,
  primaryColor,
  secondaryColor,
}: LayoutManagerProps) {
  const settings = data.settings ?? {};
  const approved = (data.content ?? []).filter((c) => c.isApproved);
  const highlight = approved.find((c) => c.isHighlight || c.isFeatured) ?? approved[0] ?? null;
  const feedContent = approved.filter((c) => c.id !== highlight?.id).slice(0, 8);
  const tickers = data.tickers ?? [];
  const currentAd = data.currentAd ?? null;
  const weather = data.weather;
  const appName = settings.app_name ?? 'Social TV';
  const qrUrl = settings.qr_url ?? '';
  const currentYT = youtubeQueue[0] ?? null;
  const igSlideDuration = Math.max(
    3000,
    parseInt(String(settings.instagram_slide_ms ?? settings.content_refresh_ms ?? '8000'), 10)
  );

  const common: CommonProps = { tickers, weather, primaryColor, secondaryColor, igSlideDuration };

  const VALID_LAYOUTS: LayoutType[] = [
    'default', 'youtube', 'instagram', 'split_2', 'fullscreen',
    'digital_signage', 'social_wall', 'ambient', 'promo', 'triple', 'news_focus', 'portrait', 'markets',
    'breaking_news', 'event_countdown', 'split_scoreboard',
  ];
  const resolvedLayout: LayoutType = VALID_LAYOUTS.includes(layout) ? layout : 'default';

  return (
    <div className="relative w-full h-full overflow-hidden">

      {/* ── Ad overlay ── */}
      <AnimatePresence>
        {showAd && currentAd && (
          <AdOverlay ad={currentAd} onComplete={onAdComplete} primaryColor={primaryColor} />
        )}
      </AnimatePresence>

      {/* ── Push message overlay ── */}
      <AnimatePresence>
        {overlayMessage && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none"
          >
            <div
              className="px-8 py-4 rounded-2xl text-white font-bold text-xl shadow-2xl"
              style={{ background: overlayMessage.color ?? primaryColor, boxShadow: `0 0 40px ${overlayMessage.color ?? primaryColor}80` }}
            >
              {overlayMessage.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layout body ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={resolvedLayout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0"
        >
          {resolvedLayout === 'default' && (
            <DefaultLayout
              highlight={highlight}
              highlights={approved.filter((c) => c.isHighlight || c.isFeatured)}
              feedContent={feedContent}
              qrUrl={qrUrl}
              {...common}
            />
          )}
          {resolvedLayout === 'youtube' && (
            <YouTubeLayout
              video={currentYT}
              feedContent={feedContent}
              onEnded={onYouTubeEnded}
              {...common}
            />
          )}
          {resolvedLayout === 'instagram' && (
            <InstagramLayout posts={instagramPosts} {...common} />
          )}
          {resolvedLayout === 'split_2' && (
            <SplitTwoLayout
              youtubeVideo={currentYT}
              highlight={highlight}
              feedContent={feedContent}
              instagramPosts={instagramPosts}
              onYouTubeEnded={onYouTubeEnded}
              {...common}
            />
          )}
          {resolvedLayout === 'fullscreen' && (
            <FullscreenLayout
              youtubeVideo={currentYT}
              instagramPosts={instagramPosts}
              liveStream={liveStream}
              onYouTubeEnded={onYouTubeEnded}
              {...common}
            />
          )}
          {resolvedLayout === 'digital_signage' && (
            <DigitalSignageLayout
              highlight={highlight}
              instagramPosts={instagramPosts}
              youtubeVideo={currentYT}
              onYouTubeEnded={onYouTubeEnded}
              {...common}
            />
          )}
          {resolvedLayout === 'social_wall' && (
            <SocialWallLayout instagramPosts={instagramPosts} {...common} />
          )}
          {resolvedLayout === 'ambient' && (
            <AmbientLayout {...common} />
          )}
          {resolvedLayout === 'promo' && (
            <PromoLayout
              highlights={approved.filter((c) => c.isHighlight || c.isFeatured)}
              allContent={approved}
              {...common}
            />
          )}
          {resolvedLayout === 'triple' && (
            <TripleLayout
              youtubeVideo={currentYT}
              highlight={highlight}
              feedContent={feedContent}
              instagramPosts={instagramPosts}
              onYouTubeEnded={onYouTubeEnded}
              {...common}
            />
          )}
          {resolvedLayout === 'news_focus' && (
            <NewsFocusLayout
              highlight={highlight}
              feedContent={feedContent}
              {...common}
            />
          )}
          {resolvedLayout === 'portrait' && (
            <PortraitLayout
              highlight={highlight}
              feedContent={feedContent}
              instagramPosts={instagramPosts}
              qrUrl={qrUrl}
              {...common}
            />
          )}
          {resolvedLayout === 'markets' && (
            <MarketsLayout
              markets={data.markets}
              news={data.news}
              {...common}
            />
          )}
          {resolvedLayout === 'breaking_news' && (
            <BreakingNewsLayout
              headline={settings.breaking_headline ?? ''}
              summary={settings.breaking_summary ?? ''}
              source={settings.breaking_source ?? ''}
              {...common}
            />
          )}
          {resolvedLayout === 'event_countdown' && (
            <EventCountdownLayout
              target={settings.countdown_target ?? ''}
              title={settings.countdown_title ?? 'Etkinliğe'}
              bgUrl={settings.countdown_bg_url ?? ''}
              {...common}
            />
          )}
          {resolvedLayout === 'split_scoreboard' && (
            <SplitScoreboardLayout
              instagramPosts={instagramPosts}
              feedContent={feedContent}
              scores={settings.scoreboard_json ?? ''}
              {...common}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Default ───────────────────────────────────────────────────────────────
function DefaultLayout({
  highlight, highlights, feedContent, tickers, weather, primaryColor, secondaryColor, igSlideDuration, qrUrl,
}: CommonProps & { highlight: any; highlights: any[]; feedContent: any[]; qrUrl: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <HeaderBar primaryColor={primaryColor} weather={weather} />
      <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {highlight || highlights.length > 0
            ? <AIHighlight content={highlight} highlights={highlights} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            : <div className="h-full glass rounded-2xl flex items-center justify-center"><EmptyState /></div>
          }
        </div>
        <div className="w-72 flex flex-col gap-3 overflow-hidden flex-shrink-0">
          {qrUrl && <QRWidget url={qrUrl} />}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SocialFeed content={feedContent.slice(0, 6)} sidebar />
          </div>
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 2. YouTube ───────────────────────────────────────────────────────────────
function YouTubeLayout({
  video, feedContent, tickers, weather, primaryColor, secondaryColor, igSlideDuration, onEnded,
}: CommonProps & { video: any; feedContent: any[]; onEnded: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-black">
          {video
            ? <YouTubePlayer videoId={video.videoId} title={video.title} muted autoplay loop onEnded={onEnded} className="absolute inset-0 w-full h-full" />
            : <EmptyState label="YouTube videosu bekleniyor\u2026" />
          }
        </div>
        {/* Sidebar */}
        <div
          className="w-64 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ background: 'rgba(2,8,23,0.96)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div
            className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
            <ClockWidget compact />
          </div>
          <div className="flex-1 min-h-0 p-3 overflow-hidden">
            <SocialFeed content={feedContent} sidebar />
          </div>
          <div className="px-4 py-3 flex justify-center flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <img src="/logo.png" alt="" className="h-5 w-auto object-contain opacity-20" />
          </div>
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 3. Instagram ─────────────────────────────────────────────────────────────
function InstagramLayout({ posts, tickers, weather, primaryColor, igSlideDuration }: CommonProps & { posts: InstagramPostData[] }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {posts.length > 0
          ? <InstagramCarousel posts={posts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
          : <div className="absolute inset-0 flex items-center justify-center"><EmptyState label="Instagram postlar\u0131 bekleniyor\u2026" /></div>
        }
        {/* Header gradient overlay */}
        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3.5 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(2,8,23,0.88) 0%, transparent 100%)' }}
        >
          <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
          <div className="flex items-center gap-5">
            <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
            <div className="w-px h-6 bg-white/15" />
            <ClockWidget compact />
          </div>
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 4. Split Two ─────────────────────────────────────────────────────────────
function SplitTwoLayout({
  youtubeVideo, highlight, feedContent, instagramPosts, tickers, weather,
  primaryColor, secondaryColor, igSlideDuration, onYouTubeEnded,
}: CommonProps & { youtubeVideo: any; highlight: any; feedContent: any[]; instagramPosts: InstagramPostData[]; onYouTubeEnded: () => void }) {
  const leftContent = youtubeVideo ? 'youtube' : highlight ? 'highlight' : 'feed';
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden">
          {leftContent === 'youtube'
            ? <YouTubePlayer videoId={youtubeVideo.videoId} title={youtubeVideo.title} muted autoplay loop onEnded={onYouTubeEnded} className="absolute inset-0 w-full h-full" />
            : leftContent === 'highlight' && highlight
              ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
              : <div className="p-3 h-full overflow-hidden"><SocialFeed content={feedContent.slice(0, 3)} /></div>
          }
          {/* Top gradient overlay */}
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(2,8,23,0.82) 0%, transparent 100%)' }}
          >
            <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
            <ClockWidget compact />
          </div>
        </div>
        {/* Divider */}
        <div
          className="w-px flex-shrink-0"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08) 15%, rgba(255,255,255,0.08) 85%, transparent)' }}
        />
        {/* Right */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden">
          {instagramPosts.length > 0
            ? <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
            : <div className="p-3 h-full overflow-hidden"><SocialFeed content={feedContent.slice(3)} /></div>
          }
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 5. Fullscreen ────────────────────────────────────────────────────────────
function FullscreenLayout({
  youtubeVideo, instagramPosts, liveStream, tickers, primaryColor, igSlideDuration, onYouTubeEnded,
}: CommonProps & { youtubeVideo: any; instagramPosts: InstagramPostData[]; liveStream?: LivePlaybackSource | null; onYouTubeEnded: () => void }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {liveStream?.playbackMode === 'iframe' && liveStream.embedUrl ? (
        <iframe
          src={liveStream.embedUrl}
          className="absolute inset-0 w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          title={liveStream.title}
        />
      ) : liveStream?.playbackMode === 'youtube' && liveStream.videoId ? (
        <YouTubePlayer videoId={liveStream.videoId} title={liveStream.title} muted autoplay loop onEnded={onYouTubeEnded} className="absolute inset-0 w-full h-full" showOverlay />
      ) : liveStream?.streamUrl ? (
        <VideoPlayer src={liveStream.streamUrl} title={liveStream.title} poster={liveStream.posterUrl} autoPlay muted loop className="absolute inset-0 w-full h-full" />
      ) : youtubeVideo ? (
        <YouTubePlayer videoId={youtubeVideo.videoId} title={youtubeVideo.title} muted autoplay loop onEnded={onYouTubeEnded} className="absolute inset-0 w-full h-full" showOverlay />
      ) : instagramPosts.length > 0 ? (
        <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
      ) : (
        <EmptyState label="Medya bekleniyor\u2026" />
      )}
      {liveStream && (
        <div className="absolute top-4 left-4 z-20 px-3 py-2 rounded-xl bg-black/55 backdrop-blur-md border border-white/10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80 font-semibold">Canlı Yayın</p>
          <p className="text-white text-sm font-medium mt-0.5">{liveStream.title}</p>
        </div>
      )}
      {tickers?.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <NewsTicker messages={tickers} primaryColor={primaryColor} />
        </div>
      )}
    </div>
  );
}

// ─── 6. Digital Signage ───────────────────────────────────────────────────────
function DigitalSignageLayout({
  highlight, instagramPosts, youtubeVideo, tickers, weather,
  primaryColor, secondaryColor, igSlideDuration, onYouTubeEnded,
}: CommonProps & { highlight: any; instagramPosts: InstagramPostData[]; youtubeVideo: any; onYouTubeEnded: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.92)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
        <div className="flex items-center gap-5">
          <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
          <div className="w-px h-6 bg-white/10" />
          <ClockWidget compact />
        </div>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-1.5 p-1.5 overflow-hidden">
        <div className="col-span-2 relative overflow-hidden rounded-xl min-h-0">
          {youtubeVideo
            ? <YouTubePlayer videoId={youtubeVideo.videoId} title={youtubeVideo.title} muted autoplay loop onEnded={onYouTubeEnded} className="absolute inset-0 w-full h-full" />
            : highlight
              ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
              : instagramPosts.length > 0
                ? <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
                : <EmptyState />
          }
        </div>
        <div className="flex flex-col gap-1.5 min-h-0">
          {instagramPosts.slice(0, 2).map((post, i) => (
            <div key={post.id} className="flex-1 relative overflow-hidden rounded-xl min-h-0">
              {(() => {
                const mediaUrl = getDisplaySafeMediaUrl(post.mediaUrl) ?? post.mediaUrl;
                return post.mediaType === 'VIDEO'
                  ? <video src={post.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  : <img src={mediaUrl} alt="" className="w-full h-full object-cover" />;
              })()}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.85) 0%, transparent 55%)' }} />
              <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5">
                {getDisplaySafeMediaUrl(post.profilePicUrl) && <img src={getDisplaySafeMediaUrl(post.profilePicUrl)} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }} />}
                <span className="text-white/70 text-[10px] font-medium">@{post.username}</span>
              </div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 2 - instagramPosts.length) }).map((_, i) => (
            <div key={i} className="flex-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 7. Social Wall ───────────────────────────────────────────────────────────
function SocialWallLayout({ instagramPosts, tickers, weather, primaryColor, igSlideDuration }: CommonProps & { instagramPosts: InstagramPostData[] }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Slim header */}
      <div
        className="flex items-center justify-between px-6 py-2.5 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.94)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <img src="/logo.png" alt="" className="h-6 w-auto object-contain" />
        <div className="flex items-center gap-4">
          <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
          <div className="w-px h-5 bg-white/10" />
          <ClockWidget compact />
        </div>
      </div>
      {/* Mosaic grid */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <InstagramMosaic posts={instagramPosts} primaryColor={primaryColor} />
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 8. Ambient ───────────────────────────────────────────────────────────────
function AmbientLayout({ weather, primaryColor, secondaryColor, tickers }: CommonProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());

  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${primaryColor}12 0%, transparent 70%)` }}
      />
      {/* Logo — top left */}
      <div className="absolute top-8 left-8">
        <img src="/logo.png" alt="" className="h-8 w-auto object-contain opacity-40" />
      </div>
      {/* Main clock */}
      <div className="flex flex-col items-center select-none">
        <div
          className="tabular-nums leading-none font-light"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(100px, 22vw, 240px)',
            letterSpacing: '-0.04em',
            background: `linear-gradient(135deg, #ffffff 30%, ${primaryColor}cc 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {h}<span style={{ opacity: 0.4 }}>:</span>{m}
        </div>
        <div
          className="tabular-nums text-white/25 font-light mt-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 5vw, 64px)', letterSpacing: '-0.02em' }}
        >
          :{s}
        </div>
        <div className="mt-5 text-white/40 text-xl font-light tracking-[0.3em] uppercase">{dateStr}</div>
      </div>
      {/* Weather — bottom right */}
      {weather && (
        <div className="absolute bottom-10 right-10">
          <WeatherWidget weather={weather} city={weather.city} />
        </div>
      )}
      {/* Ticker */}
      {tickers?.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0">
          <NewsTicker messages={tickers} primaryColor={primaryColor} />
        </div>
      )}
    </div>
  );
}

// ─── 9. Promo / Spotlight ─────────────────────────────────────────────────────
function PromoLayout({
  highlights, allContent, tickers, weather, primaryColor, secondaryColor, igSlideDuration,
}: CommonProps & { highlights: any[]; allContent: any[] }) {
  const pool = highlights.length > 0 ? highlights : allContent.slice(0, 4);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (pool.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), igSlideDuration);
    return () => clearInterval(t);
  }, [pool.length, igSlideDuration]);

  const item = pool[idx] ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {item ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={item.id + idx}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0"
            >
              {item.mediaUrl ? (
                <>
                  {item.mediaType === 'VIDEO'
                    ? <video src={item.mediaUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
                    : <img src={item.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  }
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.92) 0%, rgba(2,8,23,0.3) 50%, transparent 100%)' }} />
                </>
              ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, rgba(2,8,23,0.95) 100%)` }} />
              )}
              {/* Content overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-12">
                <div className="max-w-3xl">
                  {item.author && (
                    <div className="flex items-center gap-3 mb-4">
                      {item.authorAvatar && <img src={item.authorAvatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />}
                      <div>
                        <p className="text-white/90 font-semibold text-sm">{item.author}</p>
                        <p className="text-white/40 text-xs uppercase tracking-widest">{item.platform}</p>
                      </div>
                    </div>
                  )}
                  {item.text && (
                    <p
                      className="text-white font-light leading-relaxed"
                      style={{ fontSize: 'clamp(18px, 2.5vw, 32px)' }}
                    >
                      {item.text.length > 200 ? item.text.slice(0, 200) + '\u2026' : item.text}
                    </p>
                  )}
                </div>
              </div>
              {/* Header bar */}
              <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(2,8,23,0.8) 0%, transparent 100%)' }}
              >
                <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
                <div className="flex items-center gap-5">
                  <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
                  <div className="w-px h-6 bg-white/15" />
                  <ClockWidget compact />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState label="İçerik bekleniyor\u2026" />
        )}
        {/* Dots */}
        {pool.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
            {pool.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} />
            ))}
          </div>
        )}
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 10. Triple ───────────────────────────────────────────────────────────────
function TripleLayout({
  youtubeVideo, highlight, feedContent, instagramPosts, tickers, weather,
  primaryColor, secondaryColor, igSlideDuration, onYouTubeEnded,
}: CommonProps & { youtubeVideo: any; highlight: any; feedContent: any[]; instagramPosts: InstagramPostData[]; onYouTubeEnded: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thin top bar */}
      <div
        className="flex items-center justify-between px-6 py-2.5 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.94)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <img src="/logo.png" alt="" className="h-6 w-auto object-contain" />
        <div className="flex items-center gap-4">
          <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
          <div className="w-px h-5 bg-white/10" />
          <ClockWidget compact />
        </div>
      </div>
      {/* Three columns */}
      <div className="flex flex-1 min-h-0 gap-1.5 p-1.5 overflow-hidden">
        {/* Left: social feed */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <SocialFeed content={feedContent.slice(0, 4)} sidebar />
        </div>
        {/* Center: Instagram */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden rounded-xl">
          {instagramPosts.length > 0
            ? <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
            : highlight
              ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
              : <EmptyState />
          }
        </div>
        {/* Right: YouTube or feed */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden rounded-xl">
          {youtubeVideo
            ? <YouTubePlayer videoId={youtubeVideo.videoId} title={youtubeVideo.title} muted autoplay loop onEnded={onYouTubeEnded} className="absolute inset-0 w-full h-full" />
            : <div className="h-full overflow-hidden"><SocialFeed content={feedContent.slice(3, 8)} sidebar /></div>
          }
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 11. News Focus ───────────────────────────────────────────────────────────
function NewsFocusLayout({
  highlight, feedContent, tickers, weather, primaryColor, secondaryColor, igSlideDuration,
}: CommonProps & { highlight: any; feedContent: any[] }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Double ticker top */}
      <div className="flex-shrink-0">
        <TickerFooter tickers={tickers} primaryColor={primaryColor} />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left branded panel */}
        <div
          className="w-72 flex-shrink-0 flex flex-col items-center justify-center gap-8 p-8 overflow-hidden"
          style={{ background: `linear-gradient(180deg, rgba(2,8,23,0.97) 0%, rgba(2,8,23,0.92) 100%)`, borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          <img src="/logo.png" alt="" className="h-12 w-auto object-contain" />
          <div
            className="w-12 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}80, transparent)` }}
          />
          <div className="text-center">
            <ClockWidget />
          </div>
          {weather && (
            <>
              <div className="w-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}60, transparent)` }} />
              <WeatherWidget weather={weather} city={weather?.city ?? ''} />
            </>
          )}
        </div>
        {/* Main content */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {highlight
              ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
              : <div className="h-full glass rounded-2xl flex items-center justify-center"><EmptyState /></div>
            }
          </div>
          {feedContent.length > 0 && (
            <div className="h-28 overflow-hidden flex-shrink-0">
              <SocialFeed content={feedContent.slice(0, 3)} compact />
            </div>
          )}
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 13. Markets ────────────────────────────────────────────────────────────
function MarketsLayout({
  markets, news, tickers, weather, primaryColor, secondaryColor,
}: CommonProps & { markets?: MarketData; news?: any[] }) {
  // ── Animated number hook ──────────────────────────────────────────────
  const [displayMarkets, setDisplayMarkets] = useState<MarketData | null>(markets ?? null);
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const prevRef = useRef<MarketData | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(180);
  const [activeTab, setActiveTab] = useState<'doviz' | 'emtia' | 'kripto'>('doviz');

  // Fetch periodically
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const doFetch = () => {
      fetch('/api/markets').then(r => r.json()).then(d => {
        if (!d.success) return;
        const next: MarketData = d.data;
        // compute flash
        const f: Record<string, 'up' | 'down'> = {};
        if (prevRef.current) {
          const prev = prevRef.current;
          for (const c of next.currencies) {
            const p = prev.currencies.find(x => x.code === c.code);
            if (p && c.rate !== p.rate) f[c.code] = c.rate > p.rate ? 'up' : 'down';
          }
          for (const m of next.metals) {
            const p = prev.metals.find(x => x.code === m.code);
            if (p && m.priceTRY !== p.priceTRY) f[m.code] = m.priceTRY > p.priceTRY ? 'up' : 'down';
          }
          for (const c of next.crypto) {
            const p = prev.crypto.find(x => x.code === c.code);
            if (p && c.priceUSD !== p.priceUSD) f[c.code] = c.priceUSD > p.priceUSD ? 'up' : 'down';
          }
        }
        prevRef.current = next;
        setDisplayMarkets(next);
        setLastUpdate(new Date());
        setCountdown(180);
        if (Object.keys(f).length > 0) {
          setFlashMap(f);
          setTimeout(() => setFlashMap({}), 1800);
        }
      }).catch(() => {});
    };
    doFetch();
    timer = setInterval(doFetch, 180_000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // Tab auto-rotate every 8 s
  useEffect(() => {
    const tabs: ('doviz' | 'emtia' | 'kripto')[] = ['doviz', 'emtia', 'kripto'];
    const t = setInterval(() => setActiveTab(cur => {
      const i = tabs.indexOf(cur);
      return tabs[(i + 1) % tabs.length];
    }), 8000);
    return () => clearInterval(t);
  }, []);

  const m = displayMarkets;

  function fmtN(n: number, dec = 2) {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  }
  function fmtCompact(n: number) {
    if (n >= 1_000_000) return `${fmtN(n / 1_000_000, 2)}M`;
    if (n >= 1_000) return `${fmtN(n / 1_000, 1)}K`;
    return fmtN(n, 0);
  }
  function chgColor(v?: number) {
    if (!v) return 'text-white/40';
    return v > 0 ? 'text-emerald-400' : 'text-red-400';
  }
  function flashBg(code: string) {
    if (flashMap[code] === 'up') return 'rgba(16,185,129,0.18)';
    if (flashMap[code] === 'down') return 'rgba(239,68,68,0.18)';
    return 'transparent';
  }
  function ChgBadge({ v }: { v?: number }) {
    if (!v) return <span className="text-white/30 text-[11px] tabular-nums">—</span>;
    return (
      <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${chgColor(v)}`}>
        {v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
      </span>
    );
  }

  // ── Tab content panels ────────────────────────────────────────────────
  const DovizPanel = () => (
    <div className="grid grid-cols-1 gap-2 h-full">
      {(m?.currencies ?? []).map(c => (
        <motion.div
          key={c.code}
          layout
          animate={{ backgroundColor: flashBg(c.code) }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-5 py-3.5 rounded-xl"
          style={{ background: flashBg(c.code) || 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}30` }}
            >
              {c.code}
            </div>
            <div>
              <p className="text-white/90 text-sm font-semibold">{c.name}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">{c.code}/TRY</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', monospace" }}>
              {fmtN(c.rate, 3)} <span className="text-white/50 text-sm font-normal">₺</span>
            </p>
            <ChgBadge v={c.change} />
          </div>
        </motion.div>
      ))}
    </div>
  );

  const EmtiaPanel = () => (
    <div className="grid grid-cols-1 gap-2 h-full">
      {(m?.metals ?? []).map(metal => (
        <motion.div
          key={metal.code}
          animate={{ backgroundColor: flashBg(metal.code) }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-5 py-3.5 rounded-xl"
          style={{ background: flashBg(metal.code) || 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.25)' }}
            >
              {metal.code === 'XAU' ? '🥇' : '🥈'}
            </div>
            <div>
              <p className="text-white/90 text-sm font-semibold">{metal.name}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">gram · ${fmtN(metal.priceUSD, 3)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', monospace" }}>
              {fmtN(metal.priceTRY)} <span className="text-white/50 text-sm font-normal">₺</span>
            </p>
            <ChgBadge v={metal.change} />
          </div>
        </motion.div>
      ))}
      {(!m?.metals || m.metals.length === 0) && (
        <p className="text-white/20 text-sm text-center py-8">Emtia verisi yükleniyor…</p>
      )}
    </div>
  );

  const KriptoPanel = () => (
    <div className="grid grid-cols-1 gap-2 h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {(m?.crypto ?? []).map(c => (
        <motion.div
          key={c.code}
          animate={{ backgroundColor: flashBg(c.code) }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-5 py-3 rounded-xl"
          style={{ background: flashBg(c.code) || 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] flex-shrink-0"
              style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              {c.code}
            </div>
            <div>
              <p className="text-white/90 text-sm font-semibold">{c.name}</p>
              <p className="text-white/40 text-[10px] tabular-nums">{fmtCompact(c.priceTRY)} ₺</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-lg font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', monospace" }}>
              ${fmtCompact(c.priceUSD)}
            </p>
            <ChgBadge v={c.change} />
          </div>
        </motion.div>
      ))}
    </div>
  );

  // ── Hero top section (always visible) ────────────────────────────────
  const usd = m?.currencies.find(c => c.code === 'USD');
  const eur = m?.currencies.find(c => c.code === 'EUR');
  const gbp = m?.currencies.find(c => c.code === 'GBP');
  const gold = m?.metals.find(x => x.code === 'XAU');
  const btc = m?.crypto.find(c => c.code === 'BTC');

  function HeroCard({ label, sub, value, unit, change, accent }: {
    label: string; sub?: string; value: string; unit: string; change?: number; accent: string;
  }) {
    return (
      <div
        className="flex-1 min-w-0 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}20` }}
      >
        {/* glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 20% 20%, ${accent}10 0%, transparent 60%)` }} />
        <div>
          <p className="text-white/50 text-[11px] font-bold uppercase tracking-[0.18em]">{label}</p>
          {sub && <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>}
        </div>
        <div>
          <p
            className="text-white font-extrabold leading-none tabular-nums mt-2"
            style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)', fontFamily: "'Space Grotesk', monospace", color: 'white' }}
          >
            {value} <span style={{ fontSize: '0.45em', opacity: 0.5 }}>{unit}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            {change != null ? (
              <>
                <span className={`text-sm font-semibold ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-white/30'}`}>
                  {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change).toFixed(2)}%
                </span>
                <span className="text-white/20 text-[10px]">24s</span>
              </>
            ) : <span className="text-white/20 text-xs">—</span>}
          </div>
        </div>
        {/* accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgb(2,8,23)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Canlı Piyasa</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
          <div className="w-px h-6 bg-white/10" />
          <div className="flex flex-col items-end gap-0.5">
            <ClockWidget compact />
            <span className="text-white/25 text-[9px] tabular-nums">{countdown}s</span>
          </div>
        </div>
      </header>

      {/* ── Hero bar ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 px-4 pt-3 pb-2 flex-shrink-0">
        {usd && <HeroCard label="ABD Doları" sub="USD/TRY" value={fmtN(usd.rate, 3)} unit="₺" change={usd.change} accent="#6366f1" />}
        {eur && <HeroCard label="Euro" sub="EUR/TRY" value={fmtN(eur.rate, 3)} unit="₺" change={eur.change} accent="#3b82f6" />}
        {gbp && <HeroCard label="İngiliz Sterlini" sub="GBP/TRY" value={fmtN(gbp.rate, 3)} unit="₺" change={gbp.change} accent="#8b5cf6" />}
        {gold && <HeroCard label="Altın" sub="gram · TRY" value={fmtN(gold.priceTRY)} unit="₺" change={gold.change} accent="#f59e0b" />}
        {btc && <HeroCard label="Bitcoin" sub="BTC/USD" value={`$${fmtCompact(btc.priceUSD)}`} unit="" change={btc.change} accent="#f97316" />}
      </div>

      {/* ── Main body: tab panel + news ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-3 px-4 pb-2 overflow-hidden">
        {/* Left: category tabs */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
          {/* Tab bar */}
          <div className="flex gap-1 flex-shrink-0">
            {(['doviz', 'emtia', 'kripto'] as const).map((tab) => {
              const labels: Record<string, string> = { doviz: '💱 Döviz', emtia: '🏅 Emtia', kripto: '₿ Kripto' };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  style={activeTab === tab
                    ? { background: `${primaryColor}25`, color: primaryColor, border: `1px solid ${primaryColor}40` }
                    : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
          {/* Panel */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {activeTab === 'doviz' && <DovizPanel />}
                {activeTab === 'emtia' && <EmtiaPanel />}
                {activeTab === 'kripto' && <KriptoPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right: full market table + news */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-hidden">
          {/* All items compact table */}
          <div
            className="rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: primaryColor }}>Tüm Piyasalar</span>
              <span className="text-white/25 text-[9px] tabular-nums">
                {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[
                ...(m?.currencies ?? []).map(c => ({
                  code: c.code, label: c.name, value: `${fmtN(c.rate, 3)} ₺`, change: c.change,
                })),
                ...(m?.metals ?? []).map(x => ({
                  code: x.code, label: x.name, value: `${fmtN(x.priceTRY)} ₺`, change: x.change,
                })),
                ...(m?.crypto ?? []).map(c => ({
                  code: c.code, label: c.name, value: `$${fmtCompact(c.priceUSD)}`, change: c.change,
                })),
              ].map((row) => (
                <div
                  key={row.code}
                  className="flex items-center justify-between px-3 py-1.5 transition-colors"
                  style={{ backgroundColor: flashBg(row.code) }}
                >
                  <span className="text-white/55 text-[11px] font-medium">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-[11px] font-semibold tabular-nums" style={{ fontFamily: 'monospace' }}>{row.value}</span>
                    {row.change != null && (
                      <span className={`text-[10px] font-semibold tabular-nums w-12 text-right ${chgColor(row.change)}`}>
                        {row.change > 0 ? '▲' : '▼'} {Math.abs(row.change).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* News */}
          {news && news.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5" style={{ scrollbarWidth: 'none' }}>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/30 px-1 pb-0.5 flex-shrink-0">📰 Gündem</p>
              {news.slice(0, 10).map((item: any, i: number) => (
                <div
                  key={item.id ?? i}
                  className="rounded-xl p-2.5 flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-white/75 text-[11px] font-medium leading-snug line-clamp-2">{item.title}</p>
                  <p className="text-white/25 text-[9px] mt-1">{item.source}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrolling ticker ──────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        {tickers && tickers.length > 0 ? (
          <TickerFooter tickers={tickers} primaryColor={primaryColor} />
        ) : (
          /* Market ticker when no ticker messages */
          <div
            className="relative flex items-center overflow-hidden h-8 text-[11px]"
            style={{ background: 'rgba(2,8,23,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="flex-shrink-0 flex items-center gap-1.5 px-3 h-full font-bold tracking-widest uppercase text-[9px]"
              style={{ background: `${primaryColor}15`, color: primaryColor, borderRight: `1px solid ${primaryColor}25` }}
            >
              📈 PİYASA
            </div>
            {m && (
              <div className="flex-1 overflow-hidden relative">
                <motion.div
                  animate={{ x: ['0%', '-50%'] }}
                  transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
                  className="flex whitespace-nowrap gap-10 text-white/60 tabular-nums"
                  style={{ fontFamily: 'monospace' }}
                >
                  {[...Array(2)].map((_, idx) => (
                    <span key={idx} className="flex gap-10">
                      {m.currencies.map(c => <span key={c.code}>💱 {c.code} {fmtN(c.rate, 3)} ₺</span>)}
                      {m.metals.map(x => <span key={x.code}>🏅 {x.name} {fmtN(x.priceTRY)} ₺</span>)}
                      {m.crypto.map(c => <span key={c.code}>₿ {c.code} ${fmtCompact(c.priceUSD)}</span>)}
                    </span>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 14. Breaking News ──────────────────────────────────────────────────────
function BreakingNewsLayout({
  headline, summary, source, tickers, weather, primaryColor,
}: CommonProps & { headline: string; summary: string; source: string }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(t);
  }, []);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgb(2,8,23)' }}>
      {/* Breaking header band */}
      <div
        className="flex items-center gap-4 px-8 py-4 flex-shrink-0"
        style={{
          background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
          borderBottom: '2px solid #fca5a5',
        }}
      >
        <span
          className="text-white font-black uppercase tracking-widest text-sm"
          style={{ opacity: pulse ? 1 : 0.5, transition: 'opacity 0.2s' }}
        >
          🔴 SON DAKİKA
        </span>
        <div className="flex-1 h-px bg-white/30" />
        <span className="text-white/80 text-sm font-medium tabular-nums">{timeStr}</span>
      </div>
      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-16 py-10 gap-6">
        {headline ? (
          <>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white font-black text-center leading-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
            >
              {headline}
            </motion.h1>
            {summary && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-white/60 text-center max-w-3xl"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
              >
                {summary}
              </motion.p>
            )}
            {source && (
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <span className="text-white/50 text-xs">Kaynak:</span>
                <span className="text-white/80 text-xs font-semibold">{source}</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-6xl">🔴</div>
            <p className="text-white/30 text-lg tracking-widest uppercase">Son Dakika bekleniyor…</p>
            <p className="text-white/20 text-sm">Settings &gt; breaking_headline ile ayarlayın</p>
          </div>
        )}
      </div>
      {/* Ticker */}
      <TickerFooter tickers={tickers} primaryColor="#ef4444" />
    </div>
  );
}

// ─── 15. Event Countdown ─────────────────────────────────────────────────────
function EventCountdownLayout({
  target, title, bgUrl, tickers, primaryColor,
}: CommonProps & { target: string; title: string; bgUrl: string }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, past: false });

  useEffect(() => {
    const calc = () => {
      if (!target) return;
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, past: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining({ days: d, hours: h, minutes: m, seconds: s, past: false });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [target]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const units = [
    { label: 'GÜND', value: pad(remaining.days) },
    { label: 'SAAT', value: pad(remaining.hours) },
    { label: 'DAK', value: pad(remaining.minutes) },
    { label: 'SANİYE', value: pad(remaining.seconds) },
  ];
  const targetDate = target ? new Date(target).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Background */}
      {bgUrl ? (
        <>
          <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'rgba(2,8,23,0.72)' }} />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primaryColor}20 0%, rgba(2,8,23,0.98) 100%)` }}
        />
      )}
      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-8 px-8">
        <p
          className="text-white/70 font-light uppercase tracking-[0.35em] text-center"
          style={{ fontSize: 'clamp(0.8rem, 2vw, 1.2rem)' }}
        >
          {title}
        </p>
        {remaining.past ? (
          <p className="text-white text-4xl font-black uppercase tracking-widest">BAŞLADI!</p>
        ) : (
          <div className="flex items-end gap-6 md:gap-10">
            {units.map((u) => (
              <div key={u.label} className="flex flex-col items-center gap-2">
                <div
                  className="font-black tabular-nums leading-none"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 'clamp(3rem, 10vw, 9rem)',
                    background: `linear-gradient(135deg, #ffffff 30%, ${primaryColor}cc 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {u.value}
                </div>
                <span className="text-white/40 text-xs font-bold tracking-[0.25em] uppercase">{u.label}</span>
              </div>
            ))}
          </div>
        )}
        {targetDate && (
          <p className="text-white/40 text-sm tracking-widest">📅 {targetDate}</p>
        )}
      </div>
      {/* Ticker */}
      <div className="relative flex-shrink-0">
        <TickerFooter tickers={tickers} primaryColor={primaryColor} />
      </div>
    </div>
  );
}

// ─── 16. Split Scoreboard ─────────────────────────────────────────────────────
interface ScoreEntry { home: string; away: string; score: string; live?: boolean }
function SplitScoreboardLayout({
  instagramPosts, feedContent, scores, tickers, weather, primaryColor, secondaryColor, igSlideDuration,
}: CommonProps & { instagramPosts: InstagramPostData[]; feedContent: any[]; scores: string }) {
  let scoreList: ScoreEntry[] = [];
  try { scoreList = JSON.parse(scores) as ScoreEntry[]; } catch {}

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Scoreboard */}
        <div
          className="w-1/2 flex flex-col overflow-hidden flex-shrink-0"
          style={{ background: 'rgba(2,8,23,0.97)', borderRight: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚽</span>
              <span className="font-bold text-white text-sm uppercase tracking-wider">Maçlar</span>
            </div>
            <ClockWidget compact />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
            {scoreList.length > 0 ? scoreList.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex-1 text-right">
                  <p className="text-white font-semibold text-sm truncate">{s.home}</p>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span
                    className="font-black text-xl tabular-nums px-3 py-1 rounded-lg"
                    style={{
                      fontFamily: "'Space Grotesk', monospace",
                      background: s.live ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                      color: s.live ? '#fca5a5' : 'white',
                    }}
                  >
                    {s.score}
                  </span>
                  {s.live && (
                    <span className="text-red-400 text-[9px] font-bold uppercase tracking-widest animate-pulse">Canlı</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm truncate">{s.away}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                <span className="text-4xl">⚽</span>
                <p className="text-white/50 text-xs uppercase tracking-widest">Skor verisi bekleniyor</p>
                <p className="text-white/30 text-xs">Settings: scoreboard_json</p>
              </div>
            )}
          </div>
        </div>
        {/* Right: Social feed */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {instagramPosts.length > 0
            ? <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
            : <div className="p-3 h-full overflow-hidden"><SocialFeed content={feedContent} /></div>
          }
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 pointer-events-none z-20"
            style={{ background: 'linear-gradient(to bottom, rgba(2,8,23,0.85) 0%, transparent 100%)' }}
          >
            <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
            <img src="/logo.png" alt="" className="h-6 w-auto object-contain opacity-50" />
          </div>
        </div>
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}

// ─── 12. Portrait ─────────────────────────────────────────────────────────────
function PortraitLayout({
  highlight, feedContent, instagramPosts, qrUrl, tickers, weather, primaryColor, secondaryColor, igSlideDuration,
}: CommonProps & { highlight: any; feedContent: any[]; instagramPosts: InstagramPostData[]; qrUrl: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.94)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
        <ClockWidget compact />
      </div>
      {/* Instagram big zone */}
      <div className="relative overflow-hidden flex-[2] min-h-0">
        {instagramPosts.length > 0
          ? <InstagramCarousel posts={instagramPosts} autoSlide slideDuration={igSlideDuration} className="absolute inset-0" />
          : highlight
            ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            : <EmptyState />
        }
      </div>
      {/* Weather strip */}
      {weather && (
        <div
          className="flex items-center justify-between px-6 py-2.5 flex-shrink-0"
          style={{ background: 'rgba(2,8,23,0.90)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <WeatherWidget weather={weather} city={weather.city} compact />
          {qrUrl && <QRWidget url={qrUrl} />}
        </div>
      )}
      {/* Feed */}
      <div className="flex-1 min-h-0 overflow-hidden p-3">
        <SocialFeed content={feedContent.slice(0, 3)} />
      </div>
      <TickerFooter tickers={tickers} primaryColor={primaryColor} />
    </div>
  );
}
