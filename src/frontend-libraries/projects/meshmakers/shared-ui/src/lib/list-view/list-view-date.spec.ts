import { ListViewDateFormatter } from './list-view-date';

describe('ListViewDateFormatter (AB#8630)', () => {
  const deAt = new ListViewDateFormatter('de-AT');

  it('prints a Date in one line with date and time, not Date.toString()', () => {
    const text = deAt.format(new Date(2025, 0, 1, 1, 0, 0));
    expect(text).toBe('01.01.2025 01:00:00');
    expect(text).not.toContain('GMT');
  });

  it('prints ISO 8601 strings and epoch milliseconds as dates', () => {
    const local = new Date(2025, 11, 31, 23, 45, 0);
    expect(deAt.format(local.toISOString())).toBe('31.12.2025 23:45:00');
    expect(deAt.format(local.getTime())).toBe('31.12.2025 23:45:00');
  });

  it('prints a date-only string as the calendar day, without a time and without a UTC shift', () => {
    expect(deAt.format('2025-03-01')).toBe('01.03.2025');
  });

  it('keeps text that is no date, and a date-only string that is no calendar day', () => {
    expect(deAt.format('not a date')).toBe('not a date');
    expect(deAt.format('2025-02-31')).toBe('2025-02-31');
  });

  it('prints empty for null, undefined, empty text and invalid dates', () => {
    expect(deAt.format(null)).toBe('');
    expect(deAt.format(undefined)).toBe('');
    expect(deAt.format('')).toBe('');
    expect(deAt.format(new Date(Number.NaN))).toBe('');
  });

  it('follows the locale', () => {
    expect(new ListViewDateFormatter('en-US').format(new Date(2025, 0, 2, 13, 5, 9))).toBe('01/02/2025 01:05:09 PM');
  });

  it('applies a column format as an Angular date format', () => {
    const enUs = new ListViewDateFormatter('en-US');
    expect(enUs.format(new Date(2025, 0, 2, 13, 5, 9), 'dd.MM.yyyy HH:mm')).toBe('02.01.2025 13:05');
    expect(enUs.format('2025-03-01', 'yyyy/MM/dd')).toBe('2025/03/01');
  });

  it('falls back to the default when the locale has no Angular locale data for the format', () => {
    // de-CH has no registered Angular locale data: formatDate throws, the Intl default wins.
    expect(new ListViewDateFormatter('de-CH').format(new Date(2025, 0, 1, 1, 0, 0), 'dd.MM.yyyy HH:mm')).toBe('01.01.2025 01:00:00');
  });

  it('does not break on an invalid locale tag', () => {
    expect(new ListViewDateFormatter('not_a_locale!').format(new Date(2025, 0, 1))).toMatch(/2025/);
  });
});
