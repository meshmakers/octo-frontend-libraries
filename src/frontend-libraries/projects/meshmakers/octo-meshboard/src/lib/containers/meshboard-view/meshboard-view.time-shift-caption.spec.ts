import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DialogService, WindowService } from '@progress/kendo-angular-dialog';
import { WindowStateService } from '@meshmakers/shared-ui';
import { MeshBoardViewComponent } from './meshboard-view.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, MeshBoardTimeShift } from '../../models/meshboard.models';

@Component({
  standalone: true,
  imports: [MeshBoardViewComponent],
  template: '<mm-meshboard-view></mm-meshboard-view>'
})
class HostComponent {}

/**
 * AB#9095 criterion 5 in the rendered board: the tile header of a shifted widget shows the shifted
 * period under its title, also on a chromeless tile; an unshifted widget shows no caption.
 * The shifted window is September 2026 in Europe/Vienna (board filter October 2026, previous period).
 */
describe('MeshBoardViewComponent — time shift caption in the tile header (AB#9095)', () => {
  const SEPTEMBER_2026 = {
    range: { from: new Date('2026-09-01T00:00:00+02:00'), to: new Date('2026-10-01T00:00:00+02:00') },
    selection: { type: 'month' as const, year: 2026, month: 8 }
  };

  function kpi(id: string, title: string, timeShift?: MeshBoardTimeShift, chromeless = false): AnyWidgetConfig {
    return {
      id, type: 'kpi', title, col: 1, row: 1, colSpan: 1, rowSpan: 1, valueAttribute: '', queryMode: 'simpleCount',
      ...(chromeless && { chromeless: true }),
      dataSource: { type: 'persistentQuery', queryRtId: 'q-energy', queryFamily: 'streamData', ...(timeShift && { timeShift }) }
    } as AnyWidgetConfig;
  }

  async function render(widgets: AnyWidgetConfig[]): Promise<HTMLElement> {
    const config = signal({ name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets, autoRefreshSeconds: 0 });
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
      timeZoneMode: signal('Europe/Vienna'),
      isTimeFilterEnabled: () => false,
      getTimeFilterConfig: () => undefined,
      getEntitySelectors: () => [],
      getConfig: () => config(),
      resolveShiftedPeriod: (shift?: MeshBoardTimeShift) => (shift ? SEPTEMBER_2026 : null),
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
        { provide: EditModeStateService, useValue: { isEditMode: signal(false), isSaving: signal(false), reset: vi.fn(), hasUnsavedChanges: () => false } },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardGridService, useValue: {} },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function headers(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('.widget-header'));
  }

  it('criterion 5 Visible shifted period: the header of a shifted widget shows the period under its title, an unshifted one shows none', async () => {
    const el = await render([kpi('a', 'Verbrauch'), kpi('b', 'Verbrauch Vorjahr', { by: 'period', count: -1 })]);

    const [plain, shifted] = headers(el);
    expect(plain.querySelector('.widget-title')?.textContent?.trim()).toBe('Verbrauch');
    expect(plain.querySelector('.time-shift-caption')).toBeNull();
    expect(shifted.querySelector('.widget-title')?.textContent?.trim()).toBe('Verbrauch Vorjahr');
    expect(shifted.querySelector('.time-shift-caption')?.textContent?.trim()).toBe('September 2026');
    expect(shifted.querySelector('.time-shift-caption')?.getAttribute('title'))
      .toBe('Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)');
  });

  it('criterion 5 Visible shifted period: a chromeless tile keeps its header for the caption, an unshifted chromeless tile hides it', async () => {
    const el = await render([
      kpi('c', 'Hidden title', { by: 'period', count: -1 }, true),
      kpi('d', 'Plain chromeless', undefined, true)
    ]);

    const [shifted, plain] = headers(el);
    expect(shifted.classList.contains('chromeless-header')).toBe(false);
    expect(shifted.querySelector('.widget-title')).toBeNull();
    expect(shifted.querySelector('.time-shift-caption')?.textContent?.trim()).toBe('September 2026');
    expect(plain.classList.contains('chromeless-header')).toBe(true);
    expect(plain.querySelector('.time-shift-caption')).toBeNull();
  });
});
