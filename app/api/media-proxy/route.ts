import { NextRequest, NextResponse } from 'next/server';
import { shouldProxyExternalMedia } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');

  if (!target || !shouldProxyExternalMedia(target)) {
    return NextResponse.json({ success: false, error: 'Unsupported media URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Social Lounge TV Media Proxy',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch media' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Proxy request failed' }, { status: 502 });
  }
}