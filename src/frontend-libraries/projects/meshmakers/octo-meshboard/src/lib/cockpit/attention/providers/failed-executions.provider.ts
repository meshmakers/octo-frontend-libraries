import { InjectionToken, Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CockpitContextService } from '../../cockpit-context.service';
import { COCKPIT_ROLES } from '../../cockpit-host';
import { COCKPIT_WIDGET_MESSAGES, formatCockpitMessage as fmt, readCockpitMessagesSource, resolveCockpitWidgetMessages } from '../../cockpit-messages';
import { CockpitDataFlowExecutionsService, countFlowExecutions } from '../../data/cockpit-data-flow-executions.service';
import { formatCount } from '../../kpi/cockpit-kpi';
import { AttentionContext, AttentionFinding, AttentionProvider } from '../attention.models';

/** Thresholds of the "Failed pipeline executions" check (AB#5622). */
export interface FailedExecutionsAttentionOptions {
  /** Failed executions in the last 24 h from which a finding is shown (warning). Default: 10 */
  minFailed: number;
  /** Failed executions from which the finding is an error. `null` = never by count. Default: 1000 */
  errorFailed: number | null;
  /**
   * Share of failed executions (0–1, of all executions in 24 h) from which the finding is an error,
   * once `minFailed` is reached. `null` = never by ratio. Default: 0.2 (20 %)
   */
  errorRatio: number | null;
}

/** Defaults: a warning from 10 failures, an error from 1,000 failures or a failure share of 20 %. */
export const DEFAULT_FAILED_EXECUTIONS_OPTIONS: Readonly<FailedExecutionsAttentionOptions> = { minFailed: 10, errorFailed: 1000, errorRatio: 0.2 };

/**
 * Optional: the host's thresholds of the "Failed pipeline executions" check; missing members keep
 * {@link DEFAULT_FAILED_EXECUTIONS_OPTIONS}.
 */
export const COCKPIT_FAILED_EXECUTIONS_OPTIONS = new InjectionToken<Partial<FailedExecutionsAttentionOptions>>('COCKPIT_FAILED_EXECUTIONS_OPTIONS');

/** The finding's severity for the counts, or `null` when the counts stay below the thresholds. */
export function failedExecutionsSeverity(failed: number, total: number, options: FailedExecutionsAttentionOptions): 'error' | 'warning' | null {
  if (failed <= 0 || failed < Math.max(1, options.minFailed)) {
    return null;
  }
  const byCount = options.errorFailed !== null && failed >= options.errorFailed;
  const byRatio = options.errorRatio !== null && total > 0 && failed / total >= options.errorRatio;
  return byCount || byRatio ? 'error' : 'warning';
}

/**
 * Failed pipeline executions in the last 24 hours above a threshold (AB#5622): the same data and
 * counting as the "Pipeline executions 24 h" KPI, whose request it shares
 * (`CockpitDataFlowExecutionsService`). Texts from `COCKPIT_WIDGET_MESSAGES`, thresholds from
 * `COCKPIT_FAILED_EXECUTIONS_OPTIONS`. Needs what the Data Flows page needs.
 */
@Injectable()
export class FailedExecutionsAttentionProvider implements AttentionProvider {
  private readonly context = inject(CockpitContextService);
  private readonly executions = inject(CockpitDataFlowExecutionsService);
  private readonly messagesSource = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });
  private readonly options: FailedExecutionsAttentionOptions = {
    ...DEFAULT_FAILED_EXECUTIONS_OPTIONS,
    ...withoutUndefined(inject(COCKPIT_FAILED_EXECUTIONS_OPTIONS, { optional: true }))
  };

  readonly id = 'pipeline-executions-failed';
  readonly label = 'Failed pipeline executions';
  readonly description = 'Pipeline executions that failed in the last 24 hours, above a threshold. Viewers with CommunicationManagement.';

  isVisible(): Promise<boolean> {
    return this.context.allows([COCKPIT_ROLES.CommunicationManagement], ['System.Communication']);
  }

  load(context: AttentionContext): Observable<AttentionFinding[]> {
    return this.executions.executions(context.tenantId).pipe(map(({ flows, totalCount }) => {
      const { succeeded, failed } = countFlowExecutions(flows);
      const total = succeeded + failed;
      const severity = failedExecutionsSeverity(failed, total, this.options);
      if (!severity) {
        return [];
      }
      const m = resolveCockpitWidgetMessages(readCockpitMessagesSource(this.messagesSource));
      const n = (value: number) => formatCount(value, m.numberLocale);
      const texts = [fmt(m.attentionFailedExecutionsText, { failed: n(failed), total: n(total), ratio: formatRatio(failed / total, m.numberLocale) })];
      if (totalCount > flows.length) {
        texts.push(fmt(m.attentionFailedExecutionsTruncated, { read: n(flows.length), total: n(totalCount) }));
      }
      const title = m.attentionFailedExecutionsTitle;
      return [{
        id: this.id,
        severity,
        title,
        text: texts.join(' '),
        count: failed,
        // The Data Flows list has no "failed only" filter; it shows the 24 h counts per flow.
        links: [{ label: m.attentionFailedExecutionsLink, target: { kind: 'dataFlows' } }],
        explain: { label: `${title}: ${n(failed)}`, prompt: fmt(m.attentionFailedExecutionsExplain, { count: n(failed) }) }
      }];
    }));
  }
}

function withoutUndefined<T extends object>(value: Partial<T> | null): Partial<T> {
  return value ? Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined)) as Partial<T> : {};
}

function formatRatio(ratio: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
  }
}
