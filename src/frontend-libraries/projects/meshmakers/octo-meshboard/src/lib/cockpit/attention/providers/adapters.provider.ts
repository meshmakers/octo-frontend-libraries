import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { ADAPTER_OFFLINE_GRACE_MS, adaptersInError, adaptersOffline, CockpitAdapterState, CockpitAdapterStatesService } from '../../data/cockpit-adapter-states.service';
import { AttentionContext, AttentionFinding, AttentionLink, AttentionProvider, countLabel, nameList } from '../attention.models';

/**
 * Adapters in error (deployment or configuration failed) and adapters expected to run that stayed
 * offline (Helm-deployed and edge/local alike). One query (shared with the "Adapter status" KPI),
 * up to two findings; capped reads say "≥". Needs what the adapters page needs.
 */
@Injectable()
export class AdaptersAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly adapterStates = inject(CockpitAdapterStatesService);

  readonly id = 'adapters';
  readonly label = 'Adapters in error or offline';
  readonly description = 'Failed deployments or configurations, and adapters offline for more than 10 minutes. Viewers with CommunicationManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.CommunicationManagement], ['System.Communication']);
  }

  load(context: AttentionContext): Observable<AttentionFinding[]> {
    return this.adapterStates.states(context.tenantId).pipe(map(({ states, totalCount }) => {
      const truncated = totalCount > states.length;
      const findings: AttentionFinding[] = [];
      const failed = adaptersInError(states);
      if (failed.length > 0) {
        findings.push({
          id: `${this.id}:error`,
          severity: 'error',
          title: `${countLabel(failed.length, 'adapter', truncated)} in error`,
          text: `${nameList(failed.map(nameOf))}: the deployment or configuration failed. The adapter detail shows the last error.`,
          links: links(failed),
          explain: explainTarget(failed, 'in error')
        });
      }
      const failedIds = new Set(failed.map(state => state.rtId));
      const offline = adaptersOffline(states, Date.now()).filter(state => !failedIds.has(state.rtId));
      if (offline.length > 0) {
        findings.push({
          id: `${this.id}:offline`,
          severity: 'warning',
          title: `${countLabel(offline.length, 'adapter', truncated)} offline`,
          text: `${nameList(offline.map(nameOf))}: expected to run, but not online for more than ${ADAPTER_OFFLINE_GRACE_MS / 60_000} minutes.`,
          links: links(offline),
          explain: explainTarget(offline, 'offline')
        });
      }
      return findings;
    }));
  }
}

function nameOf(state: CockpitAdapterState): string {
  return state.name || String(state.rtId);
}

function links(states: CockpitAdapterState[]): AttentionLink[] {
  return states.length === 1
    ? [{ label: 'Open adapter', target: { kind: 'adapter', rtId: String(states[0].rtId) } }, { label: 'All adapters', target: { kind: 'adapters' } }]
    : [{ label: 'Open adapters', target: { kind: 'adapters' } }];
}

function explainTarget(states: CockpitAdapterState[], what: string): AttentionFinding['explain'] {
  if (states.length === 1) {
    const name = nameOf(states[0]);
    return { label: name, rtId: String(states[0].rtId), ckTypeId: 'System.Communication/Adapter', prompt: `Why is the adapter "${name}" ${what}?` };
  }
  return { label: `${states.length} adapters ${what}`, prompt: `Why are ${states.length} adapters ${what}?` };
}
