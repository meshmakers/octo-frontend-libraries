import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { TimeRangeSelection as SharedTimeRangeSelection, TimeRangeUtils, WindowStateService } from '@meshmakers/shared-ui';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardHostTimeRange, MeshBoardTimeFilterControl } from './host-time-range';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { EntitySelectorConfig, MeshBoardConfig, MeshBoardTimeFilterConfig } from '../../models/meshboard.models';
import { MeshBoardHeaderMode } from '../../utils/meshboard-header';

/**
 * The host page sets the board's period as exact instants and can hide the board's own picker
 * (AB#7582). Fixture: gas day 2026-03-28 (Vienna 06:00 → 06:00, 23 h because of the DST switch)
 * = [2026-03-28T05:00:00Z, 2026-03-29T04:00:00Z).
 */
describe('MeshBoardViewComponent — host time range (AB#7582)', () => {
  const GAS_DAY: MeshBoardHostTimeRange = { from: '2026-03-28T05:00:00Z', to: '2026-03-29T04:00:00Z' };
  const GAS_FROM = '2026-03-28T05:00:00.000Z';
  const GAS_TO = '2026-03-29T04:00:00.000Z';

  /** Stored board selection: March 2026 on the Vienna basis, without time (snaps to 00:00). */
  const STORED_TIME_FILTER: MeshBoardTimeFilterConfig = {
    enabled: true,
    pickerConfig: { showTime: false },
    selection: { type: 'month', year: 2026, month: 3 },
    defaultSelection: { type: 'year', year: 2026 }
  } as MeshBoardTimeFilterConfig;

  const TOOLBAR_SELECTOR: EntitySelectorConfig = {
    id: 'site',
    label: 'Site',
    ckTypeId: 'Test/Site',
    attributeMappings: []
  };

  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const originalTz = env['TZ'];

  let state: MeshBoardStateService;
  let persistence: {
    getMeshBoards: ReturnType<typeof vi.fn>;
    getMeshBoardWithWidgets: ReturnType<typeof vi.fn>;
    toMeshBoardConfig: ReturnType<typeof vi.fn>;
  };
  let navigateByUrl: ReturnType<typeof vi.fn>;

  interface SetupOptions {
    timeFilter?: MeshBoardTimeFilterConfig;
    queryParams?: Record<string, string>;
    selectors?: EntitySelectorConfig[];
    readonly?: boolean;
    timeRange?: MeshBoardHostTimeRange;
    timeFilterControl?: MeshBoardTimeFilterControl;
    headerMode?: MeshBoardHeaderMode;
  }

  function setup(options: SetupOptions = {}) {
    const config: MeshBoardConfig = {
      id: 'board-1',
      name: 'Host board',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      timeFilter: 'timeFilter' in options ? options.timeFilter : STORED_TIME_FILTER,
      timeZoneMode: 'Europe/Vienna',
      entitySelectors: options.selectors ?? []
    };
    persistence = {
      getMeshBoards: vi.fn().mockResolvedValue([{ rtId: 'board-1', name: 'Host board', rtWellKnownName: 'host' }]),
      getMeshBoardWithWidgets: vi.fn().mockResolvedValue({ meshBoard: { rtId: 'board-1', name: 'Host board' }, widgets: [] }),
      toMeshBoardConfig: vi.fn().mockReturnValue(config)
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'host', meshBoardReadonly: options.readonly ?? true, meshBoardSyncUrl: true },
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap(options.queryParams ?? {})
      },
      parent: null,
      root: { firstChild: null }
    };
    TestBed.configureTestingModule({
      imports: [MeshBoardViewComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MeshBoardStateService,
        EditModeStateService,
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardPersistenceService, useValue: persistence },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn().mockResolvedValue(true) } },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: MeshBoardVariableService, useValue: {} },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        {
          provide: MeshBoardDataService,
          useValue: { fetchRuntimeEntity: vi.fn().mockReturnValue(of(null)), fetchAssociationTargets: vi.fn().mockReturnValue(of([])) }
        },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: vi.fn().mockReturnValue(of({ data: null })) } },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    const fixture = TestBed.createComponent(MeshBoardViewComponent);
    if (options.timeRange !== undefined) {
      fixture.componentRef.setInput('timeRange', options.timeRange);
    }
    if (options.timeFilterControl !== undefined) {
      fixture.componentRef.setInput('timeFilterControl', options.timeFilterControl);
    }
    if (options.headerMode !== undefined) {
      fixture.componentRef.setInput('headerMode', options.headerMode);
    }
    return fixture;
  }

  async function settle(fixture: ReturnType<typeof setup>): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function variable(name: string): string | undefined {
    return state.getVariable(name)?.value;
  }

  /** The range the board's own stored selection resolves to (March 2026, Vienna, no time). */
  function storedSelectionRange(): { from: string; to: string } {
    const range = TimeRangeUtils.getTimeRangeFromSelection(
      STORED_TIME_FILTER.selection as unknown as SharedTimeRangeSelection, false, 'Europe/Vienna')!;
    return TimeRangeUtils.toISO(range);
  }

  function tfUrlWrites(): string[] {
    return navigateByUrl.mock.calls.map(call => String(call[0])).filter(url => url.includes('tf_'));
  }

  /**
   * Runs `fn` with the process time zone set to `tz` and restores it before returning. The process
   * time zone is global to the test process (and Vitest runs spec files side by side), so the switch
   * is kept to one synchronous block - never across an `await` - to stay invisible to other specs.
   */
  function withProcessTimeZone<T>(tz: string, fn: () => T): T {
    env['TZ'] = tz;
    try {
      return fn();
    } finally {
      if (originalTz === undefined) {
        delete env['TZ'];
      } else {
        env['TZ'] = originalTz;
      }
    }
  }

  describe.each([
    { tz: 'UTC', offsetMinutes: 0 },
    { tz: 'America/New_York', offsetMinutes: 240 }
  ])('exact instants with the process time zone $tz (AC 1, AC 2)', ({ tz, offsetMinutes }) => {
    /** Sets `range` on a settled view inside the time zone and reads what the board publishes. */
    async function publishedIn(range: MeshBoardHostTimeRange) {
      // Start from another period, so setting `range` goes through the view's change path.
      const fixture = setup({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } });
      await settle(fixture);
      return withProcessTimeZone(tz, () => {
        fixture.componentRef.setInput('timeRange', range);
        fixture.detectChanges();
        const window = state.resolveStreamDataTimeArgs();
        return {
          offsetMinutes: new Date(2026, 2, 28, 12).getTimezoneOffset(),
          variableFrom: variable('timeRangeFrom'),
          variableTo: variable('timeRangeTo'),
          windowFrom: window?.from.toISOString(),
          windowTo: window?.to.toISOString(),
          scope: state.resolveStreamDataScope(undefined, 'streamData')
        };
      });
    }

    const expected = {
      offsetMinutes,
      variableFrom: GAS_FROM,
      variableTo: GAS_TO,
      windowFrom: GAS_FROM,
      windowTo: GAS_TO,
      scope: { kind: 'unscoped' }
    };

    it('publishes the host instants unchanged as variables and as the stream-data window', async () => {
      expect(await publishedIn(GAS_DAY)).toEqual(expected);
    });

    it('takes Date objects as the same instants', async () => {
      expect(await publishedIn({ from: new Date(GAS_FROM), to: new Date(GAS_TO) })).toEqual(expected);
    });

    it('takes offset strings (Vienna wall clock) as the same instants', async () => {
      expect(await publishedIn({ from: '2026-03-28T06:00:00+01:00', to: '2026-03-29T06:00:00+02:00' })).toEqual(expected);
    });
  });

  it('publishes the host instants on the initial load (AC 1)', async () => {
    const fixture = setup({ timeRange: GAS_DAY });
    await settle(fixture);

    expect(variable('timeRangeFrom')).toBe(GAS_FROM);
    expect(variable('timeRangeTo')).toBe(GAS_TO);
    expect(state.resolveStreamDataTimeArgs()?.from.toISOString()).toBe(GAS_FROM);
  });

  it('does not snap with showTime=true either (AC 1)', async () => {
    const fixture = setup({
      timeRange: GAS_DAY,
      timeFilter: { ...STORED_TIME_FILTER, pickerConfig: { showTime: true } } as MeshBoardTimeFilterConfig
    });
    await settle(fixture);

    expect(state.resolveCurrentTimeRange()?.from.toISOString()).toBe(GAS_FROM);
    expect(state.resolveCurrentTimeRange()?.to.toISOString()).toBe(GAS_TO);
  });

  describe('host wins (AC 3)', () => {
    it('ignores tf_* parameters and the stored selection, writes no tf_* and leaves no unsaved changes', async () => {
      const fixture = setup({ timeRange: GAS_DAY, queryParams: { tf_type: 'year', tf_year: '2025' } });
      await settle(fixture);

      expect(variable('timeRangeFrom')).toBe(GAS_FROM);
      expect(state.getTimeFilterConfig()?.selection).toEqual(STORED_TIME_FILTER.selection);
      expect(tfUrlWrites()).toEqual([]);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('ignores picker events and the reset while the host owns the period', async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);
      const refresh = vi.spyOn(state, 'triggerRefresh');

      await fixture.componentInstance.onTimeSelectionChange({ type: 'year', year: 2024 } as SharedTimeRangeSelection);
      fixture.componentInstance.resetTimeFilterToDefault();

      expect(state.getTimeFilterConfig()?.selection).toEqual(STORED_TIME_FILTER.selection);
      expect(variable('timeRangeFrom')).toBe(GAS_FROM);
      expect(tfUrlWrites()).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('control: without a host period the URL sync does write tf_* (the check above can fail)', async () => {
      const fixture = setup();
      await settle(fixture);

      expect(tfUrlWrites().length).toBeGreaterThan(0);
      expect(variable('timeRangeFrom')).toBe(storedSelectionRange().from);
    });
  });

  describe('reactive (AC 4)', () => {
    it('reloads the widgets once with the new period, without reloading the board definition', async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);
      const refresh = vi.spyOn(state, 'triggerRefresh');
      const definitionLoads = persistence.getMeshBoardWithWidgets.mock.calls.length;
      const boardLists = persistence.getMeshBoards.mock.calls.length;

      fixture.componentRef.setInput('timeRange', { from: '2026-03-29T04:00:00Z', to: '2026-03-30T04:00:00Z' });
      await settle(fixture);

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(variable('timeRangeFrom')).toBe('2026-03-29T04:00:00.000Z');
      expect(variable('timeRangeTo')).toBe('2026-03-30T04:00:00.000Z');
      expect(persistence.getMeshBoardWithWidgets.mock.calls.length).toBe(definitionLoads);
      expect(persistence.getMeshBoards.mock.calls.length).toBe(boardLists);
    });

    it('does not reload for a new object with the same instants', async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);
      const refresh = vi.spyOn(state, 'triggerRefresh');

      fixture.componentRef.setInput('timeRange', { from: new Date(GAS_FROM), to: new Date(GAS_TO) });
      await settle(fixture);

      expect(refresh).not.toHaveBeenCalled();
    });

    it('does not reload on the initial value (no double fetch)', async () => {
      const refresh = vi.spyOn(MeshBoardStateService.prototype, 'triggerRefresh');
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);

      expect(refresh).not.toHaveBeenCalled();
    });

    it('returns to the board selection when the host sets undefined', async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);
      const refresh = vi.spyOn(state, 'triggerRefresh');

      fixture.componentRef.setInput('timeRange', undefined);
      const el = await settle(fixture);

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(state.hostTimeRange()).toBeNull();
      expect(variable('timeRangeFrom')).toBe(storedSelectionRange().from);
      expect(variable('timeRangeTo')).toBe(storedSelectionRange().to);
      expect(el.querySelector('mm-time-range-picker')).not.toBeNull();
    });
  });

  it('drops the host variables when the host clears its period on a board without own selection', async () => {
    const fixture = setup({
      timeRange: GAS_DAY,
      timeFilterControl: 'host',
      timeFilter: { enabled: true, pickerConfig: { showTime: false } } as MeshBoardTimeFilterConfig
    });
    await settle(fixture);
    expect(variable('timeRangeFrom')).toBe(GAS_FROM);

    fixture.componentRef.setInput('timeRange', undefined);
    await settle(fixture);

    expect(variable('timeRangeFrom')).toBeUndefined();
    expect(variable('timeRangeTo')).toBeUndefined();
    expect(state.resolveCurrentTimeRange()).toBeNull();
  });

  describe('picker hidden (AC 5)', () => {
    for (const headerMode of ['full', 'compact'] as MeshBoardHeaderMode[]) {
      it(`hides only the picker and its reset with timeFilterControl='host' (headerMode ${headerMode})`, async () => {
        const fixture = setup({
          timeFilterControl: 'host',
          headerMode,
          readonly: false,
          selectors: [TOOLBAR_SELECTOR]
        });
        const el = await settle(fixture);

        expect(el.querySelector('mm-time-range-picker')).toBeNull();
        expect(el.querySelector('[aria-label="Reset to default time filter"]')).toBeNull();
        expect(el.querySelector('mm-entity-selector-toolbar')).not.toBeNull();
        expect(el.querySelector('[aria-label="MeshBoard Settings"]')).not.toBeNull();
        expect(el.querySelector('[aria-label="Manage MeshBoards"]')).not.toBeNull();
      });
    }

    it('shows picker and reset with the default control (unchanged behaviour)', async () => {
      const fixture = setup({ readonly: false, selectors: [TOOLBAR_SELECTOR] });
      const el = await settle(fixture);

      expect(el.querySelector('mm-time-range-picker')).not.toBeNull();
      // Stored selection (month) differs from the default (year) → the reset is offered.
      expect(el.querySelector('[aria-label="Reset to default time filter"]')).not.toBeNull();
      expect(el.querySelector('mm-entity-selector-toolbar')).not.toBeNull();
    });

    it("hides the picker while a host period is set, even with timeFilterControl='board'", async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      const el = await settle(fixture);

      expect(el.querySelector('mm-time-range-picker')).toBeNull();
    });
  });

  describe('when it goes wrong (AC 6)', () => {
    it.each([
      ['an unparseable value', { from: 'not-a-date', to: GAS_TO }],
      ['from equal to to', { from: GAS_FROM, to: GAS_FROM }],
      ['from after to', { from: GAS_TO, to: GAS_FROM }],
      ['a string without zone designator', { from: '2026-03-28T05:00:00', to: GAS_TO }],
      ['an invalid Date', { from: new Date(Number.NaN), to: new Date(GAS_TO) }]
    ])('%s sends no stream-data query and logs one error naming the input', async (_label, range) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = setup({ timeRange: range as MeshBoardHostTimeRange });
      await settle(fixture);

      expect(state.resolveStreamDataScope(undefined, 'streamData')).toEqual({ kind: 'empty', reason: 'invalidTimeRange' });
      expect(state.resolveStreamDataScope('site', undefined)).toEqual({ kind: 'empty', reason: 'invalidTimeRange' });
      // Runtime queries are not gated (documented limitation).
      expect(state.resolveStreamDataScope(undefined, 'runtime')).toEqual({ kind: 'unscoped' });
      expect(state.resolveStreamDataTimeArgs()).toBeUndefined();
      expect(variable('timeRangeFrom')).toBeUndefined();
      expect(variable('timeRangeTo')).toBeUndefined();
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('"timeRange"');
    });

    it('logs again only when the host sets a different invalid value', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = setup({ timeRange: { from: 'x', to: GAS_TO } });
      await settle(fixture);
      fixture.componentRef.setInput('timeRange', { from: 'y', to: GAS_TO });
      await settle(fixture);

      expect(error).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('timeRange', { from: GAS_TO, to: GAS_FROM });
      await settle(fixture);

      expect(error).toHaveBeenCalledTimes(2);
    });

    it('a board with time filter disabled ignores timeRange and logs nothing', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = setup({ timeFilter: undefined, timeRange: { from: 'not-a-date', to: 'x' } });
      await settle(fixture);

      expect(error).not.toHaveBeenCalled();
      expect(state.resolveStreamDataScope(undefined, 'streamData')).toEqual({ kind: 'unscoped' });
      expect(state.resolveCurrentTimeRange()).toBeNull();
      expect(variable('timeRangeFrom')).toBeUndefined();
    });
  });

  describe('lifecycle and ownership (review round 1)', () => {
    it('a view destroyed during the initial load leaves no host period behind', async () => {
      let releaseLoad!: () => void;
      const loadGate = new Promise<void>(resolve => { releaseLoad = resolve; });
      const fixture = setup({ timeRange: GAS_DAY });
      const boards = [{ rtId: 'board-1', name: 'Host board', rtWellKnownName: 'host' }];
      persistence.getMeshBoards.mockReset();
      persistence.getMeshBoards
        .mockImplementationOnce(() => loadGate.then(() => boards))
        .mockResolvedValue(boards);

      fixture.detectChanges(); // ngOnInit starts
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(persistence.getMeshBoards).toHaveBeenCalledTimes(1); // the board list is in flight
      fixture.destroy();
      releaseLoad();
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(state.hostTimeRange()).toBeNull();

      // The next view without timeRange uses the board's own selection.
      const next = TestBed.createComponent(MeshBoardViewComponent);
      await settle(next);
      expect(state.hostTimeRange()).toBeNull();
      expect(variable('timeRangeFrom')).toBe(storedSelectionRange().from);
      expect(state.resolveStreamDataTimeArgs()?.from.toISOString()).toBe(storedSelectionRange().from);
    });

    it('a destroyed view does not clear the period another view set (owner-aware)', async () => {
      const first = setup({ timeRange: GAS_DAY });
      await settle(first);
      const second = TestBed.createComponent(MeshBoardViewComponent);
      second.componentRef.setInput('timeRange', { from: '2026-04-01T00:00:00Z', to: '2026-04-02T00:00:00Z' });
      await settle(second);

      first.destroy();

      expect(state.resolveCurrentTimeRange()?.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      second.destroy();
      expect(state.hostTimeRange()).toBeNull();
    });
  });

  describe('invalid range and the time-filter opt-out (review round 1)', () => {
    it('does not blank a widget with ignoreTimeFilter=true and keeps its selector scope', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = setup({ timeRange: { from: GAS_TO, to: GAS_FROM } });
      await settle(fixture);
      state.setEntitySelectorRtIds('site', ['dev-1']);

      expect(state.resolveStreamDataScope(undefined, 'streamData', true)).toEqual({ kind: 'unscoped' });
      expect(state.resolveStreamDataScope('site', 'streamData', true)).toEqual({ kind: 'scoped', rtIds: ['dev-1'] });
      expect(state.resolveStreamDataRtIds('site')).toEqual(['dev-1']);
      expect(state.resolveStreamDataScope('site', 'streamData', false)).toEqual({ kind: 'empty', reason: 'invalidTimeRange' });
      expect(state.isStreamDataBlockedByHostTimeRange(true)).toBe(false);
      expect(state.isStreamDataBlockedByHostTimeRange()).toBe(true);
    });

    it('a settings change re-applies an invalid host period through the same path (reapplyTimeFilterRange)', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = setup({ timeFilter: undefined, timeRange: { from: 'x', to: GAS_TO } });
      await settle(fixture);
      expect(error).not.toHaveBeenCalled();

      state.updateTimeFilterConfig({ ...STORED_TIME_FILTER });
      (fixture.componentInstance as unknown as { reapplyTimeFilterRange(): void }).reapplyTimeFilterRange();

      expect(error).toHaveBeenCalledTimes(1);
      expect(variable('timeRangeFrom')).toBeUndefined();
      expect(state.resolveStreamDataScope(undefined, 'streamData')).toEqual({ kind: 'empty', reason: 'invalidTimeRange' });
    });

    it('a settings change re-publishes a valid host period unchanged', async () => {
      const fixture = setup({ timeRange: GAS_DAY });
      await settle(fixture);
      state.updateTimeFilterConfig({ ...STORED_TIME_FILTER, pickerConfig: { showTime: true } } as MeshBoardTimeFilterConfig);

      (fixture.componentInstance as unknown as { reapplyTimeFilterRange(): void }).reapplyTimeFilterRange();

      expect(variable('timeRangeFrom')).toBe(GAS_FROM);
      expect(variable('timeRangeTo')).toBe(GAS_TO);
    });
  });

  describe('tf_* parameters (review round 1)', () => {
    it('does not re-apply stale tf_* of the opening URL when the host drops its period', async () => {
      const fixture = setup({ timeRange: GAS_DAY, queryParams: { tf_type: 'year', tf_year: '2025' } });
      await settle(fixture);

      fixture.componentRef.setInput('timeRange', undefined);
      await settle(fixture);

      expect(variable('timeRangeFrom')).toBe(storedSelectionRange().from);
      expect(state.getTimeFilterConfig()?.selection).toEqual(STORED_TIME_FILTER.selection);
      expect(tfUrlWrites()).toEqual([]);
    });

    it("with timeFilterControl='host' and no timeRange the board selection applies but no tf_* is written", async () => {
      const fixture = setup({ timeFilterControl: 'host' });
      await settle(fixture);

      expect(variable('timeRangeFrom')).toBe(storedSelectionRange().from);
      expect(tfUrlWrites()).toEqual([]);
    });
  });

  it('clears the host period when the view is destroyed (root-provided state service)', async () => {
    const fixture = setup({ timeRange: GAS_DAY });
    await settle(fixture);
    expect(state.hostTimeRange()).not.toBeNull();

    fixture.destroy();

    expect(state.hostTimeRange()).toBeNull();
  });
});
