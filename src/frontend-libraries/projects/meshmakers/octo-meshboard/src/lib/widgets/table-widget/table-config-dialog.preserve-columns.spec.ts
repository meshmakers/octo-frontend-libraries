import { TestBed } from '@angular/core/testing';
import { WindowRef, WindowService } from '@progress/kendo-angular-dialog';
import { NotificationService } from '@progress/kendo-angular-notification';
import { AttributeSelectorDialogService, AttributeSortSelectorDialogService } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { TableConfigDialogComponent, TableConfigResult } from './table-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { WidgetRegistryService, PersistedWidgetData } from '../../services/widget-registry.service';
import { registerDefaultWidgets } from '../../registrations/default-widget-registrations';
import { TableColumn, TableWidgetConfig } from '../../models/meshboard.models';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { of, throwError } from 'rxjs';

/** AB#7655 AC 6: a Studio edit of a table keeps the hand-authored column configuration. */

const authoredColumns: TableColumn[] = [
  {
    field: 'dataquality_max',
    title: 'Dataquality',
    width: 120,
    format: '1.0-0',
    titles: { 'de-AT': 'Datenqualität', 'en-GB': 'Data quality' },
    valueLabels: { '1': { label: 'L1' }, '2': { label: 'L2' }, '3': { label: 'L3', color: 'var(--kendo-color-error)' } },
    statusMapping: { ok: { icon: 'check-circle', tooltip: 'OK' } }
  },
  { field: 'day', title: 'Day', titles: { 'de-AT': 'Tag' } }
];

interface DialogMocks {
  /** Fields the runtime query returns now; `undefined` = the lookup fails. */
  runtimeFields?: string[];
  /** Fields the stream-data query returns now. */
  streamDataFields?: string[];
}

function createDialog(mocks: DialogMocks = {}): {
  dialog: TableConfigDialogComponent;
  close: ReturnType<typeof vi.fn>;
  fetchColumns: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const fetchColumns = vi.fn(() => mocks.runtimeFields
    ? of({ data: { runtime: { runtimeQuery: { items: [{ columns: mocks.runtimeFields.map(attributePath => ({ attributePath, attributeValueType: 'STRING' })) }] } } } })
    : throwError(() => new Error('lookup failed')));
  TestBed.configureTestingModule({
    providers: [
      { provide: CkTypeSelectorService, useValue: {} },
      { provide: AttributeSelectorDialogService, useValue: {} },
      { provide: AttributeSortSelectorDialogService, useValue: {} },
      { provide: NotificationService, useValue: {} },
      { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: {} },
      { provide: MeshBoardStateService, useValue: { getEntitySelectors: () => [], getVariables: () => [] } },
      { provide: WindowRef, useValue: { close } },
      { provide: GetRuntimeQueryColumnsDtoGQL, useValue: { fetch: fetchColumns } },
      {
        provide: QueryExecutorService,
        useValue: {
          resolveFamily: vi.fn(async () => 'runtime'),
          executeStreamData: vi.fn(() => of({ columns: (mocks.streamDataFields ?? []).map(attributePath => ({ attributePath })) }))
        }
      }
    ]
  });
  const dialog = TestBed.runInInjectionContext(() => new TableConfigDialogComponent());
  return { dialog, close, fetchColumns };
}

function onSameQuery(dialog: TableConfigDialogComponent, ckTypeId = 'System/SimpleRtQuery'): void {
  dialog.initialDataSourceType = 'persistentQuery';
  dialog.initialQueryRtId = 'q-daily';
  dialog.initialColumns = authoredColumns;
  dialog.dataSourceType = 'persistentQuery';
  dialog.selectedPersistentQuery = { rtId: 'q-daily', name: 'Daily', ckTypeId } as unknown as PersistentQueryItem;
}

function savedResult(close: ReturnType<typeof vi.fn>): TableConfigResult {
  expect(close).toHaveBeenCalledTimes(1);
  return close.mock.calls[0][0] as TableConfigResult;
}

describe('TableConfigDialogComponent — keeps authored columns (AB#7655 AC 6)', () => {
  it('persistent query: saving on the same query keeps the explicit columns unchanged', async () => {
    const { dialog, close } = createDialog({ runtimeFields: ['day', 'dataquality_max'] });
    onSameQuery(dialog);

    await dialog.onSave();

    expect(savedResult(close).columns).toEqual(authoredColumns);
  });

  it('persistent query: drops kept columns the query no longer returns and adds its new columns as derived columns', async () => {
    const { dialog, close, fetchColumns } = createDialog({ runtimeFields: ['dataquality_max', 'meterName', 'day_count'] });
    onSameQuery(dialog);

    await dialog.onSave();

    expect(fetchColumns).toHaveBeenCalledWith({ variables: { rtId: 'q-daily' }, fetchPolicy: 'network-only' });
    expect(savedResult(close).columns).toEqual([
      authoredColumns[0],
      { field: 'meterName', title: 'Meter Name' },
      { field: 'day_count', title: 'Day_count' }
    ]);
  });

  it('persistent query: a stream-data query is checked through the executor, bypassing the cache', async () => {
    const { dialog, close, fetchColumns } = createDialog({ streamDataFields: ['day'] });
    onSameQuery(dialog, 'System/SimpleSdQuery');

    await dialog.onSave();

    expect(fetchColumns).not.toHaveBeenCalled();
    expect(TestBed.inject(QueryExecutorService).executeStreamData).toHaveBeenCalledWith('q-daily', { first: 1, forceRefresh: true });
    expect(savedResult(close).columns).toEqual([authoredColumns[1]]);
  });

  it('persistent query: keeps the explicit columns unchanged when the query columns cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { dialog, close } = createDialog();
    onSameQuery(dialog);

    await dialog.onSave();

    expect(savedResult(close).columns).toEqual(authoredColumns);
  });

  it('persistent query: a different query starts without explicit columns', async () => {
    const { dialog, close, fetchColumns } = createDialog();
    dialog.initialDataSourceType = 'persistentQuery';
    dialog.initialQueryRtId = 'q-daily';
    dialog.initialColumns = authoredColumns;
    dialog.dataSourceType = 'persistentQuery';
    dialog.selectedPersistentQuery = { rtId: 'q-other', name: 'Other', ckTypeId: 'System/SimpleRtQuery' } as unknown as PersistentQueryItem;

    await dialog.onSave();

    expect(savedResult(close).columns).toEqual([]);
    expect(fetchColumns).not.toHaveBeenCalled();
  });

  it('runtime entity: columns that stay selected keep their properties, new ones get a default title', async () => {
    const { dialog, close } = createDialog();
    dialog.initialDataSourceType = 'runtimeEntity';
    dialog.initialCkTypeId = 'Test/MeteringPoint';
    dialog.initialColumns = authoredColumns;
    dialog.dataSourceType = 'runtimeEntity';
    dialog.selectedCkType = { rtCkTypeId: 'Test/MeteringPoint' } as CkTypeSelectorItem;
    dialog.selectedColumns = ['dataquality_max', 'meterName'];

    await dialog.onSave();

    expect(savedResult(close).columns).toEqual([
      authoredColumns[0],
      { field: 'meterName', title: 'Meter Name', width: undefined }
    ]);
  });

  it('runtime entity: a different CK type rebuilds the columns', async () => {
    const { dialog, close } = createDialog();
    dialog.initialDataSourceType = 'runtimeEntity';
    dialog.initialCkTypeId = 'Test/MeteringPoint';
    dialog.initialColumns = authoredColumns;
    dialog.dataSourceType = 'runtimeEntity';
    dialog.selectedCkType = { rtCkTypeId: 'Test/Meter' } as CkTypeSelectorItem;
    dialog.selectedColumns = ['day'];

    await dialog.onSave();

    expect(savedResult(close).columns).toEqual([{ field: 'day', title: 'Day', width: undefined }]);
  });
});

describe('Table registration — dialog round trip keeps authored columns (AB#7655 AC 6)', () => {
  let registry: WidgetRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  function persistentQueryTable(): TableWidgetConfig {
    return {
      id: 't1', rtId: 't1', type: 'table', title: 'Daily', col: 1, row: 1, colSpan: 4, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-daily', queryName: 'Daily' },
      columns: authoredColumns, sorting: [], filters: [], pageSize: 10, sortable: true
    };
  }

  it('hands the explicit columns to the dialog and applies the columns it returns', () => {
    const widget = persistentQueryTable();
    const initial = registry.getInitialConfig(widget) as { initialColumns?: TableColumn[] };
    expect(initial.initialColumns).toBe(authoredColumns);

    const applied = registry.applyConfigResult(widget, {
      dataSourceType: 'persistentQuery', ckTypeId: '', columns: authoredColumns, sorting: [], filters: [],
      queryRtId: 'q-daily', queryName: 'Daily', pageSize: 10, sortable: true
    } as TableConfigResult) as TableWidgetConfig;

    expect(applied.columns).toEqual(authoredColumns);
  });

  it('a persistent-query result without explicit columns still yields []', () => {
    const applied = registry.applyConfigResult(persistentQueryTable(), {
      dataSourceType: 'persistentQuery', ckTypeId: '', columns: [], sorting: [], filters: [],
      queryRtId: 'q-new', pageSize: 10, sortable: true
    } as TableConfigResult) as TableWidgetConfig;
    expect(applied.columns).toEqual([]);
  });

  it('titles and valueLabels survive save and reload', () => {
    const widget = persistentQueryTable();
    const data = registry.serializeWidget(widget);
    const persisted: PersistedWidgetData = {
      rtId: 't1', ckTypeId: 'System.UI/DashboardWidget', name: 'Daily', type: 'table',
      col: 1, row: 1, colSpan: 4, rowSpan: 2,
      dataSourceType: 'systemQuery', dataSourceCkTypeId: null, dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(data.config)
    };
    const reloaded = registry.deserializeWidget(persisted) as TableWidgetConfig;
    expect(reloaded.columns).toEqual(authoredColumns);
  });
});
