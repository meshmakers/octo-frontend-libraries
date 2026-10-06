import { Injectable, inject } from '@angular/core';
import { combineLatest, defer, from, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap, take } from 'rxjs/operators';
import { AttentionContext, AttentionFinding, AttentionProvider, COCKPIT_ATTENTION_PROVIDERS, sortAttentionFindings } from './attention.models';

/** Name and description of a registered provider (for the config dialog). */
export interface AttentionProviderInfo {
  id: string;
  label: string;
  description: string;
}

/** What the attention list shows while and after its providers run. */
export interface AttentionState {
  /** Findings so far, sorted error → warning → info. */
  findings: AttentionFinding[];
  /** True while a visible provider has not answered yet. */
  loading: boolean;
  /** Providers the viewer may see (0: nothing can be checked for this viewer). */
  visibleProviders: number;
}

type ProviderRun = { status: 'pending' } | { status: 'hidden' } | { status: 'done'; findings: AttentionFinding[] };

/**
 * Runs the attention providers (AB#5558, from the Home cockpit of AB#5545). Each provider is
 * checked for visibility first (roles / CK models), then loaded once; providers run in parallel
 * and their findings stream in, sorted by severity. A failing provider only removes its own
 * findings.
 */
@Injectable({ providedIn: 'root' })
export class CockpitAttentionService {
  private readonly providers = inject(COCKPIT_ATTENTION_PROVIDERS, { optional: true }) ?? [];

  /** Every registered provider, in registration order. */
  availableProviders(): AttentionProviderInfo[] {
    return this.providers.map(({ id, label, description }) => ({ id, label, description }));
  }

  /**
   * Runs the providers named in `providerIds` (all when empty / undefined; unknown ids are
   * ignored, so a board saved with a provider the host no longer has still loads).
   */
  state(context: AttentionContext, providerIds?: readonly string[] | null): Observable<AttentionState> {
    const selected = selectProviders(this.providers, providerIds);
    if (selected.length === 0) {
      return of({ findings: [], loading: false, visibleProviders: 0 });
    }
    const runs = selected.map(provider => this.run(provider, context).pipe(startWith<ProviderRun>({ status: 'pending' })));
    return combineLatest(runs).pipe(map(toState));
  }

  /** Findings only (the Home fallback strip). */
  findings(context: AttentionContext, providerIds?: readonly string[] | null): Observable<AttentionFinding[]> {
    return this.state(context, providerIds).pipe(map(state => state.findings));
  }

  private run(provider: AttentionProvider, context: AttentionContext): Observable<ProviderRun> {
    return defer(() => from(provider.isVisible(context))).pipe(
      switchMap(visible => visible
        ? provider.load(context).pipe(take(1), map((findings): ProviderRun => ({ status: 'done', findings })))
        : of<ProviderRun>({ status: 'hidden' })),
      catchError(error => {
        console.warn(`Cockpit: attention provider '${provider.id}' failed`, error);
        return of<ProviderRun>({ status: 'done', findings: [] });
      })
    );
  }
}

/** The providers a widget runs: all when `ids` is empty, else the named ones in registration order. */
export function selectProviders(providers: readonly AttentionProvider[], ids?: readonly string[] | null): AttentionProvider[] {
  if (!ids || ids.length === 0) {
    return [...providers];
  }
  const wanted = new Set(ids);
  return providers.filter(provider => wanted.has(provider.id));
}

function toState(runs: ProviderRun[]): AttentionState {
  const findings: AttentionFinding[] = [];
  let loading = false;
  let visibleProviders = 0;
  for (const run of runs) {
    if (run.status === 'hidden') {
      continue;
    }
    visibleProviders++;
    if (run.status === 'pending') {
      loading = true;
    } else {
      findings.push(...run.findings);
    }
  }
  return { findings: sortAttentionFindings(findings), loading, visibleProviders };
}
