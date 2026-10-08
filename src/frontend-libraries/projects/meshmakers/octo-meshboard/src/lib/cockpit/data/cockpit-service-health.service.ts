import { Injectable, inject } from '@angular/core';
import { CONFIGURATION_SERVICE, HealthCheck, HealthService, HealthStatus } from '@meshmakers/octo-services';
import { defer, from, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

/** Platform services the cockpit checks (the keys of the Studio's `health/:serviceType` page). */
export type CockpitServiceKey = 'identity' | 'asset-repository' | 'bot' | 'communication-controller';

/** Health of one platform service. `unknown`: the health endpoint did not answer. */
export type CockpitServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface CockpitServiceHealth {
  service: CockpitServiceKey;
  /** English display name ("Identity"). */
  name: string;
  status: CockpitServiceHealthStatus;
}

/** Display names, in check order. */
export const COCKPIT_SERVICE_NAMES: Readonly<Record<CockpitServiceKey, string>> = {
  identity: 'Identity',
  'asset-repository': 'Asset Repository',
  bot: 'Bot',
  'communication-controller': 'Communication Controller'
};

const SHARE_MS = 10_000;

/** `HealthCheck` → status (`null` = no answer). */
export function toServiceHealthStatus(check: HealthCheck | null | undefined): CockpitServiceHealthStatus {
  switch (check?.status) {
    case HealthStatus.Healthy:
      return 'healthy';
    case HealthStatus.Degraded:
      return 'degraded';
    case HealthStatus.Unhealthy:
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

/**
 * Health of the platform services (AB#5558, system cockpit): the same `/health` endpoints as the
 * MeshBoard's service health tiles, all at once, shared for a few seconds between the "Services"
 * KPI and the attention check. Optional services that are not part of the installation (empty
 * URL, or `/` from older platform-services) are left out.
 */
@Injectable({ providedIn: 'root' })
export class CockpitServiceHealthService {
  private readonly health = inject(HealthService);
  private readonly configuration = inject(CONFIGURATION_SERVICE, { optional: true });
  private shared: { at: number; result: Observable<CockpitServiceHealth[]> } | null = null;

  services(now = Date.now()): Observable<CockpitServiceHealth[]> {
    if (this.shared && now - this.shared.at <= SHARE_MS) {
      return this.shared.result;
    }
    const result = defer(() => from(this.check())).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.shared = { at: now, result };
    return result;
  }

  private async check(): Promise<CockpitServiceHealth[]> {
    const config = this.configuration?.config;
    const checks: [CockpitServiceKey, () => Promise<HealthCheck | null>][] = [
      ['identity', () => this.health.getIdentityServiceAsync()],
      ['asset-repository', () => this.health.getAssetRepoServiceHealthAsync()],
      ['bot', () => this.health.getBotServiceAsync()]
    ];
    if (!config || isConfigured(config.communicationServices)) {
      checks.push(['communication-controller', () => this.health.getCommunicationControllerServiceAsync()]);
    }
    return Promise.all(checks.map(async ([service, read]) => {
      let check: HealthCheck | null;
      try {
        check = await read();
      } catch {
        check = null;
      }
      return { service, name: COCKPIT_SERVICE_NAMES[service], status: toServiceHealthStatus(check) };
    }));
  }
}

function isConfigured(url: string | null | undefined): boolean {
  return !!url && url !== '/';
}
