import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { HeatmapConfigDialogComponent, HeatmapConfigResult } from './heatmap-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';

describe('HeatmapConfigDialogComponent — AB#7956 options', () => {
  let component: HeatmapConfigDialogComponent;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  const sdQuery = { rtId: 'q1', name: 'Rollup 5 min', ckTypeId: 'System/SimpleSdQuery' } as unknown as PersistentQueryItem;

  async function open(inputs: Partial<HeatmapConfigDialogComponent> = {}): Promise<void> {
    component = TestBed.createComponent(HeatmapConfigDialogComponent).componentInstance;
    Object.assign(component, { initialQueryFamily: 'streamData', ...inputs });
    await component.ngOnInit();
    component.selectedPersistentQuery = sdQuery;
    component.form.dateField = 'timestamp';
  }

  function saved(): HeatmapConfigResult {
    component.onSave();
    return windowRef.close.mock.calls[0][0] as HeatmapConfigResult;
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [HeatmapConfigDialogComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: { getVariables: () => [], getEntitySelectors: () => [] } },
        { provide: QueryExecutorService, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: WindowRef, useValue: windowRef }
      ]
    });
    TestBed.overrideComponent(HeatmapConfigDialogComponent, { set: { template: '', imports: [] } });
  });

  it('saves weighted mean, bucket end and own window', async () => {
    await open();
    Object.assign(component.form, {
      aggregation: 'weightedAvg',
      valueField: 'value_sum',
      weightField: 'value_count',
      timestampIsBucketEnd: true,
      bucketWidthMinutes: 5,
      useTimeWindow: true,
      timeWindowValue: 30,
      timeWindowUnit: 'days'
    });

    expect(component.isValid).toBe(true);
    const result = saved();
    expect(result.aggregation).toBe('weightedAvg');
    expect(result.weightField).toBe('value_count');
    expect(result.timestampIsBucketEnd).toBe(true);
    expect(result.bucketWidthMinutes).toBe(5);
    expect(result.timeWindow).toEqual({ value: 30, unit: 'days' });
  });

  it('blocks saving a weighted mean without a weight field', async () => {
    await open();
    Object.assign(component.form, { aggregation: 'weightedAvg', valueField: 'value_sum', weightField: undefined });
    expect(component.optionsError).toBe('Weighted mean needs a value field and a weight field.');
    expect(component.isValid).toBe(false);
  });

  it('blocks saving a bucket end without a whole-minute width', async () => {
    await open();
    Object.assign(component.form, { timestampIsBucketEnd: true, bucketWidthMinutes: undefined });
    expect(component.isValid).toBe(false);
    component.form.bucketWidthMinutes = 2.5;
    expect(component.isValid).toBe(false);
    component.form.bucketWidthMinutes = 5;
    expect(component.isValid).toBe(true);
  });

  it('blocks saving an own window without a positive whole number', async () => {
    await open();
    Object.assign(component.form, { useTimeWindow: true, timeWindowValue: 0 });
    expect(component.optionsError).toBe('Enter the time window as a whole number greater than 0.');
  });

  it('saves none of the new keys for an unchanged dialog', async () => {
    await open();
    const result = saved();
    expect(result.weightField).toBeUndefined();
    expect(result.timestampIsBucketEnd).toBeUndefined();
    expect(result.bucketWidthMinutes).toBeUndefined();
    expect(result.timeWindow).toBeUndefined();
  });

  it('drops the weight field when the aggregation is not weightedAvg, and the bucket end with an end field', async () => {
    await open();
    Object.assign(component.form, {
      aggregation: 'avg',
      weightField: 'value_count',
      dateEndField: 'window_end',
      timestampIsBucketEnd: true,
      bucketWidthMinutes: 5
    });
    const result = saved();
    expect(result.weightField).toBeUndefined();
    expect(result.timestampIsBucketEnd).toBeUndefined();
    expect(result.bucketWidthMinutes).toBeUndefined();
  });

  it('loads the stored options for editing', async () => {
    await open({
      initialAggregation: 'weightedAvg',
      initialWeightField: 'value_count',
      initialTimestampIsBucketEnd: true,
      initialBucketWidthMinutes: 5,
      initialTimeWindow: { value: 7, unit: 'days' }
    });
    expect(component.form.weightField).toBe('value_count');
    expect(component.form.timestampIsBucketEnd).toBe(true);
    expect(component.form.bucketWidthMinutes).toBe(5);
    expect(component.form.useTimeWindow).toBe(true);
    expect(component.form.timeWindowValue).toBe(7);
    expect(component.form.timeWindowUnit).toBe('days');
  });
});
