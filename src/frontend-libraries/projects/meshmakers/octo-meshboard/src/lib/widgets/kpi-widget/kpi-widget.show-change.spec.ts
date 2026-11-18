import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { MESHBOARD_MESSAGES, MeshBoardMessages } from '../../utils/meshboard-messages';
import { CkModelService } from '@meshmakers/octo-services';
import { KpiWidgetComponent } from './kpi-widget.component';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutionOptions, QueryExecutionResult, QueryExecutorService } from '../../services/query-executor.service';
import { KpiWidgetConfig, MeshBoardTimeShift, PersistentQueryDataSource, TimeRangeSelection } from '../../models/meshboard.models';

/**
 * AB#9245: a shifted stream-data KPI shows the change to the current (unshifted) board period.
 * Board in Europe/Vienna; the executor answers per window, so a wrong window gives a wrong text.
 */
describe('KpiWidgetComponent — change to the current period (AB#9245)', () => {
  const PREVIOUS_PERIOD: MeshBoardTimeShift = { by: 'period', count: -1 };
  const SAME_PERIOD_LAST_YEAR: MeshBoardTimeShift = { by: 'year', count: -1 };
  const at = (iso: string): Date => new Date(iso);
  const OCTOBER_2026 = { from: at('2026-10-01T00:00:00+02:00'), to: at('2026-11-01T00:00:00+01:00') };
  const SEPTEMBER_2026 = { from: at('2026-09-01T00:00:00+02:00'), to: at('2026-10-01T00:00:00+02:00') };
  const OCTOBER_2025 = { from: at('2025-10-01T00:00:00+02:00'), to: at('2025-11-01T00:00:00+01:00') };

  let fixture: ComponentFixture<KpiWidgetComponent>;
  let state: MeshBoardStateService;
  let execute: ReturnType<typeof vi.fn>;
  let valuesByWindowStart: Map<number, unknown>;

  function rows(value: unknown): QueryExecutionResult {
    return {
      family: 'streamData', queryRtId: 'q-energy', associatedCkTypeId: null, columns: [],
      rows: value === undefined ? [] : [{ __typename: 'StreamDataQueryRow', cells: [{ attributePath: 'energy', value }] }],
      totalCount: value === undefined ? 0 : 1, hasNextPage: false, endCursor: null
    } as unknown as QueryExecutionResult;
  }

  function answer(windowStart: Date, value: unknown): void {
    valuesByWindowStart.set(windowStart.getTime(), value);
  }

  function windows(): { from: Date; to: Date }[] {
    return execute.mock.calls.map(call => {
      const args = (call[2] as QueryExecutionOptions).streamDataArgs!;
      return { from: args.from as Date, to: args.to as Date };
    });
  }

  function source(overrides: Partial<PersistentQueryDataSource> = {}): PersistentQueryDataSource {
    return { type: 'persistentQuery', queryRtId: 'q-energy', queryFamily: 'streamData', timeShift: PREVIOUS_PERIOD, ...overrides };
  }

  function kpi(overrides: Partial<KpiWidgetConfig> = {}, dataSource: PersistentQueryDataSource = source()): KpiWidgetConfig {
    return {
      id: 'kpi', type: 'kpi', title: 'Energy', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      valueAttribute: '', queryMode: 'aggregation', queryValueField: 'energy', suffix: 'kWh', showChange: true,
      dataSource, ...overrides
    };
  }

  function board(selection: TimeRangeSelection, showTime = false): void {
    state.updateTimeFilterConfig({ enabled: true, selection, pickerConfig: showTime ? { showTime } : undefined });
  }

  async function render(config: KpiWidgetConfig): Promise<HTMLElement> {
    fixture = TestBed.createComponent(KpiWidgetComponent);
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const plain = (text: string | null | undefined): string => (text ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  const changeLine = (el: HTMLElement): HTMLElement | null => el.querySelector('.kpi-change');
  const value = (el: HTMLElement): string => plain(el.querySelector('.kpi-value')?.textContent);

  const hostMessages = signal<MeshBoardMessages | null>(null);

  beforeEach(() => {
    hostMessages.set(null);
    valuesByWindowStart = new Map();
    execute = vi.fn((_family: unknown, _rtId: unknown, options: QueryExecutionOptions): Observable<QueryExecutionResult> => {
      const from = options.streamDataArgs?.from as Date | undefined;
      return of(rows(from ? valuesByWindowStart.get(from.getTime()) : undefined));
    });
    TestBed.configureTestingModule({
      imports: [KpiWidgetComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: DashboardDataService, useValue: {} },
        { provide: QueryExecutorService, useValue: { execute } },
        { provide: MESHBOARD_MESSAGES, useValue: hostMessages }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    state.setConfig({ id: 'board', name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets: [] });
    state.updateSettings({ name: 'Board', description: '', columns: 4, rowHeight: 200, gap: 16, timeZoneMode: 'Europe/Vienna' });
    board({ type: 'month', year: 2026, month: 9 });
  });

  afterEach(() => {
    state.setHostTimeRange(null);
    vi.useRealTimers();
  });

  describe('criterion 1: option off or not applicable - loads, queries and renders as before', () => {
    beforeEach(() => {
      answer(SEPTEMBER_2026.from, 40674.316);
      answer(OCTOBER_2026.from, 42990.484);
    });

    it('without showChange: one query for the shifted window, no change line', async () => {
      const el = await render(kpi({ showChange: undefined }));

      expect(windows()).toEqual([SEPTEMBER_2026]);
      expect(value(el)).toBe('40 674,32');
      expect(changeLine(el)).toBeNull();
    });

    it('showChange without a time shift ("Compare with" None): one query, no change line', async () => {
      const el = await render(kpi({}, source({ timeShift: undefined })));

      expect(windows()).toEqual([OCTOBER_2026]);
      expect(changeLine(el)).toBeNull();
    });

    it('showChange with "Ignore MeshBoard time filter": one unfiltered query, no change line', async () => {
      const el = await render(kpi({}, source({ ignoreTimeFilter: true })));

      expect(execute).toHaveBeenCalledTimes(1);
      expect((execute.mock.calls[0][2] as QueryExecutionOptions).streamDataArgs).toBeUndefined();
      expect(changeLine(el)).toBeNull();
    });

    it('showChange on a runtime query: one query, no change line', async () => {
      const el = await render(kpi({}, source({ queryFamily: 'runtime' })));

      expect(execute).toHaveBeenCalledTimes(1);
      expect(changeLine(el)).toBeNull();
    });
  });

  describe('criterion 2: change = current - shifted in the KPI unit and decimals, % with one decimal, signed, never -0', () => {
    it('queries the shifted window and the current board window', async () => {
      answer(SEPTEMBER_2026.from, 40674.316);
      answer(OCTOBER_2026.from, 42990.484);

      await render(kpi());

      expect(windows()).toEqual(expect.arrayContaining([SEPTEMBER_2026, OCTOBER_2026]));
      expect(windows()).toHaveLength(2);
    });

    it('current 42 990,48 vs shifted 40 674,32 -> "+2 316,17 kWh (+5,7 %)", the tile keeps the shifted value', async () => {
      answer(SEPTEMBER_2026.from, 40674.316);
      answer(OCTOBER_2026.from, 42990.484);

      const el = await render(kpi());

      expect(value(el)).toBe('40 674,32');
      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');
    });

    it('current 3 482,59 vs shifted 3 688,86 -> "−206,27 kWh (−5,6 %)"', async () => {
      answer(SEPTEMBER_2026.from, 3688.86);
      answer(OCTOBER_2026.from, 3482.59);

      const el = await render(kpi());

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('−206,27 kWh (−5,6 %)');
    });

    it('equal totals -> "0 kWh (0,0 %)"', async () => {
      answer(SEPTEMBER_2026.from, 1250);
      answer(OCTOBER_2026.from, 1250);

      const el = await render(kpi());

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('0 kWh (0,0 %)');
    });

    it('equal totals with 2 KPI decimals -> "0,00 kWh (0,0 %)"', async () => {
      answer(SEPTEMBER_2026.from, 1250);
      answer(OCTOBER_2026.from, 1250);

      const el = await render(kpi({ decimalPlaces: 2 }));

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('0,00 kWh (0,0 %)');
    });

    it('a decrease that rounds to zero shows no minus sign: 1 250,004 vs 1 250,001 with 2 decimals -> "0,00 kWh (0,0 %)"', async () => {
      answer(SEPTEMBER_2026.from, 1250.004);
      answer(OCTOBER_2026.from, 1250.001);

      const el = await render(kpi({ decimalPlaces: 2 }));

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('0,00 kWh (0,0 %)');
    });

    it('uses the KPI decimals: 1 decimal, 1 000 vs 1 234,56 -> "+234,6 kWh (+23,5 %)"', async () => {
      answer(SEPTEMBER_2026.from, 1000);
      answer(OCTOBER_2026.from, 1234.56);

      const el = await render(kpi({ decimalPlaces: 1 }));

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+234,6 kWh (+23,5 %)');
    });

    it('applies the value multiplier to both periods: 2 000 W vs 1 500 W x 0.001 -> "+0,50 kWh (+33,3 %)"', async () => {
      answer(SEPTEMBER_2026.from, 1500);
      answer(OCTOBER_2026.from, 2000);

      const el = await render(kpi({ valueMultiplier: 0.001 }));

      expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+0,50 kWh (+33,3 %)');
    });
  });

  describe('criterion 3: arrow by direction, colour by good or bad change (theme variables only)', () => {
    const increase = (): void => { answer(SEPTEMBER_2026.from, 40674.316); answer(OCTOBER_2026.from, 42990.484); };
    const decrease = (): void => { answer(SEPTEMBER_2026.from, 3688.86); answer(OCTOBER_2026.from, 3482.59); };
    const arrow = (line: HTMLElement): string | undefined => line.querySelector('.kpi-change-arrow')?.textContent?.trim();
    const cue = (line: HTMLElement): string | undefined => line.querySelector('.kpi-change-cue')?.textContent?.trim();

    it('an increase is good by default: ▲ with the success colour class', async () => {
      increase();

      const line = changeLine(await render(kpi()))!;

      expect(plain(line.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');
      expect(arrow(line)).toBe('▲');
      expect(cue(line)).toBe('Favourable');
      expect(line.classList).toContain('change-good');
    });

    it('a decrease is bad by default: ▼ with the error colour class', async () => {
      decrease();

      const line = changeLine(await render(kpi()))!;

      expect(arrow(line)).toBe('▼');
      expect(cue(line)).toBe('Unfavourable');
      expect(line.classList).toContain('change-bad');
    });

    it('"An increase is bad" + "+2 316,17 kWh (+5,7 %)": ▲ with the error colour class', async () => {
      increase();

      const line = changeLine(await render(kpi({ increaseIsGood: false })))!;

      expect(plain(line.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');
      expect(arrow(line)).toBe('▲');
      expect(cue(line)).toBe('Unfavourable');
      expect(line.classList).toContain('change-bad');
    });

    it('"An increase is bad" + "−206,27 kWh (−5,6 %)": ▼ with the success colour class', async () => {
      decrease();

      const line = changeLine(await render(kpi({ increaseIsGood: false })))!;

      expect(plain(line.querySelector('.kpi-change-text')?.textContent)).toBe('−206,27 kWh (−5,6 %)');
      expect(arrow(line)).toBe('▼');
      expect(cue(line)).toBe('Favourable');
      expect(line.classList).toContain('change-good');
    });

    it('zero is neutral without arrow, also with "An increase is bad"', async () => {
      answer(SEPTEMBER_2026.from, 1250);
      answer(OCTOBER_2026.from, 1250);

      const line = changeLine(await render(kpi({ increaseIsGood: false })))!;

      expect(line.classList).toContain('change-neutral');
      expect(line.querySelector('.kpi-change-arrow')).toBeNull();
      expect(line.querySelector('.kpi-change-cue')).toBeNull();
    });

    it('a change that rounds to zero is neutral like equal totals: 3,004 vs 3 with 2 decimals -> "0,00 kWh (0,0 %)", no arrow', async () => {
      answer(SEPTEMBER_2026.from, 3);
      answer(OCTOBER_2026.from, 3.004);

      const line = changeLine(await render(kpi({ decimalPlaces: 2 })))!;

      expect(plain(line.querySelector('.kpi-change-text')?.textContent)).toBe('0,00 kWh (0,0 %)');
      expect(line.classList).toContain('change-neutral');
      expect(line.querySelector('.kpi-change-arrow')).toBeNull();
      expect(line.querySelector('.kpi-change-cue')).toBeNull();
    });

    it('a decrease that rounds to zero is neutral with "An increase is bad": 2,996 vs 3 with 2 decimals -> "0,00 kWh (0,0 %)", no arrow', async () => {
      answer(SEPTEMBER_2026.from, 3);
      answer(OCTOBER_2026.from, 2.996);

      const line = changeLine(await render(kpi({ decimalPlaces: 2, increaseIsGood: false })))!;

      expect(plain(line.querySelector('.kpi-change-text')?.textContent)).toBe('0,00 kWh (0,0 %)');
      expect(line.classList).toContain('change-neutral');
      expect(line.querySelector('.kpi-change-arrow')).toBeNull();
      expect(line.querySelector('.kpi-change-cue')).toBeNull();
    });

    it('the words follow the host translation (MESHBOARD_MESSAGES): "günstig" / "ungünstig"', async () => {
      hostMessages.set({ kpiChangeFavourable: 'günstig', kpiChangeUnfavourable: 'ungünstig' });
      increase();

      const unfavourable = changeLine(await render(kpi({ increaseIsGood: false })))!;
      expect(cue(unfavourable)).toBe('ungünstig');

      fixture.destroy();
      const favourable = changeLine(await render(kpi()))!;
      expect(cue(favourable)).toBe('günstig');
    });

    it('the colours are theme variables only (good success, bad error, neutral subtle), no hard-coded colour', async () => {
      answer(SEPTEMBER_2026.from, 1);
      answer(OCTOBER_2026.from, 2);
      await render(kpi());

      const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
      const rule = (selector: string): string => css.match(new RegExp(`\\.kpi-change\\.${selector}[^{]*\\{([^}]*)\\}`))?.[1] ?? '';

      expect(rule('change-good')).toMatch(/^\s*color:\s*var\(--kendo-color-success\);?\s*$/);
      expect(rule('change-bad')).toMatch(/^\s*color:\s*var\(--kendo-color-error\);?\s*$/);
      expect(rule('change-neutral')).toMatch(/^\s*color:\s*var\(--kendo-color-subtle\);?\s*$/);
    });

    it('the word stands on its own line under the numbers, inside the coloured line, with no colour of its own', async () => {
      increase();
      const line = changeLine(await render(kpi({ increaseIsGood: false })))!;

      const word = line.querySelector('.kpi-change-cue')!;
      expect(word.previousElementSibling?.classList).toContain('kpi-change-text');
      expect(word.nextElementSibling).toBeNull();
      const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
      const cueRule = css.match(/\.kpi-change-cue[^{]*\{([^}]*)\}/)?.[1] ?? '';
      expect(cueRule).toMatch(/flex-basis:\s*100%/);
      expect(cueRule).not.toMatch(/(^|;)\s*color:/);
    });
  });

  describe('criterion 4: no base value -> "–"', () => {
    it('shifted total 0 -> "–", not 100 %', async () => {
      answer(SEPTEMBER_2026.from, 0);
      answer(OCTOBER_2026.from, 512.3);

      const line = changeLine(await render(kpi()))!;

      expect(plain(line.textContent)).toBe('–');
      expect(line.classList).toContain('change-neutral');
    });

    it('shifted period without rows -> "–"', async () => {
      answer(OCTOBER_2026.from, 512.3);

      const line = changeLine(await render(kpi()))!;

      expect(plain(line.textContent)).toBe('–');
    });

    it('shifted period with an empty (null) cell -> value "-" and change "–"', async () => {
      answer(SEPTEMBER_2026.from, null);
      answer(OCTOBER_2026.from, 512.3);

      const el = await render(kpi());

      expect(value(el)).toBe('-');
      expect(plain(changeLine(el)!.textContent)).toBe('–');
    });
  });

  describe('criterion 5: every range type, the host range, loading and empty states', () => {
    const cases: { name: string; setup: () => void; shift: MeshBoardTimeShift; current: { from: Date; to: Date }; shifted: { from: Date; to: Date } }[] = [
      {
        name: 'month, same period last year', shift: SAME_PERIOD_LAST_YEAR, setup: () => board({ type: 'month', year: 2026, month: 9 }),
        current: OCTOBER_2026, shifted: OCTOBER_2025
      },
      {
        name: 'quarter', shift: PREVIOUS_PERIOD, setup: () => board({ type: 'quarter', year: 2026, quarter: 1 }),
        current: { from: at('2026-01-01T00:00:00+01:00'), to: at('2026-04-01T00:00:00+02:00') },
        shifted: { from: at('2025-10-01T00:00:00+02:00'), to: at('2026-01-01T00:00:00+01:00') }
      },
      {
        name: 'year', shift: PREVIOUS_PERIOD, setup: () => board({ type: 'year', year: 2026 }),
        current: { from: at('2026-01-01T00:00:00+01:00'), to: at('2027-01-01T00:00:00+01:00') },
        shifted: { from: at('2025-01-01T00:00:00+01:00'), to: at('2026-01-01T00:00:00+01:00') }
      },
      {
        name: 'day', shift: PREVIOUS_PERIOD, setup: () => board({ type: 'day', year: 2026, month: 2, day: 30 }),
        current: { from: at('2026-03-30T00:00:00+02:00'), to: at('2026-03-31T00:00:00+02:00') },
        shifted: { from: at('2026-03-29T00:00:00+01:00'), to: at('2026-03-30T00:00:00+02:00') }
      },
      {
        name: 'custom range', shift: PREVIOUS_PERIOD,
        setup: () => board({ type: 'custom', customFrom: '2026-11-03T00:00:00+01:00', customTo: '2026-11-10T00:00:00+01:00' }, true),
        current: { from: at('2026-11-03T00:00:00+01:00'), to: at('2026-11-10T00:00:00+01:00') },
        shifted: { from: at('2026-10-27T00:00:00+01:00'), to: at('2026-11-03T00:00:00+01:00') }
      },
      {
        name: 'relative range "last 7 days"', shift: PREVIOUS_PERIOD,
        setup: () => {
          vi.useFakeTimers({ toFake: ['Date'] });
          vi.setSystemTime(at('2026-11-10T00:00:00+01:00'));
          board({ type: 'relative', relativeValue: 7, relativeUnit: 'days' });
        },
        current: { from: at('2026-11-03T00:00:00+01:00'), to: at('2026-11-10T00:00:00+01:00') },
        shifted: { from: at('2026-10-27T00:00:00+01:00'), to: at('2026-11-03T00:00:00+01:00') }
      },
      {
        name: 'host-set range', shift: PREVIOUS_PERIOD,
        setup: () => state.setHostTimeRange({ status: 'valid', from: at('2026-11-03T00:00:00+01:00'), to: at('2026-11-10T00:00:00+01:00') }),
        current: { from: at('2026-11-03T00:00:00+01:00'), to: at('2026-11-10T00:00:00+01:00') },
        shifted: { from: at('2026-10-27T00:00:00+01:00'), to: at('2026-11-03T00:00:00+01:00') }
      }
    ];

    for (const c of cases) {
      it(`${c.name}: shifted value in the tile, change against the current window`, async () => {
        c.setup();
        answer(c.shifted.from, 3688.86);
        answer(c.current.from, 3482.59);

        const el = await render(kpi({}, source({ timeShift: c.shift })));

        expect(windows()).toEqual(expect.arrayContaining([c.shifted, c.current]));
        expect(windows()).toHaveLength(2);
        expect(value(el)).toBe('3 688,86');
        expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('−206,27 kWh (−5,6 %)');
      });
    }

    it('while the queries run the tile shows its loading state and no change line', async () => {
      execute.mockReturnValue(new Observable<QueryExecutionResult>(() => undefined));

      fixture = TestBed.createComponent(KpiWidgetComponent);
      fixture.componentRef.setInput('config', kpi());
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.loading-indicator')).not.toBeNull();
      expect(changeLine(el)).toBeNull();
    });

    describe('error state', () => {
      const failing = (failingWindowStart: Date): void => {
        execute.mockImplementation((_family: unknown, _rtId: unknown, options: QueryExecutionOptions): Observable<QueryExecutionResult> => {
          const from = options.streamDataArgs?.from as Date | undefined;
          return from?.getTime() === failingWindowStart.getTime()
            ? throwError(() => new Error('query failed'))
            : of(rows(from ? valuesByWindowStart.get(from.getTime()) : undefined));
        });
      };

      beforeEach(() => {
        answer(SEPTEMBER_2026.from, 40674.316);
        answer(OCTOBER_2026.from, 42990.484);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
      });

      it('only the current (unshifted) query fails: the tile keeps the shifted 40 674,32 and publishes it, no change line, no error', async () => {
        failing(OCTOBER_2026.from);

        const el = await render(kpi({ outputVariableName: 'shiftedEnergy' }));

        expect(el.querySelector('.error-message')).toBeNull();
        expect(value(el)).toBe('40 674,32');
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
        expect(state.getVariables().find(v => v.name === 'shiftedEnergy')?.value).toBe('40674.316');
      });

      it('the shifted query fails: the tile shows its error and no change line', async () => {
        failing(SEPTEMBER_2026.from);

        const el = await render(kpi());

        expect(plain(el.querySelector('.error-message')?.textContent)).toBe('Failed to load data');
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
      });

      it('a refresh that fails after "+2 316,17 kWh (+5,7 %)" shows the error, not the old change line', async () => {
        const el = await render(kpi());
        expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');

        failing(SEPTEMBER_2026.from);
        fixture.componentInstance.refresh();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(plain(el.querySelector('.error-message')?.textContent)).toBe('Failed to load data');
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
      });
    });

    describe('a superseded load writes nothing', () => {
      let late: Subject<QueryExecutionResult>;

      beforeEach(() => {
        answer(SEPTEMBER_2026.from, 40674.316);
        answer(OCTOBER_2026.from, 42990.484);
        late = new Subject<QueryExecutionResult>();
        state.updateEntitySelectors([{ id: 'site', label: 'Site', ckTypeId: 'System/Entity', attributeMappings: [] }]);
        state.setEntitySelectorRtIds('site', ['site-1']);
      });

      function answerLate(lateWindowStart: Date): void {
        execute.mockImplementation((_family: unknown, _rtId: unknown, options: QueryExecutionOptions): Observable<QueryExecutionResult> => {
          const from = options.streamDataArgs!.from as Date;
          return from.getTime() === lateWindowStart.getTime() ? late : of(rows(valuesByWindowStart.get(from.getTime())));
        });
      }

      async function switchToEmptyScopeWhileQueryRuns(lateWindowStart: Date): Promise<HTMLElement> {
        answerLate(lateWindowStart);
        fixture = TestBed.createComponent(KpiWidgetComponent);
        fixture.componentRef.setInput('config', kpi({}, source({ entitySelectorId: 'site' })));
        fixture.detectChanges();
        state.setEntitySelectorRtIds('site', []);
        fixture.componentInstance.refresh();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
      }

      it('a late current value of the old pick does not bring back value or change line', async () => {
        const el = await switchToEmptyScopeWhileQueryRuns(OCTOBER_2026.from);
        expect(value(el)).toBe('-');

        late.next(rows(42990.484));
        late.complete();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(value(el)).toBe('-');
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
      });

      it('switching the tile to a static value while the query runs shows 42, not the loading dots', async () => {
        answerLate(OCTOBER_2026.from);
        fixture = TestBed.createComponent(KpiWidgetComponent);
        fixture.componentRef.setInput('config', kpi({}, source({ entitySelectorId: 'site' })));
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.loading-indicator')).not.toBeNull();

        fixture.componentRef.setInput('config', kpi({ showChange: undefined, staticValue: '42' }, { type: 'static' } as unknown as PersistentQueryDataSource));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(el.querySelector('.loading-indicator')).toBeNull();
        expect(value(el)).toBe('42');
      });

      it('a late failure of the old pick\'s shifted query does not show an error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const el = await switchToEmptyScopeWhileQueryRuns(SEPTEMBER_2026.from);

        late.error(new Error('late failure'));
        await fixture.whenStable();
        fixture.detectChanges();

        expect(el.querySelector('.error-message')).toBeNull();
        expect(value(el)).toBe('-');
      });
    });

    describe('refresh', () => {
      beforeEach(() => {
        answer(SEPTEMBER_2026.from, 40674.316);
        answer(OCTOBER_2026.from, 42990.484);
      });

      it('while a refresh runs the old "+2 316,17 kWh (+5,7 %)" is not shown', async () => {
        const el = await render(kpi());
        expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');

        execute.mockReturnValue(new Observable<QueryExecutionResult>(() => undefined));
        fixture.componentInstance.refresh();
        fixture.detectChanges();

        expect(el.querySelector('.loading-indicator')).not.toBeNull();
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
      });

      it('a refresh into an empty entity-selector scope drops the old change line', async () => {
        state.updateEntitySelectors([{ id: 'site', label: 'Site', ckTypeId: 'System/Entity', attributeMappings: [] }]);
        state.setEntitySelectorRtIds('site', ['site-1']);
        const el = await render(kpi({}, source({ entitySelectorId: 'site' })));
        expect(plain(el.querySelector('.kpi-change-text')?.textContent)).toBe('+2 316,17 kWh (+5,7 %)');
        const scopes = execute.mock.calls.map(call => {
          const options = call[2] as QueryExecutionOptions;
          return { scopeRtIds: options.scopeRtIds, rtIds: options.streamDataArgs?.rtIds };
        });
        expect(scopes).toEqual([{ scopeRtIds: ['site-1'], rtIds: ['site-1'] }, { scopeRtIds: ['site-1'], rtIds: ['site-1'] }]);

        state.setEntitySelectorRtIds('site', []);
        fixture.componentInstance.refresh();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(execute).toHaveBeenCalledTimes(2);
        expect(value(el)).toBe('-');
        expect(changeLine(el)).toBeNull();
        expect(fixture.componentInstance.change()).toBeNull();
      });
    });

    it('an empty entity-selector scope shows "-" as today, sends no query and shows no change line', async () => {
      state.updateEntitySelectors([{ id: 'site', label: 'Site', ckTypeId: 'System/Entity', attributeMappings: [] }]);
      state.setEntitySelectorRtIds('site', []);

      const el = await render(kpi({}, source({ entitySelectorId: 'site' })));

      expect(execute).not.toHaveBeenCalled();
      expect(value(el)).toBe('-');
      expect(changeLine(el)).toBeNull();
    });
  });
});
