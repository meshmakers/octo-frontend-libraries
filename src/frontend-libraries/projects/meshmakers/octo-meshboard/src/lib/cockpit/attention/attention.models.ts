import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CockpitExplainTarget, CockpitLinkTarget } from '../cockpit-host';

/** Severity of a finding; drives the colour bar and the status chip. */
export type AttentionSeverity = 'error' | 'warning' | 'info';

/** Order of the findings: errors first. */
export const ATTENTION_SEVERITY_ORDER: Record<AttentionSeverity, number> = { error: 0, warning: 1, info: 2 };

/** A link chip on a finding: label plus a semantic target the host resolves (`CockpitLinkResolver`). */
export interface AttentionLink {
  label: string;
  target: CockpitLinkTarget;
}

/**
 * One rule-based health finding (ui-concept §5.5 phase 1): severity, one line, an explanation and
 * links to the affected objects. A finding never claims more than its provider's single query
 * showed.
 */
export interface AttentionFinding {
  /** Stable id, `<provider id>` or `<provider id>:<sub-key>`. */
  id: string;
  severity: AttentionSeverity;
  title: string;
  text: string;
  /**
   * How many objects the finding is about (AB#5622), shown as a badge next to the title — e.g. the
   * open items of a work queue. Omitted = no badge (the built-in providers name the count in the
   * title instead).
   */
  count?: number;
  links: AttentionLink[];
  /** What "✦ Explain" hands to the host's assistant (only shown when the host enables it). */
  explain?: CockpitExplainTarget;
}

/** What every provider receives. */
export interface AttentionContext {
  tenantId: string;
}

/**
 * A source of findings for the "Attention list" widget. Contract:
 *
 * - `isVisible` checks what the viewer needs to **open** what the finding links to (roles, CK
 *   models) via `CockpitContextService.allows`; a provider that is not visible is never loaded,
 *   so viewers only see findings about objects they may see.
 * - `load` runs exactly **one** query (GraphQL or REST) and emits the findings once; an empty
 *   array means "nothing to report" (no placeholder findings).
 * - Errors are swallowed by `CockpitAttentionService` (logged, provider skipped).
 *
 * Library providers cover the generic platform checks; a host adds its own with
 * `{ provide: COCKPIT_ATTENTION_PROVIDERS, useClass: MyProvider, multi: true }`.
 */
export interface AttentionProvider {
  /** Stable id, persisted in the widget config (`providerIds`). Never rename. */
  readonly id: string;
  /** Name in the widget's config dialog. */
  readonly label: string;
  /** One line in the config dialog: what is checked and who sees it. */
  readonly description: string;
  isVisible(context: AttentionContext): Promise<boolean>;
  load(context: AttentionContext): Observable<AttentionFinding[]>;
}

/** Multi provider token of the attention sources (built-in ones come with `provideCockpitWidgets()`). */
export const COCKPIT_ATTENTION_PROVIDERS = new InjectionToken<AttentionProvider[]>('COCKPIT_ATTENTION_PROVIDERS');

/** Sorts findings by severity, keeping the provider order within one severity. */
export function sortAttentionFindings(findings: AttentionFinding[]): AttentionFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => ATTENTION_SEVERITY_ORDER[a.finding.severity] - ATTENTION_SEVERITY_ORDER[b.finding.severity] || a.index - b.index)
    .map(entry => entry.finding);
}

/**
 * "pool-a, pool-b and 3 more" — names of the affected objects, capped at `max`; `total` counts
 * objects whose names were not fetched.
 */
export function nameList(names: string[], max = 3, total = names.length): string {
  const shown = names.slice(0, max);
  const rest = Math.max(total, names.length) - shown.length;
  if (rest > 0) {
    return `${shown.join(', ')} and ${rest} more`;
  }
  if (shown.length <= 1) {
    return shown.join('');
  }
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/** "1 pool" / "3 pools". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "3 adapters", or "≥ 3 adapters" when the count comes from a capped read. */
export function countLabel(count: number, singular: string, atLeast = false, pluralForm = `${singular}s`): string {
  return `${atLeast ? '≥ ' : ''}${plural(count, singular, pluralForm)}`;
}
