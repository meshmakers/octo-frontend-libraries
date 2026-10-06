import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { CockpitCkModelStatesService } from '../../data/cockpit-ck-model-states.service';
import { AttentionContext, AttentionFinding, AttentionProvider, nameList, plural } from '../attention.models';

/**
 * CK models in `ResolveFailed`: their data is intact, but their types are not served (typically
 * after a dependency such as System was bumped). Links to the model libraries, so it needs the
 * same role as that page (AdminPanelManagement). Shares its query with the "CK model state" KPI.
 */
@Injectable()
export class CkModelsResolveFailedAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly ckModelStates = inject(CockpitCkModelStatesService);

  readonly id = 'ck-models-resolve-failed';
  readonly label = 'CK models in ResolveFailed';
  readonly description = 'Construction Kit models whose types are not served. Viewers with AdminPanelManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.AdminPanelManagement]);
  }

  load(context: AttentionContext): Observable<AttentionFinding[]> {
    return this.ckModelStates.counts(context.tenantId).pipe(map(({ resolveFailed: count, resolveFailedNames: names }) => {
      if (count === 0) {
        return [];
      }
      return [{
        id: this.id,
        severity: 'error',
        title: `${plural(count, 'CK model')} in ResolveFailed`,
        text: `${nameList(names, 3, count)}. The data is intact, but the types are not served until the dependencies resolve.`,
        links: [{ label: 'Open Model Libraries', target: { kind: 'ckModels' } }],
        explain: { label: `${plural(count, 'CK model')} in ResolveFailed`, prompt: `Why ${count === 1 ? 'is 1 CK model' : `are ${count} CK models`} in ResolveFailed?` }
      }];
    }));
  }
}
