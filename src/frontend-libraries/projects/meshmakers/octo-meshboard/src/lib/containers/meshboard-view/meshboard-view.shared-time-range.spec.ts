import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { CkModelService } from '@meshmakers/octo-services';
import { TimeRangePickerComponent, TimeRangeSelection as SharedTimeRangeSelection, WindowStateService } from '@meshmakers/shared-ui';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardHostTimeRange } from './host-time-range';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { MeshBoardConfig, MeshBoardTimeFilterConfig } from '../../models/meshboard.models';

/**
 * AB#9737: a time range the viewer chose on one MeshBoard is preselected on every other MeshBoard
 * opened afterwards in the same app (e.g. the Dashboard and Statistics tabs of an app, each a route
 * with its own mm-meshboard-view), and a change on any of them updates that shared selection.
 * Boards are in Europe/Vienna; the expected windows are the Vienna calendar periods written out.
 */
describe('MeshBoardViewComponent - time range shared across MeshBoards (AB#9737)', () => {
  const DASHBOARD_FILTER: MeshBoardTimeFilterConfig = {
    enabled: true,
    pickerConfig: { showTime: false },
    defaultSelection: { type: 'year', year: 2026 }
  };
  const STATISTICS_FILTER: MeshBoardTimeFilterConfig = {
    enabled: true,
    pickerConfig: { showTime: false },
    defaultSelection: { type: 'year', year: 2025 }
  };

  const MARCH_2026_FROM = '2026-02-28T23:00:00.000Z';
  const YEAR_2025_FROM = '2024-12-31T23:00:00.000Z';
  const YEAR_2026_FROM = '2025-12-31T23:00:00.000Z';
  const Q2_2026_FROM = '2026-03-31T22:00:00.000Z';

  let state: MeshBoardStateService;
  let boardConfig: MeshBoardConfig;
  let queryParams: Record<string, string>;
  const open: ComponentFixture<MeshBoardViewComponent>[] = [];

  function board(id: string, timeFilter: MeshBoardTimeFilterConfig): MeshBoardConfig {
    return {
      id,
      name: id,
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      timeFilter: structuredClone(timeFilter),
      timeZoneMode: 'Europe/Vienna',
      entitySelectors: []
    };
  }

  beforeEach(() => {
    queryParams = {};
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'board', meshBoardReadonly: true },
        paramMap: convertToParamMap({}),
        get queryParamMap() {
          return convertToParamMap(queryParams);
        }
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
        {
          provide: MeshBoardPersistenceService,
          useValue: {
            getMeshBoards: vi.fn().mockImplementation(async () => [{ rtId: boardConfig.id, name: boardConfig.name, rtWellKnownName: 'board' }]),
            getMeshBoardWithWidgets: vi.fn().mockImplementation(async () => ({ meshBoard: { rtId: boardConfig.id, name: boardConfig.name }, widgets: [] })),
            toMeshBoardConfig: vi.fn().mockImplementation(() => structuredClone(boardConfig))
          }
        },
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
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    open.splice(0).forEach(fixture => fixture.destroy());
  });

  /** Opens a board in a new view (the previous view is gone, as after a tab switch) and waits for its load. */
  async function openBoard(config: MeshBoardConfig, hostTimeRange?: MeshBoardHostTimeRange): Promise<ComponentFixture<MeshBoardViewComponent>> {
    open.splice(0).forEach(fixture => fixture.destroy());
    boardConfig = config;
    const fixture = TestBed.createComponent(MeshBoardViewComponent);
    if (hostTimeRange) {
      fixture.componentRef.setInput('timeRange', hostTimeRange);
    }
    open.push(fixture);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
    return fixture;
  }

  function picker(fixture: ComponentFixture<MeshBoardViewComponent>): TimeRangePickerComponent {
    const element = fixture.debugElement.query(By.directive(TimeRangePickerComponent));
    expect(element).not.toBeNull();
    return element.componentInstance as TimeRangePickerComponent;
  }

  async function choose(fixture: ComponentFixture<MeshBoardViewComponent>, selection: Partial<SharedTimeRangeSelection>): Promise<void> {
    fixture.debugElement.query(By.directive(TimeRangePickerComponent)).triggerEventHandler('selectionChange', selection);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function preselected(fixture: ComponentFixture<MeshBoardViewComponent>): Partial<SharedTimeRangeSelection> | undefined {
    const initial = picker(fixture).initialSelection;
    return initial ? { type: initial.type, year: initial.year, quarter: initial.quarter, month: initial.month } : undefined;
  }

  function windowFrom(): string | undefined {
    return state.getVariable('timeRangeFrom')?.value;
  }

  it('AC1 negative control: without a choice of the viewer each board opens with its own default range', async () => {
    await openBoard(board('dashboard', DASHBOARD_FILTER));
    expect(windowFrom()).toBe(YEAR_2026_FROM);

    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    expect(preselected(statistics)).toEqual({ type: 'year', year: 2025, quarter: undefined, month: undefined });
    expect(windowFrom()).toBe(YEAR_2025_FROM);
  });

  it('AC1: a range chosen on one board is preselected on the next board, over that board\'s own default', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });
    expect(windowFrom()).toBe(MARCH_2026_FROM);

    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    expect(preselected(statistics)).toEqual({ type: 'month', year: 2026, quarter: undefined, month: 2 });
    expect(windowFrom()).toBe(MARCH_2026_FROM);
    expect(state.getTimeFilterConfig()?.defaultSelection).toEqual({ type: 'year', year: 2025 });
  });

  it('AC1: a board that stores a last-used selection of its own still opens with the shared range', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    const statistics = await openBoard(board('statistics', { ...STATISTICS_FILTER, selection: { type: 'year', year: 2024 } }));
    expect(preselected(statistics)).toEqual({ type: 'month', year: 2026, quarter: undefined, month: 2 });
    expect(windowFrom()).toBe(MARCH_2026_FROM);
  });

  it('AC2: changing the range on the second board updates the shared selection for the first one', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    await choose(statistics, { type: 'quarter', year: 2026, quarter: 2 });
    expect(windowFrom()).toBe(Q2_2026_FROM);

    const dashboardAgain = await openBoard(board('dashboard', DASHBOARD_FILTER));
    expect(preselected(dashboardAgain)).toEqual({ type: 'quarter', year: 2026, quarter: 2, month: undefined });
    expect(windowFrom()).toBe(Q2_2026_FROM);
  });

  it('AC2: resetting a board to its default range makes that range the shared selection', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    statistics.componentInstance.resetTimeFilterToDefault();
    statistics.detectChanges();
    expect(windowFrom()).toBe(YEAR_2025_FROM);

    const dashboardAgain = await openBoard(board('dashboard', DASHBOARD_FILTER));
    expect(preselected(dashboardAgain)).toEqual({ type: 'year', year: 2025, quarter: undefined, month: undefined });
    expect(windowFrom()).toBe(YEAR_2025_FROM);
  });

  it('AC2: a range opened from a link (tf_* parameters) becomes the shared selection', async () => {
    queryParams = { tf_type: 'month', tf_year: '2026', tf_month: '2' };
    await openBoard(board('dashboard', DASHBOARD_FILTER));
    expect(windowFrom()).toBe(MARCH_2026_FROM);

    queryParams = {};
    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    expect(preselected(statistics)).toEqual({ type: 'month', year: 2026, quarter: undefined, month: 2 });
  });

  it('a link with tf_* parameters wins over the shared selection', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    queryParams = { tf_type: 'quarter', tf_year: '2026', tf_quarter: '2' };
    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    expect(preselected(statistics)).toEqual({ type: 'quarter', year: 2026, quarter: 2, month: undefined });
    expect(windowFrom()).toBe(Q2_2026_FROM);
  });

  it('a board without a default or stored range shares nothing until the viewer picks one', async () => {
    await openBoard(board('dashboard', { enabled: true, pickerConfig: { showTime: false } }));
    expect(state.viewerTimeSelection()).toBeNull();

    const statistics = await openBoard(board('statistics', STATISTICS_FILTER));
    expect(preselected(statistics)).toEqual({ type: 'year', year: 2025, quarter: undefined, month: undefined });
    expect(windowFrom()).toBe(YEAR_2025_FROM);
  });

  it('a period set by the host page wins over the shared range', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    await openBoard(board('statistics', STATISTICS_FILTER), { from: '2026-03-28T05:00:00Z', to: '2026-03-29T04:00:00Z' });
    expect(windowFrom()).toBe('2026-03-28T05:00:00.000Z');
    expect(state.getVariable('timeRangeTo')?.value).toBe('2026-03-29T04:00:00.000Z');
  });

  it('a board whose picker does not offer the shared range type keeps its own default', async () => {
    const dashboard = await openBoard(board('dashboard', DASHBOARD_FILTER));
    await choose(dashboard, { type: 'month', year: 2026, month: 2 });

    const yearsOnly = await openBoard(board('statistics', {
      ...STATISTICS_FILTER,
      pickerConfig: { showTime: false, availableTypes: ['year'] }
    }));
    expect(preselected(yearsOnly)).toEqual({ type: 'year', year: 2025, quarter: undefined, month: undefined });
    expect(windowFrom()).toBe(YEAR_2025_FROM);
  });
});
