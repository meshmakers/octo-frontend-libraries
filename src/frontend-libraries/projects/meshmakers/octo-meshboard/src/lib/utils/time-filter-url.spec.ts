import { applyQueryParams, applyTimeFilterParams, timeFilterQueryParams } from './time-filter-url';
import { TimeRangeSelection } from '../models/meshboard.models';

describe('timeFilterQueryParams', () => {
  it('serializes a relative selection and nulls all other tf params', () => {
    const params = timeFilterQueryParams({ type: 'relative', relativeValue: 24, relativeUnit: 'hours' } as TimeRangeSelection);
    expect(params['tf_type']).toBe('relative');
    expect(params['tf_rv']).toBe('24');
    expect(params['tf_ru']).toBe('hours');
    expect(params['tf_year']).toBeNull();
    expect(params['tf_day']).toBeNull();
  });

  it('serializes a day selection with hours', () => {
    const params = timeFilterQueryParams({ type: 'day', year: 2026, month: 6, day: 31, hourFrom: 8, hourTo: 17 } as TimeRangeSelection);
    expect(params['tf_type']).toBe('day');
    expect(params['tf_year']).toBe('2026');
    expect(params['tf_month']).toBe('6');
    expect(params['tf_day']).toBe('31');
    expect(params['tf_hf']).toBe('8');
    expect(params['tf_ht']).toBe('17');
    expect(params['tf_rv']).toBeNull();
  });
});

describe('applyTimeFilterParams', () => {
  const relative = { type: 'relative', relativeValue: 24, relativeUnit: 'hours' } as TimeRangeSelection;

  it('replaces existing tf params of another selection type', () => {
    expect(applyTimeFilterParams('/energyiq/ui/meshboards/board-1?tf_type=day&tf_year=2026&tf_month=6&tf_day=31', relative))
      .toBe('/energyiq/ui/meshboards/board-1?tf_type=relative&tf_rv=24&tf_ru=hours');
  });

  it('adds tf params to a URL without a query string', () => {
    expect(applyTimeFilterParams('/energyiq/ui/meshboards/board-1', relative))
      .toBe('/energyiq/ui/meshboards/board-1?tf_type=relative&tf_rv=24&tf_ru=hours');
  });

  it('preserves non-tf query params', () => {
    const result = applyTimeFilterParams('/tenant/ui/meshboards/board-1?es_mp=rt-123&tf_type=year&tf_year=2025', relative);
    expect(result).toContain('es_mp=rt-123');
    expect(result).toContain('tf_type=relative');
    expect(result).not.toContain('tf_year');
  });

  it('returns the URL unchanged when no selection is given', () => {
    const url = '/tenant/ui/meshboards/board-1?tf_type=year&tf_year=2026';
    expect(applyTimeFilterParams(url, null)).toBe(url);
    expect(applyTimeFilterParams(url, undefined)).toBe(url);
  });
});

describe('applyQueryParams', () => {
  it('sets string values, removes null values, keeps unmentioned params', () => {
    expect(applyQueryParams('/tenant/ui/meshboards/board-1?es_mp=rt-1&es_old=rt-2&tf_type=year', {
      es_mp: 'rt-9',
      es_old: null
    })).toBe('/tenant/ui/meshboards/board-1?es_mp=rt-9&tf_type=year');
  });

  it('drops the query string entirely when all params are removed', () => {
    expect(applyQueryParams('/tenant/ui/meshboards/board-1?es_mp=rt-1', { es_mp: null }))
      .toBe('/tenant/ui/meshboards/board-1');
  });

  it('is identity for an empty params object', () => {
    const url = '/tenant/ui/meshboards/board-1?es_mp=rt-1';
    expect(applyQueryParams(url, {})).toBe(url);
  });
});
