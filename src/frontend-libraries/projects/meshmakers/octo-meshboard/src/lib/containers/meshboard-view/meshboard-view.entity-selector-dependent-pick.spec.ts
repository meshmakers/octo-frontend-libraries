import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { WindowStateService } from '@meshmakers/shared-ui';
import { Subject, of, throwError } from 'rxjs';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutionResult, QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { LineChartWidgetComponent } from '../../widgets/line-chart-widget/line-chart-widget.component';
import {
  EntitySelectorConfig,
  EntitySelectorScopeHop,
  LineChartWidgetConfig,
  MeshBoardConfig,
  RuntimeEntityData,
  RuntimeEntityDataSource
} from '../../models/meshboard.models';

/**
 * A dependent selector never keeps a pick outside its leader's pick (AB#7916):
 * leader change (keep / default / none, one widget refresh), dependent without
 * pick while the leader has one ("Pick a <label>", no query), empty and failed
 * picker scopes, leader cleared, URL and route-data validation on load, host
 * API, and two quick leader changes. Bound widgets are probed with a real line
 * chart and a spy on `QueryExecutorService`, reloaded on every widget refresh
 * as the board does. Neutral fixtures only (Test/Site → Test/Room, one hop).
 */
describe('MeshBoardViewComponent — dependent pick stays inside the leader pick (AB#7916)', () => {
  const TO_ROOM: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' };

  /** Rooms reached from each site. `room-1` is in site-a and site-e; site-c has none. */
  const ROOMS_OF: Record<string, string[]> = {
    'site-a': ['room-1', 'room-2'],
    'site-b': ['room-2', 'room-3'],
    'site-c': [],
    'site-d': ['room-9'],
    'site-e': ['room-1', 'room-5']
  };

  const SITE: EntitySelectorConfig = { id: 'site', label: 'Site', ckTypeId: 'Test/Site', attributeMappings: [], showInToolbar: true };
  /** Dependent room picker without a default. */
  const ROOM: EntitySelectorConfig = {
    id: 'room',
    label: 'Room',
    ckTypeId: 'Test/Room',
    attributeMappings: [],
    showInToolbar: true,
    scopeSource: { selectorId: 'site', path: [TO_ROOM] }
  };
  /** The same dependent with a default (`room-3`, in site-b only). */
  const ROOM_WITH_DEFAULT: EntitySelectorConfig = { ...ROOM, defaultRtId: 'room-3' };

  const RESULT: QueryExecutionResult = {
    family: 'streamData',
    queryRtId: 'q-1',
    associatedCkTypeId: null,
    columns: [],
    rows: [],
    totalCount: 0,
    hasNextPage: false,
    endCursor: null
  };

  function entity(rtId: string, ckTypeId: string): RuntimeEntityData {
    return { rtId, ckTypeId, rtDisplayName: `Name ${rtId}`, attributes: [], associations: [] } as unknown as RuntimeEntityData;
  }

  let state: MeshBoardStateService;
  let router: Router;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };
  let dataService: {
    fetchRuntimeEntity: ReturnType<typeof vi.fn>;
    fetchAssociationTargets: ReturnType<typeof vi.fn>;
    fetchAssociationTargetRtIds: ReturnType<typeof vi.fn>;
  };

  function setup(
    selectors: EntitySelectorConfig[],
    options: { queryParams?: Record<string, string>; routeSelectors?: Record<string, string> } = {}
  ) {
    const config: MeshBoardConfig = {
      id: 'board-1',
      name: 'Site board',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      entitySelectors: selectors
    };
    const persistence = {
      getMeshBoards: vi.fn().mockResolvedValue([{ rtId: 'board-1', name: 'Site board', rtWellKnownName: 'site-board' }]),
      getMeshBoardWithWidgets: vi.fn().mockResolvedValue({ meshBoard: { rtId: 'board-1', name: 'Site board' }, widgets: [] }),
      toMeshBoardConfig: vi.fn().mockReturnValue(config)
    };
    dataService = {
      fetchRuntimeEntity: vi.fn((ds: RuntimeEntityDataSource) => of(entity(ds.rtId!, ds.ckTypeId!))),
      fetchAssociationTargets: vi.fn(() => of([])),
      fetchAssociationTargetRtIds: vi.fn((sources: string[]) => of(sources.flatMap(s => ROOMS_OF[s] ?? [])))
    };
    queryExecutor = { execute: vi.fn().mockReturnValue(of(RESULT)) };
    const data: Record<string, unknown> = { meshBoardWellKnownName: 'site-board', meshBoardReadonly: true };
    if (options.routeSelectors) data['entitySelectors'] = options.routeSelectors;
    const route = {
      snapshot: {
        data,
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
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardPersistenceService, useValue: persistence },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn().mockResolvedValue(true) } },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        {
          provide: MeshBoardVariableService,
          useValue: { mapAttributeTypeToVariableType: () => 'string', convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) }
        },
        {
          provide: EditModeStateService,
          useValue: { isEditMode: () => false, isSaving: () => false, reset: vi.fn(), hasUnsavedChanges: () => false }
        },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: dataService },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: () => of({ data: null }) } },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    router = TestBed.inject(Router);
    return TestBed.createComponent(MeshBoardViewComponent);
  }

  async function settle(fixture: ReturnType<typeof setup>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function pick(fixture: ReturnType<typeof setup>, selectorId: string, rtId: string): Promise<void> {
    return fixture.componentInstance.onEntitySelectorSelected(
      { selectorId, entity: { rtId, displayName: `Name ${rtId}` } } as never
    );
  }

  const roomPick = (): string | undefined => state.getEntitySelector('room')?.selectedRtId;

  /** A line chart bound to `selectorId` — the widget that must never show data outside the leader's pick. */
  function probe(selectorId: string) {
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: `line-${selectorId}`, type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: `q-${selectorId}`, queryFamily: 'streamData', entitySelectorId: selectorId },
      categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value'
    } as LineChartWidgetConfig;
    const load = (): Promise<void> => (cmp as unknown as { loadData(): Promise<void> }).loadData();
    const queries = (): (string[] | undefined)[] => queryExecutor.execute.mock.calls
      .filter(call => call[1] === `q-${selectorId}`)
      .map(call => (call[2] as { scopeRtIds?: string[] }).scopeRtIds);
    return { cmp, load, queries };
  }

  /** Reloads the given probes on every widget refresh, as the board does (new widget config references). */
  function reloadOnRefresh(...probes: ReturnType<typeof probe>[]): { refreshes: () => number; settled: () => Promise<void> } {
    const original = state.triggerRefresh.bind(state);
    const loads: Promise<void>[] = [];
    let count = 0;
    vi.spyOn(state, 'triggerRefresh').mockImplementation(() => {
      count++;
      original();
      probes.forEach(p => loads.push(p.load()));
    });
    return { refreshes: () => count, settled: () => Promise.all(loads).then(() => undefined) };
  }

  function noticeTexts(fixture: ReturnType<typeof setup>, cssClass: string): string[] {
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(`.${cssClass} .error-item`))
      .map(el => el.textContent?.trim() ?? '');
  }

  describe('leader change', () => {
    it('keeps the dependent pick when it is also in the new leader pick', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');

      await pick(fixture, 'site', 'site-e');

      expect(roomPick()).toBe('room-1');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
    });

    it('falls back to the default when the pick is outside the new leader pick and the default is inside', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');

      await pick(fixture, 'site', 'site-b');

      expect(roomPick()).toBe('room-3');
      expect(state.getEntitySelector('room')?.selectedDisplayName).toBe('Name room-3');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-3'] });
    });

    it('clears the pick when neither the pick nor the default is in the new leader pick, and asks for a pick', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-b');
      await pick(fixture, 'room', 'room-2');

      await pick(fixture, 'site', 'site-d');

      expect(roomPick()).toBeUndefined();
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual(['Pick a Room to see this data.']);
    });

    it('marks the dependent pending synchronously, never queries the old pick after the change and queries each bound widget once', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      const room = probe('room');
      const site = probe('site');
      queryExecutor.execute.mockClear();
      const refresh = reloadOnRefresh(room, site);
      const hop$ = new Subject<string[]>();
      dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(hop$);

      const changing = pick(fixture, 'site', 'site-b');
      // A reload while the pick is decided (e.g. the auto-refresh timer) shows loading and sends nothing.
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'pending' });
      await room.load();
      expect(room.cmp.isLoading()).toBe(true);
      expect(room.queries()).toEqual([]);

      hop$.next(ROOMS_OF['site-b']);
      hop$.complete();
      await changing;
      await refresh.settled();

      expect(refresh.refreshes()).toBe(1);
      expect(room.queries()).toEqual([['room-3']]);
      expect(site.queries()).toEqual([['site-b']]);
    });

    it('sends no query for a dependent that is cleared by the change', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      const room = probe('room');
      queryExecutor.execute.mockClear();
      const refresh = reloadOnRefresh(room);

      await pick(fixture, 'site', 'site-b');
      await refresh.settled();

      expect(refresh.refreshes()).toBe(1);
      expect(room.queries()).toEqual([]);
      expect(room.cmp.isLoading()).toBe(false);
    });

    it('applies only the outcome of the last of two quick leader changes', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      const selection = vi.spyOn(state, 'updateEntitySelectorSelection');
      const refresh = reloadOnRefresh();
      const slow$ = new Subject<string[]>();
      dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(slow$);

      const first = pick(fixture, 'site', 'site-b');   // would fall back to room-3
      const second = pick(fixture, 'site', 'site-d');  // room-1 and room-3 both outside → no pick
      await second;
      slow$.next(ROOMS_OF['site-b']);
      slow$.complete();
      await first;

      expect(state.getEntitySelector('site')?.selectedRtId).toBe('site-d');
      expect(roomPick()).toBeUndefined();
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
      expect(selection.mock.calls.some(call => call[0] === 'room' && call[1] === 'room-3')).toBe(false);
      expect(refresh.refreshes()).toBe(1);
    });
  });

  describe('dependent without pick', () => {
    it('shows no data and sends no query while the leader has a pick', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      const room = probe('room');
      const refresh = reloadOnRefresh(room);

      await pick(fixture, 'site', 'site-a');
      await refresh.settled();

      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
      expect(room.queries()).toEqual([]);
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual(['Pick a Room to see this data.']);
    });

    it('keeps the persisted scope while the leader has no pick either (AB#7721 unchanged)', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      const room = probe('room');

      await room.load();

      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'unscoped' });
      expect(room.queries()).toEqual([undefined]);
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual([]);
    });

    it('asks for a pick again when the user clears the dependent while the leader has a pick', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');

      await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'room' } as never);

      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
    });
  });

  describe('empty or failed picker scope', () => {
    it('clears the pick when the new leader pick reaches no room', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');

      await pick(fixture, 'site', 'site-c');

      expect(roomPick()).toBeUndefined();
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual(['Pick a Room to see this data.']);
    });

    it('clears the pick and shows the scope-failed notice when the picker scope fails', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      vi.spyOn(console, 'error').mockReturnValue(undefined);
      dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(throwError(() => new Error('hop failed')));

      await pick(fixture, 'site', 'site-b');

      expect(roomPick()).toBeUndefined();
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'failed' });
      expect(noticeTexts(fixture, 'scope-resolution-errors')).toEqual([
        'Could not resolve the scope of "Room" - widgets bound to it show no data.'
      ]);
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual([]);
    });
  });

  describe('leader cleared', () => {
    it('keeps the dependent pick', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');

      await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'site' } as never);

      expect(roomPick()).toBe('room-1');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
      expect(state.getPickerScopeState('room')).toBeUndefined();
    });

    it('returns a dependent without pick to the persisted scope', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });

      await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'site' } as never);

      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'unscoped' });
      expect(noticeTexts(fixture, 'scope-pick-required')).toEqual([]);
    });

    it('resolves the kept pick again when the leader is cleared while the pick was being decided', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      dataService.fetchAssociationTargetRtIds.mockReturnValueOnce(new Subject<string[]>());

      void pick(fixture, 'site', 'site-b');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'pending' });
      await fixture.componentInstance.onEntitySelectorCleared({ selectorId: 'site' } as never);

      expect(roomPick()).toBe('room-1');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
    });
  });

  describe('board load from URL and route data', () => {
    it('drops a URL pick outside the leader pick, uses the default inside it and rewrites the URL', async () => {
      const info = vi.spyOn(console, 'info').mockReturnValue(undefined);
      const fixture = setup([SITE, ROOM_WITH_DEFAULT], { queryParams: { es_site: 'site-b', es_room: 'room-1' } });
      const navigate = vi.spyOn(router, 'navigateByUrl');
      const room = probe('room');
      const refresh = reloadOnRefresh(room);

      await settle(fixture);
      await refresh.settled();

      expect(roomPick()).toBe('room-3');
      expect(room.queries()).toEqual([['room-3']]);
      expect(info).toHaveBeenCalledTimes(1);
      const [url, extras] = navigate.mock.calls.at(-1) ?? [];
      expect(String(url)).toContain('es_site=site-b');
      expect(String(url)).toContain('es_room=room-3');
      expect(String(url)).not.toContain('room-1');
      expect(extras).toEqual({ replaceUrl: true });
    });

    it('drops a URL pick outside the leader pick to no pick without a default in scope', async () => {
      vi.spyOn(console, 'info').mockReturnValue(undefined);
      const fixture = setup([SITE, ROOM], { queryParams: { es_site: 'site-b', es_room: 'room-1' } });
      const navigate = vi.spyOn(router, 'navigateByUrl');
      const room = probe('room');
      const refresh = reloadOnRefresh(room);

      await settle(fixture);
      await refresh.settled();

      expect(roomPick()).toBeUndefined();
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
      expect(room.queries()).toEqual([]);
      expect(dataService.fetchRuntimeEntity.mock.calls.some(([ds]) => (ds as RuntimeEntityDataSource).rtId === 'room-1')).toBe(false);
      const [url, extras] = navigate.mock.calls.at(-1) ?? [];
      expect(String(url)).toContain('es_site=site-b');
      expect(String(url)).not.toContain('es_room');
      expect(extras).toEqual({ replaceUrl: true });
    });

    it('restores a valid URL pair without rewriting the URL', async () => {
      const info = vi.spyOn(console, 'info').mockReturnValue(undefined);
      const fixture = setup([SITE, ROOM], { queryParams: { es_site: 'site-a', es_room: 'room-1' } });
      const navigate = vi.spyOn(router, 'navigateByUrl');

      await settle(fixture);

      expect(state.getEntitySelector('site')?.selectedRtId).toBe('site-a');
      expect(roomPick()).toBe('room-1');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
      expect(info).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('marks a dependent without initial pick as needing one before the first widget renders', async () => {
      const fixture = setup([SITE, ROOM], { queryParams: { es_site: 'site-a' } });

      await settle(fixture);

      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'empty', reason: 'noPick' });
    });

    it('validates route data the same way', async () => {
      const info = vi.spyOn(console, 'info').mockReturnValue(undefined);
      const fixture = setup([SITE, ROOM], { routeSelectors: { site: 'site-d', room: 'room-2' } });

      await settle(fixture);

      expect(roomPick()).toBeUndefined();
      expect(info).toHaveBeenCalledWith(expect.stringContaining("route pick 'room-2'"));
    });

    it('keeps the dependent URL pick while the leader has no pick', async () => {
      const fixture = setup([SITE, ROOM], { queryParams: { es_room: 'room-9' } });

      await settle(fixture);

      expect(roomPick()).toBe('room-9');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-9'] });
    });
  });

  describe('host API', () => {
    it('rejects an rtId outside the picker scope with a warning and re-queries nothing', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');
      await pick(fixture, 'room', 'room-1');
      const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
      const refresh = reloadOnRefresh();

      await fixture.componentInstance.setEntitySelector('room', 'room-9');

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("'room-9' is outside its pick"));
      expect(roomPick()).toBe('room-1');
      expect(refresh.refreshes()).toBe(0);
    });

    it('accepts an rtId inside the picker scope', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await pick(fixture, 'site', 'site-a');

      await fixture.componentInstance.setEntitySelector('room', 'room-2');

      expect(roomPick()).toBe('room-2');
    });

    it('runs the leader-change rules on a host pick of the leader', async () => {
      const fixture = setup([SITE, ROOM_WITH_DEFAULT]);
      await settle(fixture);
      await fixture.componentInstance.setEntitySelector('site', 'site-a');
      await fixture.componentInstance.setEntitySelector('room', 'room-1');
      const refresh = reloadOnRefresh();

      await fixture.componentInstance.setEntitySelector('site', 'site-b');

      expect(roomPick()).toBe('room-3');
      expect(refresh.refreshes()).toBe(1);
    });

    it('keeps the dependent pick when the host clears the leader', async () => {
      const fixture = setup([SITE, ROOM]);
      await settle(fixture);
      await fixture.componentInstance.setEntitySelector('site', 'site-a');
      await fixture.componentInstance.setEntitySelector('room', 'room-1');

      fixture.componentInstance.clearEntitySelector('site');

      expect(roomPick()).toBe('room-1');
      expect(state.resolveEntitySelectorScope('room')).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
    });
  });
});
