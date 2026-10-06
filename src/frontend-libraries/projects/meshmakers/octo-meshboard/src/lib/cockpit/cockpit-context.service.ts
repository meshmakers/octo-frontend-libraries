import { Injectable, inject } from '@angular/core';
import { CkModelService, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { COCKPIT_EXPLAIN_HANDLER, COCKPIT_LINK_RESOLVER, COCKPIT_VIEWER_ACCESS, CockpitExplainTarget, CockpitLinkTarget } from './cockpit-host';

/**
 * The cockpit widgets' view of their host (AB#5558): tenant, roles, CK models, links and the
 * assistant. Every check fails closed — a missing host token, a failing role or model lookup
 * means "not allowed", so a provider is skipped rather than shown to the wrong viewer.
 */
@Injectable({ providedIn: 'root' })
export class CockpitContextService {
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });
  private readonly access = inject(COCKPIT_VIEWER_ACCESS, { optional: true });
  private readonly links = inject(COCKPIT_LINK_RESOLVER, { optional: true });
  private readonly explainHandler = inject(COCKPIT_EXPLAIN_HANDLER, { optional: true });
  private readonly ckModelService = inject(CkModelService);

  /** The current tenant, or `null` when the host provides none. */
  async tenantId(): Promise<string | null> {
    try {
      return (await this.tenantIdProvider?.()) ?? null;
    } catch {
      return null;
    }
  }

  /** True when the viewer has every role and the tenant has every CK model. */
  async allows(roles: readonly string[], models: readonly string[] = []): Promise<boolean> {
    try {
      for (const role of roles) {
        if (!this.access || !(await this.access.isInRole(role))) {
          return false;
        }
      }
      for (const model of models) {
        if (!(await this.ckModelService.isModelAvailable(model))) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Router URL of a link target, or `null` (no resolver, or the host has no such page). */
  resolveLink(target: CockpitLinkTarget, tenantId: string): string | null {
    try {
      return this.links?.resolve(target, tenantId) ?? null;
    } catch {
      return null;
    }
  }

  /** Whether "✦ Explain" buttons are shown. */
  get explainEnabled(): boolean {
    return !!this.explainHandler?.enabled;
  }

  explain(target: CockpitExplainTarget): void {
    this.explainHandler?.explain(target);
  }
}
