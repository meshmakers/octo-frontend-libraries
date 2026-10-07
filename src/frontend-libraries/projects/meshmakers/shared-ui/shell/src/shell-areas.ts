import { InjectionToken } from '@angular/core';

/**
 * Ids and keys shared by the host's command tree (`CommandSettingsService`), the rail,
 * the space shell and route data. One definition feeds all of them:
 *
 * - A rail area is a top-level command item with the id `area-<space>`.
 * - A tab is a direct child of an area with the id `<space>-<tab>`.
 * - Routes may carry `data: { space: '<space>', tab: '<tab>' }`; the shell uses
 *   it where the URL alone does not match a navigation entry.
 * - A top-level separator with the id {@link RAIL_BOTTOM_SEPARATOR_ID} moves the
 *   areas after it to the bottom of the rail (e.g. Settings).
 *
 * The space names themselves belong to the host (e.g. `'data' | 'integration' | …`).
 */
const AREA_ID_PREFIX = 'area-';

/** Id of the separator in front of the rail's bottom block (Settings). */
export const RAIL_BOTTOM_SEPARATOR_ID = 'rail-bottom';

export function areaId(space: string): string {
  return `${AREA_ID_PREFIX}${space}`;
}

/** The space of an area id (`area-data` → `data`), or null for any other id. */
export function spaceOfAreaId(id: string): string | null {
  return id.startsWith(AREA_ID_PREFIX) ? id.substring(AREA_ID_PREFIX.length) : null;
}

export function tabId(space: string, tab: string): string {
  return `${space}-${tab}`;
}

/**
 * The space whose pages use the settings side navigation (`mm-settings-side-nav`) instead
 * of the tab strip. Default `'settings'` (area id `area-settings`); provide `null` for a
 * host without a settings space.
 */
export const SHELL_SETTINGS_SPACE = new InjectionToken<string | null>('SHELL_SETTINGS_SPACE', {
  providedIn: 'root',
  factory: () => 'settings',
});
