import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { WindowRef, WindowService } from '@progress/kendo-angular-dialog';
import { TabStripComponent } from '@progress/kendo-angular-layout';
import { GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import type { ProcessDiagramConfig } from '@meshmakers/octo-process-diagrams';
import { ProcessConfigDialogComponent, ProcessConfigResult } from './process-config-dialog.component';
import { ProcessDataService } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { WidgetRegistryService, PersistedWidgetData } from '../../services/widget-registry.service';
import { registerProcessWidget } from '../../registrations/process-widget-registration';
import { ProcessWidgetConfig } from './process-widget-config.model';

/**
 * Process widget dialog with binding cards (AB#8025): legacy widgets open with
 * one "Default" card and save unchanged; named bindings round-trip; mappings
 * get Binding and Aggregate columns; a missing selector blocks Save; deleting a
 * binding clears its mappings; connections pick the value that drives them.
 */
describe('ProcessConfigDialogComponent — bindings editor (AB#8025)', () => {
  let fixture: ComponentFixture<ProcessConfigDialogComponent>;
  let cmp: ProcessConfigDialogComponent;
  let close: ReturnType<typeof vi.fn>;
  let registry: WidgetRegistryService;
  let selectors: { id: string; label: string }[];
  /** What the mocked ProcessDataService.loadDiagram returns; reset to `diagram` before each test. */
  let storedDiagram: ProcessDiagramConfig;

  const diagram = {
    id: 'd', name: 'Energiefluss', version: '1', canvas: { width: 400, height: 200 }, elements: [], connections: [],
    primitives: [{ id: 'grid-line', type: 'line', name: 'Netz ↔ Haus', position: { x: 0, y: 0 } }],
    transformProperties: [
      { id: 'level', name: 'level', type: 'number', defaultValue: 0 },
      { id: 'grid', name: 'grid', type: 'number', defaultValue: 0 },
      { id: 'flowDirection', name: 'flowDirection', type: 'string', defaultValue: '' }
    ],
    propertyBindings: [
      { propertyId: 'grid', targetType: 'primitive', targetId: 'grid-line', effectType: 'animation.enabled', animationId: 'a', expression: 'value > 0' }
    ]
  } as unknown as ProcessDiagramConfig;

  const legacyStored = {
    processDiagramRtId: '65a1b2c3d4e5f60123456789',
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1,
    dataBindingMode: 'persistentQuery',
    bindingQueryRtId: '65a1b2c3d4e5f6012345678a',
    bindingQueryName: 'Tank levels',
    bindingQueryFamily: 'streamData',
    bindingEntitySelectorId: 'site',
    bindingFilters: [{ attributePath: 'state', operator: 'EQUALS', comparisonValue: '1' }],
    propertyMappings: [{ propertyId: 'level', sourceType: 'column', sourcePath: 'level_avg', expression: 'value / 100' }]
  };

  const namedStored = {
    processDiagramRtId: '65a1b2c3d4e5f60123456789',
    fitToBounds: true,
    allowZoom: false,
    allowPan: false,
    showToolbar: false,
    initialZoom: 1,
    propertyMappings: [
      { propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'netz', aggregate: 'sum' },
      { propertyId: 'level', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie' }
    ],
    bindings: [
      { name: 'netz', mode: 'persistentQuery', queryRtId: '65a1b2c3d4e5f6012345678b', queryFamily: 'streamData', entitySelectorId: 'netz' },
      { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' }
    ]
  };

  function persisted(config: Record<string, unknown>): PersistedWidgetData {
    return {
      rtId: 'w-1', ckTypeId: 'System.UI/DashboardWidget', name: 'Flow', type: 'process',
      col: 1, row: 1, colSpan: 4, rowSpan: 3, dataSourceType: 'static',
      dataSourceCkTypeId: null, dataSourceRtId: null, config: JSON.stringify(config)
    };
  }

  /** Opens the dialog for a stored widget exactly as the registry does. */
  async function open(stored: Record<string, unknown> | null): Promise<ProcessWidgetConfig | null> {
    fixture = TestBed.createComponent(ProcessConfigDialogComponent);
    cmp = fixture.componentInstance;
    let widget: ProcessWidgetConfig | null = null;
    if (stored) {
      widget = registry.deserializeWidget(persisted(stored)) as ProcessWidgetConfig;
      for (const [key, value] of Object.entries(registry.getInitialConfig(widget))) {
        (cmp as unknown as Record<string, unknown>)[key] = value;
      }
    }
    fixture.detectChanges();
    await cmp.ngOnInit();
    await fixture.whenStable();
    fixture.detectChanges();
    return widget;
  }

  function savedResult(): ProcessConfigResult {
    cmp.onSave();
    expect(close).toHaveBeenCalledTimes(1);
    return close.mock.calls[0][0] as ProcessConfigResult;
  }

  function saveJson(widget: ProcessWidgetConfig): string {
    const applied = registry.applyConfigResult(widget, savedResult());
    return JSON.stringify(registry.serializeWidget(applied).config);
  }

  async function selectTab(index: number): Promise<void> {
    fixture.debugElement.query(By.directive(TabStripComponent)).componentInstance.selectTab(index);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    close = vi.fn();
    storedDiagram = diagram;
    selectors = [{ id: 'site', label: 'Site' }, { id: 'netz', label: 'Netz' }, { id: 'batterie', label: 'Batterie' }];
    TestBed.configureTestingModule({
      imports: [ProcessConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: { close } },
        { provide: WindowService, useValue: { open: vi.fn() } },
        { provide: MeshBoardStateService, useValue: { getEntitySelectors: () => selectors, getVariables: () => [] } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } },
        { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { types: { items: [{ availableQueryColumns: { items: [{ attributePath: 'stateOfCharge', attributeValueType: 'DOUBLE' }] } }] } } } })) } },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: vi.fn(() => of({ data: {} })) } }
      ]
    });
    TestBed.overrideComponent(ProcessConfigDialogComponent, {
      set: {
        providers: [{
          provide: ProcessDataService,
          useValue: {
            loadDiagramList: vi.fn().mockResolvedValue([{ rtId: '65a1b2c3d4e5f60123456789', name: 'Energiefluss', canvasWidth: 400, canvasHeight: 200, version: '1' }]),
            loadDiagram: vi.fn(async () => storedDiagram)
          }
        }]
      }
    });
    registry = TestBed.inject(WidgetRegistryService);
    registerProcessWidget(registry);
  });

  describe('malformed diagram elements (AB#8151)', () => {
    it('opens, keeps the tabs populated for the valid parts and shows a validation hint', async () => {
      const malformed = {
        ...diagram,
        elements: [
          { id: 'tank-ok', type: 'tank', name: 'Tank OK', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, config: {} },
          { id: 'tank-bad', type: 'tank', name: 'Tank ohne Config', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }
        ],
        // a broken primitive entry must not break the connection list either
        primitives: [null, ...(diagram.primitives ?? [])]
      } as unknown as ProcessDiagramConfig;
      storedDiagram = malformed;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await open(legacyStored);

      expect(cmp.diagramIssueHint).toBe('1 invalid diagram item skipped: Tank ohne Config: missing config');
      expect(warn).toHaveBeenCalled();
      expect(cmp.diagramExposedProperties.map(p => p.id)).toEqual(['level', 'grid', 'flowDirection']);
      expect(cmp.connections.map(c => c.id)).toEqual(['grid-line']);
      expect(el().querySelector('.diagram-issue-hint')?.textContent).toContain('Tank ohne Config');
      await selectTab(1);
      expect(el().querySelector('[data-binding-header="0"] .name')?.textContent?.trim()).toBe('Default');
    });
  });

  describe('legacy single binding', () => {
    it('opens one card "Default" with today\'s values and saves the identical config', async () => {
      const widget = await open(legacyStored);

      expect(cmp.drafts).toHaveLength(1);
      expect(cmp.drafts[0]).toEqual(expect.objectContaining({
        name: 'default', mode: 'persistentQuery', queryRtId: legacyStored.bindingQueryRtId,
        queryName: 'Tank levels', queryFamily: 'streamData', entitySelectorId: 'site'
      }));
      await selectTab(1);
      expect(el().querySelector('[data-binding-header="0"] .name')?.textContent?.trim()).toBe('Default');

      expect(saveJson(widget!)).toBe(JSON.stringify(legacyStored));
    });

    it('a widget without binding saves without one', async () => {
      const minimal = { processDiagramRtId: '65a1b2c3d4e5f60123456789', fitToBounds: true, allowZoom: false, allowPan: false, showToolbar: false, initialZoom: 1 };
      const widget = await open(minimal);

      expect(cmp.drafts).toEqual([]);
      expect(saveJson(widget!)).toBe(JSON.stringify(minimal));
    });
  });

  describe('named bindings', () => {
    it('open as one card each and round-trip unchanged', async () => {
      const widget = await open(namedStored);

      expect(cmp.drafts.map(d => d.name)).toEqual(['netz', 'batterie']);
      expect(saveJson(widget!)).toBe(JSON.stringify(namedStored));
    });

    it('a selector that is not on the board blocks Save with a message naming binding and selector', async () => {
      selectors = [{ id: 'netz', label: 'Netz' }];
      await open(namedStored);
      await selectTab(1);

      expect(cmp.isValid).toBe(false);
      expect(el().querySelector('[data-save-issues]')?.textContent)
        .toContain('Binding "batterie": selector "batterie" does not exist on this board');
      expect(el().querySelector('[data-binding-card="1"] [data-binding-warning]')?.textContent?.trim()).toBe('Selector not on this board');
      const save = Array.from(el().querySelectorAll<HTMLButtonElement>('.mm-dialog-actions button')).find(b => b.textContent?.trim() === 'Save')!;
      expect(save.disabled).toBe(true);
      cmp.onSave();
      expect(close).not.toHaveBeenCalled();
    });

    it('rename follows into the mappings; delete clears them', async () => {
      const widget = await open(namedStored);

      cmp.onBindingRenamed({ oldName: 'netz', newName: 'grid' });
      cmp.drafts[0].name = 'grid';
      cmp.onBindingDeleted('batterie');
      cmp.drafts.splice(1, 1);

      const applied = registry.applyConfigResult(widget!, savedResult()) as ProcessWidgetConfig;
      expect(applied.bindings?.map(b => b.name)).toEqual(['grid']);
      expect(applied.propertyMappings).toEqual([{ propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'grid', aggregate: 'sum' }]);
    });

    it('two bindings on a legacy widget are saved as bindings; the old default keeps its mappings', async () => {
      const widget = await open(legacyStored);
      cmp.drafts.push({ uid: 99, name: 'pv', mode: 'persistentQuery', queryRtId: 'q-pv', expanded: true });

      const applied = registry.applyConfigResult(widget!, savedResult()) as ProcessWidgetConfig;
      const saved = registry.serializeWidget(applied).config as Record<string, unknown>;
      expect(saved['dataBindingMode']).toBeUndefined();
      expect((saved['bindings'] as { name: string }[]).map(b => b.name)).toEqual(['default', 'pv']);
      expect(saved['propertyMappings']).toEqual(legacyStored.propertyMappings);
    });
  });

  describe('Mappings tab', () => {
    it('is disabled until a binding exists', async () => {
      await open({ processDiagramRtId: '65a1b2c3d4e5f60123456789', fitToBounds: true });
      const tabs = fixture.debugElement.query(By.directive(TabStripComponent)).componentInstance as TabStripComponent;
      expect(tabs.tabs.toArray()[2].disabled).toBe(true);

      cmp.drafts = [{ uid: 1, name: 'pv', mode: 'persistentQuery', queryRtId: 'q', expanded: true }];
      fixture.detectChanges();
      expect(tabs.tabs.toArray()[2].disabled).toBe(false);
    });

    it('has Binding and Aggregate columns; Aggregate is fixed for strings and runtime-entity bindings', async () => {
      await open(namedStored);
      await selectTab(2);

      const headers = Array.from(el().querySelectorAll('.mapping-header [role="columnheader"]')).map(h => h.textContent?.trim());
      expect(headers).toEqual(['Property', 'Type', 'Binding', 'Field', 'Aggregate', 'Expression']);
      expect(cmp.bindingOptionsFor('grid').map(o => o.label)).toEqual(['netz', 'batterie']);
      expect(cmp.aggregateOptions.map(o => o.label)).toEqual(['First row', 'Sum', 'Average', 'Minimum', 'Maximum']);

      const props = Object.fromEntries(cmp.diagramExposedProperties.map(p => [p.id, p]));
      expect(cmp.mappingAggregateOf(props['grid'])).toBe('sum');
      expect(cmp.isAggregateFixedFor(props['grid'])).toBe(false);
      expect(cmp.isAggregateFixedFor(props['level'])).toBe(true);   // runtime-entity binding
      expect(cmp.isAggregateFixedFor(props['flowDirection'])).toBe(true); // string property
      expect(cmp.mappingAggregateOf(props['level'])).toBe('first');
      const aggregateOfLevel = el().querySelector('[data-mapping-aggregate="level"]');
      expect(aggregateOfLevel?.getAttribute('aria-disabled') === 'true' || aggregateOfLevel?.classList.contains('k-disabled')).toBe(true);
    });

    it('narrow layout never gives the Field input the 55 px type column and shows the full name as tooltip', async () => {
      await open(namedStored);
      await selectTab(2);
      const styles = ((ProcessConfigDialogComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/%NS%/g, '');
      const narrow = styles.slice(styles.indexOf('@container (max-width: 560px)'));

      expect(narrow).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
      expect(narrow).not.toMatch(/grid-template-columns:\s*1fr 55px 1fr/);
      expect(narrow).toMatch(/\.mapping-row\s+\.col-path\s*\{\s*grid-column: 1;/);
      const pathCell = el().querySelector('[data-mapping-row] .col-path');
      expect(pathCell?.hasAttribute('title')).toBe(true);
    });

    it('choosing a runtime-entity binding sets the attribute source type and drops the aggregate', async () => {
      await open(namedStored);

      cmp.onMappingBindingChange('grid', 'batterie');
      cmp.onMappingSourcePathChange('flowDirection', 'direction');
      cmp.onMappingAggregateChange('level', 'max');

      const result = savedResult();
      expect(result.propertyMappings).toEqual([
        { propertyId: 'grid', sourceType: 'attribute', sourcePath: 'power', bindingName: 'batterie' },
        { propertyId: 'level', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie', aggregate: 'max' },
        { propertyId: 'flowDirection', sourceType: 'column', sourcePath: 'direction', bindingName: 'netz' }
      ]);
    });
  });

  describe('connections', () => {
    it('lists the diagram\'s lines and saves the picked direction property', async () => {
      const widget = await open(namedStored);
      await selectTab(2);

      expect(cmp.connections.map(c => c.label)).toEqual(['Netz ↔ Haus']);
      expect(el().querySelector('[data-connection="grid-line"] .connection-name')?.textContent?.trim()).toBe('Netz ↔ Haus');
      expect(cmp.directionOptionsFor(cmp.connections[0]).map(o => o.label)).toEqual(['As in diagram (grid)', 'level', 'grid']);
      expect(cmp.connectionSourceText(cmp.connections[0])).toBe('Direction from grid ← netz · power (Sum)');

      cmp.onConnectionDirectionChange('grid-line', 'level');
      expect(cmp.connectionSourceText(cmp.connections[0])).toBe('Direction from level ← batterie · stateOfCharge');

      const applied = registry.applyConfigResult(widget!, savedResult()) as ProcessWidgetConfig;
      const saved = registry.serializeWidget(applied).config as Record<string, unknown>;
      expect(saved['connectionDirections']).toEqual([{ connectionId: 'grid-line', propertyId: 'level' }]);
      const reloaded = registry.deserializeWidget(persisted(saved)) as ProcessWidgetConfig;
      expect(reloaded.connectionDirections).toEqual([{ connectionId: 'grid-line', propertyId: 'level' }]);
    });

    it('"As in diagram" writes nothing', async () => {
      await open({ ...namedStored, connectionDirections: [{ connectionId: 'grid-line', propertyId: 'level' }] });
      expect(cmp.connectionDirectionOf('grid-line')).toBe('level');

      cmp.onConnectionDirectionChange('grid-line', null);
      expect(savedResult().connectionDirections).toBeUndefined();
    });
  });
});
