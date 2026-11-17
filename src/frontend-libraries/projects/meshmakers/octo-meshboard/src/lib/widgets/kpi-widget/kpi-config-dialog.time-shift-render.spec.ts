import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService } from '@meshmakers/octo-services';
import { KpiConfigDialogComponent } from './kpi-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';

/**
 * AB#9095 criteria 2 and 4 in the rendered KPI dialog (its real template): the "Compare with" control
 * sits in the dialog for a stream-data query, shows the saved shift, and is disabled while
 * "Ignore MeshBoard time filter" is on.
 */
describe('KpiConfigDialogComponent — time shift control in the template (AB#9095)', () => {
  let fixture: ComponentFixture<KpiConfigDialogComponent>;

  async function open(ignoreTimeFilter: boolean): Promise<HTMLElement> {
    TestBed.inject(MeshBoardStateService).setConfig({ id: 'board', name: 'Board', columns: 4, rowHeight: 200, gap: 16, widgets: [] });
    fixture = TestBed.createComponent(KpiConfigDialogComponent);
    Object.assign(fixture.componentInstance, {
      initialDataSourceType: 'persistentQuery',
      initialQueryFamily: 'streamData',
      initialIgnoreTimeFilter: ignoreTimeFilter,
      initialTimeShift: { by: 'year', count: -1 }
    });
    await fixture.componentInstance.ngOnInit();
    fixture.componentInstance.selectedPersistentQuery = { rtId: 'q-energy', name: 'Energy', ckTypeId: 'System/SimpleSdQuery' } as never;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function radio(el: HTMLElement, label: string): HTMLInputElement {
    const choice = Array.from(el.querySelectorAll('mm-sd-time-shift-editor label.choice')).find(l => l.textContent?.trim() === label);
    return choice!.querySelector('input[type="radio"]') as HTMLInputElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KpiConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: {} },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [], totalCount: 0 } } } })) } },
        { provide: WindowRef, useValue: { close: vi.fn() } }
      ]
    });
  });

  it('criterion 2 Set: the dialog shows "Compare with" for a stream-data query with the saved choice', async () => {
    const el = await open(false);

    expect(el.querySelector('mm-sd-time-shift-editor legend')?.textContent?.trim()).toBe('Compare with');
    expect(radio(el, 'Same period last year').checked).toBe(true);
    expect(radio(el, 'Same period last year').disabled).toBe(false);
  });

  it('criterion 4 Only where it applies: with "Ignore MeshBoard time filter" on, the control in the dialog is disabled and says so', async () => {
    const el = await open(true);

    expect(['None', 'Previous period', 'Same period last year'].every(label => radio(el, label).disabled)).toBe(true);
    expect(radio(el, 'Same period last year').checked).toBe(true);
    expect(el.querySelector('mm-sd-time-shift-editor .field-hint')?.textContent?.trim())
      .toBe('The shift has no effect while the MeshBoard time filter is ignored.');
  });
});
