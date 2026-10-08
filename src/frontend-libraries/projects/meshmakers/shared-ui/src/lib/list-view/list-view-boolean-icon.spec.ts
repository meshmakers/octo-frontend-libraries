import { Component, Directive, forwardRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { starIcon } from '@progress/kendo-svg-icons';
import { Observable, of } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { ListViewMessages, TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

const ROWS = [
  { name: 'alpha', enabled: true },
  { name: 'beta', enabled: false },
  { name: 'gamma', enabled: null },
];

@Directive({
  selector: '[mmTestBoolDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => BoolDataSourceDirective) }],
})
class BoolDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return of(new FetchResultBase(ROWS, ROWS.length));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, BoolDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestBoolDs [columns]="columns" [messages]="messages" style="flex: 1"></mm-list-view>
    </div>
  `,
})
class HostComponent {
  columns: TableColumn[] = [
    { field: 'name', displayName: 'Name', dataType: 'text' },
    { field: 'enabled', displayName: 'Enabled', dataType: 'booleanIcon' },
  ];
  messages: Partial<ListViewMessages> | null = null;
}

/** `dataType: 'booleanIcon'` (AB#5623): check / x icon, named "<column>: Yes|No", boolean filter. */
describe('ListViewComponent booleanIcon column (AB#5623)', () => {
  let fixture: ComponentFixture<HostComponent>;

  async function render(configure?: (host: HostComponent) => void): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    configure?.(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const icons = (): HTMLElement[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.boolean-icon'));

  it('renders true / false as named images and leaves an empty value empty', async () => {
    await render();
    const cells = icons();
    expect(cells.length).toBe(2);
    expect(cells.map((c) => c.getAttribute('role'))).toEqual(['img', 'img']);
    expect(cells.map((c) => c.getAttribute('aria-label'))).toEqual(['Enabled: Yes', 'Enabled: No']);
    expect(cells[0].classList).toContain('boolean-icon--true');
    expect(cells[1].classList).toContain('boolean-icon--false');
    expect(cells.every((c) => !!c.querySelector('svg'))).toBe(true);
  });

  it('takes Yes / No and the label template from the messages', async () => {
    await render((host) => {
      host.messages = { booleanYes: 'Ja', booleanNo: 'Nein', booleanIconLabel: '{column} – {value}' };
    });
    expect(icons().map((c) => c.getAttribute('aria-label'))).toEqual(['Enabled – Ja', 'Enabled – Nein']);
  });

  it('uses host icons and hides false cells with false: null', async () => {
    await render((host) => {
      host.columns = [
        { field: 'name', displayName: 'Name' },
        { field: 'enabled', displayName: 'Enabled', dataType: 'booleanIcon', booleanIcons: { true: starIcon, false: null, trueColor: 'gold' } },
      ];
    });
    const cells = icons();
    expect(cells.length).toBe(1);
    expect(cells[0].style.color).toBe('gold');
    expect(cells[0].getAttribute('aria-label')).toBe('Enabled: Yes');
  });

  it('filters like a boolean column', async () => {
    await render();
    const list = fixture.debugElement.query(By.directive(ListViewComponent)).componentInstance as unknown as { getFilterType(c: TableColumn): string };
    expect(list.getFilterType({ field: 'enabled', dataType: 'booleanIcon' })).toBe('boolean');
  });
});
