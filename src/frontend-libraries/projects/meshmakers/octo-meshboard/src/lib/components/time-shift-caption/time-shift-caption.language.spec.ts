import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, MeshBoardTimeShift } from '../../models/meshboard.models';
import { MESHBOARD_MESSAGES, MeshBoardMessages } from '../../utils/meshboard-messages';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';
import { TimeShiftCaptionComponent } from './time-shift-caption.component';

/**
 * AB#9743 (F9, F12): caption and tooltip of a shifted widget in the host language. The German texts are
 * what the energy-community app hands over; month and date follow the host locale.
 */
describe('TimeShiftCaptionComponent in the host language (AB#9743)', () => {
  const GERMAN: MeshBoardMessages = {
    timeShiftPreviousPeriod: 'Vorperiode',
    timeShiftSamePeriodLastYear: 'Vorjahreszeitraum',
    timeShiftPeriodsBack: '{count} Perioden zurück',
    timeShiftYearsBack: '{count} Jahre zurück'
  };

  let fixture: ComponentFixture<TimeShiftCaptionComponent>;

  function render(shift: MeshBoardTimeShift, providers: unknown[]): HTMLElement | null {
    TestBed.configureTestingModule({
      imports: [TimeShiftCaptionComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        ...(providers as never[])
      ]
    });
    const state = TestBed.inject(MeshBoardStateService);
    state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'Europe/Vienna' });
    state.updateTimeFilterConfig({ enabled: true, selection: { type: 'month', year: 2026, month: 10 } });
    const widget = {
      id: 'w', type: 'kpi', title: 'Verbrauch', col: 1, row: 1, colSpan: 1, rowSpan: 1, valueAttribute: '',
      dataSource: { type: 'persistentQuery', queryRtId: 'q', queryFamily: 'streamData', timeShift: shift }
    } as AnyWidgetConfig;
    fixture = TestBed.createComponent(TimeShiftCaptionComponent);
    fixture.componentRef.setInput('widget', widget);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.time-shift-caption');
  }

  afterEach(() => TestBed.resetTestingModule());

  it('German host: month name and shift name in German', () => {
    const caption = render({ by: 'period', count: -1 }, [
      { provide: MESHBOARD_MESSAGES, useValue: GERMAN },
      { provide: MESHBOARD_LANGUAGE, useValue: 'de-AT' }
    ]);

    expect(caption?.textContent?.trim()).toBe('Oktober 2026');
    expect(caption?.getAttribute('title')).toBe('Vorperiode: 01.10.2026 - 31.10.2026 (Europe/Vienna)');
  });

  it('German host: several years back with the count in the German text', () => {
    const caption = render({ by: 'year', count: -2 }, [
      { provide: MESHBOARD_MESSAGES, useValue: GERMAN },
      { provide: MESHBOARD_LANGUAGE, useValue: 'de-AT' }
    ]);

    expect(caption?.textContent?.trim()).toBe('November 2024');
    expect(caption?.getAttribute('title')).toBe('2 Jahre zurück: 01.11.2024 - 30.11.2024 (Europe/Vienna)');
  });

  it('English host: English month and dates in the English format', () => {
    const caption = render({ by: 'period', count: -1 }, [{ provide: MESHBOARD_LANGUAGE, useValue: 'en' }]);

    expect(caption?.textContent?.trim()).toBe('October 2026');
    expect(caption?.getAttribute('title')).toBe('Previous period: 10/01/2026 - 10/31/2026 (Europe/Vienna)');
  });

  it('host without a language keeps the former texts', () => {
    const caption = render({ by: 'period', count: -1 }, []);

    expect(caption?.textContent?.trim()).toBe('October 2026');
    expect(caption?.getAttribute('title')).toBe('Previous period: 01.10.2026 - 31.10.2026 (Europe/Vienna)');
  });
});
