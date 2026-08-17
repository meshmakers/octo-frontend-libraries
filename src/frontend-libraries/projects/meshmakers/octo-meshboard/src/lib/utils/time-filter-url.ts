import { TimeRangeSelection } from '../models/meshboard.models';

/**
 * Pure helpers for representing the active time-filter selection in the URL.
 *
 * The URL is written from two sides — the board-switch rtId sync and the
 * time-range picker — and two concurrent Router navigations supersede each
 * other (the later one wins, computed from the pre-navigation route, silently
 * dropping the rtId path change). Both writers therefore serialize the tf_*
 * params through these helpers onto one target URL string and navigate once.
 */

/** All tf_* query params; params not used by the selection type are null (= removed). */
export function timeFilterQueryParams(selection: TimeRangeSelection): Record<string, string | null> {
  const params: Record<string, string | null> = {
    tf_type: selection.type,
    tf_year: null,
    tf_quarter: null,
    tf_month: null,
    tf_day: null,
    tf_hf: null,
    tf_ht: null,
    tf_rv: null,
    tf_ru: null,
    tf_from: null,
    tf_to: null
  };

  switch (selection.type) {
    case 'year':
      if (selection.year != null) params['tf_year'] = selection.year.toString();
      break;
    case 'quarter':
      if (selection.year != null) params['tf_year'] = selection.year.toString();
      if (selection.quarter != null) params['tf_quarter'] = selection.quarter.toString();
      break;
    case 'month':
      if (selection.year != null) params['tf_year'] = selection.year.toString();
      if (selection.month != null) params['tf_month'] = selection.month.toString();
      break;
    case 'day':
      if (selection.year != null) params['tf_year'] = selection.year.toString();
      if (selection.month != null) params['tf_month'] = selection.month.toString();
      if (selection.day != null) params['tf_day'] = selection.day.toString();
      if (selection.hourFrom != null) params['tf_hf'] = selection.hourFrom.toString();
      if (selection.hourTo != null) params['tf_ht'] = selection.hourTo.toString();
      break;
    case 'relative':
      if (selection.relativeValue != null) params['tf_rv'] = selection.relativeValue.toString();
      if (selection.relativeUnit) params['tf_ru'] = selection.relativeUnit;
      break;
    case 'custom':
      if (selection.customFrom) params['tf_from'] = selection.customFrom;
      if (selection.customTo) params['tf_to'] = selection.customTo;
      break;
  }

  return params;
}

/**
 * Returns `url` with the given query params merged in: string values are set,
 * null values are removed, params not mentioned are preserved.
 */
export function applyQueryParams(url: string, params: Record<string, string | null>): string {
  const [pathPart, queryPart] = url.split('?');
  const search = new URLSearchParams(queryPart ?? '');
  for (const [key, value] of Object.entries(params)) {
    if (value === null) {
      search.delete(key);
    } else {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `${pathPart}?${query}` : pathPart;
}

/**
 * Returns `url` with its tf_* query params replaced by the given selection's.
 * Non-tf params (es_*, …) are preserved. `selection` null/undefined returns
 * the url unchanged.
 */
export function applyTimeFilterParams(url: string, selection: TimeRangeSelection | null | undefined): string {
  if (!selection) {
    return url;
  }
  return applyQueryParams(url, timeFilterQueryParams(selection));
}
