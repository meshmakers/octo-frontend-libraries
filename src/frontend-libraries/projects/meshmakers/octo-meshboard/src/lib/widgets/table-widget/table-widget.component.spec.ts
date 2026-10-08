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
