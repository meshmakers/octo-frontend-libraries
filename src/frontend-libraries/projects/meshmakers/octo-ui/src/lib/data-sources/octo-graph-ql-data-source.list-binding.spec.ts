import { Component, Directive, forwardRef, inject, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client';
import { Observable, of, throwError } from 'rxjs';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent } from '@meshmakers/shared-ui';
import { GridComponent } from '@progress/kendo-angular-grid';
import { OctoGraphQlDataSource } from './octo-graph-ql-data-source';

interface RowDto {
  id: string;
  value: number;
}

/**
 * Simulates the asset repository: `total` rows, and for a page window beyond the result the
 * Apollo 4 rejection a real `.fetch()` produces (`CombinedGraphQLErrors` with ASSET1002 /
 * INCOMPLETE_SLICE).
 */
@Directive({
  selector: '[mmTestOctoDataSource]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => TestOctoDataSourceDirective) }]
})
class TestOctoDataSourceDirective extends OctoGraphQlDataSource<RowDto> {
  total = 16;
  readonly skips: number[] = [];

  constructor() {
    super(inject(ListViewComponent));
  }

  public override fetchData(options: FetchDataOptions): Observable<FetchResultTyped<RowDto> | null> {
    const skip = options.state.skip ?? 0;
    this.skips.push(skip);
    if (skip > 0 && skip >= this.total) {
      return throwError(() => new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: 'An error occurred', extensions: { code: 'ASSET1002', codes: ['ASSET1002', 'INCOMPLETE_SLICE'] } }]
      }));
    }
    const count = Math.min(options.state.take ?? 10, this.total - skip);
    const rows = Array.from({ length: count }, (_, i) => ({ id: `row-${skip + i}`, value: skip + i }));
    return of(new FetchResultTyped<RowDto>(rows, this.total));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, TestOctoDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestOctoDataSource [columns]="columns" [pageSize]="10" style="flex: 1"></mm-list-view>
    </div>
  `
})
class HostComponent {
  @ViewChild(TestOctoDataSourceDirective) dataSource!: TestOctoDataSourceDirective;
  columns = [{ field: 'value', displayName: 'Value', dataType: 'numeric' as const }];
}

/**
 * AB#8804 end to end through the real `mm-list-view` server binding: on Apollo 4 a list on page 2
 * whose next query is refused with INCOMPLETE_SLICE re-queries page 1 once and shows its rows.
 */
describe('OctoGraphQlDataSource — page-out-of-range recovery through mm-list-view (AB#8804)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let grid: GridComponent;

  const gridRowCount = (): number => (grid.data as { data: unknown[] }).data.length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    grid = fixture.debugElement.query(By.directive(GridComponent)).componentInstance as GridComponent;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('re-queries page 1 once and shows its rows when page 2 is out of range', fakeAsync(() => {
    tick();
    const dataSource = fixture.componentInstance.dataSource;

    grid.pageChange.emit({ skip: 10, take: 10 });
    fixture.detectChanges();
    tick();
    expect(dataSource.skips.at(-1)).toBe(10);
    expect(gridRowCount()).toBe(6);

    // The data shrinks below the page offset; the next fetch of page 2 is refused.
    dataSource.total = 4;
    const before = dataSource.skips.length;
    dataSource.fetchAgain();
    fixture.detectChanges();
    tick();

    expect(dataSource.skips.slice(before)).toEqual([10, 0]);
    expect(grid.skip).toBe(0);
    expect(gridRowCount()).toBe(4);
    flush();
  }));

  it('retries page 1 only once when the page-1 retry fails as well', fakeAsync(() => {
    tick();
    const dataSource = fixture.componentInstance.dataSource;

    grid.pageChange.emit({ skip: 10, take: 10 });
    fixture.detectChanges();
    tick();
    expect(dataSource.skips.at(-1)).toBe(10);

    // Every further request is refused, the page-2 refetch and its page-1 retry alike.
    const requested: number[] = [];
    vi.spyOn(dataSource, 'fetchData').mockImplementation((options: FetchDataOptions) => {
      requested.push(options.state.skip ?? 0);
      return throwError(() => new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: 'An error occurred', extensions: { code: 'INCOMPLETE_SLICE' } }]
      }));
    });

    dataSource.fetchAgain();
    fixture.detectChanges();
    tick();

    expect(requested).toEqual([10, 0]);
    expect(grid.skip).toBe(0);
    flush();
  }));
});
