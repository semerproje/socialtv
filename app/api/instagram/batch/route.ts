import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface BatchPost {
  instagramId?: string;
  username: string;
  displayName?: string;
  profilePicUrl?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType?: string;
  caption?: string;
  permalink?: string;
  likeCount?: number;
  commentCount?: number;
  postedAt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { posts } = (await req.json()) as { posts: BatchPost[] };
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'posts array zorunlu' }, { status: 400 });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const post of posts) {
      // Dedup by instagramId
      if (post.instagramId) {
        const existing = await db.instagramPost.findByInstagramId(post.instagramId);
        if (existing) {
          results.push({ ...(existing as Record<string, unknown>), skipped: true });
          continue;
        }
      }
      const created = await db.instagramPost.create({
        ...post,
        isApproved: true,
        isDisplayed: true,
      });
      results.push({ ...(created as Record<string, unknown>), skipped: false });
    }

    const newCount = results.filter((r) => !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    return NextResponse.json({ success: true, created: newCount, skipped: skippedCount, results });
  } catch (err) {
    console.error('[instagram/batch]', err);
    return NextResponse.json({ error: 'Batch import başarısız' }, { status: 500 });
  }
}
