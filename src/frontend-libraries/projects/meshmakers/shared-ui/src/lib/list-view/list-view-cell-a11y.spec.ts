import { Component, Directive, forwardRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { checkIcon, xIcon } from '@progress/kendo-svg-icons';
import { Observable, of } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { RowClassFn, TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

const ROWS = [
  { name: 'alpha', state: 'OK', enabled: true },
  { name: 'beta', state: 'FAILED', enabled: false },
];

/** Answers every fetch with {@link ROWS}. */
@Directive({
  selector: '[mmTestStaticDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => StaticDataSourceDirective) }],
})
class StaticDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return of(new FetchResultBase(ROWS, ROWS.length));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, StaticDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestStaticDs [columns]="columns" [rowClass]="rowClass" style="flex: 1"></mm-list-view>
    </div>
  `,
})
class HostComponent {
  columns: TableColumn[] = [
    { field: 'name', displayName: 'Name', dataType: 'text' },
    {
      field: 'state',
      displayName: 'State',
      dataType: 'statusIcons',
      statusMapping: {
        OK: { icon: checkIcon, tooltip: 'Healthy', color: 'green' },
        FAILED: { icon: xIcon, tooltip: 'Failed', color: 'red' },
      },
    },
    { field: 'enabled', displayName: 'Enabled', dataType: 'boolean' },
  ];
  rowClass: RowClassFn | undefined = undefined;
}

/**
 * Accessible names of icon-only / marker cells in `mm-list-view` (AB#5621, G13): status icons are
 * `role="img"` named by their mapping tooltip, the read-only boolean checkbox is named after its
 * column. Also covers the `rowClass` pass-through to the grid rows.
 */
describe('ListViewComponent cell accessibility (AB#5621)', () => {
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
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('names status icons by their tooltip and exposes them as images', async () => {
    await render();
    await fixture.whenStable();
    fixture.detectChanges();
    const icons = Array.from(el().querySelectorAll<HTMLElement>('.status-icon'));
    expect(icons.length).toBe(2);
    expect(icons.map((i) => i.getAttribute('role'))).toEqual(['img', 'img']);
    expect(icons.map((i) => i.getAttribute('aria-label'))).toEqual(['Healthy', 'Failed']);
    expect(icons.map((i) => i.getAttribute('title'))).toEqual(['Healthy', 'Failed']);
  });

  it('names the read-only boolean checkbox after its column', async () => {
    await render();
    await fixture.whenStable();
    fixture.detectChanges();
    const inputs = Array.from(el().querySelectorAll<HTMLInputElement>('kendo-checkbox input'));
    expect(inputs.length).toBe(2);
    expect(inputs.every((i) => i.getAttribute('aria-label') === 'Enabled')).toBe(true);
  });

  it('applies the host rowClass to the grid rows', async () => {
    await render((host) => {
      host.rowClass = ({ dataItem }) => ({ 'row-disabled': !(dataItem as { enabled: boolean }).enabled });
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll<HTMLElement>('tr.k-master-row'));
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.classList.contains('row-disabled'))).toEqual([false, true]);
  });
});
