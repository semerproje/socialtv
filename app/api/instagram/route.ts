import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/instagram — list posts
export async function GET(req: NextRequest) {
  try {
    const approved = req.nextUrl.searchParams.get('approved');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10);

    const posts = await db.instagramPost.findMany({
      where: {
        isDisplayed: true,
        ...(approved === '1' ? { isApproved: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { postedAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    console.error('GET /api/instagram error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// POST /api/instagram — add post manually
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      username,
      displayName,
      profilePicUrl,
      mediaUrl,
      mediaType,
      thumbnailUrl,
      caption,
      permalink,
      likeCount,
      commentCount,
      instagramId,
      postedAt,
    } = body;

    if (!username || !mediaUrl) {
      return NextResponse.json(
        { error: 'username and mediaUrl are required' },
        { status: 400 }
      );
    }

    const post = await db.instagramPost.create({
        instagramId: instagramId ?? undefined,
        username,
        displayName,
        profilePicUrl,
        mediaUrl,
        mediaType: mediaType ?? 'IMAGE',
        thumbnailUrl,
        caption,
        permalink,
        likeCount: likeCount ?? 0,
        commentCount: commentCount ?? 0,
        isApproved: true,
        isDisplayed: true,
        postedAt: postedAt ? new Date(postedAt).toISOString() : new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    console.error('POST /api/instagram error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add post' }, { status: 500 });
  }
}

// DELETE /api/instagram?id=...
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await db.instagramPost.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/instagram error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete post' }, { status: 500 });
  }
}
