import { Injectable, inject } from '@angular/core';
import { CkModelService, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import {
  COCKPIT_EXPLAIN_HANDLER,
  COCKPIT_LINK_RESOLVER,
  COCKPIT_VIEWER_ACCESS,
  CockpitExplainTarget,
  CockpitLinkQueryParams,
  CockpitLinkTarget,
  CockpitResolvedLink
} from './cockpit-host';

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

  /** Whether the viewer is a builder (`CockpitViewerAccess.isBuilder`); fails closed. */
  async isBuilder(): Promise<boolean> {
    try {
      return !!(await this.access?.isBuilder?.());
    } catch {
      return false;
    }
  }

  /**
   * Router URL of a link target, or `null` (no resolver, or the host has no such page). A `route`
   * target always resolves: the host's rewrite or its own path, with the query parameters
   * appended (`/acme/documents?checkTier=2`) — for `routerLink` prefer {@link resolveLinkTarget},
   * which keeps them apart.
   */
  resolveLink(target: CockpitLinkTarget, tenantId: string): string | null {
    const resolved = this.resolveLinkTarget(target, tenantId);
    if (!resolved) {
      return null;
    }
    const path = Array.isArray(resolved.path) ? joinCommands(resolved.path) : resolved.path as string;
    const query = queryString(resolved.queryParams);
    return query ? `${path}?${query}` : path;
  }

  /**
   * A link target resolved for `routerLink` + `queryParams` (AB#5622), or `null` when there is no
   * page for it. Semantic targets go through the host's `CockpitLinkResolver`; `route` targets
   * keep their path unless the resolver rewrites it, and always keep their query parameters.
   */
  resolveLinkTarget(target: CockpitLinkTarget, tenantId: string): CockpitResolvedLink | null {
    let url: string | null;
    try {
      url = this.links?.resolve(target, tenantId) ?? null;
    } catch {
      url = null;
    }
    if (target.kind !== 'route') {
      return url ? { path: url } : null;
    }
    if (url === null && !isInAppPath(target.path)) {
      // Route targets stay in the app: no scheme, no protocol-relative "//host" (open redirect).
      return null;
    }
    const path = url ?? (typeof target.path === 'string' ? target.path : [...target.path]);
    if (path.length === 0) {
      return null;
    }
    return target.queryParams && Object.keys(target.queryParams).length > 0 ? { path, queryParams: { ...target.queryParams } } : { path };
  }

  /** Whether "✦ Explain" buttons are shown. */
  get explainEnabled(): boolean {
    return !!this.explainHandler?.enabled;
  }

  explain(target: CockpitExplainTarget): void {
    this.explainHandler?.explain(target);
  }
}

/**
 * Whether a route target's own path stays in the app: no URL scheme (`https:`, `javascript:`) and
 * no protocol-relative start (`//host`, `/\\host`) once commands are joined.
 */
function isInAppPath(path: string | readonly string[]): boolean {
  const joined = (typeof path === 'string' ? path : joinCommands(path)).trim().replace(/\\/g, '/');
  return !/^[a-z][a-z0-9+.-]*:/i.test(joined) && !joined.startsWith('//');
}

/** `['/', 'acme', 'documents']` → `/acme/documents`; relative commands stay relative. */
function joinCommands(commands: readonly string[]): string {
  const [first, ...rest] = commands;
  if (first === '/') {
    return `/${rest.join('/')}`;
  }
  return commands.join('/');
}

function queryString(params: CockpitLinkQueryParams | undefined): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.append(key, String(value));
  }
  return search.toString();
}
