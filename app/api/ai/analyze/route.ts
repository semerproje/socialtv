import { NextRequest, NextResponse } from 'next/server';
import { analyzeContent } from '@/lib/ai-engine';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'ai-analyze-post', 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdmin(request, 'editor');
  if (!auth.ok) return auth.response;

  try {
    const { text } = await request.json() as { text: string };

    if (!text) {
      return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key yapılandırılmamış.' },
        { status: 503 },
      );
    }

    const analysis = await analyzeContent(text);
    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    console.error('AI analyze error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
