import { NextRequest, NextResponse } from 'next/server';
import { aiChat } from '@/lib/ai-engine';
import { prisma } from '@/lib/prisma';
import type { AIChatMessage } from '@/types';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-chat-post', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { messages, includeContext = true } = await request.json() as {
      messages: AIChatMessage[];
      includeContext?: boolean;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'messages is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key yapılandırılmamış. .env.local dosyasında OPENAI_API_KEY ayarlayın.' },
        { status: 503 },
      );
    }

    // Build context from DB
    let context: string | undefined;
    if (includeContext) {
      try {
        const [adCount, contentCount, activeAds] = await Promise.all([
          prisma.advertisement.count(),
          prisma.content.count({ where: { isApproved: true } }),
          prisma.advertisement.findMany({
            where: { isActive: true },
            select: { title: true, priority: true, impressions: true },
            orderBy: { priority: 'desc' },
            take: 5,
          }),
        ]);

        context = `
Mevcut sistem durumu:
- Toplam reklam: ${adCount}
- Aktif reklamlar: ${activeAds.map((a: { title: string; priority: number; impressions: number }) => `"${a.title}" (öncelik: ${a.priority}, gösterim: ${a.impressions})`).join(', ')}
- Onaylı içerik sayısı: ${contentCount}
`;
      } catch {
        // Continue without context
      }
    }

    const reply = await aiChat(messages, context);
    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error('AI chat error:', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
