import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, DataSource, MeshBoardTimeShift, PersistentQueryDataSource, TimeRangeSelection } from '../../models/meshboard.models';
import { TimeShiftCaptionComponent } from './time-shift-caption.component';
import { hoverTooltip, leaveTooltip, openTooltips, tooltipSide, tooltipTestProviders, tooltipText } from '../../testing/meshboard-tooltip.helpers';

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

  function kpi(dataSource: DataSource): AnyWidgetConfig {
    return { id: 'w', type: 'kpi', title: 'Consumption', col: 1, row: 1, colSpan: 1, rowSpan: 1, valueAttribute: '', dataSource } as AnyWidgetConfig;
  }

  function heatmap(dataSource: DataSource, timeWindow?: { value: number; unit: 'days' }): AnyWidgetConfig {
    return {
      id: 'h', type: 'heatmap', title: 'Load', col: 1, row: 1, colSpan: 2, rowSpan: 2, dataSource,
      dateField: 'timestamp', aggregation: 'count', colorScheme: 'green', ...(timeWindow && { timeWindow })
    } as unknown as AnyWidgetConfig;
  }

  function render(dataSourceOrWidget: DataSource | AnyWidgetConfig): void {
    const widget = 'dataSource' in dataSourceOrWidget ? dataSourceOrWidget : kpi(dataSourceOrWidget);
    fixture = TestBed.createComponent(TimeShiftCaptionComponent);
    fixture.componentRef.setInput('widget', widget);
    fixture.detectChanges();
  }

  function caption(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.time-shift-caption');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TimeShiftCaptionComponent],
      providers: [
        ...tooltipTestProviders(),
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
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)');
    });

    it('month, same period last year: "October 2025", tooltip names the shift', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(LAST_YEAR));

      expect(caption()?.textContent?.trim()).toBe('October 2025');
      expect(caption()?.getAttribute('aria-label')).toBe('Same period last year: 01.10.2025 - 31.10.2025 (Europe/Vienna)');
    });

    it('quarter: "Q4 2025"', () => {
      boardOn({ type: 'quarter', year: 2026, quarter: 1 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('Q4 2025');
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 01.10.2025 - 31.12.2025 (Europe/Vienna)');
    });

    it('year: "2025"', () => {
      boardOn({ type: 'year', year: 2026 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('2025');
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 01.01.2025 - 31.12.2025 (Europe/Vienna)');
    });

    it('day: the date', () => {
      boardOn({ type: 'day', year: 2026, month: 10, day: 10 });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('09.11.2026');
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 09.11.2026 (Europe/Vienna)');
    });

    it('custom range of 7 days: "03.11.2026 - 09.11.2026"', () => {
      boardOn({ type: 'custom', customFrom: '2026-11-10T00:00:00+01:00', customTo: '2026-11-16T00:00:00+01:00' } as TimeRangeSelection);
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('03.11.2026 - 09.11.2026');
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 03.11.2026 - 09.11.2026 (Europe/Vienna)');
    });

    it('custom range of whole days across the DST change: "22.03.2026 - 29.03.2026"', () => {
      boardOn({ type: 'custom', customFrom: '2026-03-30T00:00:00+02:00', customTo: '2026-04-06T00:00:00+02:00' } as TimeRangeSelection);
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.textContent?.trim()).toBe('22.03.2026 - 29.03.2026');
      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 22.03.2026 - 29.03.2026 (Europe/Vienna)');
    });

    it('relative "last 24 hours" at 09:17: the tooltip shows the exact range with its times, the caption dates only', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-11-16T09:17:00+01:00'));
        boardOn({ type: 'relative', relativeValue: 24, relativeUnit: 'hours' } as TimeRangeSelection);
        render(source(PREVIOUS_PERIOD));

        expect(caption()?.textContent?.trim()).toBe('14.11.2026 - 15.11.2026');
        expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 14.11.2026 09:17 - 15.11.2026 09:17 (Europe/Vienna)');
      } finally {
        vi.useRealTimers();
      }
    });

    it('custom range with a time of day: the tooltip shows both times', () => {
      state.updateTimeFilterConfig({
        enabled: true,
        selection: { type: 'custom', customFrom: '2026-11-10T08:30:00+01:00', customTo: '2026-11-10T17:45:00+01:00' } as TimeRangeSelection,
        pickerConfig: { showTime: true }
      });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 09.11.2026 23:15 - 10.11.2026 08:30 (Europe/Vienna)');
    });

    it('host period whose shifted end is a local midnight: the end stays the last day, the start shows its time', () => {
      boardOn({ type: 'month', year: 2026, month: 10 });
      state.setHostTimeRange({ status: 'valid', from: new Date('2026-11-11T00:00:00+01:00'), to: new Date('2026-11-12T12:00:00+01:00') });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 09.11.2026 12:00 - 10.11.2026 (Europe/Vienna)');
    });

    it('host period whose shifted start is a local midnight: the start stays a date, the end shows its time', () => {
      boardOn({ type: 'month', year: 2026, month: 10 });
      state.setHostTimeRange({ status: 'valid', from: new Date('2026-11-10T12:00:00+01:00'), to: new Date('2026-11-11T00:00:00+01:00') });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 10.11.2026 - 10.11.2026 12:00 (Europe/Vienna)');
    });

    it('board zone UTC: a bound 30 seconds after midnight is not a midnight and shows its time', () => {
      state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'utc' });
      boardOn({ type: 'month', year: 2026, month: 10 });
      state.setHostTimeRange({ status: 'valid', from: new Date('2026-11-11T00:00:30Z'), to: new Date('2026-11-12T00:00:30Z') });
      render(source(PREVIOUS_PERIOD));

      expect(caption()?.getAttribute('aria-label')).toBe('Previous period: 10.11.2026 00:00 - 11.11.2026 00:00 (UTC)');
    });

    it('names a shift of several periods: "3 periods back"', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source({ by: 'period', count: -3 }));

      expect(caption()?.textContent?.trim()).toBe('July 2026');
      expect(caption()?.getAttribute('aria-label')).toBe('3 periods back: 01.07.2026 - 31.07.2026 (Europe/Vienna)');
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

  describe('criterion 5 Visible shifted period: a heatmap with its own time window', () => {
    it('shows no caption, because its own window takes precedence over the board filter and the shift', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(heatmap(source(PREVIOUS_PERIOD), { value: 30, unit: 'days' }));

      expect(caption()).toBeNull();
    });

    it('without its own window shows the shifted period like any other widget', () => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(heatmap(source(PREVIOUS_PERIOD)));

      expect(caption()?.textContent?.trim()).toBe('September 2026');
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
      expect(caption()?.getAttribute('aria-label')).toContain('01.09.2026 - 30.09.2026');
    });
  });

  describe('styled tooltip', () => {
    const TOOLTIP = 'Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)';

    beforeEach(() => {
      boardOn({ type: 'month', year: 2026, month: 9 });
      render(source(PREVIOUS_PERIOD));
    });

    it('criterion 1: hovering the caption shows the shifted period in a Kendo tooltip, leaving hides it', () => {
      expect(tooltipText()).toBeNull();
      expect(hoverTooltip(fixture, caption()!)).toBe(TOOLTIP);
      leaveTooltip(fixture, caption()!);
      expect(tooltipText()).toBeNull();
    });

    it('criterion 1: the tooltip follows a change of the board time filter', () => {
      boardOn({ type: 'month', year: 2026, month: 3 });
      fixture.detectChanges();
      expect(hoverTooltip(fixture, caption()!)).toBe('Previous period: 01.03.2026 - 31.03.2026 (Europe/Vienna)');
    });

    it('criterion 3: the caption carries the tooltip text as its accessible name', () => {
      expect(caption()?.getAttribute('aria-label')).toBe(TOOLTIP);
      expect(caption()?.getAttribute('role')).toBe('note');
    });

    it('criterion 4: the caption has no native title, also while the tooltip is open', () => {
      expect(caption()?.hasAttribute('title')).toBe(false);
      hoverTooltip(fixture, caption()!);
      expect(caption()?.hasAttribute('title')).toBe(false);
      expect(openTooltips().length).toBe(1);
    });

    it('the caption shows that it has a tooltip: dotted underline and help cursor', () => {
      const style = getComputedStyle(caption()!);
      expect(style.cursor).toBe('help');
      expect(style.textDecoration).toContain('dotted');
    });

    it('criterion 2: the caption is in the tab order', () => {
      expect(caption()?.tabIndex).toBe(0);
      expect(caption()?.getAttribute('tabindex')).toBe('0');
    });

    it('criterion 2: keyboard focus shows the caption tooltip, blur hides it', () => {
      caption()!.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      expect(tooltipText()).toBe(TOOLTIP);
      caption()!.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
      expect(tooltipText()).toBeNull();
    });

    it('criterion 2: Escape hides the caption tooltip while the caption keeps focus', () => {
      caption()!.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      caption()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(tooltipText()).toBeNull();
    });

    it('criterion 1: the caption tooltip opens below the caption, so it does not cover the widget title', () => {
      hoverTooltip(fixture, caption()!);
      expect(tooltipSide()).toBe('bottom');
    });
  });
});
