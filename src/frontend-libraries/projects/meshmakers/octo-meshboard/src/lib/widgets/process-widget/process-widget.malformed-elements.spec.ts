import { TestBed } from '@angular/core/testing';
import {
  ExpressionEvaluatorService,
  ProcessDiagramConfig,
  SymbolLibraryService
} from '@meshmakers/octo-process-diagrams';
import { ProcessWidgetComponent } from './process-widget.component';
import { ProcessDataService } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { ProcessWidgetConfig } from './process-widget-config.model';

/**
 * AB#8151: a malformed element (tank without config, unknown type, missing geometry)
 * must not break change detection. The valid elements render, the broken ones show a
 * placeholder naming them, and the widget carries a hint; the stored diagram is unchanged.
 */
describe('ProcessWidgetComponent — malformed diagram elements (AB#8151)', () => {
  const diagram = {
    id: 'd1', name: 'Anlage', version: '1', canvas: { width: 400, height: 300 },
    elements: [
      { id: 'tank-ok', type: 'tank', name: 'Tank OK', position: { x: 10, y: 10 }, size: { width: 80, height: 120 },
        config: { shape: 'cylindrical', orientation: 'vertical', showLevel: true, showPercentage: true } },
      { id: 'tank-no-config', type: 'tank', name: 'Tank ohne Config', position: { x: 120, y: 10 }, size: { width: 80, height: 120 } },
      { id: 'ghost', type: 'hologram', name: 'Hologramm', position: { x: 220, y: 10 }, size: { width: 50, height: 50 }, config: {} },
      { id: 'no-geometry', type: 'label', name: 'Label ohne Geometrie', config: { text: 'x' } }
    ],
    connections: []
  } as unknown as ProcessDiagramConfig;

  function widgetConfig(): ProcessWidgetConfig {
    return {
      id: 'flow', type: 'process', title: 'Anlage', col: 1, row: 1, colSpan: 4, rowSpan: 3,
      dataSource: { type: 'static', data: null }, inlineConfig: diagram
    } as ProcessWidgetConfig;
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { getConfig: () => ({ entitySelectors: [] }) } },
        { provide: SymbolLibraryService, useValue: {} }
      ]
    });
    TestBed.overrideComponent(ProcessWidgetComponent, {
      set: {
        providers: [
          { provide: ProcessDataService, useValue: { loadBindings: vi.fn().mockResolvedValue(new Map()), loadRuntimeData: vi.fn().mockResolvedValue(null) } },
          ExpressionEvaluatorService
        ]
      }
    });
  });

  async function render(): Promise<{ root: HTMLElement; component: ProcessWidgetComponent }> {
    const fixture = TestBed.createComponent(ProcessWidgetComponent);
    fixture.componentInstance.config = widgetConfig();
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  it('renders without throwing: valid tank stays, broken elements become placeholders', async () => {
    const { root } = await render();

    expect(root.querySelector('[data-id="tank-ok"] .tank-element rect')).not.toBeNull();
    expect(root.querySelector('[data-id="tank-no-config"].element-invalid')).not.toBeNull();
    expect(root.querySelector('[data-id="tank-no-config"] .tank-element')).toBeNull();
    expect(root.querySelector('[data-id="ghost"].element-invalid')).not.toBeNull();
    expect(root.querySelector('[data-id="no-geometry"].element-invalid')).not.toBeNull();
    expect(root.querySelector('.error-container')).toBeNull();
  });

  it('shows a hint naming every skipped element and warns on the console once', async () => {
    const { root, component } = await render();

    const hint = root.querySelector('.diagram-issue-badge')?.textContent ?? '';
    expect(hint).toContain('Tank ohne Config: missing config');
    expect(hint).toContain("Hologramm: unknown type 'hologram'");
    expect(hint).toContain('Label ohne Geometrie: missing or invalid position');
    expect(component.diagramIssues()).toHaveLength(3);
    const warnings = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
    expect(warnings.filter(w => w.includes('Tank ohne Config'))).toHaveLength(1);
  });

  it('does not modify the stored diagram', async () => {
    await render();

    expect(diagram.elements).toHaveLength(4);
    expect((diagram.elements[1] as unknown as Record<string, unknown>)['config']).toBeUndefined();
  });
});
