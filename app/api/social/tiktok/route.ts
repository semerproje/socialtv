import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/social/tiktok?url=<tiktok_url>
 * Fetches TikTok metadata via the free oEmbed API, then imports as a Content item.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, error: 'URL parameter required' }, { status: 400 });
  }

  if (!url.includes('tiktok.com')) {
    return NextResponse.json({ success: false, error: 'Invalid TikTok URL' }, { status: 400 });
  }

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialTV/1.0)' },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'TikTok oEmbed failed' }, { status: 502 });
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      data: {
        author: data.author_name ?? 'TikTok User',
        authorHandle: data.author_url?.split('/').pop() ?? '',
        title: data.title ?? '',
        thumbnailUrl: data.thumbnail_url ?? null,
        thumbnailWidth: data.thumbnail_width,
        thumbnailHeight: data.thumbnail_height,
        originalUrl: url,
        html: data.html, // embed HTML for optional rendering
      },
    });
  } catch (error) {
    console.error('TikTok oEmbed error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch TikTok metadata' }, { status: 500 });
  }
}

/**
 * POST /api/social/tiktok
 * Import a TikTok video as a Content item in the library.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, author, authorHandle, title, thumbnailUrl, isApproved = false } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
    }

    const item = await db.content.create({
      platform: 'tiktok',
      author: author ?? 'TikTok',
      authorHandle: authorHandle ?? null,
      authorAvatar: null,
      isVerified: false,
      text: title ?? '',
      mediaUrl: thumbnailUrl ?? null,
      mediaType: 'image',
      externalUrl: url,
      externalId: url,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      isApproved,
      isFeatured: false,
      isHighlight: false,
      displayOrder: 0,
      moderationPassed: true,
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('TikTok import error:', error);
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 });
  }
}
