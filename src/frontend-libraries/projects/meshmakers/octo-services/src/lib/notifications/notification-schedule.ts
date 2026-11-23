import { InjectionToken } from '@angular/core';
import { CronExpressionParser } from 'cron-parser';

export const NOTIFICATION_MIN_INTERVAL_MS = 60_000;

export const NOTIFICATION_SCHEDULE_TYPES = ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom'] as const;

export const NOTIFICATION_DEFAULT_CRON = '0 0 7 * * *';

const SAMPLE_SIZE = 20;

export type NextExecutions = (cron: string, count: number) => Date[];

/**
 * Next `count` run times of a 6-field cron expression (second minute hour day month weekday), or an empty list when the
 * expression is not a valid 6-field expression. Same contract as `CronParserService.getNextExecutions` of
 * `@meshmakers/shared-ui`, implemented on `cron-parser` directly so that octo-services does not pull shared-ui (and
 * with it Kendo) into the initial bundle of every app (AB#9650).
 */
export function nextCronExecutions(cron: string, count: number): Date[] {
  if (!cron || cron.trim() === '') return [];
  if (cron.trim().split(/\s+/).length !== 6) return [];
  try {
    const interval = CronExpressionParser.parse(cron, { currentDate: new Date() });
    const executions: Date[] = [];
    for (let i = 0; i < count; i++) {
      executions.push(interval.next().toDate());
    }
    return executions;
  } catch {
    return [];
  }
}

/**
 * Source of the next run times the notification service uses to check a schedule. Defaults to
 * {@link nextCronExecutions}; tests and apps may provide their own.
 */
export const NOTIFICATION_NEXT_EXECUTIONS = new InjectionToken<NextExecutions>('NOTIFICATION_NEXT_EXECUTIONS', {
  providedIn: 'root',
  factory: () => nextCronExecutions
});

export type NotificationScheduleIssue = 'EMPTY' | 'INVALID' | 'TOO_FREQUENT';

export function notificationScheduleIssue(nextExecutions: NextExecutions, cron: string | null | undefined): NotificationScheduleIssue | null {
  if (!cron?.trim()) return 'EMPTY';
  let executions: Date[];
  try {
    executions = nextExecutions(cron, SAMPLE_SIZE);
  } catch {
    return 'INVALID';
  }
  if (executions.length === 0) return 'INVALID';
  for (let i = 1; i < executions.length; i++) {
    if (executions[i].getTime() - executions[i - 1].getTime() < NOTIFICATION_MIN_INTERVAL_MS) {
      return 'TOO_FREQUENT';
    }
  }
  return null;
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
