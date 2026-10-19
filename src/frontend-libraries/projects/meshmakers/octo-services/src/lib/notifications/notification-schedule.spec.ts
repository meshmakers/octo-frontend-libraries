import { firesMoreThanOncePerMinute, isNotificationSchedulable, withScheduleTimeZone } from './notification-schedule';

describe('notification schedule', () => {
  const every = (ms: number) => (_cron: string, count: number) =>
    Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 9, 15) + index * ms));

  it('marks fixed times with the zone and leaves intervals alone', () => {
    expect(withScheduleTimeZone('At 07:00', '0 0 7 * * *')).toBe('At 07:00 UTC');
    expect(withScheduleTimeZone('At 07:00, only on Monday', '0 0 7 * * 1', 'Europe/Vienna'))
      .toBe('At 07:00 Europe/Vienna, only on Monday');
    expect(withScheduleTimeZone('Every 5 minutes', '0 */5 * * * *', 'Europe/Vienna')).toBe('Every 5 minutes');
  });

  it('refuses schedules more often than once a minute and accepts once a minute', () => {
    expect(firesMoreThanOncePerMinute(every(1000), '* * * * * *')).toBe(true);
    expect(firesMoreThanOncePerMinute(every(60_000), '0 * * * * *')).toBe(false);
  });

  it('treats an empty schedule as not schedulable', () => {
    expect(isNotificationSchedulable(every(60_000), '  ')).toBe(false);
    expect(isNotificationSchedulable(every(60_000), null)).toBe(false);
    expect(isNotificationSchedulable(every(60_000), '0 * * * * *')).toBe(true);
    expect(isNotificationSchedulable(every(1000), '* * * * * *')).toBe(false);
  });
});
