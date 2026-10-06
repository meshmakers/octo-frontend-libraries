import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitUnregisteredPoolsDtoGQL } from '../../../graphQL/cockpitUnregisteredPools';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { AttentionFinding, AttentionProvider, nameList, plural } from '../attention.models';

const NAMES_FETCHED = 10;

/**
 * Pools no Communication Operator has registered for: their adapters and applications are not
 * rolled out. Needs what the pools page needs (CommunicationManagement + System.Communication).
 */
@Injectable()
export class UnregisteredPoolsAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly poolsGql = inject(CockpitUnregisteredPoolsDtoGQL);

  readonly id = 'pools-unregistered';
  readonly label = 'Pools not registered';
  readonly description = 'Pools without a connected Communication Operator. Viewers with CommunicationManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.CommunicationManagement], ['System.Communication']);
  }

  load(): Observable<AttentionFinding[]> {
    return this.poolsGql.fetch({ variables: { first: NAMES_FETCHED }, fetchPolicy: 'network-only' }).pipe(map(result => {
      const connection = result.data?.runtime?.systemCommunicationPool;
      const pools = (connection?.items ?? []).filter((pool): pool is NonNullable<typeof pool> => !!pool);
      const count = connection?.totalCount ?? pools.length;
      if (count === 0) {
        return [];
      }
      const single = count === 1 && pools.length === 1 ? pools[0] : null;
      if (single) {
        const name = single.name ?? String(single.rtId);
        return [{
          id: this.id,
          severity: 'warning',
          title: `Pool "${name}" is not registered`,
          text: 'No operator is connected. Adapters and applications in this pool are not rolled out.',
          links: [{ label: 'Open pool', target: { kind: 'pool', rtId: String(single.rtId) } }, { label: 'All pools', target: { kind: 'pools' } }],
          explain: { label: name, rtId: String(single.rtId), ckTypeId: 'System.Communication/Pool', prompt: `Why is the pool "${name}" not registered?` }
        }];
      }
      return [{
        id: this.id,
        severity: 'warning',
        title: `${plural(count, 'pool')} not registered`,
        text: `${nameList(pools.map(pool => pool.name ?? String(pool.rtId)), 3, count)}: no operator is connected, their adapters and applications are not rolled out.`,
        links: [{ label: 'Open pools', target: { kind: 'pools' } }],
        explain: { label: `${count} pools not registered`, prompt: `Why are ${count} pools not registered?` }
      }];
    }));
  }
}
