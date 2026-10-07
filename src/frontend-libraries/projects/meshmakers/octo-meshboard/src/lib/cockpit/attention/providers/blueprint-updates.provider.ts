import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES, formatCockpitMessage as fmt, readCockpitMessagesSource, resolveCockpitWidgetMessages } from '../../cockpit-messages';
import { CockpitBlueprintStatusService, CockpitBlueprintUpdate } from '../../data/cockpit-blueprint-status.service';
import { AttentionContext, AttentionFinding, AttentionProvider, nameList } from '../attention.models';

/** "Name 1.0.0 → 1.1.0". */
function describe(update: CockpitBlueprintUpdate): string {
  return `${update.name} ${update.installedVersion} → ${update.availableVersion}`;
}

/**
 * Installed blueprints with a newer catalog version (system cockpit, AB#5558): one info finding
 * with the count as badge, linking to the installed blueprints. Service-managed blueprints
 * (`System.*`) are named separately — their service applies them. Runs on the system tenant only
 * for now (it reads the catalogs, so tenant cockpits do not pay for it); same role as the
 * Blueprints pages. Shares its request with the "Blueprint updates" KPI.
 */
@Injectable()
export class BlueprintUpdatesAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  /** Resolved on first load: hosts and tests that never run the check need no data providers. */
  private readonly injector = inject(Injector);
  private readonly messagesSource = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });

  readonly id = 'blueprint-updates';
  readonly label = 'Blueprint updates available';
  readonly description = 'Installed blueprints with a newer version in the catalogs. System tenant, viewers with AdminPanelManagement.';

  async isVisible(context: AttentionContext): Promise<boolean> {
    return this.context.isSystemTenant(context.tenantId) && await this.context.allows([COCKPIT_ROLES.AdminPanelManagement]);
  }

  load(context: AttentionContext): Observable<AttentionFinding[]> {
    return this.injector.get(CockpitBlueprintStatusService).status(context.tenantId).pipe(map(status => {
      if (status.updates.length === 0) {
        return [];
      }
      const m = resolveCockpitWidgetMessages(readCockpitMessagesSource(this.messagesSource));
      const own = status.updates.filter(update => !update.isServiceManaged);
      const managed = status.updates.filter(update => update.isServiceManaged);
      const texts: string[] = [];
      if (own.length > 0) {
        texts.push(fmt(m.attentionBlueprintUpdatesText, { list: nameList(own.map(describe)) }));
      }
      if (managed.length > 0) {
        texts.push(fmt(m.attentionBlueprintUpdatesServiceManaged, { list: nameList(managed.map(describe)) }));
      }
      const title = m.attentionBlueprintUpdatesTitle;
      return [{
        id: this.id,
        severity: 'info',
        title,
        text: texts.join(' '),
        count: status.updates.length,
        links: [{ label: m.attentionBlueprintUpdatesLink, target: { kind: 'blueprints' } }]
      }];
    }));
  }
}
