import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeContent, moderateContent } from '@/lib/ai-engine';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function normalizeContentText(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@][\p{L}\p{N}_]+/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

// GET /api/content
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, 'viewer');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const approved = searchParams.get('approved');
    const featured = searchParams.get('featured');
    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20');

    const where = {
      ...(platform && { platform }),
      ...(approved !== null && { isApproved: approved === 'true' }),
      ...(featured !== null && { isFeatured: featured === 'true' }),
    };

    const [items, total] = await Promise.all([
      db.content.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.content.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: items, total, page, pageSize });
  } catch (error) {
    console.error('GET /api/content error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch content' }, { status: 500 });
  }
}

// POST /api/content — Create new content
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'content-post', 30, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      platform = 'custom', author, authorHandle, authorAvatar,
      isVerified = false, text, mediaUrl, mediaType,
      likes = 0, comments = 0, shares = 0, views = 0,
      isApproved = false, isFeatured = false,
      externalId, externalUrl,
      scheduledFor,
      autoAnalyze = true,
    } = body;

    if (!author || !text) {
      return NextResponse.json(
        { success: false, error: 'author ve text zorunludur' },
        { status: 400 },
      );
    }

    // Duplicate detection by externalId
    if (externalId) {
      const existing = await db.content.findMany({ where: {} });
      const dupe = existing.find((c) => c.externalId === externalId);
      if (dupe) {
        return NextResponse.json(
          { success: false, error: `Bu içerik zaten mevcut (ID: ${externalId})` },
          { status: 409 },
        );
      }
    }

    // Duplicate detection by text similarity (Levenshtein < 15)
    const normalizedInput = normalizeContentText(text);
    if (normalizedInput.length >= 20) {
      const existing = await db.content.findMany({ where: {} });
      const similar = existing
        .map((c) => {
          const t = typeof c.text === 'string' ? c.text : '';
          const normalized = normalizeContentText(t);
          if (!normalized || normalized.length < 20) return null;
          const distance = levenshtein(normalizedInput, normalized);
          return {
            id: String(c.id),
            author: String(c.author ?? 'Bilinmeyen'),
            text: t,
            distance,
          };
        })
        .filter((row): row is { id: string; author: string; text: string; distance: number } => row !== null)
        .filter((row) => row.distance < 15)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      if (similar.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Benzer içerik tespit edildi (${similar.length} adet). Lütfen mevcut kaydı kullanın veya metni güncelleyin.`,
            similar,
          },
          { status: 409 },
        );
      }
    }

    // AI Moderation & Analysis
    let aiData: Record<string, unknown> = {};
    let moderationPassed = true;

    if (autoAnalyze && process.env.GEMINI_API_KEY) {
      try {
        const [modResult, analysisResult] = await Promise.all([
          moderateContent(text),
          analyzeContent(text),
        ]);

        moderationPassed = modResult.passed;
        aiData = {
          sentiment: analysisResult.sentiment,
          sentimentScore: analysisResult.sentimentScore,
          aiSummary: analysisResult.summary,
          aiTags: JSON.stringify(analysisResult.tags),
          moderationPassed: modResult.passed && analysisResult.isAppropriate,
          isHighlight: analysisResult.sentimentScore > 0.8,
        };
      } catch {
        // Continue without AI analysis if it fails
      }
    }

    const content = await db.content.create({
        platform, author, authorHandle, authorAvatar,
        isVerified, text, mediaUrl, mediaType,
        likes: Number(likes), comments: Number(comments),
        shares: Number(shares), views: Number(views),
        isApproved, isFeatured,
        moderationPassed,
        externalId, externalUrl,
        scheduledFor: scheduledFor || null,
        ...aiData,
    });

    return NextResponse.json({ success: true, data: content }, { status: 201 });
  } catch (error) {
    console.error('POST /api/content error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create content' }, { status: 500 });
  }
}
