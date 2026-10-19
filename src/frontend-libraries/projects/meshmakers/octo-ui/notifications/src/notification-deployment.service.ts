import { inject, Injectable } from '@angular/core';
import { ConfirmationService, injectMmT, NotificationDisplayService } from '@meshmakers/shared-ui';
import { CommunicationService } from '@meshmakers/octo-services';
import { MmHttpErrorInterceptor } from '@meshmakers/shared-services';
import { DEFAULT_NOTIFICATIONS_MESSAGES, NOTIFICATIONS_KEY } from './notifications.messages';

export interface NotificationDeploymentTarget {
  rtId: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationDeploymentService {
  private readonly communication = inject(CommunicationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(NotificationDisplayService);
  private readonly t = injectMmT(DEFAULT_NOTIFICATIONS_MESSAGES);
  private readonly k = NOTIFICATIONS_KEY;

  async deploy(tenantId: string, subscription: NotificationDeploymentTarget): Promise<boolean> {
    try {
      await this.communication.deployNotificationSubscription(tenantId, subscription.rtId);
      this.notifications.showSuccess(this.t(`${this.k}.deployedDone`, { name: subscription.name }), 3000);
      return true;
    } catch (error) {
      this.reportFailure(error, 'deployFailed', subscription.name);
      return false;
    }
  }

  async undeploy(tenantId: string, subscription: NotificationDeploymentTarget): Promise<boolean> {
    const confirmed = await this.confirmation.showYesNoConfirmationDialog(
      this.t(`${this.k}.undeployTitle`, { name: subscription.name }),
      this.t(`${this.k}.undeployMessage`));
    if (!confirmed) return false;
    try {
      await this.communication.undeployNotificationSubscription(tenantId, subscription.rtId);
      this.notifications.showSuccess(this.t(`${this.k}.undeployedDone`, { name: subscription.name }), 3000);
      return true;
    } catch (error) {
      this.reportFailure(error, 'undeployFailed', subscription.name);
      return false;
    }
  }

  private reportFailure(error: unknown, key: string, name: string): void {
    console.error(`Error (${key}):`, error);
    if (!MmHttpErrorInterceptor.reportsToUser(error)) {
      this.notifications.showError(this.t(`${this.k}.${key}`, { name }));
    }
  }
}
