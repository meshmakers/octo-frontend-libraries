import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthorizeService } from './authorize.service';
import { allowedTenantsFromToken, tenantIdFromToken } from './jwt-claims';
import {
  KnownTenantTopology,
  TenantTopologyNode,
  TenantTopologyResult,
  TenantTopologyUnknownReason,
  UnknownTenantTopology,
  unknownTopology
} from './tenant-topology';

export interface TenantTopologyLoadOptions {
  /** Bypass the session cache and ask identity again. */
  readonly refresh?: boolean;
}

/** What identity accepts as a tenant id: at most 64 ASCII letters, digits, `-` or `_`. */
const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const REQUEST_TIMEOUT_MS = 10_000;
const LOG_PREFIX = 'TenantTopologyService';

/**
 * Asks identity which of the signed-in user's tenants lie below an app's root tenant (AB#7053,
 * contract AB#7044): `GET {issuer}/api/tenant-topology?scope={scope}`.
 *
 * Rules (see the shared-auth README):
 * - {@link load} never throws and never rejects; every failure is a `topologyKnown: false` result.
 * - Exactly one request to that one endpoint. No retry, no other URL, no GraphQL. An app that
 *   receives an unknown result uses its token tenant only and calls no other tenant.
 * - The URL is built from `AuthorizeService.issuer()` only. The request bypasses the HTTP
 *   interceptors on purpose (`HttpBackend`): the bearer is attached explicitly to this request, so a
 *   host need not list the identity URL in `wellKnownServiceUris`, the header is never duplicated, and
 *   no interceptor refresh or retry can send a second request.
 */
@Injectable({ providedIn: 'root' })
export class TenantTopologyService {
  private readonly authorizeService = inject(AuthorizeService);
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly cache = new Map<string, KnownTenantTopology | UnknownTenantTopology>();
  private readonly inFlight = new Map<string, Promise<TenantTopologyResult>>();
  /** Bumped on sign-out; a response that started in an older generation is not stored. */
  private generation = 0;

  constructor() {
    let wasAuthenticated = false;
    effect(() => {
      const authenticated = this.authorizeService.isAuthenticated();
      if (wasAuthenticated && !authenticated) {
        this.clearCache();
      }
      wasAuthenticated = authenticated;
    });
  }

  /**
   * Loads the topology below `scope` (the app's root tenant). Never throws, never rejects.
   *
   * Successful results and `identity-too-old` are cached for the session per scope (case-insensitive)
   * and per token tenant + `allowed_tenants`; concurrent calls share one request. Other unknown
   * results are not cached.
   */
  load(scope: string, options?: TenantTopologyLoadOptions): Promise<TenantTopologyResult> {
    try {
      return this.loadCore(scope, options?.refresh === true);
    } catch {
      return Promise.resolve(unknownTopology('not-configured'));
    }
  }

  /** Drops all cached results (sign-out does this automatically). */
  clearCache(): void {
    this.generation++;
    this.cache.clear();
    this.inFlight.clear();
  }

  private loadCore(scope: string, refresh: boolean): Promise<TenantTopologyResult> {
    const issuer = (this.authorizeService.issuer() ?? '').trim().replace(/\/+$/, '');
    const token = this.authorizeService.getAccessTokenSync();
    if (!/^https?:\/\/[^\s/?#]+/i.test(issuer) || !token) {
      return Promise.resolve(unknownTopology('not-configured'));
    }
    if (typeof scope !== 'string' || !TENANT_ID_PATTERN.test(scope)) {
      return Promise.resolve(unknownTopology('not-configured'));
    }

    const key = this.cacheKey(scope, token);
    if (refresh) {
      this.cache.delete(key);
    } else {
      const cached = this.cache.get(key);
      if (cached) {
        return Promise.resolve(cached);
      }
      const pending = this.inFlight.get(key);
      if (pending) {
        return pending;
      }
    }

    const generation = this.generation;
    const request = this.fetch(issuer, scope, token).then((result) => {
      if (this.inFlight.get(key) === request) {
        this.inFlight.delete(key);
      }
      if (generation === this.generation && this.isCacheable(result)) {
        this.cache.set(key, result);
      }
      return result;
    });
    this.inFlight.set(key, request);
    return request;
  }

  private async fetch(issuer: string, scope: string, token: string): Promise<TenantTopologyResult> {
    try {
      const response = await firstValueFrom(
        this.http
          .get<unknown>(`${issuer}/api/tenant-topology`, {
            params: { scope },
            headers: { Authorization: `Bearer ${token}` },
            observe: 'response'
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS))
      );
      // An identity older than AB#7044 answers unknown /api paths with its SPA fallback: 200 text/html.
      if (isNonJsonContentType(response.headers.get('Content-Type'))) {
        return this.unknown('identity-too-old', scope, response.status);
      }
      const parsed = parseResponse(response.body, scope);
      if (!parsed) {
        return this.unknown('invalid-response', scope);
      }
      return parsed;
    } catch (error) {
      // Only the status leaves this block: the HttpErrorResponse carries URL, headers and body.
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      // A 2xx that the HttpClient could not parse as JSON: html means an old identity, anything else is malformed.
      if (error instanceof HttpErrorResponse && status >= 200 && status < 300) {
        return this.unknown(
          isNonJsonContentType(error.headers.get('Content-Type')) ? 'identity-too-old' : 'invalid-response',
          scope,
          status
        );
      }
      return this.unknown(reasonForStatus(status), scope, status);
    }
  }

  private unknown(reason: TenantTopologyUnknownReason, scope: string, status?: number): UnknownTenantTopology {
    console.debug(`${LOG_PREFIX}: topology of scope "${scope}" is unknown (${reason}${status ? `, HTTP ${status}` : ''})`);
    return unknownTopology(reason);
  }

  private isCacheable(result: TenantTopologyResult): boolean {
    return result.topologyKnown || result.reason === 'identity-too-old';
  }

  private cacheKey(scope: string, token: string): string {
    const tenant = (tenantIdFromToken(token) ?? '').toLowerCase();
    const allowed = [...new Set(allowedTenantsFromToken(token).map((t) => t.toLowerCase()))].sort();
    return JSON.stringify([scope.toLowerCase(), tenant, allowed]);
  }
}

/** True when a content type is present and is not JSON (`application/json`, `application/problem+json`, ...). */
function isNonJsonContentType(contentType: string | null): boolean {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return type !== '' && type !== 'application/json' && !type.endsWith('+json');
}

function reasonForStatus(status: number): TenantTopologyUnknownReason {
  switch (status) {
    case 400:
      return 'not-configured';
    case 401:
    case 403:
      return 'unauthorized';
    case 404:
      return 'identity-too-old';
    case 429:
      return 'rate-limited';
    case 503:
      return 'hierarchy-unreadable';
    default:
      // 0 (transport error, CORS, timeout), 502, 504 and other 5xx are transient; any other
      // status is not part of the contract.
      return status === 0 || status >= 500 ? 'network' : 'invalid-response';
  }
}

/** Validates the body against the contract and copies exactly the known fields; null when it does not fit. */
function parseResponse(body: unknown, requestedScope: string): KnownTenantTopology | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const { scope, scopeHasChildren, tenants } = body as Record<string, unknown>;
  if (typeof scope !== 'string' || scope.toLowerCase() !== requestedScope.toLowerCase()) {
    return null;
  }
  if (typeof scopeHasChildren !== 'boolean' || !Array.isArray(tenants)) {
    return null;
  }
  const nodes: TenantTopologyNode[] = [];
  for (const entry of tenants as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }
    const { tenantId, depth, hasChildren } = entry as Record<string, unknown>;
    if (
      typeof tenantId !== 'string' ||
      tenantId.length === 0 ||
      typeof depth !== 'number' ||
      !Number.isInteger(depth) ||
      depth < 1 ||
      typeof hasChildren !== 'boolean'
    ) {
      return null;
    }
    nodes.push({ tenantId, depth, hasChildren });
  }
  return { topologyKnown: true, scope, scopeHasChildren, tenants: nodes };
}
