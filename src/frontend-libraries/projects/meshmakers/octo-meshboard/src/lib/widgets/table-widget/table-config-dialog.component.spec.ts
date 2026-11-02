import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { NotificationService } from '@progress/kendo-angular-notification';
import { AttributeSelectorDialogService, AttributeSortSelectorDialogService } from '@meshmakers/octo-ui';
import { CkTypeSelectorService, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { TableConfigDialogComponent } from './table-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { of } from 'rxjs';

describe('TableConfigDialogComponent — row action and value markers (AB#7728)', () => {
  let windowRef: { close: ReturnType<typeof vi.fn> };

  function dialogProviders(): Provider[] {
    return [
      { provide: NotificationService, useValue: { show: vi.fn() } },
      { provide: AttributeSelectorDialogService, useValue: {} },
      { provide: AttributeSortSelectorDialogService, useValue: {} },
      { provide: CkTypeSelectorService, useValue: {} },
      { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: {} },
      { provide: MeshBoardStateService, useValue: { getVariables: () => [], getEntitySelectors: () => [] } },
      // The dialog loads the fields of a kept query (AB#7655); these tests start without one.
      { provide: GetRuntimeQueryColumnsDtoGQL, useValue: { fetch: vi.fn() } },
      { provide: QueryExecutorService, useValue: { resolveFamily: vi.fn(async () => 'streamData'), fetchStreamDataColumns: vi.fn(async () => []) } }
    ];
  }

  async function open(inputs: Partial<TableConfigDialogComponent> = {}): Promise<TableConfigDialogComponent> {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: WindowRef, useValue: windowRef }, ...dialogProviders()]
    });
    const component = TestBed.runInInjectionContext(() => new TableConfigDialogComponent());
    Object.assign(component, { initialDataSourceType: 'persistentQuery', ...inputs });
    await component.ngOnInit();
    component.selectedPersistentQuery = { rtId: 'q1', name: 'daily', ckTypeId: 'System/StreamDataQuery' } as never;
    return component;
  }

  it('starts without row action and markers for a table that has none', async () => {
    const component = await open();
    expect(component.rowActionEnabled).toBe(false);
    expect(component.valueMarkers).toEqual([]);

    component.onSave();

    const result = windowRef.close.mock.calls[0][0];
    expect('rowAction' in result).toBe(false);
    expect('valueMarkers' in result).toBe(false);
  });

  it('loads and saves the configured row action and markers', async () => {
    const component = await open({
      initialRowAction: { label: 'Details' },
      initialValueMarkers: [{ field: 'manualCount', tooltip: 'Contains manual values' }]
    });
    expect(component.rowActionEnabled).toBe(true);
    expect(component.rowActionLabel).toBe('Details');
    expect(component.valueMarkers).toEqual([{ field: 'manualCount', tooltip: 'Contains manual values', icon: 'exclamation-circle' }]);

    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({
      rowAction: { label: 'Details' },
      valueMarkers: [{ field: 'manualCount', tooltip: 'Contains manual values', icon: 'exclamation-circle' }]
    }));
  });

  it('keeps showValue through load and save, and writes no key when it is off', async () => {
    const component = await open({
      initialValueMarkers: [{ field: 'a', tooltip: 'A', showValue: true }, { field: 'b', tooltip: 'B' }]
    });
    expect(component.valueMarkers[0].showValue).toBe(true);

    component.onSave();

    const [first, second] = windowRef.close.mock.calls[0][0].valueMarkers;
    expect(first.showValue).toBe(true);
    expect('showValue' in second).toBe(false);
  });

  it('is invalid while the row action has no label or a marker is incomplete', async () => {
    const component = await open();
    expect(component.isValid).toBe(true);

    component.rowActionEnabled = true;
    expect(component.isValid).toBe(false);
    component.rowActionLabel = 'Details';
    expect(component.isValid).toBe(true);

    component.addValueMarker();
    expect(component.isValid).toBe(false);
    component.valueMarkers[0].field = 'manualCount';
    component.valueMarkers[0].tooltip = 'Manual';
    expect(component.isValid).toBe(true);

    component.removeValueMarker(0);
    expect(component.valueMarkers).toEqual([]);
  });

  it('drops the row action when it is switched off', async () => {
    const component = await open({ initialRowAction: { label: 'Details' } });
    component.rowActionEnabled = false;

    component.onSave();

    expect('rowAction' in windowRef.close.mock.calls[0][0]).toBe(false);
  });

  it('names every marker control for screen readers', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowRef, useValue: { close: vi.fn() } },
        provideNoopAnimations(),
        ...dialogProviders(),
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [], totalCount: 0 } } } })) } }
      ]
    });
    const fixture = TestBed.createComponent(TableConfigDialogComponent);
    Object.assign(fixture.componentInstance, {
      initialDataSourceType: 'persistentQuery',
      initialValueMarkers: [{ field: 'manualCount', tooltip: 'Manual', icon: 'warning-triangle' }]
    });
    await fixture.componentInstance.ngOnInit();
    // The marker card belongs to a picked query.
    fixture.componentInstance.selectedPersistentQuery = { rtId: 'q1', name: 'daily', ckTypeId: 'System/StreamDataQuery' } as never;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector('.marker-row')!;

    expect(row.querySelector('kendo-dropdownlist.marker-icon')!.getAttribute('aria-label')).toBe('Marker icon');
    expect(row.querySelector('kendo-combobox.marker-field input')!.getAttribute('aria-label')).toBe('Marker column field');
    expect(row.querySelector('kendo-textbox.marker-tooltip input')!.getAttribute('aria-label')).toBe('Marker tooltip');
    expect(row.querySelector('button[title="Remove marker"]')!.getAttribute('aria-label')).toBe('Remove marker');
  });
});
