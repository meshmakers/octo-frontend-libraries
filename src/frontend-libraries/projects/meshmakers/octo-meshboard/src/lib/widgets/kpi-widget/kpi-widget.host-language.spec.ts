import { TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { KpiWidgetComponent } from './kpi-widget.component';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { KpiWidgetConfig } from '../../models/meshboard.models';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';

/** AB#9743 (F6): a KPI value follows the number format of the host language. */
describe('KpiWidgetComponent number format in the host language (AB#9743)', () => {
  function shown(staticValue: string, decimalPlaces: number | undefined, language?: string): string {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [KpiWidgetComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: DashboardDataService, useValue: {} },
        { provide: QueryExecutorService, useValue: { execute: vi.fn() } },
        ...(language ? [{ provide: MESHBOARD_LANGUAGE, useValue: language }] : [])
      ]
    });
    const config: KpiWidgetConfig = {
      id: 'kpi-1', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1, valueAttribute: '',
      dataSource: { type: 'static' }, staticValue, ...(decimalPlaces !== undefined && { decimalPlaces })
    };
    TestBed.inject(MeshBoardStateService).setConfig({ id: 'b', name: 'B', columns: 6, rowHeight: 200, gap: 16, widgets: [config] });
    const fixture = TestBed.createComponent(KpiWidgetComponent);
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
    return fixture.componentInstance.value();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses a decimal point for an English host', () => {
    expect(shown('0.15', 2, 'en')).toBe('0.15');
    expect(shown('38.9', undefined, 'en')).toBe('38.90');
  });

  it('uses a decimal comma for a German host', () => {
    expect(shown('0.15', 2, 'de-AT')).toBe('0,15');
  });

  it('keeps the former de-AT format for a host without a language', () => {
    expect(shown('38.9', 1)).toBe('38,9');
  });
});
