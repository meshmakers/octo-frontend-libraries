import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService } from '@meshmakers/octo-services';
import { KpiConfigDialogComponent } from './kpi-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { registerDefaultWidgets } from '../../registrations/default-widget-registrations';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { SdTimeShiftEditorComponent } from '../../components/sd-time-shift-editor/sd-time-shift-editor.component';
import { KpiWidgetConfig, MeshBoardTimeShift, PersistentQueryDataSource } from '../../models/meshboard.models';

/**
 * AB#9245 criterion 1: "Show the change to the current period" in the rendered KPI dialog (only with
 * Previous period / Same period last year on a stream-data query, disabled like the shift while the
 * time filter is ignored), saved as an optional `showChange: true` that is absent when off.
 */
describe('KPI dialog — criterion 1: "Show change" option visibility and storage (AB#9245)', () => {
  const STREAM_QUERY = { rtId: 'q-energy', name: 'Energy', ckTypeId: 'System/SimpleSdQuery' };
  const RUNTIME_QUERY = { rtId: 'q-meters', name: 'Meters', ckTypeId: 'System/SimpleRtQuery' };
  const SOURCE: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-energy', queryName: 'Energy', queryFamily: 'streamData' };
  const KPI: KpiWidgetConfig = {
    id: 'kpi', type: 'kpi', title: 'Energy', col: 1, row: 1, colSpan: 1, rowSpan: 1, configurable: true,
    dataSource: SOURCE, valueAttribute: '', queryMode: 'aggregation', queryValueField: 'energy', suffix: 'kWh'
  };

  let fixture: ComponentFixture<KpiConfigDialogComponent>;
  let close: ReturnType<typeof vi.fn>;
  let registry: WidgetRegistryService;

  beforeEach(() => {
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [KpiConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: {} },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [], totalCount: 0 } } } })) } },
        { provide: WindowRef, useValue: { close } }
      ]
    });
    TestBed.inject(MeshBoardStateService).setConfig({ id: 'board', name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets: [] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  async function open(widget: KpiWidgetConfig, query: unknown = STREAM_QUERY): Promise<HTMLElement> {
    fixture = TestBed.createComponent(KpiConfigDialogComponent);
    const initial = registry.getInitialConfig(widget);
    delete initial['initialQueryRtId'];
    Object.assign(fixture.componentInstance, initial);
    await fixture.componentInstance.ngOnInit();
    fixture.componentInstance.selectedPersistentQuery = query as never;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function withShift(timeShift: MeshBoardTimeShift | undefined, extra: Partial<PersistentQueryDataSource> = {}, showChange?: true): KpiWidgetConfig {
    return { ...KPI, ...(showChange && { showChange }), dataSource: { ...SOURCE, ...(timeShift && { timeShift }), ...extra } };
  }

  const checkbox = (el: HTMLElement): HTMLInputElement | null =>
    el.querySelector('mm-sd-time-shift-editor .show-change input[type="checkbox"]');

  function radio(el: HTMLElement, label: string): HTMLInputElement {
    const choice = Array.from(el.querySelectorAll('mm-sd-time-shift-editor label.choice')).find(l => l.textContent?.trim() === label);
    return choice!.querySelector('input[type="radio"]') as HTMLInputElement;
  }

  async function save(widget: KpiWidgetConfig): Promise<KpiWidgetConfig> {
    close.mockClear();
    await fixture.componentInstance.onSave();
    expect(close).toHaveBeenCalledTimes(1);
    return registry.applyConfigResult(widget, close.mock.calls[0][0]) as KpiWidgetConfig;
  }

  function stored(widget: KpiWidgetConfig): Record<string, unknown> {
    return registry.serializeWidget(widget).config as Record<string, unknown>;
  }

  it('with Previous period the option is shown, labelled and enabled', async () => {
    const el = await open(withShift({ by: 'period', count: -1 }));

    expect(checkbox(el)).not.toBeNull();
    expect(checkbox(el)!.disabled).toBe(false);
    expect(el.querySelector('mm-sd-time-shift-editor .show-change')?.textContent?.replace(/\s+/g, ' ').trim())
      .toBe('Show change Show the change to the current period (value and %)');
  });

  it('with Same period last year the option is shown', async () => {
    const el = await open(withShift({ by: 'year', count: -1 }));

    expect(checkbox(el)).not.toBeNull();
  });

  it('with None the option is hidden, and choosing a shift shows it', async () => {
    const el = await open(withShift(undefined));
    expect(checkbox(el)).toBeNull();

    radio(el, 'Previous period').click();
    fixture.detectChanges();

    expect(checkbox(el)).not.toBeNull();
  });

  it('with "Ignore MeshBoard time filter" the option is disabled like the shift control', async () => {
    const el = await open(withShift({ by: 'period', count: -1 }, { ignoreTimeFilter: true }, true));

    expect(checkbox(el)!.disabled).toBe(true);
    expect(checkbox(el)!.checked).toBe(true);
    expect(radio(el, 'Previous period').disabled).toBe(true);
  });

  it('a runtime query shows neither the shift control nor the option', async () => {
    const el = await open(withShift(undefined, { queryFamily: 'runtime' }), RUNTIME_QUERY);

    expect(el.querySelector('mm-sd-time-shift-editor fieldset')).toBeNull();
    expect(checkbox(el)).toBeNull();
  });

  it('checking it saves showChange: true on the KPI config, stores it and reopens checked', async () => {
    const widget = withShift({ by: 'period', count: -1 });
    const el = await open(widget);
    checkbox(el)!.click();
    fixture.detectChanges();

    const saved = await save(widget);

    expect(saved.showChange).toBe(true);
    expect(stored(saved)['showChange']).toBe(true);
    const reloaded = registry.deserializeWidget({
      rtId: 'w', ckTypeId: 'System.UI/MeshBoardWidget', name: 'Energy', type: 'kpi', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      dataSourceType: 'persistentQuery', dataSourceRtId: 'q-energy', config: JSON.stringify(stored(saved))
    }) as KpiWidgetConfig;
    expect(reloaded.showChange).toBe(true);
    expect(checkbox(await open(reloaded))!.checked).toBe(true);
  });

  it('unchecking it removes the key from the KPI config and the stored config', async () => {
    const widget = withShift({ by: 'period', count: -1 }, {}, true);
    const el = await open(widget);
    checkbox(el)!.click();
    fixture.detectChanges();

    const saved = await save(widget);

    expect('showChange' in saved).toBe(false);
    expect('showChange' in stored(saved)).toBe(false);
  });

  it('switching "Compare with" to None removes it', async () => {
    const widget = withShift({ by: 'period', count: -1 }, {}, true);
    const el = await open(widget);
    radio(el, 'None').click();
    fixture.detectChanges();

    const saved = await save(widget);

    expect('showChange' in saved).toBe(false);
    expect('showChange' in stored(saved)).toBe(false);
  });

  it('a board without the option stores exactly the same config as before (no showChange key)', () => {
    const widget = withShift({ by: 'period', count: -1 });

    expect('showChange' in stored(widget)).toBe(false);
    const reloaded = registry.deserializeWidget({
      rtId: 'w', ckTypeId: 'System.UI/MeshBoardWidget', name: 'Energy', type: 'kpi', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      dataSourceType: 'persistentQuery', dataSourceRtId: 'q-energy', config: JSON.stringify(stored(widget))
    });
    expect('showChange' in reloaded).toBe(false);
  });

  describe('"An increase is good / bad" (colour of the change line)', () => {
    const direction = (el: HTMLElement, label: 'good' | 'bad'): HTMLInputElement | undefined =>
      Array.from(el.querySelectorAll<HTMLLabelElement>('mm-sd-time-shift-editor .change-direction label.choice'))
        .find(l => l.textContent?.trim() === label)?.querySelector('input[type="radio"]') as HTMLInputElement | undefined;

    it('is shown only while "Show change" is on, with "good" preselected', async () => {
      const el = await open(withShift({ by: 'period', count: -1 }));
      expect(el.querySelector('mm-sd-time-shift-editor .change-direction')).toBeNull();

      checkbox(el)!.click();
      fixture.detectChanges();

      expect(el.querySelector('mm-sd-time-shift-editor .change-direction-label')?.textContent?.trim()).toBe('An increase is');
      expect(direction(el, 'good')!.checked).toBe(true);
      expect(direction(el, 'bad')!.checked).toBe(false);
    });

    it('the good and bad radios are a group of their own, labelled "An increase is", not "Compare with"', async () => {
      const el = await open(withShift({ by: 'period', count: -1 }, {}, true));

      for (const label of ['good', 'bad'] as const) {
        const group = direction(el, label)!.closest('fieldset')!;
        expect(group.querySelector(':scope > legend')?.textContent?.trim()).toBe('An increase is');
      }
      expect(direction(el, 'good')!.closest('fieldset')).toBe(direction(el, 'bad')!.closest('fieldset'));
      expect(direction(el, 'good')!.name).toBe(direction(el, 'bad')!.name);
    });

    it('is disabled while "Ignore MeshBoard time filter" is on', async () => {
      const el = await open(withShift({ by: 'period', count: -1 }, { ignoreTimeFilter: true }, true));

      expect(direction(el, 'good')!.disabled).toBe(true);
      expect(direction(el, 'bad')!.disabled).toBe(true);
    });

    it('"bad" saves increaseIsGood: false, stores it and reopens with "bad"', async () => {
      const widget = withShift({ by: 'period', count: -1 }, {}, true);
      const el = await open(widget);
      direction(el, 'bad')!.click();
      fixture.detectChanges();

      const saved = await save(widget);

      expect(saved.increaseIsGood).toBe(false);
      expect(stored(saved)['increaseIsGood']).toBe(false);
      const reloaded = registry.deserializeWidget({
        rtId: 'w', ckTypeId: 'System.UI/MeshBoardWidget', name: 'Energy', type: 'kpi', col: 1, row: 1, colSpan: 1, rowSpan: 1,
        dataSourceType: 'persistentQuery', dataSourceRtId: 'q-energy', config: JSON.stringify(stored(saved))
      }) as KpiWidgetConfig;
      expect(reloaded.increaseIsGood).toBe(false);
      expect(direction(await open(reloaded), 'bad')!.checked).toBe(true);
    });

    it('"good" (the default) stores no key', async () => {
      const widget = { ...withShift({ by: 'period', count: -1 }, {}, true), increaseIsGood: false as const };
      const el = await open(widget);
      direction(el, 'good')!.click();
      fixture.detectChanges();

      const saved = await save(widget);

      expect('increaseIsGood' in saved).toBe(false);
      expect('increaseIsGood' in stored(saved)).toBe(false);
    });

    it('turning "Show change" off removes "bad" too', async () => {
      const widget = { ...withShift({ by: 'period', count: -1 }, {}, true), increaseIsGood: false as const };
      const el = await open(widget);
      checkbox(el)!.click();
      fixture.detectChanges();

      const saved = await save(widget);

      expect('increaseIsGood' in saved).toBe(false);
      expect('increaseIsGood' in stored(saved)).toBe(false);
    });
  });

  it('the editor offers the option only where a dialog asks for it (line, bar, pie and table dialogs do not)', () => {
    const editor = TestBed.createComponent(SdTimeShiftEditorComponent);
    editor.componentRef.setInput('family', 'streamData');
    editor.componentRef.setInput('timeShift', { by: 'period', count: -1 });
    editor.detectChanges();

    expect((editor.nativeElement as HTMLElement).querySelector('.show-change')).toBeNull();
  });
});
