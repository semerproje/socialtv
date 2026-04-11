import { NextResponse } from 'next/server';
import type { NewsItem, NewsCategory } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Feed definitions ─────────────────────────────────────────────────────────

interface FeedDef { url: string; label: string; emoji: string; }

const FEEDS: Record<string, FeedDef> = {
  gundem:    { url: 'https://news.google.com/rss?hl=tr&gl=TR&ceid=TR:tr',                                   label: 'Gündem',    emoji: '🗞️' },
  dunya:     { url: 'https://news.google.com/rss/search?q=dünya+haberleri&hl=tr&gl=TR&ceid=TR:tr',         label: 'Dünya',     emoji: '🌍' },
  ekonomi:   { url: 'https://news.google.com/rss/search?q=ekonomi+borsa+dolar&hl=tr&gl=TR&ceid=TR:tr',    label: 'Ekonomi',   emoji: '💹' },
  teknoloji: { url: 'https://news.google.com/rss/search?q=teknoloji+yapay+zeka&hl=tr&gl=TR&ceid=TR:tr',   label: 'Teknoloji', emoji: '💻' },
  spor:      { url: 'https://news.google.com/rss/search?q=spor+futbol&hl=tr&gl=TR&ceid=TR:tr',            label: 'Spor',      emoji: '⚽' },
  eglence:   { url: 'https://news.google.com/rss/search?q=magazin+eğlence+sinema&hl=tr&gl=TR&ceid=TR:tr', label: 'Eğlence',  emoji: '🎬' },
  bilim:     { url: 'https://news.google.com/rss/search?q=bilim+uzay+araştırma&hl=tr&gl=TR&ceid=TR:tr',   label: 'Bilim',     emoji: '🔬' },
  saglik:    { url: 'https://news.google.com/rss/search?q=sağlık+tıp+ilaç&hl=tr&gl=TR&ceid=TR:tr',        label: 'Sağlık',    emoji: '🏥' },
};

export const FEED_META = Object.entries(FEEDS).map(([key, f]) => ({
  key, label: f.label, emoji: f.emoji,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  return (xml.match(re)?.[1] ?? '').trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Google News titles often end with " - Source Name"; strip that suffix. */
function cleanTitle(raw: string): string {
  const idx = raw.lastIndexOf(' - ');
  return idx > 20 ? raw.slice(0, idx).trim() : raw;
}

function extractImage(description: string): string | undefined {
  return description.match(/<img[^>]+src="([^"]+)"/i)?.[1];
}

function parsePubDate(raw: string): string {
  try { return new Date(raw).toISOString(); } catch { return new Date().toISOString(); }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchFeed(feedUrl: string, category: string, limit: number): Promise<NewsItem[]> {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialTV/1.0)' },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const items: NewsItem[] = [];
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = itemRe.exec(xml)) !== null && idx < limit) {
    const block = m[1];
    const title = cleanTitle(stripHtml(extractTag(block, 'title')));
    if (!title) continue;

    const link = extractTag(block, 'link').replace(/\n/g, '').trim()
      || extractTag(block, 'guid').trim();
    const pubDate = parsePubDate(extractTag(block, 'pubDate'));
    const source = stripHtml(extractTag(block, 'source')) || 'Google Haberler';
    const descRaw = extractTag(block, 'description');
    const description = stripHtml(descRaw).slice(0, 220) || undefined;
    const imageUrl = extractImage(descRaw);

    items.push({
      id: `${category}_${idx}_${Date.now()}`,
      title, source, link, pubDate,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      category: category as NewsCategory,
    });
    idx++;
  }
  return items;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? 'gundem';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const all = searchParams.get('all') === '1';

  try {
    if (all) {
      const results = await Promise.allSettled(
        Object.entries(FEEDS).map(([key, feed]) => fetchFeed(feed.url, key, 5)),
      );
      const combined: NewsItem[] = results
        .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
      return NextResponse.json(
        { success: true, data: combined, count: combined.length, category: 'all', meta: FEED_META },
        { headers: { 'Cache-Control': 'public, s-maxage=600', 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const feed = FEEDS[category] ?? FEEDS.gundem;
    const items = await fetchFeed(feed.url, category, limit);
    return NextResponse.json(
      { success: true, data: items, count: items.length, category, meta: FEED_META },
      { headers: { 'Cache-Control': 'public, s-maxage=600', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ success: false, error: 'Haber akışı alınamadı' }, { status: 502 });
  }
}

