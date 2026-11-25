import { formatBoardDate, formatInstant, formatTableCellValue } from './meshboard-datetime';
import { formatWidgetNumber } from './widget-data-utils';
import { DEFAULT_MESHBOARD_MESSAGES, resolveMeshBoardMessages } from './meshboard-messages';
import { timeShiftName } from './time-shift-caption';

/**
 * AB#9743 (F6, F20): numbers and dates of the widgets follow the host language; without one they stay
 * in the former de-AT format, so hosts that set no language see no change.
 */
describe('widget formats in the host language (AB#9743)', () => {
  it('formats a number with a decimal point for an English host and a decimal comma for a German one', () => {
    expect(formatWidgetNumber(0.15, 2, 'exact', 'en')).toBe('0.15');
    expect(formatWidgetNumber(0.15, 2, 'exact', 'de-AT')).toBe('0,15');
  });

  it('keeps the de-AT number format when the host names no language', () => {
    expect(formatWidgetNumber(0.15, 2, 'exact')).toBe('0,15');
    expect(formatWidgetNumber(0.15, 2, 'exact', null)).toBe('0,15');
  });

  it('formats a table date-time cell in the English format for an English host', () => {
    const cell = '2026-09-28T10:45:30Z';

    expect(formatTableCellValue(cell, 'Europe/Vienna', 'en')).toBe('09/28/2026 12:45:30 PM');
    expect(formatTableCellValue(cell, 'Europe/Vienna', 'de-AT')).toBe('28.09.2026 12:45:30');
    expect(formatTableCellValue(cell, 'Europe/Vienna')).toBe('28.09.2026 12:45:30');
  });

  it('formats board dates and instants in the host locale', () => {
    const instant = new Date('2026-10-01T08:00:00Z');

    expect(formatBoardDate(instant, 'Europe/Vienna', 'en')).toBe('10/01/2026');
    expect(formatInstant(instant, 'Europe/Vienna', { day: '2-digit', month: '2-digit' }, 'de-AT')).toBe('01.10.');
  });
});

describe('time shift names from the host messages (AB#9743, F9)', () => {
  const german = { timeShiftPreviousPeriod: 'Vorperiode', timeShiftSamePeriodLastYear: 'Vorjahreszeitraum',
    timeShiftPeriodsBack: '{count} Perioden zurück', timeShiftYearsBack: '{count} Jahre zurück' };

  it('names every kind of shift in the host language', () => {
    expect(timeShiftName({ by: 'period', count: -1 }, german)).toBe('Vorperiode');
    expect(timeShiftName({ by: 'year', count: -1 }, german)).toBe('Vorjahreszeitraum');
    expect(timeShiftName({ by: 'period', count: -3 }, german)).toBe('3 Perioden zurück');
    expect(timeShiftName({ by: 'year', count: -2 }, german)).toBe('2 Jahre zurück');
  });

  it('keeps the English names without host messages', () => {
    expect(timeShiftName({ by: 'period', count: -3 })).toBe('3 periods back');
    expect(timeShiftName({ by: 'year', count: -1 })).toBe('Same period last year');
  });

  it('lets a host replace every new text and keeps the default for a member it leaves out', () => {
    const resolved = resolveMeshBoardMessages({ noDataAvailable: 'Keine Daten vorhanden', refreshAllWidgets: 'Alle aktualisieren' });

    expect(resolved.noDataAvailable).toBe('Keine Daten vorhanden');
    expect(resolved.refreshAllWidgets).toBe('Alle aktualisieren');
    expect(resolved.loading).toBe(DEFAULT_MESHBOARD_MESSAGES.loading);
  });
});
