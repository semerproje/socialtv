import type { LiveChannel, ScheduleEvent, SchedulePriority } from '@/types';

const PRIORITY_SCORE: Record<SchedulePriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

function normalizeDaysOfWeek(days: ScheduleEvent['daysOfWeek']): number[] {
  if (!days) return [];
  if (Array.isArray(days)) return days.map(Number).filter((d) => !Number.isNaN(d));
  if (typeof days === 'string') {
    try {
      const parsed = JSON.parse(days);
      return Array.isArray(parsed) ? parsed.map(Number).filter((d) => !Number.isNaN(d)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getSchedulePriorityScore(priority?: SchedulePriority | string): number {
  if (!priority || !(priority in PRIORITY_SCORE)) return PRIORITY_SCORE.normal;
  return PRIORITY_SCORE[priority as SchedulePriority];
}

export function isScheduleEventActive(event: ScheduleEvent, now: Date, screenId?: string | null): boolean {
  if (!event.isActive) return false;
  if (screenId && event.screenId && event.screenId !== screenId) return false;
  if (!screenId && event.screenId) return false;

  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime()) || start > now) return false;

  if (event.endAt) {
    const end = new Date(event.endAt);
    if (!Number.isNaN(end.getTime()) && end < now) return false;
  }

  const recurrence = event.recurrence ?? 'once';
  const dayOfWeek = now.getDay();
  if (recurrence === 'daily' || recurrence === 'once') return true;
  if (recurrence === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (recurrence === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
  if (recurrence === 'weekly') return normalizeDaysOfWeek(event.daysOfWeek).includes(dayOfWeek);
  return true;
}

export function resolveActiveScheduleEvent(events: ScheduleEvent[], now: Date, screenId?: string | null): ScheduleEvent | null {
  const candidates = events
    .filter((event) => isScheduleEventActive(event, now, screenId))
    .sort((a, b) => {
      const priorityDiff = getSchedulePriorityScore(b.priority) - getSchedulePriorityScore(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
    });

  return candidates[0] ?? null;
}

export function detectScheduleConflicts(events: ScheduleEvent[]): Array<{ a: ScheduleEvent; b: ScheduleEvent }> {
  const conflicts: Array<{ a: ScheduleEvent; b: ScheduleEvent }> = [];
  const sorted = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const currentStart = new Date(current.startAt).getTime();
    const currentEnd = current.endAt ? new Date(current.endAt).getTime() : currentStart + 60 * 60 * 1000;

    for (let j = i + 1; j < sorted.length; j += 1) {
      const next = sorted[j];
      const nextStart = new Date(next.startAt).getTime();
      if (nextStart >= currentEnd) break;

      const sameScope = !current.screenId || !next.screenId || current.screenId === next.screenId;
      if (sameScope) conflicts.push({ a: current, b: next });
    }
  }

  return conflicts;
}

export function attachLiveChannel(event: ScheduleEvent | null, channels: LiveChannel[]) {
  if (!event?.sourceRef) return { event, channel: null };
  const channel = channels.find((item) => item.id === event.sourceRef) ?? null;
  return { event, channel };
}