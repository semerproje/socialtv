// ─── Advertisement Types ──────────────────────────────────────────────────────

export type AdType = 'image' | 'video' | 'html' | 'text' | 'fullscreen';

export interface AdSchedule {
  days: number[];       // 0=Sunday, 1=Monday, ..., 6=Saturday
  startHour: number;    // 0-23
  endHour: number;      // 0-23
}

export interface TextAdContent {
  headline: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  badge?: string;
}

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  type: AdType;
  content: string;
  thumbnailUrl?: string;
  duration: number;
  priority: number;
  isActive: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  scheduleJson?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  impressions: number;
  totalPlayTime: number;
  completions: number;
  aiGenerated: boolean;
  aiPrompt?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AdWithSchedule extends Advertisement {
  schedule?: AdSchedule;
}

// ─── Content Types ───────────────────────────────────────────────────────────

export type ContentPlatform = 'custom' | 'instagram' | 'twitter' | 'tiktok' | 'announcement';
export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface Content {
  id: string;
  platform: ContentPlatform;
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  isVerified: boolean;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'gif';
  likes: number;
  comments: number;
  shares: number;
  views: number;
  isApproved: boolean;
  isFeatured: boolean;
  isHighlight: boolean;
  displayOrder: number;
  sentiment?: SentimentType;
  sentimentScore?: number;
  aiSummary?: string;
  aiTags?: string;
  moderationPassed: boolean;
  externalId?: string;
  externalUrl?: string;
  postedAt: Date | string;
  createdAt: Date | string;
}

// ─── Ticker Types ────────────────────────────────────────────────────────────

export interface TickerMessage {
  id: string;
  text: string;
  emoji?: string;
  isActive: boolean;
  priority: number;
  color?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export type AnalyticsEventType = 'ad_impression' | 'ad_complete' | 'content_view' | 'qr_scan';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  advertisementId?: string;
  contentId?: string;
  screenId?: string;
  duration?: number;
  metadataJson?: string;
  createdAt: Date | string;
}

export interface AnalyticsSummary {
  totalImpressions: number;
  totalAdPlays: number;
  totalContentViews: number;
  totalQRScans: number;
  topAds: { id: string; title: string; impressions: number }[];
  dailyStats: { date: string; impressions: number; views: number }[];
}

// ─── Market Data Types ────────────────────────────────────────────────────────

export interface MarketCurrency {
  code: string;   // "USD", "EUR", "GBP"
  name: string;   // "Dolar", "Euro"
  rate: number;   // rate in TRY
  change?: number; // % change (optional)
}

export interface MarketMetal {
  code: string;   // "XAU", "XAG"
  name: string;   // "Altın", "Gümüş"
  priceTRY: number;
  priceUSD: number;
  change?: number;
  unit?: 'gram' | 'oz';
}

export interface MarketCrypto {
  code: string;   // "BTC", "ETH"
  name: string;
  priceUSD: number;
  priceTRY: number;
  change?: number;
}

export interface MarketData {
  timestamp: string;
  currencies: MarketCurrency[];
  metals: MarketMetal[];
  crypto: MarketCrypto[];
}

// ─── News Types ───────────────────────────────────────────────────────────────

export type NewsCategory = 'gundem' | 'dunya' | 'ekonomi' | 'teknoloji' | 'spor' | 'eglence' | 'bilim' | 'saglik';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  link: string;
  pubDate: string;
  description?: string;
  imageUrl?: string;
  category?: NewsCategory | string;
}

// ─── Live TV / Broadcast Types ──────────────────────────────────────────────

export type LiveProvider = 'bein' | 'tabii' | 'youtube' | 'custom' | 'other';
export type LivePlaybackMode = 'native' | 'iframe' | 'youtube';
export type SchedulePriority = 'low' | 'normal' | 'high' | 'critical';

export interface LiveChannel {
  id: string;
  title: string;
  provider: LiveProvider;
  category?: string;
  description?: string;
  playbackMode: LivePlaybackMode;
  streamUrl?: string;
  embedUrl?: string;
  videoId?: string;
  logoUrl?: string;
  posterUrl?: string;
  rightsNote?: string;
  tags?: string[] | string;
  isActive: boolean;
  requiresAuth?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LivePlaybackSource {
  title: string;
  provider?: LiveProvider;
  playbackMode: LivePlaybackMode;
  streamUrl?: string;
  embedUrl?: string;
  videoId?: string;
  posterUrl?: string;
  logoUrl?: string;
}

export type ChannelHealthState = 'healthy' | 'degraded' | 'auth-required' | 'unreachable';

export interface ChannelHealthCheck {
  state: ChannelHealthState;
  checkedAt: string;
  latencyMs: number;
  statusCode?: number;
  message: string;
  target?: string;
}

export interface ChannelHealthLog {
  id: string;
  channelId: string;
  channelTitle: string;
  provider: LiveProvider;
  state: ChannelHealthState;
  checkedAt: string;
  latencyMs: number;
  statusCode?: number;
  message: string;
  target?: string;
  createdAt: string;
}

export interface ChannelHealthDailyAggregate {
  id: string;
  day: string;
  channelId: string;
  channelTitle: string;
  provider: LiveProvider;
  totalChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  authRequiredChecks: number;
  unreachableChecks: number;
  totalLatencyMs: number;
  lastState: ChannelHealthState;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Schedule Types ───────────────────────────────────────────────────────────

export type ScheduleRecurrence = 'once' | 'daily' | 'weekly' | 'weekdays' | 'weekends';
export type ScheduleEventType = 'layout' | 'youtube' | 'instagram' | 'content' | 'announcement' | 'custom' | 'markets' | 'news' | 'live_tv';

export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  screenId?: string;       // null = all screens
  type: ScheduleEventType;
  contentRef?: string;     // ID of referenced content
  sourceRef?: string;      // ID of referenced live channel
  layoutType?: string;     // for type='layout'
  payload?: string;        // JSON extra data
  startAt: string;         // ISO datetime
  endAt?: string;
  recurrence: ScheduleRecurrence;
  daysOfWeek?: number[];   // for custom recurrence [0-6]
  priority?: SchedulePriority;
  autoSwitch?: boolean;
  color?: string;          // display color on calendar
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Display Types ────────────────────────────────────────────────────────────

export interface DisplayData {
  currentAd: Advertisement | null;
  nextAd: Advertisement | null;
  content: Content[];
  tickers: TickerMessage[];
  settings: Record<string, string>;
  weather?: WeatherData;
  markets?: MarketData;
  news?: NewsItem[];
  timestamp: string;
}

// ─── Screen / Multi-Display Types ────────────────────────────────────────────

export type LayoutType =
  | 'default'
  | 'youtube'
  | 'instagram'
  | 'split_2'
  | 'fullscreen'
  | 'digital_signage'
  | 'social_wall'
  | 'ambient'
  | 'promo'
  | 'triple'
  | 'news_focus'
  | 'portrait'
  | 'markets'
  | 'breaking_news'
  | 'event_countdown'
  | 'split_scoreboard';

export interface ScreenData {
  id: string;
  name: string;
  location?: string;
  layoutType: LayoutType;
  orientation: 'landscape' | 'portrait';
  resolution?: string;
  isActive: boolean;
  isOnline?: boolean;
  lastSeen?: Date | string;
  ipAddress?: string;
  groupId?: string;
  group?: { id: string; name: string } | null;
}

export interface YouTubeVideoData {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number;
  displayOrder: number;
  isActive: boolean;
  muted: boolean;
  loop: boolean;
  startSeconds: number;
}

export interface InstagramPostData {
  id: string;
  instagramId?: string;
  username: string;
  displayName?: string;
  profilePicUrl?: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  thumbnailUrl?: string;
  caption?: string;
  permalink?: string;
  likeCount: number;
  commentCount: number;
  isApproved: boolean;
  isDisplayed: boolean;
  postedAt: Date | string;
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType =
  | 'connected'
  | 'heartbeat'
  | 'reload'
  | 'update_content'
  | 'play_youtube'
  | 'play_stream'
  | 'play_playlist'
  | 'show_instagram'
  | 'show_ad'
  | 'change_layout'
  | 'fullscreen_video'
  | 'overlay_message'
  | 'clear_overlay'
  | 'set_volume'
  | 'mute'
  | 'unmute'
  | 'screen_connected'
  | 'screen_disconnected';


export interface WeatherData {
  city: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  icon: string;
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export interface AppSettings {
  app_name: string;
  app_tagline: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  weather_lat: string;
  weather_lon: string;
  weather_city: string;
  content_refresh_ms: string;
  show_qr_code: string;
  qr_url: string;
  qr_label: string;
  ai_auto_moderate: string;
  ai_auto_analyze: string;
  layout: string;
  ticker_speed: string;
  wifi_name: string;
  wifi_password: string;
  [key: string]: string;
}

export type SystemLogLevel = 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: string;
  message: string;
  metadataJson?: string;
  createdAt: string;
}

export interface MonitoringHealth {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  connectedScreens: number;
  activeChannels: number;
  activeScheduleEvents: number;
  version: string;
}

export type AdminRole = 'viewer' | 'editor' | 'ops';

// ─── AI Types ────────────────────────────────────────────────────────────────

export type AIRequestType = 'generate_ad' | 'analyze_content' | 'moderate' | 'suggest' | 'chat';

export interface AIAdGenerationRequest {
  business: string;
  offer: string;
  tone?: string;
  targetAudience?: string;
  callToAction?: string;
}

export interface AIContentAnalysis {
  sentiment: SentimentType;
  sentimentScore: number;
  summary: string;
  tags: string[];
  isAppropriate: boolean;
  moderationReason?: string;
  highlights: string[];
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Screen Types ─────────────────────────────────────────────────────────────

export interface Screen {
  id: string;
  name: string;
  location?: string;
  layout: string;
  isActive: boolean;
  lastSeen?: Date | string;
  ipAddress?: string;
}

// ─── Playlist Types ───────────────────────────────────────────────────────────

export type PlaylistItemType =
  | 'image'
  | 'video'
  | 'youtube'
  | 'layout'
  | 'content'
  | 'ad'
  | 'instagram'
  | 'announcement'
  | 'url'
  | 'scene';

export type PlaylistTransition = 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'blur' | 'none';

export interface PlaylistItem {
  id: string;
  playlistId: string;
  order: number;
  type: PlaylistItemType;
  title?: string;
  // content refs
  contentRef?: string;     // content / ad / instagram item ID
  mediaUrl?: string;       // image / video / url
  youtubeVideoId?: string; // youtube video ID
  layoutType?: string;     // for type='layout'
  sceneId?: string;        // for type='scene'
  // playback
  duration: number;        // seconds (0 = play full video)
  transition?: PlaylistTransition; // override playlist-level transition
  // thumbnails / metadata
  thumbnailUrl?: string;
  payload?: string;        // JSON extra
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  loop: boolean;
  shuffle: boolean;
  transition: PlaylistTransition;
  defaultDuration: number; // seconds
  tags?: string;           // JSON array
  screenIds?: string;      // JSON array of screen IDs
  items?: PlaylistItem[];
  itemCount?: number;
  totalDuration?: number;  // computed sum of durations
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
