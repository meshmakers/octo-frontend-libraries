import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { DataSource, MeshBoardTimeShift, PersistentQueryDataSource, TimeRangeSelection } from '../../models/meshboard.models';
import { TimeShiftCaptionComponent } from './time-shift-caption.component';

/**
 * AB#9095 criterion 5: the caption of a shifted widget and its tooltip, board zone Europe/Vienna.
 * Expected texts are the literals of the acceptance criteria.
 */
describe('TimeShiftCaptionComponent (AB#9095)', () => {
  let state: MeshBoardStateService;
  let fixture: ComponentFixture<TimeShiftCaptionComponent>;

  const PREVIOUS_PERIOD: MeshBoardTimeShift = { by: 'period', count: -1 };
  const LAST_YEAR: MeshBoardTimeShift = { by: 'year', count: -1 };

  function source(timeShift?: MeshBoardTimeShift, extra: Partial<PersistentQueryDataSource> = {}): DataSource {
    return { type: 'persistentQuery', queryRtId: 'q-energy', queryFamily: 'streamData', ...(timeShift && { timeShift }), ...extra };
  }

  function boardOn(selection: TimeRangeSelection): void {
    state.updateTimeFilterConfig({ enabled: true, selection });
  }

  function render(dataSource: DataSource): void {
    fixture = TestBed.createComponent(TimeShiftCaptionComponent);
    fixture.componentRef.setInput('dataSource', dataSource);
    fixture.detectChanges();
  }

  function caption(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.time-shift-caption');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TimeShiftCaptionComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'Europe/Vienna' });
  });

  afterEach(() => state.setHostTimeRange(null));

  describe('criterion 5 Visible shifted period', () => {
    it('month: "September 2026", tooltip "Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)"', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('September 2026');
      expect(caption()?.getAttribute('title')).toBe('Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)');
    });

    it('month, same period last year: "October 2025", tooltip names the shift', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(LAST_YEAR));

      expect(caption()?.textContent?.trim()).toBe('October 2025');
      expect(caption()?.getAttribute('title')).toBe('Same period last year: 01.10.2025 - 31.10.2025 (Europe/Vienna)');
    });

    it('quarter: "Q4 2025"', () => {
      boardOn({ type: 'quarter', year: 2026, quarter: 1 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('Q4 2025');
      expect(caption()?.getAttribute('title')).toBe('Previous period: 01.10.2025 - 31.12.2025 (Europe/Vienna)');
    });

    it('year: "2025"', () => {
      boardOn({ type: 'year', year: 2026 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('2025');
      expect(caption()?.getAttribute('title')).toBe('Previous period: 01.01.2025 - 31.12.2025 (Europe/Vienna)');
    });

    it('day: the date', () => {
      boardOn({ type: 'day', year: 2026, month: 10, day: 10 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('09.11.2026');
      expect(caption()?.getAttribute('title')).toBe('Previous period: 09.11.2026 (Europe/Vienna)');
    });

    it('custom range of 7 days: "03.11.2026 - 09.11.2026"', () => {
      boardOn({ type: 'custom', customFrom: '2026-11-10T00:00:00+01:00', customTo: '2026-11-16T00:00:00+01:00' } as TimeRangeSelection);
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('03.11.2026 - 09.11.2026');
      expect(caption()?.getAttribute('title')).toBe('Previous period: 03.11.2026 - 09.11.2026 (Europe/Vienna)');
    });

    it('names a shift of several periods: "3 periods back"', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source({ by: 'period', count: -3 }));

      expect(caption()?.textContent?.trim()).toBe('July 2026');
      expect(caption()?.getAttribute('title')).toBe('3 periods back: 01.07.2026 - 31.07.2026 (Europe/Vienna)');
    });

    it('follows a change of the board time filter', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(PREVIOUS_PERIOD));
      expect(caption()?.textContent?.trim()).toBe('September 2026');

      boardOn({ type: 'month', year: 2026, month: 10 });
      fixture.detectChanges();

      expect(caption()?.textContent?.trim()).toBe('October 2026');
    });

    it('a widget without a shift shows no caption', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source());

      expect(caption()).toBeNull();
      expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
    });

    it('no caption where the shift has no effect: ignored time filter, runtime query, no time filter', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(PREVIOUS_PERIOD, { ignoreTimeFilter: true }));
      expect(caption()).toBeNull();

      render(source(PREVIOUS_PERIOD, { queryFamily: 'runtime' }));
      expect(caption()).toBeNull();

      state.updateTimeFilterConfig({ enabled: false, selection: { type: 'month', year: 2026, month: 9 } });
      render(source(PREVIOUS_PERIOD));
      expect(caption()).toBeNull();
    });
  });

  describe('criterion 7 Narrow window', () => {
    it('the caption truncates with an ellipsis and keeps the full text in the tooltip', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(PREVIOUS_PERIOD));

      const style = getComputedStyle(caption()!);
      expect(style.textOverflow).toBe('ellipsis');
      expect(style.whiteSpace).toBe('nowrap');
      expect(style.overflow).toBe('hidden');
      expect(caption()?.getAttribute('title')).toContain('01.09.2026 - 30.09.2026');
    });
  });
});
