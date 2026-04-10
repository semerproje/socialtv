import { NextResponse } from 'next/server';
import type { NewsItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FEEDS: Record<string, string> = {
  tr:       'https://news.google.com/rss?hl=tr&gl=TR&ceid=TR:tr',
  tech:     'https://news.google.com/rss/search?q=teknoloji&hl=tr&gl=TR&ceid=TR:tr',
  business: 'https://news.google.com/rss/search?q=ekonomi+borsa&hl=tr&gl=TR&ceid=TR:tr',
  world:    'https://news.google.com/rss/search?q=dünya&hl=tr&gl=TR&ceid=TR:tr',
};

function extractText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
  return (xml.match(re)?.[1] ?? '').trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? 'tr';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '15', 10), 30);

  const feedUrl = FEEDS[category] ?? FEEDS.tr;

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialTV/1.0)' },
      next: { revalidate: 600 }, // 10 min cache
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 502 });
    }

    const xml = await res.text();

    // Extract items between <item> tags
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items: NewsItem[] = [];
    let match;
    let idx = 0;

    while ((match = itemRegex.exec(xml)) !== null && idx < limit) {
      const item = match[1];
      const title = stripHtml(extractText(item, 'title'));
      const link = extractText(item, 'link') || extractText(item, 'guid');
      const pubDate = extractText(item, 'pubDate');
      const source = stripHtml(extractText(item, 'source'));
      const description = stripHtml(extractText(item, 'description')).slice(0, 200);

      if (title) {
        items.push({
          id: `news_${idx}_${Date.now()}`,
          title,
          source: source || 'Google Haberler',
          link,
          pubDate,
          description: description || undefined,
        });
        idx++;
      }
    }

    return NextResponse.json({ success: true, data: items, count: items.length, category }, {
      headers: { 'Cache-Control': 'public, s-maxage=600', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ success: false, error: 'News fetch failed' }, { status: 500 });
  }
}
