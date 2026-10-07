import type {ComponentFixture} from '@angular/core/testing';

/** Options of {@link expectIconButtonsAccessible} / {@link findInaccessibleIconButtons}. */
export interface IconButtonA11yOptions {
  /**
   * Also require a tooltip (`title`) next to the accessible name — the Studio action guideline
   * (§2.2) wants both: tooltip = label for sighted users, `aria-label` = label + target. Default `true`.
   */
  requireTooltip?: boolean;
  /** CSS selector of elements to skip (e.g. third-party widgets the spec does not own). */
  ignore?: string;
  /**
   * Also check Kendo's widget-internal buttons (dropdown arrows, spinners, pager selects — named by
   * Kendo with `aria-label` only, not in the host's hands). Default `false`.
   */
  includeKendoInternals?: boolean;
}

/** Kendo widget-internal buttons (not authored by the host template). */
const KENDO_INTERNAL_SELECTOR = '.k-input-button, .k-spinner-increase, .k-spinner-decrease, .k-clear-value, .k-pager-nav, .k-pager-numbers button';

/** Elements that act as buttons. */
const BUTTON_SELECTOR = 'button, a.k-button, [role="button"]';
/** Icon content of a button. */
const ICON_SELECTOR = 'svg, kendo-svgicon, kendo-svg-icon, kendo-icon, .k-icon, .k-svg-icon';

type Root = ComponentFixture<unknown> | Element | Document;

function rootElement(root: Root): ParentNode {
  if (root instanceof Element || (typeof Document !== 'undefined' && root instanceof Document)) {
    return root;
  }
  const fixture = root as ComponentFixture<unknown>;
  fixture.detectChanges();
  return fixture.nativeElement as Element;
}

/** Visible text of a button (without visually hidden helper text such as disabled reasons). */
function visibleText(button: Element): string {
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function accessibleName(button: Element): string {
  const label = button.getAttribute('aria-label')?.trim();
  if (label) return label;
  const labelledBy = button.getAttribute('aria-labelledby');
  if (labelledBy) {
    const scope = button.getRootNode() as ParentNode;
    return labelledBy.split(/\s+/)
      .map((id) => (button.ownerDocument.getElementById(id) ?? scope.querySelector?.(`[id="${id}"]`))?.textContent?.trim() ?? '')
      .join(' ').trim();
  }
  return '';
}

function describe(button: Element): string {
  const html = button.outerHTML.replace(/\s+/g, ' ');
  return html.length > 160 ? `${html.slice(0, 157)}...` : html;
}

/**
 * Icon-only buttons (an icon, no visible text) that miss an accessible name (`aria-label` /
 * `aria-labelledby`) or — unless `requireTooltip: false` — a tooltip (`title`). Returns one
 * message per offending button.
 */
export function findInaccessibleIconButtons(root: Root, options: IconButtonA11yOptions = {}): string[] {
  const requireTooltip = options.requireTooltip ?? true;
  const problems: string[] = [];
  for (const button of Array.from(rootElement(root).querySelectorAll(BUTTON_SELECTOR))) {
    if (options.ignore && button.closest(options.ignore)) continue;
    if (!options.includeKendoInternals && button.matches(KENDO_INTERNAL_SELECTOR)) continue;
    if (!button.querySelector(ICON_SELECTOR) || visibleText(button) !== '') continue;
    const missing: string[] = [];
    if (!accessibleName(button)) missing.push('aria-label');
    if (requireTooltip && !button.getAttribute('title')?.trim()) missing.push('title/tooltip');
    if (missing.length) {
      problems.push(`icon-only button without ${missing.join(' and ')}: ${describe(button)}`);
    }
  }
  return problems;
}

/**
 * Fails (throws) when the rendered fixture / element contains an icon-only button without an
 * accessible name and a tooltip (Studio action guideline §2.2, AB#5581). Runs `detectChanges()`
 * on a fixture first.
 *
 * ```ts
 * import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
 *
 * it('names every icon-only button', () => {
 *   expectIconButtonsAccessible(fixture);
 * });
 * ```
 */
export function expectIconButtonsAccessible(root: Root, options: IconButtonA11yOptions = {}): void {
  const problems = findInaccessibleIconButtons(root, options);
  if (problems.length) {
    throw new Error(`${problems.length} inaccessible icon-only button(s):\n- ${problems.join('\n- ')}`);
  }
}
