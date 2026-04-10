import { NextResponse } from 'next/server';
import { getConnectedCount } from '@/lib/sse-manager';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [channels, events] = await Promise.all([
      db.liveChannel.findMany({ where: { isActive: true } }),
      db.scheduleEvent.findMany({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        connectedScreens: getConnectedCount(),
        activeChannels: channels.length,
        activeScheduleEvents: events.length,
        version: process.env.npm_package_version ?? '1.0.0',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        connectedScreens: getConnectedCount(),
        activeChannels: 0,
        activeScheduleEvents: 0,
        version: process.env.npm_package_version ?? '1.0.0',
        error: error instanceof Error ? error.message : 'health check failed',
      },
    });
  }
}