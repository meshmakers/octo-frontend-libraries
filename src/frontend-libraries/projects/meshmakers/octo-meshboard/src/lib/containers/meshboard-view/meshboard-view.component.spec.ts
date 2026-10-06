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
import { MeshBoardHeaderMode } from '../../utils/meshboard-header';
import { MeshBoardChrome } from '../../utils/meshboard-chrome';

/** A host binding the input, the way an embedding page (e.g. a Home tab) uses the view. */
@Component({
  standalone: true,
  imports: [MeshBoardViewComponent],
  template: '<mm-meshboard-view [headerMode]="mode()" [chrome]="chrome()"></mm-meshboard-view>'
})
class HostComponent {
  readonly mode = signal<MeshBoardHeaderMode | undefined>(undefined);
  readonly chrome = signal<MeshBoardChrome | undefined>(undefined);
}

/**
 * Header mode of the view (AB#5558): `full` shows name + description, `compact` only the
 * controls, `none` no header row. The bound input wins over the route data.
 */
describe('MeshBoardViewComponent — header mode and chrome', () => {
  function setup(routeData: Record<string, unknown>, readonly = true) {
    const config = signal({
      name: 'Tenant Cockpit',
      description: 'Status of this tenant at a glance',
      columns: 6,
      rowHeight: 120,
      gap: 16,
      widgets: [],
      autoRefreshSeconds: 0
    });
    const stateService = {
      meshBoardConfig: config,
      isLoading: signal(false),
      isModelAvailable: signal(true),
      hiddenForViewer: signal(new Set<string>()),
      persistedMeshBoardId: signal<string | null>(null),
      variableResolutionErrors: signal([]),
      timeZoneMode: signal('local'),
      isTimeFilterEnabled: () => false,
      getTimeFilterConfig: () => undefined,
      getEntitySelectors: () => [],
      getConfig: () => config(),
      switchToMeshBoardByWellKnownName: vi.fn().mockResolvedValue([]),
      loadInitialMeshBoard: vi.fn().mockResolvedValue([])
    };
    const editModeService = {
      isEditMode: signal(false),
      isSaving: signal(false),
      reset: vi.fn(),
      hasUnsavedChanges: () => false
    };
    const route = {
      snapshot: {
        data: { meshBoardWellKnownName: 'cockpit', meshBoardReadonly: readonly, ...routeData },
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
        { provide: EditModeStateService, useValue: editModeService },
        { provide: WidgetFactoryService, useValue: {} },
        { provide: WidgetRegistryService, useValue: { getWidgetComponent: () => null } },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardGridService, useValue: {} },
        { provide: DialogService, useValue: {} },
        { provide: WindowService, useValue: {} },
        { provide: WindowStateService, useValue: {} }
      ]
    });
    return TestBed.createComponent(HostComponent);
  }

  async function render(fixture: ReturnType<typeof setup>, mode?: MeshBoardHeaderMode, chrome?: MeshBoardChrome): Promise<HTMLElement> {
    fixture.componentInstance.mode.set(mode);
    fixture.componentInstance.chrome.set(chrome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows name and description by default', async () => {
    const el = await render(setup({}));
    expect(el.querySelector('.meshboard-title')?.textContent).toContain('Tenant Cockpit');
    expect(el.querySelector('.meshboard-description')?.textContent).toContain('Status of this tenant');
    expect(el.querySelector('.meshboard-toolbar.compact')).toBeNull();
  });

  it('compact hides name and description but keeps the controls', async () => {
    const el = await render(setup({}), 'compact');
    expect(el.querySelector('.meshboard-toolbar.compact')).not.toBeNull();
    expect(el.querySelector('.meshboard-title')).toBeNull();
    expect(el.querySelector('.meshboard-description')).toBeNull();
    expect(el.querySelector('button[title="Refresh All Widgets"]')).not.toBeNull();
  });

  it('compact keeps the editing controls of an editable board', async () => {
    const el = await render(setup({}, false), 'compact');
    expect(el.querySelector('.meshboard-title')).toBeNull();
    expect(el.querySelector('button[title="MeshBoard Settings"]')).not.toBeNull();
    expect(el.querySelector('button[title="Enter Edit Mode"]')).not.toBeNull();
  });

  it('none renders no header row', async () => {
    const el = await render(setup({}), 'none');
    expect(el.querySelector('.meshboard-toolbar')).toBeNull();
    expect(el.querySelector('.meshboard-title')).toBeNull();
  });

  it('reads the mode from the route data when no input is bound', async () => {
    const el = await render(setup({ meshBoardHeaderMode: 'compact' }));
    expect(el.querySelector('.meshboard-toolbar.compact')).not.toBeNull();
    expect(el.querySelector('.meshboard-title')).toBeNull();
  });

  it('lets the bound input win over the route data', async () => {
    const el = await render(setup({ meshBoardHeaderMode: 'compact' }), 'full');
    expect(el.querySelector('.meshboard-title')?.textContent).toContain('Tenant Cockpit');
  });

  it('keeps the "not found" help regardless of the mode', async () => {
    const fixture = setup({});
    const state = TestBed.inject(MeshBoardStateService) as unknown as { switchToMeshBoardByWellKnownName: ReturnType<typeof vi.fn> };
    state.switchToMeshBoardByWellKnownName.mockResolvedValue(null);
    const el = await render(fixture, 'none');
    expect(el.textContent).toContain('MeshBoard Not Found');
  });

  // Outer frame (AB#5558): `framed` (default) draws background, header bar and grid padding;
  // `plain` leaves them to the host page. Widgets are rendered either way.
  describe('chrome', () => {
    it('is framed by default', async () => {
      const el = await render(setup({}));
      expect(el.querySelector('.meshboard-view')).not.toBeNull();
      expect(el.querySelector('.meshboard-view.chrome-plain')).toBeNull();
    });

    it('plain marks the view so it drops its outer frame', async () => {
      const el = await render(setup({}), 'compact', 'plain');
      expect(el.querySelector('.meshboard-view.chrome-plain')).not.toBeNull();
      expect(el.querySelector('.meshboard-toolbar.compact')).not.toBeNull();
    });

    it('reads the chrome from the route data when no input is bound', async () => {
      const el = await render(setup({ meshBoardChrome: 'plain' }));
      expect(el.querySelector('.meshboard-view.chrome-plain')).not.toBeNull();
    });

    it('lets the bound input win over the route data', async () => {
      const el = await render(setup({ meshBoardChrome: 'plain' }), undefined, 'framed');
      expect(el.querySelector('.meshboard-view.chrome-plain')).toBeNull();
    });

    it('falls back to framed for unknown route data', async () => {
      const el = await render(setup({ meshBoardChrome: 'borderless' }));
      expect(el.querySelector('.meshboard-view.chrome-plain')).toBeNull();
    });

    it('keeps the plain chrome on the "not found" help', async () => {
      const fixture = setup({ meshBoardChrome: 'plain' });
      const state = TestBed.inject(MeshBoardStateService) as unknown as { switchToMeshBoardByWellKnownName: ReturnType<typeof vi.fn> };
      state.switchToMeshBoardByWellKnownName.mockResolvedValue(null);
      const el = await render(fixture);
      expect(el.textContent).toContain('MeshBoard Not Found');
      expect(el.querySelector('.meshboard-view.chrome-plain')).not.toBeNull();
    });
  });
});
