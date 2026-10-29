import { Component, Directive, Type, forwardRef, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { Observable, Subject } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { ListViewEmptyActionsDirective } from './list-view-empty-actions.directive';
import { TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

@Directive({
  selector: '[mmTestEmptyActionsDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => ControlledDataSourceDirective) }],
})
class ControlledDataSourceDirective extends DataSourceBase {
  readonly response = new Subject<FetchResult | null>();

  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return this.response;
  }
}

const COLUMNS: TableColumn[] = [{ field: 'name', displayName: 'Name', dataType: 'text' }];

@Component({
  standalone: true,
  imports: [ListViewComponent, ControlledDataSourceDirective, ListViewEmptyActionsDirective],
  template: `
    <mm-list-view mmTestEmptyActionsDs [columns]="columns" [hasExternalFilters]="filtered()"
                  [emptyState]="{ title: 'No customers yet', text: 'Create the first customer.' }">
      <ng-template mmListViewEmptyActions>
        <button type="button" class="test-create" (click)="creations = creations + 1">New customer</button>
      </ng-template>
    </mm-list-view>`,
})
class HostWithActionComponent {
  readonly columns = COLUMNS;
  readonly filtered = signal(false);
  creations = 0;
}

@Component({
  standalone: true,
  imports: [ListViewComponent, ControlledDataSourceDirective],
  template: `
    <mm-list-view mmTestEmptyActionsDs [columns]="columns"
                  [emptyState]="{ title: 'No customers yet', text: 'Create the first customer.' }"></mm-list-view>`,
})
class HostWithoutActionComponent {
  readonly columns = COLUMNS;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
  await new Promise(resolve => setTimeout(resolve));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

async function render<T>(host: Type<T>, filtered = false): Promise<{ fixture: ComponentFixture<T>; root: HTMLElement; dataSource: ControlledDataSourceDirective }> {
  await TestBed.configureTestingModule({
    imports: [host],
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  if (fixture.componentInstance instanceof HostWithActionComponent) {
    fixture.componentInstance.filtered.set(filtered);
  }
  fixture.detectChanges();
  const dataSource = fixture.debugElement.children[0].injector.get(ControlledDataSourceDirective);
  return { fixture, root: fixture.nativeElement as HTMLElement, dataSource };
}

async function answerEmpty<T>(fixture: ComponentFixture<T>, dataSource: ControlledDataSourceDirective): Promise<void> {
  await settle(fixture);
  dataSource.response.next(new FetchResultBase([], 0));
  await settle(fixture);
}

describe('ListViewComponent empty state actions (AB#7628)', () => {
  it('shows the host action inside the empty state, below the text, usable by keyboard and pointer', async () => {
    const { fixture, root, dataSource } = await render(HostWithActionComponent);
    await answerEmpty(fixture, dataSource);

    const emptyState = root.querySelector('mm-empty-state');
    expect(emptyState?.getAttribute('data-variant')).toBe('empty');
    const actions = emptyState?.querySelector('.mm-list-view-empty-actions');
    const text = emptyState?.querySelector('.mm-empty-state__text');
    expect(actions).not.toBeNull();
    expect(text!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const button = actions!.querySelector<HTMLButtonElement>('button.test-create')!;
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(fixture.componentInstance.creations).toBe(1);
  });

  it('shows the "no results" variant without the action while a host filter is active', async () => {
    const { fixture, root, dataSource } = await render(HostWithActionComponent, true);
    await answerEmpty(fixture, dataSource);

    const emptyState = root.querySelector('mm-empty-state');
    expect(emptyState?.getAttribute('data-variant')).toBe('no-results');
    expect(root.querySelector('.mm-list-view-empty-actions')).toBeNull();
    expect(root.querySelector('button.test-create')).toBeNull();
  });

  it('renders the empty state exactly as before when the host passes no action', async () => {
    const { fixture, root, dataSource } = await render(HostWithoutActionComponent);
    await answerEmpty(fixture, dataSource);

    const emptyState = root.querySelector('mm-empty-state')!;
    expect(emptyState.getAttribute('data-variant')).toBe('empty');
    expect(root.querySelector('.mm-list-view-empty-actions')).toBeNull();
    const expectedParts = ['mm-empty-state__figure', 'mm-empty-state__title', 'mm-empty-state__text'];
    const children = Array.from(emptyState.children);
    expect(children.length).toBe(expectedParts.length);
    children.forEach((child, index) => expect(child.classList.contains(expectedParts[index])).toBe(true));
  });

  it('does not show the action while the list is loading', async () => {
    const { fixture, root } = await render(HostWithActionComponent);
    await settle(fixture);

    expect(root.querySelector('mm-empty-state')).toBeNull();
    expect(root.querySelector('button.test-create')).toBeNull();
  });
});
