import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeAndDirectSystem,
  suggestLayoutForNow,
  generateAITickers,
  type SystemStateSnapshot,
} from '@/lib/ai-engine';
import { db } from '@/lib/db';
import { broadcastToAll, sendToScreen, getConnectedScreens } from '@/lib/sse-manager';
import { requireAdmin, enforceRateLimit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// POST /api/ai/director — AI analyzes system + returns action plan
// Body: { action, execute?, userInstruction?, businessContext? }
// action: "analyze" | "quick_layout" | "execute_command" | "generate_tickers"
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;

  const rl = enforceRateLimit(req, 'ai-director', 10, 60_000);
  if (rl instanceof NextResponse) return rl;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY yapılandırılmamış' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { action = 'analyze', execute = false, userInstruction, businessContext } = body;

    // ── Build system snapshot ──────────────────────────────────────────────────
    const [screens, activeAds, approvedContent, instagramPosts, tickers, scheduleEvents, playlists] =
      await Promise.all([
        db.screen.findMany({ include: { group: true } } as Parameters<typeof db.screen.findMany>[0]),
        db.advertisement.findMany({ where: { isActive: true } }),
        db.content.count({ where: { isApproved: true } }),
        db.instagramPost.findMany({ where: { isApproved: true, isDisplayed: true } }),
        db.tickerMessage.findMany({ where: { isActive: true } }),
        db.scheduleEvent.findMany({ where: { isActive: true } }),
        db.playlist.findMany({ where: { isActive: true } }),
      ]);

    const connected = getConnectedScreens();
    const connectedIds = new Set(connected.map((s) => s.screenId));

    const now = new Date();
    const hour = now.getHours();
    const timeOfDay =
      hour >= 5 && hour < 12 ? 'morning'
      : hour >= 12 && hour < 17 ? 'afternoon'
      : hour >= 17 && hour < 22 ? 'evening'
      : 'night';

    const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    const snapshot: SystemStateSnapshot = {
      currentTime: now.toLocaleString('tr-TR'),
      dayOfWeek: DAYS_TR[now.getDay()],
      timeOfDay,
      screens: (screens as Array<Record<string, unknown>>).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        location: (s.location as string) ?? undefined,
        currentLayout: (s.layoutType as string) ?? 'default',
        isOnline: connectedIds.has(s.id as string),
        groupName: (s.group as Record<string, unknown> | null)?.name as string | undefined,
      })),
      activeAds: (activeAds as Array<Record<string, unknown>>).map((a) => ({
        id: a.id as string,
        title: a.title as string,
        type: a.type as string,
        priority: (a.priority as number) ?? 5,
      })),
      approvedContentCount: approvedContent as number,
      instagramPostCount: instagramPosts.length,
      activeTickerCount: tickers.length,
      scheduledEventsToday: (scheduleEvents as Array<Record<string, unknown>>).filter((e) => {
        const start = e.startAt ? new Date(e.startAt as string) : null;
        return start && start.toDateString() === now.toDateString();
      }).length,
      playlistCount: playlists.length,
      businessContext,
    };

    // ── Route to appropriate AI function ──────────────────────────────────────

    if (action === 'quick_layout') {
      const suggestions = await suggestLayoutForNow(now, snapshot.screens, businessContext);
      if (execute) {
        for (const s of suggestions) {
          if (s.screenId) {
            await db.screen.update(s.screenId, { layoutType: s.layout });
            sendToScreen(s.screenId, 'change_layout', { layout: s.layout, source: 'ai_director' });
          } else {
            broadcastToAll('change_layout', { layout: s.layout, source: 'ai_director' });
          }
        }
      }
      return NextResponse.json({ success: true, data: { suggestions, executed: execute } });
    }

    if (action === 'generate_tickers') {
      const { context = 'lounge/bar işletmesi', count = 5 } = body;
      const tickers = await generateAITickers(context, count);
      return NextResponse.json({ success: true, data: { tickers } });
    }

    if (action === 'execute_command') {
      // Execute a single broadcast command
      const { command, target, payload } = body;
      if (!command) return NextResponse.json({ success: false, error: 'command required' }, { status: 400 });

      if (target === 'all' || !target) {
        broadcastToAll(command, { ...payload, source: 'ai_director' });
      } else {
        sendToScreen(target as string, command, { ...payload, source: 'ai_director' });
      }
      return NextResponse.json({ success: true, data: { executed: true } });
    }

    // Default: full analysis
    const plan = await analyzeAndDirectSystem(snapshot, userInstruction);

    // If execute=true, carry out immediate broadcast commands
    if (execute) {
      for (const cmd of plan.broadcastCommands) {
        if (cmd.executeAt && new Date(cmd.executeAt) > now) continue; // skip scheduled ones
        const eventPayload = { ...cmd.payload, source: 'ai_director', reason: cmd.reason };
        if (cmd.target === 'all') {
          broadcastToAll(cmd.command, eventPayload);
        } else {
          sendToScreen(cmd.target, cmd.command, eventPayload);
        }
      }

      // Apply immediate layout changes
      for (const rec of plan.layoutRecommendations) {
        if (rec.priority !== 'immediate') continue;
        if (rec.screenId) {
          await db.screen.update(rec.screenId, { layoutType: rec.layout });
          sendToScreen(rec.screenId, 'change_layout', { layout: rec.layout, source: 'ai_director' });
        } else {
          broadcastToAll('change_layout', { layout: rec.layout, source: 'ai_director' });
        }
      }
    }

    return NextResponse.json({ success: true, data: { plan, snapshot, executed: execute } });
  } catch (err) {
    console.error('[POST /api/ai/director]', err);
    const message = err instanceof Error ? err.message : 'AI Director error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
