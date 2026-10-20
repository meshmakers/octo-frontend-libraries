import { notificationScheduleIssue, withScheduleTimeZone } from './notification-schedule';

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
});
