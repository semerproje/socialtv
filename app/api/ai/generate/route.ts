import { NextRequest, NextResponse } from 'next/server';
import { generateAdCopy, generateContentSuggestion } from '@/lib/ai-engine';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-generate-post', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { type, ...params } = body;

    if (!type) {
      return NextResponse.json({ success: false, error: 'type is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key yapılandırılmamış. GEMINI_API_KEY ortam değişkenini ayarlayın.' },
        { status: 503 },
      );
    }

    switch (type) {
      case 'ad_copy': {
        const result = await generateAdCopy(params);
        return NextResponse.json({ success: true, data: result });
      }
      case 'content': {
        const result = await generateContentSuggestion(params.context ?? '');
        return NextResponse.json({ success: true, data: { text: result } });
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error) {
    console.error('AI generate error:', error);
    const message = error instanceof Error ? error.message : 'AI generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
