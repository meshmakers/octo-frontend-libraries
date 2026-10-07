import { BreadCrumbData } from '@meshmakers/shared-services';
import { ShellNavNode } from './shell-navigation.service';

/**
 * Host-specific crumb rewriting of {@link shellBreadcrumbs}. Hosts that migrated from a
 * section-based navigation use it to replace the old section crumb with the rail area.
 */
export interface ShellBreadcrumbOptions {
  /**
   * Lower-case labels of old section crumbs that routes still start with (e.g. `'identity'`).
   * Such a first crumb is replaced by the rail area the page lives in.
   */
  legacySectionCrumbs?: ReadonlySet<string>;
  /**
   * Area names of old section crumbs (lower-case key → area name), used when the page has no
   * active area: `{ communication: 'Integration' }` turns "Communication › Data Flows" into
   * "Integration › Data Flows".
   */
  legacySectionAreaNames?: Readonly<Record<string, string>>;
}

const NO_LEGACY_CRUMBS: ReadonlySet<string> = new Set();

/** A breadcrumb the shell added for the rail area; clicking it opens the area. */
export interface ShellAreaCrumb extends BreadCrumbData {
  areaId: string;
}

export function isAreaCrumb(item: unknown): item is ShellAreaCrumb {
  return !!item && typeof (item as ShellAreaCrumb).areaId === 'string';
}

/**
 * Breadcrumbs as the shell shows them (AB#5516): the first crumb names the rail area of the
 * page (route `data.space`), never a section of an old drawer navigation.
 *
 * - a legacy section crumb ({@link ShellBreadcrumbOptions.legacySectionCrumbs}) is replaced by the area crumb;
 * - a first crumb that already is the area ("Settings") stays as it is;
 * - otherwise the area crumb is put in front ("Data Explorer" → "Data › Data Explorer");
 * - the area crumb is dropped again when the next crumb carries the same label
 *   ("General › Settings" → "Settings", not "Settings › Settings").
 *
 * - crumbs without text are dropped (no empty segments).
 *
 * Pure: returns a new array and never mutates the items (the BreadCrumbService re-emits the
 * same objects after resolving `{{placeholders}}`).
 */
export function shellBreadcrumbs(
  allItems: readonly BreadCrumbData[],
  area: ShellNavNode | null,
  options: ShellBreadcrumbOptions = {}
): BreadCrumbData[] {
  const legacyCrumbs = options.legacySectionCrumbs ?? NO_LEGACY_CRUMBS;
  const legacyAreaNames = options.legacySectionAreaNames ?? {};
  // A crumb without text (e.g. an unresolved or empty `{{placeholder}}`) would render as an empty
  // segment ("Integration › › Mesh Adapter", visual check 2026-10-06) — drop it.
  const items = allItems.filter((item) => (item.text ?? '').trim().length > 0);
  if (items.length === 0) {
    return [];
  }
  if (!area) {
    const known = legacyAreaNames[(items[0].text ?? '').trim().toLowerCase()];
    return known ? [{ ...items[0], text: known, title: known, labelTemplate: known }, ...items.slice(1)] : [...items];
  }
  const areaLabel = area.text.trim().toLowerCase();
  const [first, ...rest] = items;
  const firstLabel = (first.text ?? '').trim().toLowerCase();
  if (firstLabel === areaLabel) {
    return [...items];
  }
  const tail = legacyCrumbs.has(firstLabel) ? rest : [...items];
  if ((tail[0]?.text ?? '').trim().toLowerCase() === areaLabel) {
    return tail;
  }
  const areaCrumb: ShellAreaCrumb = {
    text: area.text,
    title: area.text,
    svgIcon: area.svgIcon,
    labelTemplate: area.text,
    url: '',
    areaId: area.id
  };
  return [areaCrumb, ...tail];
}

/** "Integration › Adapters" — the description stored with a recent page. */
export function crumbPath(items: readonly BreadCrumbData[]): string | undefined {
  const texts = items.map(item => item.text?.trim()).filter((text): text is string => !!text);
  return texts.length > 0 ? texts.join(' › ') : undefined;
}
