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
  | 'markets';       // Live market data full-screen

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
  highlight, feedContent, tickers, weather, primaryColor, secondaryColor, igSlideDuration, qrUrl,
}: CommonProps & { highlight: any; feedContent: any[]; qrUrl: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <HeaderBar primaryColor={primaryColor} weather={weather} />
      <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {highlight
            ? <AIHighlight content={highlight} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            : <div className="h-full glass rounded-2xl flex items-center justify-center"><EmptyState /></div>
          }
        </div>
        <div className="w-72 flex flex-col gap-3 overflow-hidden flex-shrink-0">
          {qrUrl && <QRWidget url={qrUrl} />}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SocialFeed content={feedContent} />
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
            <SocialFeed content={feedContent} compact />
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
          <SocialFeed content={feedContent.slice(0, 3)} />
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
            : <div className="h-full overflow-hidden"><SocialFeed content={feedContent.slice(3)} /></div>
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
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 relative z-10"
        style={{ background: 'rgba(2,8,23,0.94)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AccentLine primaryColor={primaryColor} />
        <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
        <div className="flex items-center gap-5">
          <WeatherWidget weather={weather} city={weather?.city ?? ''} compact />
          <div className="w-px h-6 bg-white/10" />
          <ClockWidget compact />
        </div>
      </div>
      {/* Main content */}
      <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">
        {/* Market panel */}
        <div className="flex-1 min-h-0 overflow-auto">
          <MarketWidget variant="panel" markets={markets} primaryColor={primaryColor} />
        </div>
        {/* News sidebar */}
        {news && news.length > 0 && (
          <div
            className="w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 px-1 pb-1">Gündem</p>
            {news.slice(0, 12).map((item: any, i: number) => (
              <div
                key={item.id ?? i}
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-white/80 text-xs font-medium leading-snug line-clamp-3">{item.title}</p>
                <p className="text-white/30 text-[10px] mt-1.5">{item.source}</p>
              </div>
            ))}
          </div>
        )}
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
      <div className="relative overflow-hidden" style={{ height: '45%' }}>
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
