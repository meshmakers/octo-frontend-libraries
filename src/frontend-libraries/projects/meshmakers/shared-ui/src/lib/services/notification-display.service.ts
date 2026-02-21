import {Injectable, inject, OnDestroy, NgZone} from '@angular/core';
import {NotificationService, NotificationSettings, NotificationRef} from '@progress/kendo-angular-notification';
import { MessageDetailsDialogService } from '../message-details-dialog/message-details-dialog.service';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, fromEvent } from 'rxjs';
import { filter, debounceTime } from 'rxjs/operators';

@Injectable()
export class NotificationDisplayService implements OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly messageDetailsDialogService = inject(MessageDetailsDialogService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private notificationCounter = 0;
  private activeNotifications = new Map<string, NotificationRef>();
  private subscriptions: Subscription[] = [];
  private interactionDebounceTime = 300; // ms
  private gracePeriod = 1000; // ms - prevent immediate closure after opening
  private notificationOpenTimes = new Map<string, number>();

  private readonly defaultSettings: NotificationSettings = {
    content: '',
    type: {style: 'success', icon: true},
    animation: {type: 'slide', duration: 400},
    hideAfter: 3000,
    closable: true,
    position: { horizontal: 'center', vertical: 'top' }
  };

  constructor() {
    this.setupNavigationListener();
    this.setupGlobalInteractionListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearAllNotifications();
  }

  private setupNavigationListener(): void {
    const navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.clearErrorAndWarningNotifications();
      });
    this.subscriptions.push(navigationSubscription);
  }

  private setupGlobalInteractionListeners(): void {
    this.ngZone.runOutsideAngular(() => {
      const events = ['click', 'keydown', 'touchstart'];

      events.forEach(eventType => {
        const subscription = fromEvent(document, eventType)
          .pipe(
            debounceTime(this.interactionDebounceTime),
            filter(() => this.hasActiveErrorOrWarning()), // Only process events if we have error/warning notifications
            filter((event) => this.shouldCloseOnInteraction(event as Event))
          )
          .subscribe(() => {
            this.ngZone.run(() => {
              this.clearErrorAndWarningNotifications();
            });
          });
        this.subscriptions.push(subscription);
      });
    });
  }

  private hasActiveErrorOrWarning(): boolean {
    for (const [id, _] of this.activeNotifications) {
      if (id.includes('error') || id.includes('warning')) {
        return true;
      }
    }
    return false;
  }

  private shouldCloseOnInteraction(event: Event): boolean {
    const target = event.target as Element;

    // Don't close if clicking on the notification itself
    const notificationElements = document.querySelectorAll('.k-notification');
    for (const element of Array.from(notificationElements)) {
      if (element.contains(target)) {
        return false;
      }
    }

    // Don't close if clicking on navigation elements
    const navElements = document.querySelectorAll('nav, .navigation, .navbar, .menu, .sidebar');
    for (const element of Array.from(navElements)) {
      if (element.contains(target)) {
        return false;
      }
    }

    // Check grace period for recent error/warning notifications
    for (const [id, openTime] of this.notificationOpenTimes) {
      if (id.includes('error') || id.includes('warning')) {
        const timeSinceOpen = Date.now() - openTime;
        if (timeSinceOpen < this.gracePeriod) {
          return false;
        }
      }
    }

    // Don't close on certain key presses
    if (event.type === 'keydown') {
      const keyEvent = event as KeyboardEvent;
      const excludedKeys = ['Tab', 'Shift', 'Control', 'Alt', 'Meta'];
      return !excludedKeys.includes(keyEvent.key);
    }

    return true;
  }

  private clearErrorAndWarningNotifications(): void {
    const toRemove: string[] = [];
    for (const [id, ref] of this.activeNotifications) {
      if (id.includes('error') || id.includes('warning')) {
        ref.hide();
        toRemove.push(id);
      }
    }
    toRemove.forEach(id => {
      this.activeNotifications.delete(id);
      this.notificationOpenTimes.delete(id);
    });
  }

  private clearAllNotifications(): void {
    for (const [_, ref] of this.activeNotifications) {
      ref.hide();
    }
    this.activeNotifications.clear();
    this.notificationOpenTimes.clear();
  }

  /**
   * Helper method to create SVG icon HTML
   */
  private createSvgIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor"' +
      ' d="M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5"/></svg>';
  }


  /**
   * Shows a success notification (auto-closes after 3 seconds)
   */
  showSuccess(title: string, hideAfter?: number): void {
    console.log('showSuccess called with:', { title, hideAfter });

    const autoHideTime = hideAfter ?? 3000;

    const settings: NotificationSettings = {
      content: title,
      type: {
        style: 'success',
        icon: true
      },
      animation: { type: 'slide', duration: 400 },
      hideAfter: 0, // Disable Kendo's auto-hide, we'll handle it manually
      closable: true,
      position: { horizontal: 'center', vertical: 'top' }
    };

    console.log('Success notification settings:', settings);

    const notificationRef = this.notificationService.show(settings);
    console.log('Notification ref created:', notificationRef);

    if (notificationRef) {
      console.log(`Success notification will auto-hide after ${autoHideTime}ms (manual)`);

      // Manually hide the notification after the specified time
      setTimeout(() => {
        console.log('Manually hiding success notification');
        notificationRef.hide();
      }, autoHideTime);
    }
  }

  /**
   * Shows an error notification (persists until user interaction or navigation)
   */
  showError(title: string, details?: string, hideAfter?: number): void {
    // Generate unique ID for this notification
    const notificationId = `error-${++this.notificationCounter}-${Date.now()}`;

    // Start with plain text content
    const settings: NotificationSettings = {
      ...this.defaultSettings,
      content: title,
      type: {
        style: 'error',
        icon: true
      },
      hideAfter: hideAfter ?? 0, // 0 means no auto-hide for errors
      closable: true,
      cssClass: `notification-${notificationId}` // Add unique class for targeting
    };

    const notificationRef = this.notificationService.show(settings);

    if (notificationRef) {
      this.activeNotifications.set(notificationId, notificationRef);
      this.notificationOpenTimes.set(notificationId, Date.now());
    }

    if (details && notificationRef) {
      // After notification is shown, find it by the unique class and modify its content
      setTimeout(() => {
        const notification = document.querySelector(`.notification-${notificationId}`);
        if (notification) {
          const contentEl = notification.querySelector('.k-notification-content');
          if (contentEl && !contentEl.querySelector('.notification-details-btn')) {
            // Create wrapper div
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px;';

            // Create text span
            const textSpan = document.createElement('span');
            textSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis;';
            textSpan.textContent = title;

            // Create details button with icon only
            const detailsBtn = document.createElement('button');
            detailsBtn.className = 'k-button k-button-sm k-button-flat k-button-flat-base notification-details-btn';
            detailsBtn.style.cssText = 'flex-shrink: 0; width: 32px; height: 32px; padding: 8px; display: flex; align-items: center; justify-content: center;';
            detailsBtn.innerHTML = this.createSvgIcon();
            detailsBtn.title = 'Show Details';
            detailsBtn.onclick = (event) => {
              event.stopPropagation();
              this.messageDetailsDialogService.showDetailsDialog({
                title,
                details,
                level: 'error'
              });
            };

            // Assemble the elements
            wrapper.appendChild(textSpan);
            wrapper.appendChild(detailsBtn);

            // Replace content
            contentEl.innerHTML = '';
            contentEl.appendChild(wrapper);
          }
        }
      }, 50);
    }
  }



  /**
   * Shows a warning notification (persists until user interaction or navigation)
   */
  showWarning(title: string, details?: string, hideAfter?: number): void {
    // Generate unique ID for this notification
    const notificationId = `warning-${++this.notificationCounter}-${Date.now()}`;

    // Start with plain text content
    const settings: NotificationSettings = {
      ...this.defaultSettings,
      content: title,
      type: {
        style: 'warning',
        icon: true
      },
      hideAfter: hideAfter ?? 0, // 0 means no auto-hide for warnings
      closable: true,
      cssClass: `notification-${notificationId}` // Add unique class for targeting
    };

    const notificationRef = this.notificationService.show(settings);

    if (notificationRef) {
      this.activeNotifications.set(notificationId, notificationRef);
      this.notificationOpenTimes.set(notificationId, Date.now());
    }

    if (details && notificationRef) {
      // After notification is shown, find it by the unique class and modify its content
      setTimeout(() => {
        const notification = document.querySelector(`.notification-${notificationId}`);
        if (notification) {
          const contentEl = notification.querySelector('.k-notification-content');
          if (contentEl && !contentEl.querySelector('.notification-details-btn')) {
            // Create wrapper div
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px;';

            // Create text span
            const textSpan = document.createElement('span');
            textSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis;';
            textSpan.textContent = title;

            // Create details button with icon only
            const detailsBtn = document.createElement('button');
            detailsBtn.className = 'k-button k-button-sm k-button-flat k-button-flat-base notification-details-btn';
            detailsBtn.style.cssText = 'flex-shrink: 0; width: 32px; height: 32px; padding: 8px; display: flex; align-items: center; justify-content: center;';
            detailsBtn.innerHTML = this.createSvgIcon();
            detailsBtn.title = 'Show Details';
            detailsBtn.onclick = (event) => {
              event.stopPropagation();
              this.messageDetailsDialogService.showDetailsDialog({
                title,
                details,
                level: 'warning'
              });
            };

            // Assemble the elements
            wrapper.appendChild(textSpan);
            wrapper.appendChild(detailsBtn);

            // Replace content
            contentEl.innerHTML = '';
            contentEl.appendChild(wrapper);
          }
        }
      }, 50);
    }
  }

  /**
   * Shows an info notification (auto-closes after 3 seconds)
   */
  showInfo(title: string, hideAfter?: number): void {
    console.log('showInfo called with:', { title, hideAfter });

    const autoHideTime = hideAfter ?? 3000;

    const settings: NotificationSettings = {
      content: title,
      type: {
        style: 'info',
        icon: true
      },
      animation: { type: 'slide', duration: 400 },
      hideAfter: 0, // Disable Kendo's auto-hide, we'll handle it manually
      closable: true,
      position: { horizontal: 'center', vertical: 'top' }
    };

    console.log('Info notification settings:', settings);

    const notificationRef = this.notificationService.show(settings);
    console.log('Notification ref created:', notificationRef);

    if (notificationRef) {
      console.log(`Info notification will auto-hide after ${autoHideTime}ms (manual)`);

      // Manually hide the notification after the specified time
      setTimeout(() => {
        console.log('Manually hiding info notification');
        notificationRef.hide();
      }, autoHideTime);
    }
  }
}
