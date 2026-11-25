import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
import { MESHBOARD_MESSAGES, MeshBoardMessages } from '../../utils/meshboard-messages';
import { WidgetLoadingComponent } from '../../components/widget-loading/widget-loading.component';

const GERMAN: MeshBoardMessages = { loading: 'Wird geladen', loadingMeshBoard: 'Übersicht wird geladen...', refreshAllWidgets: 'Alle aktualisieren', resetTimeFilter: 'Auf den Standardzeitraum zurücksetzen' };

@Component({
  standalone: true,
  imports: [MeshBoardViewComponent],
  template: '<mm-meshboard-view></mm-meshboard-view>'
})
class HostComponent {}

/**
 * AB#9743: the read-only board shows its own texts (loading mask, refresh tooltip) in the language the
 * host hands over through MESHBOARD_MESSAGES, never the English defaults.
 */
describe('MeshBoardViewComponent — board texts in the host language (AB#9743)', () => {
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

  async function render(widgets: AnyWidgetConfig[], loading = false, timeFilter?: Record<string, unknown>): Promise<HTMLElement> {
    const config = signal({ name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets, autoRefreshSeconds: 0 });
    const stateService = {
      meshBoardConfig: config,
      isLoading: signal(loading),
      isModelAvailable: signal(true),
      hiddenForViewer: signal(new Set<string>()),
      widgetContentHeights: signal(new Map<string, number>()),
      persistedMeshBoardId: signal<string | null>(null),
      variableResolutionErrors: signal([]),
      failedEntitySelectorScopeIds: signal<string[]>([]),
      needsPickEntitySelectorIds: signal<string[]>([]),
      pickerScopes: signal({}),
      timeZoneMode: signal('Europe/Vienna'),
      isTimeFilterEnabled: () => !!timeFilter,
      getTimeFilterConfig: () => timeFilter,
      setTimeFilterVariables: vi.fn(),
      resolveCurrentTimeRange: () => null,
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
        provideNoopAnimations(),
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
        { provide: WindowStateService, useValue: {} },
        { provide: MESHBOARD_MESSAGES, useValue: GERMAN }
      ]
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the refresh tooltip of the board in the host language', async () => {
    const el = await render([kpi('a', 'Verbrauch')]);
    const refresh = Array.from(el.querySelectorAll<HTMLButtonElement>('.toolbar-right button'))
      .find(button => button.getAttribute('aria-label') === 'Alle aktualisieren');

    expect(refresh?.getAttribute('title')).toBe('Alle aktualisieren');
    expect(el.textContent).not.toContain('Refresh All Widgets');
  });

  it('shows the reset tooltip of the period selector in the host language', async () => {
    const el = await render([kpi('a', 'Verbrauch')], false, {
      enabled: true,
      selection: { type: 'month', year: 2026, month: 9 },
      defaultSelection: { type: 'month', year: 2026, month: 10 }
    });
    const reset = el.querySelector<HTMLButtonElement>('.toolbar-center button[aria-label="Auf den Standardzeitraum zurücksetzen"]');

    expect(reset?.getAttribute('title')).toBe('Auf den Standardzeitraum zurücksetzen');
    expect(el.querySelector('[aria-label="Reset to default time filter"]')).toBeNull();
  });

  it('shows the loading text of the board in the host language', async () => {
    const el = await render([kpi('a', 'Verbrauch')], true);

    expect(el.querySelector('.loading-container .k-loading-text')?.textContent?.trim()).toBe('Übersicht wird geladen...');
  });

  it('shows the loading text of a widget in the host language', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WidgetLoadingComponent],
      providers: [{ provide: MESHBOARD_MESSAGES, useValue: GERMAN }]
    });
    const fixture = TestBed.createComponent(WidgetLoadingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.k-loading-text')?.textContent?.trim()).toBe('Wird geladen');
  });
});
