import { Injectable, inject, OnDestroy } from '@angular/core';
import { MessageService } from '@meshmakers/shared-services';
import { NotificationDisplayService } from './notification-display.service';
import { Subscription } from 'rxjs';

/**
 * Service that listens to MessageService events and displays them as UI notifications.
 * This service should be initialized at app startup to ensure all messages are displayed.
 */
@Injectable({
  providedIn: 'root'
})
export class MessageListenerService implements OnDestroy {
  private readonly messageService = inject(MessageService);
  private readonly notificationDisplay = inject(NotificationDisplayService);
  private subscription?: Subscription;

  /**
   * Starts listening to messages from MessageService and displays them as notifications.
   * Call this once at application startup.
   */
  initialize(): void {
    if (this.subscription) {
      return; // Already initialized
    }

    // Subscribe to the new message stream
    this.subscription = this.messageService.messages$.subscribe(message => {
      switch (message.level) {
        case 'error':
          this.notificationDisplay.showError(message.message, message.details);
          break;
        case 'warning':
          this.notificationDisplay.showWarning(message.message, message.details);
          break;
        case 'info':
          this.notificationDisplay.showInfo(message.message);
          break;
        case 'success':
          this.notificationDisplay.showSuccess(message.message);
          break;
      }
    });
  }

  /**
   * Stops listening to messages
   */
  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
