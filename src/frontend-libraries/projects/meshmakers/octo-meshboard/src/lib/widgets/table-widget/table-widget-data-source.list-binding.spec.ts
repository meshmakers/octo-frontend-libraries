import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { ListViewComponent } from '@meshmakers/shared-ui';
import { GridComponent } from '@progress/kendo-angular-grid';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutionOptions, QueryExecutionResult, QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { TableWidgetDataSourceDirective } from './table-widget-data-source.directive';
import { TableWidgetConfig } from '../../models/meshboard.models';

/**
 * AB#8801 end to end through the real `mm-list-view` and its server binding: the table widget's
 * data source drives the shared list's page state, so the query after a variable change and the
 * query after an out-of-range page both go out with OFFSET 0. The executor simulates the asset
 * repository: a 16-row result for `dev-1`, a 6-row result for `dev-2`, and ASSET1002 /
 * INCOMPLETE_SLICE for an offset beyond the result (prod-2 trace 11351993c1a1618cf2af885263491b01).
 */
@Component({
  standalone: true,
  imports: [ListViewComponent, TableWidgetDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTableWidgetDataSource [config]="config" [columns]="columns" [pageSize]="10" style="flex: 1"></mm-list-view>
    </div>
  `
})
class HostComponent {
  @ViewChild(TableWidgetDataSourceDirective) dataSource!: TableWidgetDataSourceDirective;
  columns = [{ field: 'value', displayName: 'Value', dataType: 'text' as const }];
  config: TableWidgetConfig = {
    id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-1', queryFamily: 'streamData' },
    columns: [],
    pageSize: 10,
    filters: [{ attributePath: 'device', operator: 'EQUALS', comparisonValue: '$device' }]
  } as TableWidgetConfig;
}

describe('TableWidgetDataSourceDirective — through mm-list-view (AB#8801)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let state: MeshBoardStateService;
  let grid: GridComponent;
  let calls: QueryExecutionOptions[];

  const ROWS: Record<string, number> = { 'dev-1': 16, 'dev-2': 6 };

  /** Inverse of `GraphQL.offsetToCursor` (`null` = offset 0). */
  const toOffset = (after?: string | null): number => (after ? Number(atob(after).split(':')[1]) + 1 : 0);

  function execute(_family: unknown, _rtId: string, options: QueryExecutionOptions): Observable<QueryExecutionResult> {
    calls.push(options);
    const device = String(options.fieldFilter?.[0]?.comparisonValue ?? '');
    const total = ROWS[device] ?? 0;
    const offset = toOffset(options.after);
    if (offset > 0 && offset >= total) {
      return throwError(() => Object.assign(new Error('An error occurred'), {
        errors: [{ message: 'An error occurred', extensions: { code: 'ASSET1002', codes: ['ASSET1002', 'INCOMPLETE_SLICE'] } }]
      }));
    }
    const count = Math.min(options.first ?? 10, total - offset);
    return of({
      family: 'streamData', queryRtId: 'q-1', associatedCkTypeId: null,
      columns: [{ attributePath: 'value' }],
      rows: Array.from({ length: count }, (_, i) => ({
        __typename: 'StreamDataQueryRow', rtId: `${device}-${offset + i}`, cells: [{ attributePath: 'value', value: offset + i }]
      })),
      totalCount: total, hasNextPage: offset + count < total, endCursor: null
    });
  }

  const lastOffset = (): number => toOffset(calls.at(-1)?.after);
  const gridRowCount = (): number => (grid.data as { data: unknown[] }).data.length;

  beforeEach(async () => {
    calls = [];
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: QueryExecutorService, useValue: { execute: vi.fn(execute) } },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: SecretSafeAttributeNamesService, useValue: { forCkType: vi.fn().mockResolvedValue([]) } }
      ]
    }).compileComponents();
    state = TestBed.inject(MeshBoardStateService);
    state.addVariable({ name: 'device', type: 'string', source: 'static', value: 'dev-1' });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    grid = fixture.debugElement.query(By.directive(GridComponent)).componentInstance as GridComponent;
  });

  function goToPage2(): void {
    grid.pageChange.emit({ skip: 10, take: 10 });
    fixture.detectChanges();
    tick();
    expect(lastOffset()).toBe(10);
    expect(gridRowCount()).toBe(6);
  }

  it('sends the query after a variable change with OFFSET 0 and shows the new rows', fakeAsync(() => {
    goToPage2();

    state.setVariableValue('device', 'dev-2');
    fixture.componentInstance.dataSource.refetch();
    fixture.detectChanges();
    tick();

    const afterChange = calls.slice(-1);
    expect(afterChange.map(c => c.fieldFilter?.[0]?.comparisonValue)).toEqual(['dev-2']);
    expect(lastOffset()).toBe(0);
    expect(gridRowCount()).toBe(6);
    expect(grid.skip).toBe(0);
    flush();
  }));

  it('keeps page 2 on a refresh with unchanged inputs', fakeAsync(() => {
    goToPage2();

    fixture.componentInstance.dataSource.refetch();
    fixture.detectChanges();
    tick();

    expect(lastOffset()).toBe(10);
    expect(gridRowCount()).toBe(6);
    flush();
  }));

  it('loads page 1 when the page offset turns out beyond the result (data shrank)', fakeAsync(() => {
    goToPage2();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ROWS['dev-1'] = 6;

    grid.pageChange.emit({ skip: 10, take: 10 });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    tick();

    expect(calls.slice(-2).map(c => toOffset(c.after))).toEqual([10, 0]);
    expect(gridRowCount()).toBe(6);
    expect(grid.skip).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    ROWS['dev-1'] = 16;
    flush();
  }));
});
