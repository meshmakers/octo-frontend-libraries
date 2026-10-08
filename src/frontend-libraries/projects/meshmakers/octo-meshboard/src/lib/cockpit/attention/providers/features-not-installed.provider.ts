import { Injectable, inject } from '@angular/core';
import { AssetRepoService, CONFIGURATION_SERVICE, TenantFeaturesStatus } from '@meshmakers/octo-services';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { AttentionContext, AttentionFinding, AttentionProvider } from '../attention.models';

/**
 * An unconfigured optional service is an empty URL; older platform-services answered `/` (same
 * rule as the Studio's Tenant Features panel).
 */
export function isServiceConfigured(url: string | undefined | null): boolean {
  return !!url && url !== '/';
}

/** Capabilities switched on for the tenant whose service is not part of this installation. */
export function enabledButNotInstalled(
  status: TenantFeaturesStatus | null,
  config: { reportingServices?: string | null; aiServices?: string | null } | undefined
): string[] {
  if (!status) {
    return [];
  }
  const names: string[] = [];
  if (status.reporting?.tenantEnabled && !isServiceConfigured(config?.reportingServices)) {
    names.push('Reporting');
  }
  if (status.aiServices?.tenantEnabled && !isServiceConfigured(config?.aiServices)) {
    names.push('AI Services');
  }
  if (status.streamData?.tenantEnabled && status.streamData.instanceEnabled === false) {
    names.push('Stream Data');
  }
  return names;
}

/**
 * A capability enabled for the tenant whose service is not installed: the tenant delete/detach
 * guard keeps refusing (AB#4255). One REST call — the aggregate feature status (AB#4884). Links
 * to the tenant settings, so it needs TenantManagement.
 */
@Injectable()
export class FeaturesNotInstalledAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly assetRepoService = inject(AssetRepoService);
  private readonly configurationService = inject(CONFIGURATION_SERVICE, { optional: true });

  readonly id = 'features-not-installed';
  readonly label = 'Features enabled but not installed';
  readonly description = 'Reporting, AI Services or Stream Data enabled for the tenant without the service. Viewers with TenantManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.TenantManagement]);
  }

  load(context: AttentionContext): Observable<AttentionFinding[]> {
    return from(this.assetRepoService.getTenantFeaturesStatus(context.tenantId)).pipe(map(status => {
      const names = enabledButNotInstalled(status, this.configurationService?.config);
      if (names.length === 0) {
        return [];
      }
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      return [{
        id: this.id,
        severity: 'info',
        title: `${list} enabled, but not installed`,
        text: 'The tenant cannot be deleted or detached while a capability is enabled whose service is not installed.',
        links: [{ label: 'Open tenant settings', target: { kind: 'tenantSettings' } }]
      }];
    }));
  }
}
