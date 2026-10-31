import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HeatmapWidgetComponent } from './heatmap-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { HeatmapWidgetConfig } from '../../models/meshboard.models';

const MINUTE = 60_000;

/** A 5-min rollup row as the stream-data executor maps it: bucket END at top level, sum + count cells. */
function rollupRow(bucketEnd: Date, sum: number, count: number): QueryResultRow {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'rt-1',
    timestamp: bucketEnd.toISOString() as unknown as Date,
    cells: [
      { attributePath: 'value_sum', value: sum },
      { attributePath: 'value_count', value: count }
    ]
  } as QueryResultRow;
}

function countRow(timestamp: string): QueryResultRow {
  return {
    __typename: 'StreamDataQueryRow',
    rtId: 'rt-1',
    timestamp: timestamp as unknown as Date,
    cells: [{ attributePath: 'value', value: 1 }]
  } as QueryResultRow;
}

/**
 * Raw fixture: one sample per minute 08:00–09:59 UTC with uneven gaps, so the buckets hold
 * different counts and a mean of bucket means differs from the exact mean.
 */
function rawFixture(): { time: Date; value: number }[] {
  const start = Date.parse('2026-10-28T08:00:00Z');
  const rows: { time: Date; value: number }[] = [];
  for (let i = 0; i < 120; i++) {
    if (i % 11 === 3 || (i < 30 && i % 2 === 0) || (i >= 55 && i < 59)) continue;
    rows.push({ time: new Date(start + i * MINUTE), value: (i * 7) % 13 + i / 10 });
  }
  return rows;
}

/** Rolls raw rows up into 5-min buckets stamped with their END, as the archive rollup does. */
function rollUp(raw: { time: Date; value: number }[]): QueryResultRow[] {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const { time, value } of raw) {
    const start = Math.floor(time.getTime() / (5 * MINUTE)) * 5 * MINUTE;
    const bucket = buckets.get(start) ?? { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(start, bucket);
  }
  return Array.from(buckets.entries()).map(([start, b]) => rollupRow(new Date(start + 5 * MINUTE), b.sum, b.count));
}

describe('HeatmapWidgetComponent — weighted mean, bucket end, DST, own window (AB#7956)', () => {
  let component: HeatmapWidgetComponent;
  let execute: ReturnType<typeof vi.fn>;
  let state: {
    resolveStreamDataRtIds: ReturnType<typeof vi.fn>;
    resolveStreamDataScope: ReturnType<typeof vi.fn>;
    resolveStreamDataTimeArgs: ReturnType<typeof vi.fn>;
    timeZoneMode: ReturnType<typeof vi.fn>;
    getVariables: ReturnType<typeof vi.fn>;
  };

  async function render(partial: Partial<HeatmapWidgetConfig>, rows: QueryResultRow[]): Promise<void> {
    execute.mockReturnValue(of({ rows, totalCount: rows.length }));
    component.config = {
      type: 'heatmap',
      dateField: 'timestamp',
      aggregation: 'count',
      colorScheme: 'green',
      dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData' },
      ...partial
    } as unknown as HeatmapWidgetConfig;
    await component['loadData']();
  }

  function cell(date: string, hour: string): { value: number | null; color: string } | undefined {
    return component.heatmapData().find(c => c.date === date && c.hour === hour);
  }

  beforeEach(() => {
    execute = vi.fn().mockName('QueryExecutorService.execute');
    state = {
      resolveStreamDataRtIds: vi.fn().mockReturnValue(undefined),
      resolveStreamDataScope: vi.fn().mockReturnValue({ kind: 'unscoped' }),
      resolveStreamDataTimeArgs: vi.fn().mockReturnValue(undefined),
      timeZoneMode: vi.fn().mockReturnValue('utc'),
      getVariables: vi.fn().mockReturnValue([])
    };
    TestBed.configureTestingModule({
      imports: [HeatmapWidgetComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: state },
        { provide: QueryExecutorService, useValue: { execute } },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } }
      ]
    });
    component = TestBed.createComponent(HeatmapWidgetComponent).componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  describe('weightedAvg', () => {
    const weighted: Partial<HeatmapWidgetConfig> = {
      aggregation: 'weightedAvg',
      valueField: 'value_sum',
      weightField: 'value_count',
      timestampIsBucketEnd: true,
      bucketWidthMinutes: 5
    };

    it('equals the exact mean of the underlying raw rows per hour', async () => {
      const raw = rawFixture();
      const rollup = rollUp(raw);
      await render(weighted, rollup);

      for (const hour of [8, 9]) {
        const inHour = raw.filter(r => r.time.getUTCHours() === hour);
        const exact = inHour.reduce((sum, r) => sum + r.value, 0) / inHour.length;
        expect(cell('2026-10-28', `0${hour}:00`)?.value).toBeCloseTo(exact, 10);
      }

      // The fixture is meaningful: a plain mean of the bucket means would be wrong.
      const hour8Buckets = rollup
        .filter(r => {
          const start = Date.parse(String(r.timestamp)) - 5 * MINUTE;
          return new Date(start).getUTCHours() === 8;
        })
        .map(r => (r.cells[0].value as number) / (r.cells[1].value as number));
      const meanOfMeans = hour8Buckets.reduce((a, b) => a + b, 0) / hour8Buckets.length;
      expect(Math.abs(meanOfMeans - (cell('2026-10-28', '08:00')?.value as number))).toBeGreaterThan(1e-3);
    });

    it('leaves a cell without rows empty, not 0, and colours a real mean of 0', async () => {
      await render(weighted, [rollupRow(new Date('2026-10-28T08:05:00Z'), 0, 5)]);

      const zero = cell('2026-10-28', '08:00');
      expect(zero?.value).toBe(0);
      expect(zero?.color).not.toBe('transparent');
      expect(component.cellLabelContent({ value: 0 })).toBe('0');

      const empty = cell('2026-10-28', '09:00');
      expect(empty?.value).toBeNull();
      expect(empty?.color).toBe('transparent');
      expect(component.cellLabelContent({ value: null })).toBe('');
    });

    it('skips rows without a usable weight instead of biasing the mean', async () => {
      const broken = rollupRow(new Date('2026-10-28T08:10:00Z'), 100, 0);
      broken.cells[1] = { attributePath: 'value_count', value: null } as QueryResultRow['cells'][number];
      await render(weighted, [rollupRow(new Date('2026-10-28T08:05:00Z'), 10, 5), broken]);

      expect(cell('2026-10-28', '08:00')?.value).toBe(2);
    });
  });

  describe('timestampIsBucketEnd', () => {
    it('moves the bucket ending at 09:00 into 08:00', async () => {
      await render({ timestampIsBucketEnd: true, bucketWidthMinutes: 5 }, [countRow('2026-10-28T09:00:00Z')]);
      expect(cell('2026-10-28', '08:00')?.value).toBe(1);
      expect(cell('2026-10-28', '09:00')?.value).toBe(0);
    });

    it('moves the bucket ending at midnight into the previous day', async () => {
      await render({ timestampIsBucketEnd: true, bucketWidthMinutes: 5 }, [countRow('2026-10-29T00:00:00Z')]);
      expect(component.xCategories()).toEqual(['2026-10-28']);
      expect(cell('2026-10-28', '23:00')?.value).toBe(1);
    });

    it('keeps the row where it is without the option (unchanged behaviour)', async () => {
      await render({}, [countRow('2026-10-28T09:00:00Z')]);
      expect(cell('2026-10-28', '09:00')?.value).toBe(1);
      expect(cell('2026-10-28', '08:00')?.value).toBe(0);
    });
  });

  describe('board time zone incl. DST', () => {
    it('shows 25 hours on the Vienna fall-back day 2026-10-25', async () => {
      state.timeZoneMode.mockReturnValue('Europe/Vienna');
      const rows: QueryResultRow[] = [];
      for (let t = Date.parse('2026-10-24T22:00:00Z'); t <= Date.parse('2026-10-25T22:00:00Z'); t += 60 * MINUTE) {
        rows.push(countRow(new Date(t).toISOString()));
      }
      await render({}, rows);

      expect(component.xCategories()).toEqual(['2026-10-25']);
      expect(component.yCategories()).toHaveLength(25);
      expect(component.yCategories()).toContain('02:00 (2)');
      const day = component.heatmapData().filter(c => c.date === '2026-10-25');
      expect(day).toHaveLength(25);
      expect(day.every(c => c.value === 1)).toBe(true);
    });

    it('keeps 24 hour rows on an ordinary day', async () => {
      state.timeZoneMode.mockReturnValue('Europe/Vienna');
      await render({}, [countRow('2026-10-28T10:00:00Z')]);
      expect(component.yCategories()).toHaveLength(24);
      expect(cell('2026-10-28', '11:00')?.value).toBe(1);
    });
  });

  describe('own time window', () => {
    it('queries its own rolling window instead of the board time filter', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-31T06:42:00Z'));
      state.resolveStreamDataTimeArgs.mockReturnValue({ from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') });

      await render({ timeWindow: { value: 30, unit: 'days' } }, []);

      const args = execute.mock.calls[0][2].streamDataArgs;
      expect(args.to.toISOString()).toBe('2026-10-31T06:42:00.000Z');
      expect(args.from.getTime()).toBeLessThanOrEqual(Date.parse('2026-10-01T06:42:00Z'));
      expect(args.from.getTime()).toBeGreaterThan(Date.parse('2026-10-01T04:00:00Z'));
      expect(args.from.getUTCMinutes()).toBe(0);
      expect(state.resolveStreamDataTimeArgs).not.toHaveBeenCalled();
      expect(state.resolveStreamDataScope).toHaveBeenCalledWith(undefined, 'streamData', true);
      expect(component.timeWindowLabel()).toBe('Last 30 days');
    });

    it('follows the board time filter without a window (unchanged behaviour)', async () => {
      const board = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') };
      state.resolveStreamDataTimeArgs.mockReturnValue(board);

      await render({}, []);

      expect(execute.mock.calls[0][2].streamDataArgs).toEqual({ ...board, rtIds: undefined });
      expect(state.resolveStreamDataScope).toHaveBeenCalledWith(undefined, 'streamData', undefined);
      expect(component.timeWindowLabel()).toBeNull();
    });

    it('shows no window badge for a runtime query', async () => {
      await render({
        timeWindow: { value: 30, unit: 'days' },
        dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'runtime' }
      } as Partial<HeatmapWidgetConfig>, []);
      expect(component.timeWindowLabel()).toBeNull();
    });
  });
});
