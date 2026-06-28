import {
  isIsoDateTime,
  toInstant,
  formatInstant,
  formatBoardDate,
  formatBoardDateTime,
  formatTableCellValue
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
});
