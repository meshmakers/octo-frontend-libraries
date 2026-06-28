import {
  isIsoDateTime,
  toInstant,
  formatInstant,
  formatBoardDate,
  formatBoardDateTime,
  formatTableCellValue,
  getZonedDateParts,
  zonedDateKey
} from './meshboard-datetime';

describe('meshboard-datetime', () => {
  describe('isIsoDateTime', () => {
    it('accepts ISO-8601 date-time strings (with/without seconds, Z or offset)', () => {
      expect(isIsoDateTime('2025-12-31T23:00:00Z')).toBe(true);
      expect(isIsoDateTime('2026-01-01T00:00')).toBe(true);
      expect(isIsoDateTime('2026-01-01T00:00:00.123Z')).toBe(true);
      expect(isIsoDateTime('2026-01-01T00:00:00+01:00')).toBe(true);
    });

    it('rejects plain dates, non-date strings, and non-strings', () => {
      expect(isIsoDateTime('2026-01-01')).toBe(false);
      expect(isIsoDateTime('1-1:1.9.0 G.01')).toBe(false);
      expect(isIsoDateTime('hello')).toBe(false);
      expect(isIsoDateTime(42)).toBe(false);
      expect(isIsoDateTime(null)).toBe(false);
    });
  });

  describe('toInstant', () => {
    it('parses strings, numbers and Date objects; rejects invalid', () => {
      expect(toInstant('2026-01-01T00:00:00Z')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(toInstant(new Date('2026-01-01T00:00:00Z'))?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(toInstant('not-a-date')).toBeNull();
      expect(toInstant(new Date('invalid'))).toBeNull();
      expect(toInstant({})).toBeNull();
    });
  });

  describe('formatInstant (utc mode is timezone-deterministic)', () => {
    it('renders the instant in UTC wall-clock', () => {
      const out = formatInstant('2025-12-31T23:00:00Z', 'utc', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      // de-AT combined format: "31.12.2025, 23:00:00"
      expect(out).toContain('31.12.2025');
      expect(out).toContain('23:00:00');
    });

    it('returns null for non-instants so callers can fall back', () => {
      expect(formatInstant('nope', 'utc', { year: 'numeric' })).toBeNull();
    });
  });

  describe('formatBoardDate / formatBoardDateTime (utc)', () => {
    it('formats date-only as dd.MM.yyyy', () => {
      expect(formatBoardDate('2025-12-31T23:00:00Z', 'utc')).toBe('31.12.2025');
    });

    it('formats date+time with a space separator (not a comma)', () => {
      expect(formatBoardDateTime('2025-12-31T23:00:00Z', 'utc')).toBe('31.12.2025 23:00:00');
    });
  });

  describe('formatTableCellValue', () => {
    it('formats ISO date-time cells on the board timezone basis', () => {
      // The archive boundary row the user reported: UTC 23:00 on Dec 31 is
      // midnight Jan 1 in CET. In utc mode it stays Dec 31.
      expect(formatTableCellValue('2025-12-31T23:00:00Z', 'utc')).toBe('31.12.2025 23:00:00');
    });

    it('passes non-datetime values through unchanged', () => {
      expect(formatTableCellValue('1-1:1.9.0 G.01', 'utc')).toBe('1-1:1.9.0 G.01');
      expect(formatTableCellValue(3.96, 'utc')).toBe('3.96');
      expect(formatTableCellValue(false, 'utc')).toBe('false');
      expect(formatTableCellValue(null, 'utc')).toBe('');
      expect(formatTableCellValue(undefined, 'utc')).toBe('');
    });
  });

  describe('getZonedDateParts', () => {
    it('decomposes an instant into UTC wall-clock parts in utc mode', () => {
      // The reported symptom: a row at local midnight (CEST, UTC+2) is stored as
      // 22:00Z the previous day. In utc mode the bucketing must see hour 22.
      expect(getZonedDateParts('2026-06-27T22:00:00Z', 'utc')).toEqual({
        year: 2026,
        month: 6,
        day: 27,
        hour: 22,
        minute: 0
      });
    });

    it('reads sub-hour minutes in utc mode', () => {
      expect(getZonedDateParts('2026-03-08T05:45:00Z', 'utc')).toEqual({
        year: 2026,
        month: 3,
        day: 8,
        hour: 5,
        minute: 45
      });
    });

    it('normalizes midnight to hour 0 (not 24)', () => {
      const parts = getZonedDateParts('2026-06-28T00:00:00Z', 'utc');
      expect(parts?.hour).toBe(0);
      expect(parts?.day).toBe(28);
    });

    it('local mode matches the browser-local wall-clock (timezone-aware, not hard-coded UTC)', () => {
      // Deterministic regardless of the runner's timezone: local-mode parts must
      // equal the JS local getters for the same instant. This is the regression
      // guard — the heatmap previously always used getUTC* and ignored the mode.
      const instant = new Date('2026-06-27T22:00:00Z');
      const parts = getZonedDateParts(instant, 'local');
      expect(parts).toEqual({
        year: instant.getFullYear(),
        month: instant.getMonth() + 1,
        day: instant.getDate(),
        hour: instant.getHours(),
        minute: instant.getMinutes()
      });
    });

    it('returns null for non-instants so callers can skip the row', () => {
      expect(getZonedDateParts('not-a-date', 'utc')).toBeNull();
      expect(getZonedDateParts(null, 'local')).toBeNull();
    });
  });

  describe('zonedDateKey', () => {
    it('builds a zero-padded yyyy-MM-dd key', () => {
      expect(zonedDateKey({ year: 2026, month: 3, day: 8, hour: 5, minute: 45 })).toBe('2026-03-08');
      expect(zonedDateKey({ year: 2026, month: 12, day: 31, hour: 0, minute: 0 })).toBe('2026-12-31');
    });
  });
});
