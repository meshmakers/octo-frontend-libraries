/**
 * Category helpers of the MeshBoard charts (visual check #15 of the Studio rebuild): enum-style
 * categories such as `RESOLVE_FAILED` read as "Resolve failed", well-known state categories get
 * status colours (a failed state must never be drawn in the success/accent colour), and a legend
 * beside a narrow chart moves below it so the plot keeps its size.
 */

/** `RESOLVE_FAILED` / `ResolveFailed` → `Resolve failed`; other text is returned unchanged. */
export function humanizeCategory(category: string): string {
  const text = category.trim();
  const enumConstant = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$|^[A-Z]{2,}$/.test(text);
  const pascal = /^[A-Z][a-z0-9]+([A-Z][a-z0-9]+)+$/.test(text);
  if (!enumConstant && !pascal) {
    return category;
  }
  const words = text
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type CategoryStatus = 'success' | 'warning' | 'error' | 'info';

/**
 * THE status table of well-known state names (CK enum option names, query categories), keys
 * normalised (lower case, no separators). Shared by the MeshBoard charts and the Refinery Studio
 * Data Explorer enum chips, so a state reads the same everywhere.
 */
export const STATE_STATUS_BY_KEY: Readonly<Record<string, CategoryStatus>> = {
  available: 'success', online: 'success', ok: 'success', success: 'success', succeeded: 'success', completed: 'success',
  deployed: 'success', configured: 'success', running: 'success', active: 'success', healthy: 'success', enabled: 'success',
  resolvefailed: 'error', error: 'error', failed: 'error', faulted: 'error', critical: 'error', unhealthy: 'error',
  pending: 'warning', warning: 'warning', degraded: 'warning', unregistered: 'warning', deploying: 'warning',
  waking: 'warning', draining: 'warning',
  hibernated: 'info',
};

/** Status of a well-known state category (case and separators ignored), else null. */
export function categoryStatus(category: string): CategoryStatus | null {
  return STATE_STATUS_BY_KEY[category.replace(/[\s_-]/g, '').toLowerCase()] ?? null;
}

const FALLBACK_COLORS: Record<CategoryStatus, string> = {
  success: '#2fb37a',
  warning: '#e0a43a',
  error: '#e5484d',
  info: '#3b9eff',
};

/**
 * The theme colour of a status for an SVG chart. Charts need a concrete colour, so the host's
 * `--theme-status-<status>` (Studio Deep Sea tokens), then `--kendo-color-<status>` are read from
 * the document; a fixed colour is the last resort (and the value in environments without CSS).
 */
export function statusColor(status: CategoryStatus, doc: Document | null = typeof document !== 'undefined' ? document : null): string {
  return statusColorFrom(status, computedRootStyle(doc));
}

function computedRootStyle(doc: Document | null): CSSStyleDeclaration | null {
  return doc?.documentElement && typeof getComputedStyle === 'function' ? getComputedStyle(doc.documentElement) : null;
}

function statusColorFrom(status: CategoryStatus, style: CSSStyleDeclaration | null): string {
  for (const name of [`--theme-status-${status}`, `--kendo-color-${status}`]) {
    const value = style?.getPropertyValue(name).trim();
    if (value) {
      return value;
    }
  }
  return FALLBACK_COLORS[status];
}

/** Below this width a legend configured beside the chart moves below it. */
export const NARROW_CHART_WIDTH = 420;

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

/** `right` / `left` become `bottom` on a narrow widget (`width` 0 = not measured yet: unchanged). */
export function responsiveLegendPosition(configured: LegendPosition | undefined, width: number, fallback: LegendPosition = 'right'): LegendPosition {
  const position = configured ?? fallback;
  return width > 0 && width < NARROW_CHART_WIDTH && (position === 'left' || position === 'right') ? 'bottom' : position;
}

/**
 * What the charts' resolved colours depend on: the `data-theme` attribute, the OS colour scheme
 * and the resolved status colours. `class` / `style` of `<html>` are deliberately not part of it —
 * popups, tooltips and scroll locks mutate them without changing the theme (AB#5568).
 */
export function themeSignature(doc: Document | null = typeof document !== 'undefined' ? document : null): string {
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  // One style computation per signature (it runs on every <html> mutation).
  const style = computedRootStyle(doc);
  const colors = (['success', 'warning', 'error', 'info'] as CategoryStatus[]).map(status => statusColorFrom(status, style)).join(',');
  return `${doc?.documentElement?.getAttribute('data-theme') ?? ''}|${dark ? 'dark' : 'light'}|${colors}`;
}

/**
 * Calls `onChange` when the colour theme really changed: `<html>` `data-theme`, `class` or
 * `style` mutated (the Studio ThemeService sets `data-theme`) or the OS colour scheme switched,
 * **and** the theme signature (`themeSignature`) differs from the last one. Hovering a chart
 * opens tooltips / popups that mutate `<html>`; reacting to every mutation made the pie redraw
 * endlessly (AB#5568). Returns the unsubscribe.
 */
export function observeThemeChanges(onChange: () => void, doc: Document | null = typeof document !== 'undefined' ? document : null): () => void {
  const cleanups: (() => void)[] = [];
  let last = themeSignature(doc);
  const check = (): void => {
    const next = themeSignature(doc);
    if (next !== last) {
      last = next;
      onChange();
    }
  };
  if (doc?.documentElement && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(check);
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    cleanups.push(() => observer.disconnect());
  }
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  if (media?.addEventListener) {
    media.addEventListener('change', check);
    cleanups.push(() => media.removeEventListener('change', check));
  }
  return () => cleanups.forEach(c => c());
}

/** A chart data item as the pie / donut binds it. */
export interface ChartColorItem {
  category: string;
  value: number;
  color?: string;
}

/**
 * Equality of chart data arrays by category, value and colour — used as the `equal` of the data
 * `computed`, so a re-evaluation with the same values keeps the array reference and Kendo does
 * not re-animate the series (AB#5568).
 */
export function sameChartItems(a: readonly ChartColorItem[], b: readonly ChartColorItem[]): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item.category === b[i].category && item.value === b[i].value && item.color === b[i].color));
}
