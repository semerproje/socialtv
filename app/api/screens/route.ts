import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastToAll, sendToScreen, getConnectedScreens } from '@/lib/sse-manager';
import { enforceRateLimit, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/screens — list all screens with live status
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'viewer');
  if (!auth.ok) return auth.response;
  const screens = await db.screen.findMany({
    include: { group: { select: { id: true, name: true } } },
  });

  const connected = getConnectedScreens();
  const connectedIds = new Set(connected.map((s) => s.screenId));

  const enriched = (screens as Array<Record<string, unknown>>).map((s) => ({
    ...s,
    isOnline: connectedIds.has(s.id as string),
    sseInfo: connected.find((c) => c.screenId === (s.id as string)),
  }));

  const groups = await db.screenGroup.findMany();

  return NextResponse.json({ success: true, data: enriched, groups, connected });
}

// POST /api/screens — create screen
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screens-post', 20, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const { name, location, layoutType, groupId, orientation, resolution } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const screen = await db.screen.create({
      name,
      location,
      layoutType: layoutType ?? 'default',
    groupId,
    orientation: orientation ?? 'landscape',
    resolution,
  });

  return NextResponse.json({ success: true, data: screen }, { status: 201 });
}

// PATCH /api/screens?id=...
export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screens-patch', 40, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  const screen = await db.screen.update(id, body);

  // Notify screen in real-time if layout changed
  if (body.layoutType) {
    sendToScreen(id, 'change_layout', { layoutType: body.layoutType });
  }

  return NextResponse.json({ success: true, data: screen });
}

// DELETE /api/screens?id=...
export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req, 'screens-delete', 10, 60_000);
  if (limited) return limited;
  const auth = await requireAdmin(req, 'editor');
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.screen.delete(id);
  return NextResponse.json({ success: true });
}

