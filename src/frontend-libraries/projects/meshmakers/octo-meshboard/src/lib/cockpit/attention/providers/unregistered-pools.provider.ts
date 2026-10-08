import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitUnregisteredPoolsDtoGQL } from '../../../graphQL/cockpitUnregisteredPools';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { AttentionFinding, AttentionProvider, nameList, plural } from '../attention.models';

const NAMES_FETCHED = 10;

/**
 * Deployment sites (`System.Communication/DeploymentSite`, called "pools" before
 * System.Communication 4.x) no Communication Operator has registered for: the adapters and
 * applications they host are not rolled out. Needs what the deployment sites page needs
 * (CommunicationManagement + System.Communication).
 *
 * The class name and the provider id `pools-unregistered` keep the pre-4.x wording on purpose:
 * the id is persisted in attention-list widget configs (`providerIds`) and must never change
 * (AB#5842).
 */
@Injectable()
export class UnregisteredPoolsAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly sitesGql = inject(CockpitUnregisteredPoolsDtoGQL);

  /** Persisted in widget configs — stable since AB#5558, deliberately not renamed in AB#5842. */
  readonly id = 'pools-unregistered';
  readonly label = 'Deployment sites not registered';
  readonly description = 'Deployment sites without a connected Communication Operator. Viewers with CommunicationManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.CommunicationManagement], ['System.Communication']);
  }

  load(): Observable<AttentionFinding[]> {
    return this.sitesGql.fetch({ variables: { first: NAMES_FETCHED }, fetchPolicy: 'network-only' }).pipe(map(result => {
      const connection = result.data?.runtime?.systemCommunicationDeploymentSite;
      const sites = (connection?.items ?? []).filter((site): site is NonNullable<typeof site> => !!site);
      const count = connection?.totalCount ?? sites.length;
      if (count === 0) {
        return [];
      }
      const single = count === 1 && sites.length === 1 ? sites[0] : null;
      if (single) {
        const name = single.name ?? String(single.rtId);
        return [{
          id: this.id,
          severity: 'warning',
          title: `Deployment site "${name}" is not registered`,
          text: 'No operator is connected. Adapters and applications on this deployment site are not rolled out.',
          links: [
            { label: 'Open deployment site', target: { kind: 'deployment-site', rtId: String(single.rtId) } },
            { label: 'All deployment sites', target: { kind: 'deployment-sites' } }
          ],
          explain: {
            label: name,
            rtId: String(single.rtId),
            ckTypeId: 'System.Communication/DeploymentSite',
            prompt: `Why is the deployment site "${name}" not registered?`
          }
        }];
      }
      return [{
        id: this.id,
        severity: 'warning',
        title: `${plural(count, 'deployment site')} not registered`,
        text: `${nameList(sites.map(site => site.name ?? String(site.rtId)), 3, count)}: no operator is connected, their adapters and applications are not rolled out.`,
        links: [{ label: 'Open deployment sites', target: { kind: 'deployment-sites' } }],
        explain: { label: `${count} deployment sites not registered`, prompt: `Why are ${count} deployment sites not registered?` }
      }];
    }));
  }
}
