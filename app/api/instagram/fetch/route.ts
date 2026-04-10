import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

interface IGEdge {
  node: {
    id: string;
    shortcode: string;
    display_url: string;
    thumbnail_src?: string;
    is_video: boolean;
    video_url?: string;
    edge_media_to_caption: { edges: Array<{ node: { text: string } }> };
    edge_liked_by: { count: number };
    edge_media_to_comment: { count: number };
    taken_at_timestamp: number;
  };
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().replace(/^@/, '');
  if (!username) {
    return NextResponse.json({ error: 'username zorunlu' }, { status: 400 });
  }

  try {
    const { data } = await axios.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'x-ig-app-id': '936619743392459',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
          Referer: `https://www.instagram.com/${username}/`,
        },
        timeout: 12000,
      }
    );

    const user = data?.data?.user;
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }
    if (user.is_private) {
      return NextResponse.json({ error: 'Bu hesap gizli, içerik görüntülenemiyor' }, { status: 403 });
    }

    const edges: IGEdge[] = user.edge_owner_to_timeline_media?.edges ?? [];

    const posts = edges.map(({ node }) => ({
      instagramId: node.id,
      shortcode: node.shortcode,
      username,
      displayName: (user.full_name as string) || username,
      profilePicUrl: user.profile_pic_url as string,
      mediaUrl: node.is_video ? (node.video_url ?? node.display_url) : node.display_url,
      thumbnailUrl: node.thumbnail_src ?? node.display_url,
      mediaType: node.is_video ? 'VIDEO' : 'IMAGE',
      caption: node.edge_media_to_caption.edges[0]?.node.text ?? '',
      permalink: `https://www.instagram.com/p/${node.shortcode}/`,
      likeCount: node.edge_liked_by.count,
      commentCount: node.edge_media_to_comment.count,
      postedAt: new Date(node.taken_at_timestamp * 1000).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      profile: {
        username,
        displayName: (user.full_name as string) || username,
        profilePicUrl: user.profile_pic_url as string,
        followerCount: (user.edge_followed_by as { count: number } | undefined)?.count ?? 0,
        isVerified: (user.is_verified as boolean) ?? false,
      },
      posts,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) return NextResponse.json({ error: 'Hesap bulunamadı' }, { status: 404 });
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: 'Instagram erişimi engellendi. Daha sonra tekrar deneyin.' },
          { status: 403 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: 'Instagram hız limiti aşıldı. Birkaç dakika bekleyin.' },
          { status: 429 }
        );
      }
    }
    console.error('[instagram/fetch]', err);
    return NextResponse.json({ error: 'Instagram verisi alınamadı' }, { status: 500 });
  }
}
