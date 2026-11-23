import { TestBed } from '@angular/core/testing';
import { CronParserService } from '@meshmakers/shared-ui';
import {
  NOTIFICATION_NEXT_EXECUTIONS,
  nextCronExecutions,
  notificationScheduleIssue,
  withScheduleTimeZone
} from './notification-schedule';

describe('notification schedule', () => {
  const every = (ms: number) => (_cron: string, count: number) =>
    Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 9, 15) + index * ms));
  const never = () => [];
  const unparsable = () => {
    throw new Error('Invalid cron expression');
  };

  it('marks fixed times with the zone and leaves intervals alone', () => {
    expect(withScheduleTimeZone('At 07:00', '0 0 7 * * *')).toBe('At 07:00 UTC');
    expect(withScheduleTimeZone('At 07:00, only on Monday', '0 0 7 * * 1', 'Europe/Vienna'))
      .toBe('At 07:00 Europe/Vienna, only on Monday');
    expect(withScheduleTimeZone('Every 5 minutes', '0 */5 * * * *', 'Europe/Vienna')).toBe('Every 5 minutes');
  });

  it('accepts a schedule that runs at most once a minute', () => {
    expect(notificationScheduleIssue(every(60_000), '0 * * * * *')).toBeNull();
  });

  it('refuses a schedule that is empty, never runs, cannot be read, or runs more than once a minute', () => {
    expect(notificationScheduleIssue(every(60_000), '  ')).toBe('EMPTY');
    expect(notificationScheduleIssue(every(60_000), null)).toBe('EMPTY');
    expect(notificationScheduleIssue(never, '0 0 0 31 2 *')).toBe('INVALID');
    expect(notificationScheduleIssue(unparsable, '0 0 25 * * *')).toBe('INVALID');
    expect(notificationScheduleIssue(every(1000), '* * * * * *')).toBe('TOO_FREQUENT');
  });

  describe('nextCronExecutions (AB#9650: replaces CronParserService of @meshmakers/shared-ui)', () => {
    // Every kind of expression the notification editor produces, plus the invalid ones it must refuse.
    const expressions = [
      '0 0 7 * * *',
      '0 */5 * * * *',
      '0 * * * * *',
      '* * * * * *',
      '*/30 * * * * *',
      '0 0 * * * *',
      '0 30 8 * * 1-5',
      '0 0 7 * * 1',
      '0 0 7 1 * *',
      '0 0 0 1 1 *',
      '0 15 10 15 6 *',
      '0 0 0 31 2 *',
      '0 0 25 * * *',
      '0 0 7 * *',
      '0 0 0 7 * * *',
      'not a cron',
      '',
      '   '
    ];
    const reference = new CronParserService();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 23, 6, 41, 17)));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(expressions)('returns the same run times as CronParserService.getNextExecutions for %j', expression => {
      for (const count of [1, 3, 20]) {
        expect(nextCronExecutions(expression, count).map(date => date.toISOString()))
          .toEqual(reference.getNextExecutions(expression, count).map(date => date.toISOString()));
      }
    });

    it.each(expressions)('gives the same schedule issue as with CronParserService for %j', expression => {
      expect(notificationScheduleIssue(nextCronExecutions, expression))
        .toBe(notificationScheduleIssue((cron, count) => reference.getNextExecutions(cron, count), expression));
    });

    it('classifies the typical schedules', () => {
      expect(notificationScheduleIssue(nextCronExecutions, '0 0 7 * * *')).toBeNull();
      expect(notificationScheduleIssue(nextCronExecutions, '0 * * * * *')).toBeNull();
      expect(notificationScheduleIssue(nextCronExecutions, '* * * * * *')).toBe('TOO_FREQUENT');
      expect(notificationScheduleIssue(nextCronExecutions, '0 0 25 * * *')).toBe('INVALID');
      expect(notificationScheduleIssue(nextCronExecutions, '0 0 7 * *')).toBe('INVALID');
      expect(notificationScheduleIssue(nextCronExecutions, '')).toBe('EMPTY');
    });

    it('is the default of NOTIFICATION_NEXT_EXECUTIONS', () => {
      expect(TestBed.inject(NOTIFICATION_NEXT_EXECUTIONS)).toBe(nextCronExecutions);
    });
  });
});
