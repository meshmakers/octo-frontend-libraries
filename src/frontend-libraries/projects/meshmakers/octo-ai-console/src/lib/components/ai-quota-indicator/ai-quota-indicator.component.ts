import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Two-bar usage indicator (daily + monthly) with threshold colour state.
 * Inputs are unit-agnostic counts and caps; the component does not parse the
 * tenant's `AiQuotaLimit` itself — the host is expected to feed numbers the
 * adapter already aggregated.
 */
@Component({
  selector: 'mm-ai-quota-indicator',
  imports: [],
  templateUrl: './ai-quota-indicator.component.html',
  styleUrl: './ai-quota-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiQuotaIndicatorComponent {
  readonly dailyConsumed = input.required<number>();
  readonly dailyCap = input.required<number>();
  readonly monthlyConsumed = input<number | null>(null);
  readonly monthlyCap = input<number | null>(null);

  protected readonly dailyPercent = computed(() =>
    this.percent(this.dailyConsumed(), this.dailyCap()),
  );
  protected readonly monthlyPercent = computed(() => {
    const consumed = this.monthlyConsumed();
    const cap = this.monthlyCap();
    if (consumed == null || cap == null) {
      return null;
    }
    return this.percent(consumed, cap);
  });

  protected readonly dailyState = computed(() => this.toState(this.dailyPercent()));
  protected readonly monthlyState = computed(() => {
    const pct = this.monthlyPercent();
    return pct == null ? null : this.toState(pct);
  });

  private percent(consumed: number, cap: number): number {
    if (cap <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((consumed / cap) * 100));
  }

  private toState(percent: number): 'ok' | 'warning' | 'critical' {
    if (percent >= 100) {
      return 'critical';
    }
    if (percent >= 80) {
      return 'warning';
    }
    return 'ok';
  }
}
