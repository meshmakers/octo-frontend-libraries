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
  if (doc?.documentElement && typeof getComputedStyle === 'function') {
    const style = getComputedStyle(doc.documentElement);
    for (const name of [`--theme-status-${status}`, `--kendo-color-${status}`]) {
      const value = style.getPropertyValue(name).trim();
      if (value) {
        return value;
      }
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
 * Calls `onChange` whenever the colour theme may have changed: `data-theme`, `class` or `style`
 * of `<html>` (the Studio ThemeService sets `data-theme`) or the OS colour scheme. Charts resolve
 * theme colours to concrete values, so they re-resolve on this signal. Returns the unsubscribe.
 */
export function observeThemeChanges(onChange: () => void, doc: Document | null = typeof document !== 'undefined' ? document : null): () => void {
  const cleanups: (() => void)[] = [];
  if (doc?.documentElement && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => onChange());
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    cleanups.push(() => observer.disconnect());
  }
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  if (media?.addEventListener) {
    const listener = (): void => onChange();
    media.addEventListener('change', listener);
    cleanups.push(() => media.removeEventListener('change', listener));
  }
  return () => cleanups.forEach(c => c());
}
