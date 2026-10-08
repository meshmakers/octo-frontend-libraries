import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_WIDGET_MESSAGES, formatCockpitMessage as fmt, readCockpitMessagesSource, resolveCockpitWidgetMessages } from '../../cockpit-messages';
import { CockpitServiceHealthService } from '../../data/cockpit-service-health.service';
import { serviceStateText } from '../../kpi/cockpit-kpi';
import { AttentionContext, AttentionFinding, AttentionProvider } from '../attention.models';

/**
 * Platform services whose health check is not Healthy (system cockpit, AB#5558): one finding per
 * service — unhealthy or not answering is an error, degraded a warning — linking to the service's
 * health details. The services serve the whole installation, so the check runs on the system
 * tenant only (tenant cockpits are unchanged). Shares its requests with the "Services healthy" KPI.
 */
@Injectable()
export class ServicesHealthAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  /** Resolved on first load: hosts and tests that never run the check need no data providers. */
  private readonly injector = inject(Injector);
  private readonly messagesSource = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });

  readonly id = 'services-unhealthy';
  readonly label = 'Platform services with problems';
  readonly description = 'Identity, Asset Repository, Bot or Communication Controller not healthy. System tenant only.';

  async isVisible(context: AttentionContext): Promise<boolean> {
    return this.context.isSystemTenant(context.tenantId) && await this.context.allows([]);
  }

  load(): Observable<AttentionFinding[]> {
    return this.injector.get(CockpitServiceHealthService).services().pipe(map(services => {
      const m = resolveCockpitWidgetMessages(readCockpitMessagesSource(this.messagesSource));
      return services
        .filter(service => service.status !== 'healthy')
        .map((service): AttentionFinding => {
          const state = serviceStateText(service.status, m);
          const title = fmt(m.attentionServiceTitle, { name: service.name, state });
          return {
            id: `${this.id}:${service.service}`,
            severity: service.status === 'degraded' ? 'warning' : 'error',
            title,
            text: service.status === 'unknown' ? m.attentionServiceUnreachableText : m.attentionServiceText,
            links: [{ label: m.attentionServiceLink, target: { kind: 'serviceHealth', service: service.service } }],
            explain: { label: title, prompt: fmt(m.attentionServiceExplain, { name: service.name, state }) }
          };
        });
    }));
  }
}
