import { TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { MeshBoardStateService } from './meshboard-state.service';
import { MeshBoardPersistenceService } from './meshboard-persistence.service';
import { MeshBoardGridService } from './meshboard-grid.service';
import { MeshBoardTimeShift, TimeRangeSelection } from '../models/meshboard.models';

/**
 * Calendar time shift of a stream-data query (AB#9094). Board zone Europe/Vienna, ranges [from, to)
 * at local midnight. Every expected window is a literal of the story's acceptance criteria, written
 * with its Vienna offset (+01:00 winter, +02:00 summer).
 */
describe('MeshBoardStateService — time shift (AB#9094)', () => {
  let service: MeshBoardStateService;

  const PREVIOUS_PERIOD: MeshBoardTimeShift = { by: 'period', count: -1 };
  const LAST_YEAR: MeshBoardTimeShift = { by: 'year', count: -1 };
  const HOUR = 3_600_000;

  const at = (iso: string): Date => new Date(iso);

  function window(from: string, to: string): { from: Date; to: Date } {
    return { from: at(from), to: at(to) };
  }

  function boardWith(selection: TimeRangeSelection, showTime = false): void {
    service.updateTimeFilterConfig({ enabled: true, selection, pickerConfig: showTime ? { showTime } : undefined });
  }

  function shifted(timeShift?: MeshBoardTimeShift): { from: Date; to: Date } | undefined {
    return service.resolveStreamDataTimeArgs(false, timeShift);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } }
      ]
    });
    service = TestBed.inject(MeshBoardStateService);
    service.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'Europe/Vienna' });
  });

  afterEach(() => {
    service.setHostTimeRange(null);
    vi.useRealTimers();
  });

  describe('AC1 backward compatible', () => {
    it('without timeShift sends the unshifted October 2026 window', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      expect(shifted()).toEqual(window('2026-10-01T00:00:00+02:00', '2026-11-01T00:00:00+01:00'));
      expect(service.resolveStreamDataTimeArgs()).toEqual(window('2026-10-01T00:00:00+02:00', '2026-11-01T00:00:00+01:00'));
    });
  });

  describe('AC2 a count that is not a negative integer is no shift', () => {
    const invalid: unknown[] = [
      { by: 'period', count: 0 },
      { by: 'period', count: 1 },
      { by: 'period', count: -1.5 },
      { by: 'period', count: '-1' },
      { by: 'period', count: Number.NaN },
      { by: 'period' },
      { by: 'week', count: -1 },
      { count: -1 },
      null
    ];

    for (const value of invalid) {
      it(`treats ${JSON.stringify(value)} as no shift`, () => {
        boardWith({ type: 'month', year: 2026, month: 9 });

        expect(shifted(value as MeshBoardTimeShift)).toEqual(window('2026-10-01T00:00:00+02:00', '2026-11-01T00:00:00+01:00'));
      });
    }
  });

  describe('AC3 previous period on calendar boundaries', () => {
    it('October 2026 -> whole September 2026 (30 days, though October has 31)', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-09-01T00:00:00+02:00', '2026-10-01T00:00:00+02:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(30 * 24);
    });

    it('March 2026 -> February 2026 (28 days)', () => {
      boardWith({ type: 'month', year: 2026, month: 2 });

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-02-01T00:00:00+01:00', '2026-03-01T00:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(28 * 24);
    });

    it('March 2024 -> February 2024 (29 days, leap year)', () => {
      boardWith({ type: 'month', year: 2024, month: 2 });

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2024-02-01T00:00:00+01:00', '2024-03-01T00:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(29 * 24);
    });

    it('January 2026 -> December 2025 (year roll-over)', () => {
      boardWith({ type: 'month', year: 2026, month: 0 });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2025-12-01T00:00:00+01:00', '2026-01-01T00:00:00+01:00'));
    });

    it('Q1 2026 -> Q4 2025', () => {
      boardWith({ type: 'quarter', year: 2026, quarter: 1 });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2025-10-01T00:00:00+02:00', '2026-01-01T00:00:00+01:00'));
    });

    it('year 2026 -> year 2025', () => {
      boardWith({ type: 'year', year: 2026 });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2025-01-01T00:00:00+01:00', '2026-01-01T00:00:00+01:00'));
    });

    it('day 2026-03-30 -> day 2026-03-29', () => {
      boardWith({ type: 'day', year: 2026, month: 2, day: 30 });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2026-03-29T00:00:00+01:00', '2026-03-30T00:00:00+02:00'));
    });

    it('two periods back from October 2026 -> August 2026', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      expect(shifted({ by: 'period', count: -2 })).toEqual(window('2026-08-01T00:00:00+02:00', '2026-09-01T00:00:00+02:00'));
    });
  });

  describe('AC4 same period last year', () => {
    it('October 2026 -> October 2025', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      expect(shifted(LAST_YEAR)).toEqual(window('2025-10-01T00:00:00+02:00', '2025-11-01T00:00:00+01:00'));
    });

    it('Q1 2026 -> Q1 2025', () => {
      boardWith({ type: 'quarter', year: 2026, quarter: 1 });

      expect(shifted(LAST_YEAR)).toEqual(window('2025-01-01T00:00:00+01:00', '2025-04-01T00:00:00+02:00'));
    });

    it('February 2025 -> February 2024 (whole month, 29 days)', () => {
      boardWith({ type: 'month', year: 2025, month: 1 });

      const range = shifted(LAST_YEAR)!;

      expect(range).toEqual(window('2024-02-01T00:00:00+01:00', '2024-03-01T00:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(29 * 24);
    });

    it('count -2 on October 2026 -> October 2024', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      expect(shifted({ by: 'year', count: -2 })).toEqual(window('2024-10-01T00:00:00+02:00', '2024-11-01T00:00:00+01:00'));
    });

    it('day 2024-02-29 -> day 2023-02-28', () => {
      boardWith({ type: 'day', year: 2024, month: 1, day: 29 });

      expect(shifted(LAST_YEAR)).toEqual(window('2023-02-28T00:00:00+01:00', '2023-03-01T00:00:00+01:00'));
    });
  });

  describe('AC5 DST: bounds are local midnights, not the unshifted instants minus fixed hours', () => {
    it('October 2026 (end of summer time) -> September 2026', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });
      const unshifted = shifted()!;

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-09-01T00:00:00+02:00', '2026-10-01T00:00:00+02:00'));
      const lengthOfOctober = unshifted.to.getTime() - unshifted.from.getTime();
      expect(range.from.getTime()).not.toBe(unshifted.from.getTime() - lengthOfOctober);
    });

    it('April 2026 -> March 2026 (start of summer time, 743 hours)', () => {
      boardWith({ type: 'month', year: 2026, month: 3 });

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-03-01T00:00:00+01:00', '2026-04-01T00:00:00+02:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(31 * 24 - 1);
    });

    it('March 2026 last year -> March 2025 with its own DST change', () => {
      boardWith({ type: 'month', year: 2026, month: 2 });

      expect(shifted(LAST_YEAR)).toEqual(window('2025-03-01T00:00:00+01:00', '2025-04-01T00:00:00+02:00'));
    });
  });

  describe('AC6 non-calendar ranges: whole-day custom ranges by calendar days, relative and host ranges by their exact length', () => {
    it('custom range 2026-11-03 to 2026-11-10 -> 2026-10-27 to 2026-11-03', () => {
      boardWith({ type: 'custom', customFrom: '2026-11-03T00:00:00+01:00', customTo: '2026-11-10T00:00:00+01:00' }, true);

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2026-10-27T00:00:00+01:00', '2026-11-03T00:00:00+01:00'));
    });

    it('custom range of whole days across the DST change moves back by its days and keeps local midnights', () => {
      boardWith({ type: 'custom', customFrom: '2026-03-30T00:00:00+02:00', customTo: '2026-04-06T00:00:00+02:00' });

      expect(service.resolveStreamDataTimeArgs()).toEqual(window('2026-03-30T00:00:00+02:00', '2026-04-07T00:00:00+02:00'));
      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2026-03-22T00:00:00+01:00', '2026-03-30T00:00:00+02:00'));
    });

    it('custom range of whole days containing the spring DST change (167 h) moves back by 7 calendar days (168 h)', () => {
      boardWith({ type: 'custom', customFrom: '2026-03-23T00:00:00+01:00', customTo: '2026-03-29T00:00:00+01:00' });

      const unshifted = service.resolveStreamDataTimeArgs()!;
      const range = shifted(PREVIOUS_PERIOD)!;

      expect(unshifted).toEqual(window('2026-03-23T00:00:00+01:00', '2026-03-30T00:00:00+02:00'));
      expect((unshifted.to.getTime() - unshifted.from.getTime()) / HOUR).toBe(7 * 24 - 1);
      expect(range).toEqual(window('2026-03-16T00:00:00+01:00', '2026-03-23T00:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(7 * 24);
    });

    it('custom range with a time of day across the DST change moves back by its exact length (143 h)', () => {
      boardWith({ type: 'custom', customFrom: '2026-03-25T10:00:00+01:00', customTo: '2026-03-31T10:00:00+02:00' }, true);

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-03-19T11:00:00+01:00', '2026-03-25T10:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(6 * 24 - 1);
    });

    it('host period over a board with a whole-day custom range moves back by its exact length, not by calendar days', () => {
      boardWith({ type: 'custom', customFrom: '2026-01-05T00:00:00+01:00', customTo: '2026-01-11T00:00:00+01:00' });
      service.setHostTimeRange({ status: 'valid', from: at('2026-03-30T00:00:00+02:00'), to: at('2026-04-06T00:00:00+02:00') });

      const range = shifted(PREVIOUS_PERIOD)!;

      expect(range).toEqual(window('2026-03-22T23:00:00+01:00', '2026-03-30T00:00:00+02:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(7 * 24);
    });

    it('relative range "last 7 days" at 10:30 across the spring DST change keeps its exact length and time of day', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(at('2026-04-02T10:30:00+02:00'));
      boardWith({ type: 'relative', relativeValue: 7, relativeUnit: 'days' });

      const unshifted = service.resolveStreamDataTimeArgs()!;
      const range = shifted(PREVIOUS_PERIOD)!;
      const length = unshifted.to.getTime() - unshifted.from.getTime();

      expect(unshifted.to).toEqual(at('2026-04-02T10:30:00+02:00'));
      expect(range.to).toEqual(unshifted.from);
      expect(range.to.getTime() - range.from.getTime()).toBe(length);
      expect(range.to.getUTCMinutes()).toBe(30);
    });

    it('relative range "last 7 days" moves back by 7 days', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(at('2026-11-10T00:00:00+01:00'));
      boardWith({ type: 'relative', relativeValue: 7, relativeUnit: 'days' });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2026-10-27T00:00:00+01:00', '2026-11-03T00:00:00+01:00'));
    });

    it('host period (AB#7582, from/to only) moves back by its own length', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });
      service.setHostTimeRange({ status: 'valid', from: at('2026-11-03T00:00:00+01:00'), to: at('2026-11-10T00:00:00+01:00') });

      expect(shifted(PREVIOUS_PERIOD)).toEqual(window('2026-10-27T00:00:00+01:00', '2026-11-03T00:00:00+01:00'));
    });

    it('host period with "year" moves both bounds by a calendar year in the board zone', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });
      service.setHostTimeRange({ status: 'valid', from: at('2026-07-15T10:30:00+02:00'), to: at('2026-12-15T12:45:00+01:00') });

      expect(shifted(LAST_YEAR)).toEqual(window('2025-07-15T10:30:00+02:00', '2025-12-15T12:45:00+01:00'));
    });

    it('custom range with "year": a 29 February bound lands on 28 February', () => {
      boardWith({ type: 'custom', customFrom: '2024-02-29T00:00:00+01:00', customTo: '2024-03-07T00:00:00+01:00' }, true);

      expect(shifted(LAST_YEAR)).toEqual(window('2023-02-28T00:00:00+01:00', '2023-03-07T00:00:00+01:00'));
    });

    it('whole-day custom range 28.02.2024 with "year": the exclusive end 29 February lands on 1 March, so the day 28.02.2023 is queried', () => {
      boardWith({ type: 'custom', customFrom: '2024-02-28T00:00:00+01:00', customTo: '2024-02-28T00:00:00+01:00' });

      expect(service.resolveStreamDataTimeArgs()).toEqual(window('2024-02-28T00:00:00+01:00', '2024-02-29T00:00:00+01:00'));
      expect(shifted(LAST_YEAR)).toEqual(window('2023-02-28T00:00:00+01:00', '2023-03-01T00:00:00+01:00'));
    });

    it('custom range 28.02.2024 23:00 - 29.02.2024 01:00 with "year" keeps its 2 hours: 28.02.2023 23:00 - 01.03.2023 01:00', () => {
      boardWith({ type: 'custom', customFrom: '2024-02-28T23:00:00+01:00', customTo: '2024-02-29T01:00:00+01:00' }, true);

      const range = shifted(LAST_YEAR)!;

      expect(range).toEqual(window('2023-02-28T23:00:00+01:00', '2023-03-01T01:00:00+01:00'));
      expect((range.to.getTime() - range.from.getTime()) / HOUR).toBe(2);
    });
  });

  describe('AC7 composition with ignoreTimeFilter and the host gate', () => {
    it('ignoreTimeFilter ignores the shift: the query keeps its own bounds', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });

      expect(service.resolveStreamDataTimeArgs(true, PREVIOUS_PERIOD)).toBeUndefined();
    });

    it('an invalid host period blocks a shifted widget exactly like an unshifted one', () => {
      boardWith({ type: 'month', year: 2026, month: 9 });
      service.setHostTimeRange({ status: 'invalid', reason: 'from >= to' });

      expect(service.resolveStreamDataScope(undefined, 'streamData', false)).toEqual({ kind: 'empty', reason: 'invalidTimeRange' });
      expect(shifted(PREVIOUS_PERIOD)).toBeUndefined();
      expect(shifted()).toBeUndefined();
    });

    it('no time filter: no window with or without a shift', () => {
      expect(shifted(PREVIOUS_PERIOD)).toBeUndefined();
    });
  });
});
