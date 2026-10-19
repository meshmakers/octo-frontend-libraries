import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { LoaderComponent } from '@progress/kendo-angular-indicators';
import { injectMmT, NotificationDisplayService } from '@meshmakers/shared-ui';
import { NotificationSubscriptionDetail, NotificationSubscriptionService } from '@meshmakers/octo-services';
import { NotificationRecipientsComponent } from './notification-recipients.component';
import { DEFAULT_NOTIFICATIONS_MESSAGES, NOTIFICATIONS_KEY } from './notifications.messages';

@Component({
  selector: 'mm-notification-subscription-detail',
  standalone: true,
  imports: [LoaderComponent, NotificationRecipientsComponent],
  template: `
    @if (loading()) {
      <div class="detail-loading"><kendo-loader type="pulsing" size="medium"></kendo-loader></div>
    } @else if (subscription(); as subscription) {
      <section class="detail-header">
        <span class="detail-name">{{ subscription.name }}</span>
        @if (subscription.description) {
          <p class="detail-description">{{ subscription.description }}</p>
        }
      </section>
      <section class="detail-recipients">
        <h3 class="detail-section-title">{{ t(k + '.recipients') }}</h3>
        <mm-notification-recipients
          [tenantId]="tenantId()"
          [subscription]="recipientSubscription()!"
          [canWrite]="canWrite()">
        </mm-notification-recipients>
      </section>
    } @else {
      <p class="detail-missing">{{ t(k + '.notFound') }}</p>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 16px; min-height: 0; }
    .detail-loading { display: flex; justify-content: center; padding: 32px; }
    .detail-header { display: flex; flex-direction: column; gap: 8px; }
    .detail-name { font-size: 1.25rem; font-weight: 600; }
    .detail-description { margin: 0; opacity: 0.8; }
    .detail-recipients { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
    .detail-section-title { margin: 0; font-size: 1rem; font-weight: 600; }
  `],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class NotificationSubscriptionDetailComponent {
  private readonly subscriptions = inject(NotificationSubscriptionService);
  private readonly notifications = inject(NotificationDisplayService);
  protected readonly t = injectMmT(DEFAULT_NOTIFICATIONS_MESSAGES);
  protected readonly k = NOTIFICATIONS_KEY;

  readonly tenantId = input.required<string>();
  readonly subscriptionRtId = input.required<string>();
  readonly canWrite = input(true);
  readonly loaded = output<NotificationSubscriptionDetail | null>();

  protected readonly subscription = signal<NotificationSubscriptionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly recipientSubscription = computed(() => {
    const subscription = this.subscription();
    return subscription
      ? { rtId: subscription.rtId, ckTypeId: subscription.ckTypeId, name: subscription.name, deployed: subscription.enabled }
      : null;
  });

  constructor() {
    effect(() => {
      const rtId = this.subscriptionRtId();
      untracked(() => void this.load(rtId));
    });
  }

  private async load(rtId: string): Promise<void> {
    this.loading.set(true);
    try {
      const subscription = await this.subscriptions.getSubscription(rtId);
      this.subscription.set(subscription);
      this.loaded.emit(subscription);
    } catch (error) {
      console.error('Error loading the subscription:', error);
      this.notifications.showError(this.t(`${this.k}.loadFailed`));
      this.subscription.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
