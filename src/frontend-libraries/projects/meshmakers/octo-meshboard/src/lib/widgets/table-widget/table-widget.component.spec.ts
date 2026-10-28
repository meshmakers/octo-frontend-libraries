import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TableWidgetComponent } from './table-widget.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { TableWidgetConfig } from '../../models/meshboard.models';

describe('TableWidgetComponent — explicit columns', () => {
  function create(config: Partial<TableWidgetConfig>): TableWidgetComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local') } }
      ]
    });
    const cmp = TestBed.runInInjectionContext(() => new TableWidgetComponent());
    cmp.config = {
      id: 'w1', type: 'table', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1' },
      columns: [],
      ...config
    } as TableWidgetConfig;
    return cmp;
  }

  it('passes a numeric column format through to the list view', () => {
    const cmp = create({
      columns: [{ field: 'quantity_sum', title: 'Quantity', dataType: 'numeric', format: '1.2-2' }]
    });

    const [column] = cmp.listViewColumns();

    expect(column.dataType).toBe('numeric');
    expect(column.format).toBe('1.2-2');
  });

  it('leaves the format unset when the column names none', () => {
    const cmp = create({
      columns: [{ field: 'quantity_sum', title: 'Quantity', dataType: 'numeric' }]
    });

    expect(cmp.listViewColumns()[0].format).toBeUndefined();
  });
});

describe('TableWidgetComponent — host messages (AB#5622)', () => {
  it('forwards MESHBOARD_MESSAGES list texts to mm-list-view', async () => {
    const { MESHBOARD_MESSAGES } = await import('../../utils/meshboard-messages');
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local') } },
        { provide: MESHBOARD_MESSAGES, useValue: { tableList: { noRecords: 'Keine Einträge vorhanden.', pagerItemsPerPage: 'Einträge pro Seite' }, tableNotConfigured: 'Tabelle nicht konfiguriert' } }
      ]
    });
    const cmp = TestBed.runInInjectionContext(() => new TableWidgetComponent());
    const texts = (cmp as unknown as { texts: () => { tableList?: { noRecords?: string; pagerItemsPerPage?: string }; tableNotConfigured: string } }).texts();
    expect(texts.tableList?.noRecords).toBe('Keine Einträge vorhanden.');
    expect(texts.tableList?.pagerItemsPerPage).toBe('Einträge pro Seite');
    expect(texts.tableNotConfigured).toBe('Tabelle nicht konfiguriert');
  });

  it('renders the translated placeholder when the table is not configured', async () => {
    const { MESHBOARD_MESSAGES } = await import('../../utils/meshboard-messages');
    TestBed.configureTestingModule({
      imports: [TableWidgetComponent],
      providers: [
        { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local') } },
        { provide: MESHBOARD_MESSAGES, useValue: { tableNotConfigured: 'Tabelle nicht konfiguriert' } }
      ]
    });
    const fixture = TestBed.createComponent(TableWidgetComponent);
    fixture.componentInstance.config = { id: 'w', type: 'table', title: 'T', col: 1, row: 1, colSpan: 1, rowSpan: 1, columns: [] } as unknown as TableWidgetConfig;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tabelle nicht konfiguriert');
  });
});

describe('TableWidgetComponent — enum labels (AB#5622)', () => {
  async function create(config: Partial<TableWidgetConfig>, resolver?: (r: unknown) => string | null) {
    const { MESHBOARD_LABEL_RESOLVER } = await import('../../utils/meshboard-labels');
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local') } },
        ...(resolver ? [{ provide: MESHBOARD_LABEL_RESOLVER, useValue: resolver }] : [])
      ]
    });
    const cmp = TestBed.runInInjectionContext(() => new TableWidgetComponent());
    cmp.config = {
      id: 'w1', type: 'table', title: 'Test', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'runtimeEntity', ckTypeId: 'Shop/Invoice' },
      columns: [],
      ...config
    } as TableWidgetConfig;
    return cmp;
  }

  it('leaves cell texts unchanged without a resolver', async () => {
    const cmp = await create({ columns: [{ field: 'state', title: 'State' }] });
    expect(cmp.listViewColumns()[0].formatter!('PAID', {})).toBe('PAID');
  });

  it('translates string cells of text columns through the host resolver', async () => {
    const resolver = vi.fn((r: unknown) => (r as { value: string }).value === 'PAID' ? 'Bezahlt' : null);
    const cmp = await create({ columns: [{ field: 'state', title: 'State' }, { field: 'total', title: 'Total', dataType: 'numeric' }] }, resolver);
    const [state, total] = cmp.listViewColumns();
    expect(state.formatter!('PAID', {})).toBe('Bezahlt');
    expect(state.formatter!('OPEN', {})).toBe('OPEN');
    expect(total.formatter).toBeUndefined();
    expect(resolver).toHaveBeenCalledWith({ kind: 'tableCell', ckTypeId: 'Shop/Invoice', attribute: 'state', value: 'PAID', defaultText: 'PAID' });
  });

  it('only offers ENUM columns of a persistent query to the resolver', async () => {
    const resolver = vi.fn(() => 'translated');
    const cmp = await create({ dataSource: { type: 'persistentQuery', queryRtId: 'q1' } as never }, resolver);
    cmp.onQueryColumnsLoaded([
      { attributePath: 'state', attributeValueType: 'ENUM' },
      { attributePath: 'name', attributeValueType: 'STRING' }
    ]);
    const [state, name] = cmp.listViewColumns();
    expect(state.formatter!('PAID', {})).toBe('translated');
    expect(name.formatter!('PAID', {})).toBe('PAID');
    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ valueType: 'ENUM', attribute: 'state' }));
  });
});

describe('TableWidgetComponent — row action and value markers (AB#7728)', () => {
  async function create(config: Partial<TableWidgetConfig>, handler?: (e: unknown) => void | Promise<void>) {
    const { MESHBOARD_TABLE_ROW_ACTION_HANDLER } = await import('../../utils/meshboard-table-row-action');
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { timeZoneMode: signal('local'), persistedMeshBoardId: signal('board-1') } },
        ...(handler ? [{ provide: MESHBOARD_TABLE_ROW_ACTION_HANDLER, useValue: handler }] : [])
      ]
    });
    const cmp = TestBed.runInInjectionContext(() => new TableWidgetComponent());
    cmp.config = {
      id: 'w1', rtId: 'rt-w1', type: 'table', title: 'Daily values', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q1' },
      columns: [],
      ...config
    } as TableWidgetConfig;
    return cmp;
  }

  it('offers no row action without one configured, even with a host handler', async () => {
    const cmp = await create({}, vi.fn());
    expect(cmp.rowActions()).toEqual([]);
  });

  it('offers no row action without a host handler', async () => {
    const cmp = await create({ rowAction: { label: 'Details' } });
    expect(cmp.rowActions()).toEqual([]);
  });

  it('offers the configured row action when the host handles it', async () => {
    const cmp = await create({ rowAction: { label: 'Details' } }, vi.fn());
    const actions = cmp.rowActions();
    expect(actions.length).toBe(1);
    expect(actions[0].label).toBe('Details');
    expect(actions[0].icon).toBeDefined();
    expect(cmp.rowActions()).toBe(actions);
  });

  it('tells the host the widget and the row values', async () => {
    const handler = vi.fn();
    const cmp = await create({ rowAction: { label: 'Details' } }, handler);
    const [action] = cmp.rowActions();
    const row = { day: '2026-10-27', energy_sum: 12.5, manualCount: 2 };

    await cmp.onRowAction({ id: action.id, action: { id: action.id, label: action.label }, row });

    expect(handler).toHaveBeenCalledWith({
      widgetId: 'rt-w1',
      widgetTitle: 'Daily values',
      meshBoardRtId: 'board-1',
      actionLabel: 'Details',
      row
    });
  });

  it('falls back to the local widget id for an unsaved widget', async () => {
    const handler = vi.fn();
    const cmp = await create({ rtId: undefined, rowAction: { label: 'Details' } }, handler);
    const [action] = cmp.rowActions();
    await cmp.onRowAction({ id: action.id, action: { id: action.id, label: action.label }, row: {} });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ widgetId: 'w1' }));
  });

  it('logs a failing host handler instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cmp = await create({ rowAction: { label: 'Details' } }, () => { throw new Error('boom'); });
    const [action] = cmp.rowActions();
    await expect(cmp.onRowAction({ id: action.id, action: { id: action.id, label: action.label }, row: {} })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it('turns a query-derived column into a marker column', async () => {
    const cmp = await create({ valueMarkers: [{ field: 'manualCount', tooltip: 'Contains manual values' }] });
    cmp.onQueryColumnsLoaded([
      { attributePath: 'day', attributeValueType: 'DATE_TIME' },
      { attributePath: 'manualCount', attributeValueType: 'INTEGER' }
    ]);
    const [day, marker] = cmp.listViewColumns();
    expect(day.dataType).toBe('text');
    expect(marker.dataType).toBe('component');
    expect(marker.formatter).toBeUndefined();
    const inputs = marker.cellInputs!({ manualCount: 3 });
    expect(inputs['value']).toBe(3);
    expect(inputs['tooltip']).toBe('Contains manual values');
    expect(inputs['icon']).toBeDefined();
  });

  it('turns a configured column into a marker column and reads dotted paths', async () => {
    const cmp = await create({
      dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Day' } as never,
      columns: [{ field: 'stats.manual', title: 'Manual' }, { field: 'name', title: 'Name' }],
      valueMarkers: [{ field: 'stats.manual', tooltip: 'Manual', icon: 'warning-triangle', color: 'orange' }]
    });
    const [marker, name] = cmp.listViewColumns();
    expect(marker.dataType).toBe('component');
    expect(marker.cellInputs!({ stats: { manual: 1 } })).toEqual(expect.objectContaining({ value: 1, color: 'orange' }));
    expect(name.dataType).toBe('text');
  });

  it('leaves columns unchanged without markers', async () => {
    const cmp = await create({ dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Day' } as never, columns: [{ field: 'manualCount', title: 'Manual', dataType: 'numeric' }] });
    expect(cmp.listViewColumns()[0].dataType).toBe('numeric');
  });
});
