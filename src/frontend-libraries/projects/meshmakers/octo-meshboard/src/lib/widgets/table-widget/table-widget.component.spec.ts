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
