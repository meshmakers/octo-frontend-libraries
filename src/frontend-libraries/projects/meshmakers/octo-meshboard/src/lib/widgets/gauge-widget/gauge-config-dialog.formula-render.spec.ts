import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService } from '@meshmakers/octo-services';
import { GaugeConfigDialogComponent } from './gauge-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';

/**
 * Rendered gauge dialog in formula mode (AB#7950): the "Formula" data source button, the shared
 * formula field, its message and the Save button's disabled state.
 */
describe('GaugeConfigDialogComponent — formula template (AB#7950)', () => {
  let fixture: ComponentFixture<GaugeConfigDialogComponent>;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  async function open(formula: string): Promise<void> {
    TestBed.inject(MeshBoardStateService).setConfig({
      id: 'board', name: 'Board', columns: 6, rowHeight: 200, gap: 16, widgets: [],
      variables: [{ name: 'import', type: 'number', source: 'static', value: '30' }]
    });
    fixture = TestBed.createComponent(GaugeConfigDialogComponent);
    Object.assign(fixture.componentInstance, { initialDataSourceType: 'formula', initialFormula: formula });
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find(b => b.textContent?.trim() === label);
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [GaugeConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: {} },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: WindowRef, useValue: windowRef }
      ]
    });
  });

  it('offers the Formula data source next to Runtime Entity and Query', async () => {
    await open('${import}');

    expect(button('Runtime Entity')).toBeDefined();
    expect(button('Query')).toBeDefined();
    expect(button('Formula')).toBeDefined();
    expect(element().querySelector('mm-meshboard-formula-field')).not.toBeNull();
  });

  it('enables Save for a valid formula and saves on a click', async () => {
    await open('${import} * 2');

    const save = button('Save');
    expect(save?.disabled).toBe(false);
    save?.click();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ dataSourceType: 'formula', formula: '${import} * 2' }));
  });

  it('shows the message and disables Save for an invalid formula', async () => {
    await open('${import} + ${missing}');

    expect(element().querySelector('mm-meshboard-formula-field .field-error')?.textContent?.trim()).toBe('Unknown variable: missing');
    expect(button('Save')?.disabled).toBe(true);
  });

  it('keeps the formula field, Save and Cancel keyboard reachable (native controls, no negative tabindex)', async () => {
    await open('${import}');

    const input = element().querySelector('mm-meshboard-formula-field input');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('tabindex')).not.toBe('-1');
    for (const label of ['Formula', 'Save', 'Cancel']) {
      expect(button(label)?.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  it('hides the filter and label-attribute sections in formula mode', async () => {
    await open('${import}');

    expect(element().textContent).not.toContain('Label Attribute');
    expect(element().querySelector('mm-field-filter-editor')).toBeNull();
  });
});
