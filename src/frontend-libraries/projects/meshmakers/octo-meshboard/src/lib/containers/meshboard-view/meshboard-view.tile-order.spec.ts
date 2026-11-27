import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { TileLayoutItemComponent } from '@progress/kendo-angular-layout';
import { WindowStateService } from '@meshmakers/shared-ui';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, MeshBoardConfig } from '../../models/meshboard.models';

@Component({
  standalone: true,
  imports: [MeshBoardViewComponent],
  template: '<mm-meshboard-view></mm-meshboard-view>'
})
class HostComponent {}

/**
 * Keyboard focus moves through the tiles in DOM order, so the tiles of a board in view mode must be
 * rendered by row, then by column, whatever order the widgets are stored in.
 */
describe('MeshBoardViewComponent — Tab order follows the layout', () => {
  function kpi(title: string, row: number, col: number): AnyWidgetConfig {
    return {
      id: title, type: 'kpi', title, col, row, colSpan: 1, rowSpan: 1, valueAttribute: '', queryMode: 'simpleCount',
      dataSource: { type: 'static' }
    } as AnyWidgetConfig;
  }

  const storedOrder = [
    kpi('Row 1 Col 2', 1, 2),
    kpi('Row 1 Col 1', 1, 1),
    kpi('Row 1 Col 4', 1, 4),
    kpi('Row 2 Col 1', 2, 1),
    kpi('Row 2 Col 4', 2, 4),
    kpi('Row 2 Col 2', 2, 2),
    kpi('Row 3 Col 4', 3, 4),
    kpi('Row 4 Col 1', 4, 1),
    kpi('Row 1 Col 3', 1, 3)
  ];

  let config: WritableSignal<MeshBoardConfig>;
  let isEditMode: WritableSignal<boolean>;
  let fixture: ComponentFixture<HostComponent>;

  async function render(widgets: AnyWidgetConfig[]): Promise<void> {
    config = signal({ name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets, autoRefreshSeconds: 0 } as MeshBoardConfig);
    isEditMode = signal(false);
    const stateService = {
      meshBoardConfig: config,
      isLoading: signal(false),
      isModelAvailable: signal(true),
      hiddenForViewer: signal(new Set<string>()),
      widgetContentHeights: signal(new Map<string, number>()),
      persistedMeshBoardId: signal<string | null>(null),
      variableResolutionErrors: signal([]),
      failedEntitySelectorScopeIds: signal<string[]>([]),
      needsPickEntitySelectorIds: signal<string[]>([]),
      pickerScopes: signal({}),
      timeZoneMode: signal('local'),
      isTimeFilterEnabled: () => false,
      getTimeFilterConfig: () => undefined,
      getEntitySelectors: () => [],
      getConfig: () => config(),
      resolveShiftedPeriod: () => null,
      updateWidget: (id: string, update: (w: AnyWidgetConfig) => AnyWidgetConfig) =>
        config.update(c => ({ ...c, widgets: c.widgets.map(w => (w.id === id ? update(w) : w)) })),
      updateConfig: (update: (c: MeshBoardConfig) => MeshBoardConfig) => config.update(update),
      switchToMeshBoardByWellKnownName: vi.fn().mockResolvedValue([]),
      loadInitialMeshBoard: vi.fn().mockResolvedValue([])
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'board', meshBoardReadonly: true },
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({})
      },
      parent: null,
      root: { firstChild: null }
    };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: MeshBoardVariableService, useValue: {} },
        {
          provide: EditModeStateService,
          useValue: { isEditMode, isSaving: signal(false), reset: vi.fn(), enterEditMode: vi.fn(), hasUnsavedChanges: () => false }
        },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null, getRegistration: () => undefined } },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardGridService, useValue: {} },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function tiles(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('kendo-tilelayout-item'));
  }

  function tileTitles(): string[] {
    return tiles().map(tile => tile.querySelector('.widget-title')?.textContent?.trim() ?? '');
  }

  function view(): MeshBoardViewComponent {
    return fixture.debugElement.query(By.directive(MeshBoardViewComponent)).componentInstance as MeshBoardViewComponent;
  }

  function kendoItemOf(title: string): TileLayoutItemComponent {
    const item = fixture.debugElement.queryAll(By.directive(TileLayoutItemComponent))
      .find(el => el.nativeElement.querySelector('.widget-title')?.textContent?.trim() === title);
    return item!.injector.get(TileLayoutItemComponent);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('view mode: a board whose stored order differs from its layout puts the tiles in the tab sequence by row, then by column', async () => {
    await render(storedOrder);

    expect(tileTitles()).toEqual([
      'Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3', 'Row 1 Col 4',
      'Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 4',
      'Row 3 Col 4',
      'Row 4 Col 1'
    ]);
    expect(tiles().every(tile => tile.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('view mode: the tiles keep their stored grid positions', async () => {
    await render(storedOrder);

    const positions = tiles().map(tile => `${tile.style.gridRowStart}/${tile.style.gridColumnStart}`);
    expect(positions).toEqual(['1/1', '1/2', '1/3', '1/4', '2/1', '2/2', '2/4', '3/4', '4/1']);
  });

  it('the stored widget order is not changed by rendering in reading order', async () => {
    await render(storedOrder);

    expect(config().widgets.map(w => w.id)).toEqual(storedOrder.map(w => w.id));
  });

  it('edit mode: a tile moved after the board was shown in view mode moves that widget, and back in view mode the tab sequence follows its new position', async () => {
    await render(storedOrder);
    isEditMode.set(true);
    await settle();

    const moved = kendoItemOf('Row 4 Col 1');
    view().onReorder({ oldIndex: moved.order, newCol: 3, newRow: 3 } as Parameters<MeshBoardViewComponent['onReorder']>[0]);
    await settle();
    await new Promise(resolve => setTimeout(resolve, 0));
    isEditMode.set(false);
    await settle();

    const movedWidget = config().widgets.find(w => w.id === 'Row 4 Col 1')!;
    expect({ row: movedWidget.row, col: movedWidget.col }).toEqual({ row: 3, col: 3 });
    expect(config().widgets.filter(w => w.id !== 'Row 4 Col 1').map(w => `${w.row}/${w.col}`))
      .toEqual(storedOrder.filter(w => w.id !== 'Row 4 Col 1').map(w => `${w.row}/${w.col}`));
    expect(tileTitles()).toEqual([
      'Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3', 'Row 1 Col 4',
      'Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 4',
      'Row 4 Col 1', 'Row 3 Col 4'
    ]);
  });
});
