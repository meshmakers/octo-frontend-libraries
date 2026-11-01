import { COLUMN_PROBE_FALLBACK_MS, columnProbeWindow } from './column-probe-window';

describe('columnProbeWindow (AB#7975)', () => {
  it('uses the board window when the board has a time filter', () => {
    const boardWindow = { from: new Date('2026-10-30T00:00:00Z'), to: new Date('2026-10-31T00:00:00Z') };

    expect(columnProbeWindow(boardWindow)).toBe(boardWindow);
  });

  it('falls back to the last 24 hours when the board has no time filter', () => {
    const now = new Date('2026-11-01T12:00:00Z');

    const window = columnProbeWindow(undefined, now);

    expect(window.to).toEqual(now);
    expect(window.to.getTime() - window.from.getTime()).toBe(COLUMN_PROBE_FALLBACK_MS);
  });
});
