import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttributeSelectorService, CkTypeSelectorService, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { WidgetGroupConfigDialogComponent, WidgetGroupConfigResult } from './widget-group-config-dialog.component';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { KpiWidgetConfig, WidgetGroupChildTemplate } from '../../models/meshboard.models';

describe('WidgetGroupConfigDialogComponent — KPI decimal places (AB#7686)', () => {
  let component: WidgetGroupConfigDialogComponent;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  function kpiTemplate(staticConfig: Record<string, unknown>): WidgetGroupChildTemplate {
    return {
      widgetType: 'kpi',
      attributeMappings: { valueAttribute: 'value' },
      staticConfig: staticConfig as Partial<KpiWidgetConfig>
    };
  }

  async function open(initialChildTemplate?: WidgetGroupChildTemplate): Promise<void> {
    component = TestBed.createComponent(WidgetGroupConfigDialogComponent).componentInstance;
    Object.assign(component, { initialDataSourceMode: 'ckType', initialChildTemplate });
    await component.ngOnInit();
  }

  function savedDecimalPlaces(): unknown {
    component.onSave();
    const result = windowRef.close.mock.calls[0][0] as WidgetGroupConfigResult;
    return (result.childTemplate.staticConfig as Partial<KpiWidgetConfig>).decimalPlaces;
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [WidgetGroupConfigDialogComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: { getVariables: () => [] } },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: {} },
        { provide: WindowRef, useValue: windowRef }
      ]
    });
    TestBed.overrideComponent(WidgetGroupConfigDialogComponent, { set: { template: '', imports: [] } });
  });

  it('offers 0 to 3 decimal places', async () => {
    await open();

    expect(component.maxDecimalPlaces).toBe(3);
  });

  it('reads and saves a set value', async () => {
    await open(kpiTemplate({ decimalPlaces: 1, prefix: '$' }));

    expect(component.form.decimalPlaces).toBe(1);
    expect(savedDecimalPlaces()).toBe(1);
  });

  it('saves nothing when the field is empty', async () => {
    await open(kpiTemplate({}));

    expect(component.form.decimalPlaces).toBeNull();
    expect(savedDecimalPlaces()).toBeUndefined();
  });

  it('opens a seeded out-of-range value as automatic and does not save it', async () => {
    await open(kpiTemplate({ decimalPlaces: 5 }));

    expect(component.form.decimalPlaces).toBeNull();
    expect(savedDecimalPlaces()).toBeUndefined();
  });

  it('saves a value typed into the field', async () => {
    await open(kpiTemplate({}));
    component.form.decimalPlaces = 2;

    expect(savedDecimalPlaces()).toBe(2);
  });

  it('does not save a typed value above 3', async () => {
    await open(kpiTemplate({}));
    component.form.decimalPlaces = 7;

    expect(savedDecimalPlaces()).toBeUndefined();
  });

  it('does not save decimal places for a gauge child', async () => {
    await open({ widgetType: 'gauge', attributeMappings: { valueAttribute: 'value' }, staticConfig: { decimalPlaces: 1 } as Partial<KpiWidgetConfig> });

    component.onSave();
    const result = windowRef.close.mock.calls[0][0] as WidgetGroupConfigResult;
    expect('decimalPlaces' in (result.childTemplate.staticConfig ?? {})).toBe(false);
  });
});
