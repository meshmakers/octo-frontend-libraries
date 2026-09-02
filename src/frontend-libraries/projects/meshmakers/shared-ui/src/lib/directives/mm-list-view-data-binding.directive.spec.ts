import { Component, Directive, forwardRef, inject, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { GridComponent } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query/dist/npm/state';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { MmListViewDataBindingDirective } from './mm-list-view-data-binding.directive';
import { ListViewComponent } from '../list-view/list-view.component';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

interface RecordedCall {
    state: State;
    textSearch: string | null;
    forceRefresh?: boolean;
}

/**
 * Records every fetchData call and answers with rows whose names encode the
 * request (sort + skip), so a test can tell WHICH request produced the data
 * currently rendered in the grid.
 */
@Directive({
  selector: '[mmTestRecordingDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => RecordingDataSourceDirective) }]
})
class RecordingDataSourceDirective extends DataSourceBase {
  public calls: RecordedCall[] = [];
  public responseDelayMs = 0;
  /** Make the next fetch fail — with a page-out-of-range error or a generic one. */
  public failNextFetch: 'pageOutOfRange' | 'other' | null = null;

  constructor() {
    super(inject(ListViewComponent));
  }

  public override isPageOutOfRangeError(error: unknown): boolean {
    return (error as {
            pageOutOfRange?: boolean;
        })?.pageOutOfRange === true;
  }

  public fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    // deep-copy the state so later mutations don't retroactively alter recorded calls
    this.calls.push({
      state: JSON.parse(JSON.stringify(options.state)),
      textSearch: options.textSearch,
      forceRefresh: options.forceRefresh
    });
    if (this.failNextFetch) {
      const kind = this.failNextFetch;
      this.failNextFetch = null;
      return throwError(() => (kind === 'pageOutOfRange' ? { pageOutOfRange: true } : new Error('fetch failed')));
    }
    const sortDescriptor = options.state.sort?.find(s => s.dir);
    const sortTag = sortDescriptor ? `${sortDescriptor.field}:${sortDescriptor.dir}` : 'unsorted';
    const rows = Array.from({ length: options.state.take ?? 10 }, (_, i) => ({
      name: `${sortTag}-row-${(options.state.skip ?? 0) + i}`
    }));
    const result = of(new FetchResultBase(rows, 100));
    return this.responseDelayMs > 0 ? result.pipe(delay(this.responseDelayMs)) : result;
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, RecordingDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestRecordingDs [columns]="columns" style="flex: 1"></mm-list-view>
    </div>
  `
})
class HostComponent {
    @ViewChild(RecordingDataSourceDirective)
      dataSource!: RecordingDataSourceDirective;
    columns = [
      { field: 'name', displayName: 'Name', dataType: 'text' as const }
    ];
}

describe('MmListViewDataBindingDirective (server binding)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let grid: GridComponent;
  let directive: MmListViewDataBindingDirective;

  const lastCall = () => host.dataSource.calls[host.dataSource.calls.length - 1];
  const gridRowNames = () => (grid.data as {
        data: {
            name: string;
        }[];
    }).data.map(r => r.name);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: { navigate: vi.fn().mockName('navigate') } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    grid = fixture.debugElement.query(By.directive(GridComponent)).componentInstance as GridComponent;
    directive = fixture.debugElement.query(By.directive(MmListViewDataBindingDirective))
      .injector.get(MmListViewDataBindingDirective);
  });

  it('keeps the sort in the fetch state when paging', fakeAsync(() => {
    grid.sortChange.emit([{ field: 'name', dir: 'asc' }]);
    fixture.detectChanges();
    tick();
    expect(lastCall().state.sort).toEqual([{ field: 'name', dir: 'asc' }]);

    grid.pageChange.emit({ skip: 20, take: 20 });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.skip).toBe(20);
    expect(lastCall().state.sort, 'sort must survive paging').toEqual([{ field: 'name', dir: 'asc' }]);
    flush();
  }));

  it('keeps the filter in the fetch state when paging', fakeAsync(() => {
    grid.filterChange.emit({ logic: 'and', filters: [{ field: 'name', operator: 'contains', value: 'abc' }] });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.filter?.filters?.length).toBe(1);

    grid.pageChange.emit({ skip: 20, take: 20 });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.skip).toBe(20);
    expect(lastCall().state.filter?.filters?.length, 'filter must survive paging').toBe(1);
    flush();
  }));

  it('keeps sort and filter on an applyPageSize refetch (autoPageSize)', fakeAsync(() => {
    grid.sortChange.emit([{ field: 'name', dir: 'desc' }]);
    grid.filterChange.emit({ logic: 'and', filters: [{ field: 'name', operator: 'contains', value: 'x' }] });
    fixture.detectChanges();
    tick();

    directive.applyPageSize(14);
    fixture.detectChanges();
    tick();

    expect(lastCall().state.take).toBe(14);
    expect(lastCall().state.sort).toEqual([{ field: 'name', dir: 'desc' }]);
    expect(lastCall().state.filter?.filters?.length).toBe(1);
    flush();
  }));

  it('resets skip to page 1 on a programmatic filter change (notifyFilterChange)', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.skip).toBe(40);

    // the dropdown/range filter cells go through notifyFilterChange, not Kendo's filter row
    directive.notifyFilterChange({ logic: 'and', filters: [{ field: 'name', operator: 'eq', value: 'abc' }] });
    fixture.detectChanges();
    tick();

    expect(lastCall().state.skip, 'a changed filter changes the result set — the old page offset would point past it').toBe(0);
    expect(lastCall().state.filter?.filters?.length).toBe(1);
    expect(grid.skip).toBe(0);
    flush();
  }));

  it('resets skip to page 1 on a text search', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.skip).toBe(40);

    host.dataSource.listViewComponent.onExecuteFilter.emit('search term');
    fixture.detectChanges();
    tick();

    expect(lastCall().textSearch).toBe('search term');
    expect(lastCall().state.skip).toBe(0);
    expect(grid.skip).toBe(0);
    flush();
  }));

  it('resets skip to page 1 on fetchAgain({ resetSkip: true }) (bar-filter change)', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();
    expect(lastCall().state.skip).toBe(40);

    // bar/quick-view filters live in the data source, outside the Kendo state —
    // their change path is fetchAgain(), which must mirror notifyFilterChange()
    host.dataSource.fetchAgain({ resetSkip: true });
    fixture.detectChanges();
    tick();

    expect(lastCall().state.skip, 'changed bar filters change the result set — the old page offset would point past it').toBe(0);
    expect(lastCall().forceRefresh).toBe(true);
    expect(grid.skip).toBe(0);
    flush();
  }));

  it('keeps the current page on a plain fetchAgain() (data refresh)', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();

    host.dataSource.fetchAgain();
    fixture.detectChanges();
    tick();

    expect(lastCall().state.skip, 'a plain refresh must not yank the user back to page 1').toBe(40);
    flush();
  }));

  it('recovers from a page-out-of-range fetch error by returning to page 1', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();

    // e.g. a restored page offset beyond the current (shrunken) result set
    host.dataSource.failNextFetch = 'pageOutOfRange';
    host.dataSource.fetchAgain();
    fixture.detectChanges();
    tick();

    expect(lastCall().state.skip, 'the failed out-of-range fetch must be retried from page 1').toBe(0);
    expect(gridRowNames()[0], 'the grid must show page-1 data, not silently keep the previous rows').toBe('unsorted-row-0');
    expect(grid.skip).toBe(0);
    flush();
  }));

  it('does not reset the page on a generic fetch error', fakeAsync(() => {
    grid.pageChange.emit({ skip: 40, take: 20 });
    fixture.detectChanges();
    tick();
    const callsBefore = host.dataSource.calls.length;

    host.dataSource.failNextFetch = 'other';
    host.dataSource.fetchAgain();
    fixture.detectChanges();
    tick();

    expect(host.dataSource.calls.length, 'a non-page error must not trigger a retry').toBe(callsBefore + 1);
    expect(lastCall().state.skip).toBe(40);
    flush();
  }));

  it('cancels a stale in-flight fetch so its late response cannot overwrite newer data', fakeAsync(() => {
    const ds = host.dataSource;

    // A slow page fetch is still in flight ...
    ds.responseDelayMs = 500;
    grid.pageChange.emit({ skip: 20, take: 20 });
    fixture.detectChanges();

    // ... when the user sorts; the sorted fetch answers fast.
    ds.responseDelayMs = 10;
    grid.sortChange.emit([{ field: 'name', dir: 'asc' }]);
    fixture.detectChanges();

    tick(20); // sorted fetch resolves
    expect(gridRowNames()[0]).toMatch(/^name:asc-/);

    tick(600); // stale unsorted fetch would resolve now — it must have been cancelled
    expect(gridRowNames()[0], 'late stale response must not replace the sorted data').toMatch(/^name:asc-/);
    flush();
  }));
});

describe('MmListViewDataBindingDirective (state persistence)', () => {
  const STORAGE_KEY = 'mm-list-view-state';
  const LIST_KEY = '/documents';

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // The TestBed setup lives in a hook rather than in the test bodies: awaiting
  // compileComponents() inside fakeAsync() resumes outside the fakeAsync zone, so a
  // later tick() would not find it.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        // A url makes resolveListStateKey() return '/documents' -> persistence on.
        { provide: Router, useValue: { navigate: vi.fn().mockName('navigate'), url: '/documents?tab=all' } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } }
      ]
    }).compileComponents();
  });

  it('persists the sort under the route-derived key after a sort change', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const grid = fixture.debugElement.query(By.directive(GridComponent)).componentInstance as GridComponent;

    grid.sortChange.emit([{ field: 'name', dir: 'asc' }]);
    fixture.detectChanges();
    tick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[LIST_KEY]?.sort).toEqual([{ field: 'name', dir: 'asc' }]);
    flush();
  }));

  it('restores a persisted sort + skip into the very first fetch', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      [LIST_KEY]: { sort: [{ field: 'name', dir: 'desc' }], skip: 40 }
    }));
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const firstCall = host.dataSource.calls[0];
    expect(firstCall.state.sort, 'the initial fetch must already carry the restored sort').toEqual([{ field: 'name', dir: 'desc' }]);
    expect(firstCall.state.skip).toBe(40);
    flush();
  }));

  it('persists the free-text search value', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();

    host.dataSource.listViewComponent.onExecuteFilter.emit('acme');
    fixture.detectChanges();
    tick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[LIST_KEY]?.textSearch).toBe('acme');
    flush();
  }));

  it('restores the free-text search into the very first fetch', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      [LIST_KEY]: { textSearch: 'acme' }
    }));
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    expect(host.dataSource.calls[0].textSearch, 'the initial fetch must already carry the restored search term').toBe('acme');
    flush();
  }));

  it('fetchAgain({ resetSkip: true }) persists the page reset', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      [LIST_KEY]: { skip: 40 }
    }));
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    host.dataSource.fetchAgain({ resetSkip: true });
    fixture.detectChanges();
    tick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[LIST_KEY]?.skip, 'the stale page offset must not be restored on the next visit').toBe(0);
    flush();
  }));

  it('resetState() clears sort/filter/search + drops the persisted entry', fakeAsync(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      [LIST_KEY]: { sort: [{ field: 'name', dir: 'desc' }], textSearch: 'acme', extra: { view: 'done' } }
    }));
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    const directive = fixture.debugElement.query(By.directive(MmListViewDataBindingDirective))
      .injector.get(MmListViewDataBindingDirective);
    tick();

    directive.resetState();
    fixture.detectChanges();
    tick();

    const lastCall = host.dataSource.calls[host.dataSource.calls.length - 1];
    expect(lastCall.state.sort ?? []).toEqual([]);
    expect(lastCall.state.filter?.filters ?? []).toEqual([]);
    expect(lastCall.textSearch).toBeNull();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[LIST_KEY], 'the whole entry (incl. app extra) is dropped').toBeUndefined();
    flush();
  }));
});
