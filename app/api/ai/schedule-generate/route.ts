import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklySchedule, generateAIPlaylist } from '@/lib/ai-engine';
import { db } from '@/lib/db';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// POST /api/ai/schedule-generate
// body: { action: "weekly" | "playlist", weekStart?, businessContext?, contentSummary?, theme?, durationMinutes?, autoSave? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const rl = enforceRateLimit(req, 'ai-schedule-gen', 5, 60_000);
  if (rl instanceof NextResponse) return rl;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY yapılandırılmamış' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { action = 'weekly', autoSave = false } = body;

    // ── Generate weekly schedule ───────────────────────────────────────────────
    if (action === 'weekly') {
      const {
        weekStart = new Date().toISOString().slice(0, 10),
        businessContext = 'Social Lounge TV — modern lounge/bar',
        contentSummary,
      } = body;

      // If no contentSummary provided, build one from DB
      let summary = contentSummary;
      if (!summary) {
        const [adCount, contentCount, igCount] = await Promise.all([
          db.advertisement.findMany({ where: { isActive: true } }).then((r) => r.length),
          db.content.count({ where: { isApproved: true } }),
          db.instagramPost.findMany({ where: { isApproved: true } }).then((r) => r.length),
        ]);
        summary = `${adCount} aktif reklam, ${contentCount} onaylı sosyal içerik, ${igCount} Instagram gönderisi`;
      }

      const { events, narrative } = await generateWeeklySchedule(
        weekStart,
        businessContext,
        summary,
        0,
      );

      let savedCount = 0;
      if (autoSave && events.length > 0) {
        for (const ev of events) {
          try {
            await db.scheduleEvent.create({
              title: ev.title,
              type: ev.type,
              layoutType: ev.layoutType ?? null,
              contentRef: (ev as unknown as Record<string, string>).contentRef ?? null,
              startAt: ev.startAt,
              endAt: ev.endAt ?? null,
              recurrence: ev.recurrence ?? 'once',
              priority: ev.priority ?? 'normal',
              color: ev.color ?? null,
              isActive: true,
              screenId: null,
            });
            savedCount++;
          } catch {
            // Skip individual save failures
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: { events, narrative, savedCount, autoSaved: autoSave },
      });
    }

    // ── Generate AI playlist ───────────────────────────────────────────────────
    if (action === 'playlist') {
      const {
        theme = 'Genel lounge yayın',
        durationMinutes = 60,
        businessContext = 'Social Lounge TV',
        autoSave: save = false,
      } = body;

      const LAYOUTS = [
        'default', 'youtube', 'instagram', 'split_2', 'promo', 'social_wall',
        'ambient', 'news_focus', 'markets', 'digital_signage',
      ];

      const suggestion = await generateAIPlaylist(theme, durationMinutes, LAYOUTS, businessContext);

      let savedPlaylistId: string | null = null;
      if (save) {
        const created = await db.playlist.create({
          name: suggestion.name,
          description: suggestion.description ?? null,
          loop: true,
          shuffle: false,
          transition: suggestion.transition ?? 'fade',
          defaultDuration: suggestion.defaultDuration ?? 15,
          isActive: true,
        });
        savedPlaylistId = created.id as string;

        for (let i = 0; i < suggestion.items.length; i++) {
          const item = suggestion.items[i];
          await db.playlistItem.create({
            playlistId: savedPlaylistId,
            order: i,
            type: item.type,
            title: item.title ?? null,
            layoutType: item.layoutType ?? null,
            youtubeVideoId: item.youtubeVideoId ?? null,
            mediaUrl: item.mediaUrl ?? null,
            duration: item.duration ?? suggestion.defaultDuration,
            isActive: true,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: { suggestion, savedPlaylistId, autoSaved: save },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/ai/schedule-generate]', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
