export const NOTIFICATION_MIN_INTERVAL_MS = 60_000;

const SAMPLE_SIZE = 20;

export type NextExecutions = (cron: string, count: number) => Date[];

export function firesMoreThanOncePerMinute(nextExecutions: NextExecutions, cron: string): boolean {
  const executions = nextExecutions(cron, SAMPLE_SIZE);
  for (let i = 1; i < executions.length; i++) {
    if (executions[i].getTime() - executions[i - 1].getTime() < NOTIFICATION_MIN_INTERVAL_MS) {
      return true;
    }
  }
  return false;
}

export function isNotificationSchedulable(nextExecutions: NextExecutions, cron: string | null | undefined): boolean {
  return !!cron?.trim() && !firesMoreThanOncePerMinute(nextExecutions, cron);
}

export function withScheduleTimeZone(humanReadable: string, cron: string, timeZone?: string | null): string {
  const zone = timeZone || 'UTC';
  const hour = cron.trim().split(/\s+/)[2] ?? '*';
  if (!/^[\d,-]+$/.test(hour)) return humanReadable;
  const times = [...humanReadable.matchAll(/\b\d{2}:\d{2}(:\d{2})?\b/g)];
  const last = times.at(-1);
  if (!last || last.index === undefined) return `${humanReadable} ${zone}`;
  const end = last.index + last[0].length;
  return `${humanReadable.slice(0, end)} ${zone}${humanReadable.slice(end)}`;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function notificationTimeZones(): string[] {
  const zones = ['UTC', ...Intl.supportedValuesOf('timeZone').filter(zone => zone !== 'UTC')];
  const browser = browserTimeZone();
  return zones.includes(browser) ? zones : [...zones, browser];
}
