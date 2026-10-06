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

const STATUS_BY_KEY: Record<string, CategoryStatus> = {
  available: 'success', online: 'success', ok: 'success', success: 'success', succeeded: 'success', completed: 'success',
  deployed: 'success', configured: 'success', running: 'success', active: 'success', healthy: 'success',
  resolvefailed: 'error', error: 'error', failed: 'error', faulted: 'error', critical: 'error', unhealthy: 'error',
  pending: 'warning', warning: 'warning', degraded: 'warning', unregistered: 'warning', deploying: 'warning',
  hibernated: 'info',
};

/** Status of a well-known state category (case and separators ignored), else null. */
export function categoryStatus(category: string): CategoryStatus | null {
  return STATUS_BY_KEY[category.replace(/[\s_-]/g, '').toLowerCase()] ?? null;
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
