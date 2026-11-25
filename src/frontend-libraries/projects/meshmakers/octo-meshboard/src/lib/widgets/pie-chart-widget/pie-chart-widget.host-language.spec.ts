import { TestBed } from '@angular/core/testing';
import { PieChartWidgetComponent } from './pie-chart-widget.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';

/** AB#9743 (F6): the slice values of a pie chart follow the number format of the host language. */
describe('PieChartWidgetComponent value format in the host language (AB#9743)', () => {
  function formatIn(language: string | undefined, value: number): string {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: {} },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: MeshBoardStateService, useValue: {} },
        { provide: MeshBoardVariableService, useValue: {} },
        ...(language ? [{ provide: MESHBOARD_LANGUAGE, useValue: language }] : [])
      ]
    });
    return TestBed.createComponent(PieChartWidgetComponent).componentInstance.formatValue(value);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses a decimal point for an English host and a decimal comma for a German one', () => {
    expect(formatIn('en', 0.15)).toBe('0.15');
    expect(formatIn('de-AT', 0.15)).toBe('0,15');
    expect(formatIn('en', 1234.5)).toBe('1,234.5');
  });

  it('keeps the de-AT format for a host without a language', () => {
    expect(formatIn(undefined, 0.15)).toBe('0,15');
  });

  it('falls back to the de-AT format for a malformed host locale instead of failing', () => {
    expect(formatIn('de AT', 0.15)).toBe('0,15');
  });
});
