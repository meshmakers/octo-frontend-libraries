import { Component, Directive, forwardRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { Observable, Subject } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

/** Data source whose fetch stays pending until the test answers it. */
@Directive({
  selector: '[mmTestPendingDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => PendingDataSourceDirective) }],
})
class PendingDataSourceDirective extends DataSourceBase {
  readonly response = new Subject<FetchResult | null>();

  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return this.response;
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, PendingDataSourceDirective],
  template: `<mm-list-view mmTestPendingDs [columns]="columns" [emptyState]="{ title: 'No data flows yet' }"></mm-list-view>`,
})
class HostComponent {
  columns: TableColumn[] = [{ field: 'name', displayName: 'Name', dataType: 'text' }];
}

/**
 * The empty state must not flash while the first fetch is in flight (AB#3444): the list's loading
 * signal follows the data source one macrotask late, so the first render must not show the
 * OctoBot "No ... yet" block although the data source is already loading.
 */
describe('ListViewComponent empty state while loading (AB#3444)', () => {
  it('shows no empty state before the first fetch answered, then shows it for an empty result', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    const root = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    expect(root.querySelector('mm-empty-state')).toBeNull();

    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    expect(root.querySelector('mm-empty-state')).toBeNull();

    const ds = fixture.debugElement.children[0].injector.get(PendingDataSourceDirective);
    ds.response.next(new FetchResultBase([], 0));
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('mm-empty-state')?.textContent).toContain('No data flows yet');
  });
});
