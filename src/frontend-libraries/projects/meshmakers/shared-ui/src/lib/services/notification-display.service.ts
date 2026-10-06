import {Injectable, inject, InjectionToken, OnDestroy, NgZone} from '@angular/core';
import {NotificationService, NotificationSettings, NotificationRef} from '@progress/kendo-angular-notification';
import { MessageDetailsDialogService } from '../message-details-dialog/message-details-dialog.service';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, fromEvent } from 'rxjs';
import { filter, debounceTime } from 'rxjs/operators';
import {
  NotificationDisplayMessages,
  DEFAULT_NOTIFICATION_DISPLAY_MESSAGES,
} from './notification-display.messages';

/**
 * How the {@link NotificationDisplayService} stacks its toasts. Provide it with
 * {@link NOTIFICATION_DISPLAY_OPTIONS}; without a provider the defaults keep the former behaviour
 * except for de-duplication, which is always safe.
 */
export interface NotificationDisplayOptions {
  /**
   * Milliseconds after which an error hides itself when the caller passes no `hideAfter`.
   * 0 (default) keeps errors until user interaction or navigation. A caller passing
   * `hideAfter: 0` explicitly always gets a sticky (critical) error.
   */
  errorHideAfter?: number;
  /** Same as {@link errorHideAfter} for warnings. */
  warningHideAfter?: number;
  /**
   * Errors and warnings that come with details (the "show details" button) stay until closed,
   * whatever {@link errorHideAfter} / {@link warningHideAfter} say. Default false.
   */
  stickyWithDetails?: boolean;
  /** Most toasts shown at once; beyond it the oldest toast of the LOWEST severity is hidden
   * (an error or warning is never dropped in favour of a success or info). 0 (default) = no limit. */
  maxVisible?: number;
  /** A toast with the same type, text and details as a visible one is not stacked again; the visible one's timer restarts. Default true. */
  dedupe?: boolean;
}

export const NOTIFICATION_DISPLAY_OPTIONS = new InjectionToken<NotificationDisplayOptions>('NOTIFICATION_DISPLAY_OPTIONS');

const DEFAULT_OPTIONS: Required<NotificationDisplayOptions> = {
  errorHideAfter: 0,
  warningHideAfter: 0,
  maxVisible: 0,
  dedupe: true,
  stickyWithDetails: false,
};

/** Eviction order of the stack cap: lower goes first. */
const SEVERITY: Record<'success' | 'info' | 'warning' | 'error', number> = { success: 0, info: 0, warning: 1, error: 2 };

type ToastStyle = 'success' | 'info' | 'warning' | 'error';

/** One visible toast. */
interface ActiveToast {
  id: string;
  key: string;
  style: ToastStyle;
  title: string;
  ref: NotificationRef;
  hideAfter: number;
  timer?: ReturnType<typeof setTimeout>;
  /** Hover / keyboard focus on the toast: the auto-hide timer waits until both are gone. */
  hovered: boolean;
  focused: boolean;
}

@Injectable()
export class NotificationDisplayService implements OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly messageDetailsDialogService = inject(MessageDetailsDialogService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private readonly options: Required<NotificationDisplayOptions> = {
    ...DEFAULT_OPTIONS,
    ...(inject(NOTIFICATION_DISPLAY_OPTIONS, { optional: true }) ?? {}),
  };

  private notificationCounter = 0;
  private activeNotifications = new Map<string, NotificationRef>();
  /** Every visible toast, oldest first (dedupe, stack cap, auto-hide timers). */
  private toasts: ActiveToast[] = [];
  private subscriptions: Subscription[] = [];
  private interactionDebounceTime = 300; // ms
  private gracePeriod = 1000; // ms - prevent immediate closure after opening
  private notificationOpenTimes = new Map<string, number>();

  public messages: NotificationDisplayMessages = { ...DEFAULT_NOTIFICATION_DISPLAY_MESSAGES };

  public setMessages(value: Partial<NotificationDisplayMessages>): void {
    this.messages = { ...DEFAULT_NOTIFICATION_DISPLAY_MESSAGES, ...value };
  }

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
      this.forget(id);
    });
  }

  private clearAllNotifications(): void {
    for (const [_, ref] of this.activeNotifications) {
      ref.hide();
    }
    this.activeNotifications.clear();
    this.notificationOpenTimes.clear();
    this.toasts.forEach(toast => clearTimeout(toast.timer));
    this.toasts = [];
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
    this.present('success', title, undefined, hideAfter ?? 3000);
  }

  /**
   * Shows an error notification. It persists until user interaction or navigation, or hides
   * after `hideAfter` ms (default: `errorHideAfter` of the options; `0` = sticky).
   */
  showError(title: string, details?: string, hideAfter?: number): void {
    this.present('error', title, details, hideAfter ?? this.options.errorHideAfter);
  }

  /**
   * Shows a warning notification. It persists until user interaction or navigation, or hides
   * after `hideAfter` ms (default: `warningHideAfter` of the options; `0` = sticky).
   */
  showWarning(title: string, details?: string, hideAfter?: number): void {
    this.present('warning', title, details, hideAfter ?? this.options.warningHideAfter);
  }

  /**
   * Shows an info notification (auto-closes after 3 seconds)
   */
  showInfo(title: string, hideAfter?: number): void {
    this.present('info', title, undefined, hideAfter ?? 3000);
  }

  /** The visible toasts as `[style, text]`, oldest first — for tests and diagnostics. */
  visibleToasts(): [ToastStyle, string][] {
    return this.toasts.map(toast => [toast.style, toast.title]);
  }

  private present(style: ToastStyle, title: string, details: string | undefined, hideAfter: number): void {
    const key = `${style}\u0000${title}\u0000${details ?? ''}`;
    if (this.options.dedupe) {
      const same = this.toasts.find(toast => toast.key === key);
      if (same) {
        // Already on screen: no second copy, the visible one just stays a while longer.
        this.schedule(same);
        return;
      }
    }

    const sticky = style === 'error' || style === 'warning';
    // An error or warning with details is read in the details dialog: it waits for the user.
    const duration = sticky && details && this.options.stickyWithDetails ? 0 : hideAfter;
    const notificationId = `${style}-${++this.notificationCounter}-${Date.now()}`;
    const settings: NotificationSettings = {
      ...this.defaultSettings,
      content: title,
      type: { style, icon: true },
      // Kendo ignores hideAfter on closable notifications: hiding is done by schedule().
      hideAfter: 0,
      closable: true,
      cssClass: `notification-${notificationId}`,
    };

    const notificationRef = this.notificationService.show(settings);
    if (!notificationRef) {
      return;
    }

    if (sticky) {
      this.activeNotifications.set(notificationId, notificationRef);
      this.notificationOpenTimes.set(notificationId, Date.now());
    }
    const toast: ActiveToast = { id: notificationId, key, style, title, ref: notificationRef, hideAfter: duration, hovered: false, focused: false };
    this.toasts.push(toast);
    notificationRef.afterHide?.subscribe(() => this.forget(notificationId));
    this.schedule(toast);
    this.enforceLimit();

    // The toast element exists once Kendo has rendered it.
    setTimeout(() => {
      this.watchPointerAndFocus(toast);
      if (details && sticky) {
        this.addDetailsButton(notificationId, title, details, style);
      }
    }, 50);
  }

  /** (Re)starts the auto-hide timer of a toast; a toast with `hideAfter` 0 stays, a hovered or focused one waits. */
  private schedule(toast: ActiveToast): void {
    clearTimeout(toast.timer);
    toast.timer = undefined;
    if (toast.hideAfter > 0 && !toast.hovered && !toast.focused) {
      toast.timer = setTimeout(() => this.hideToast(toast), toast.hideAfter);
    }
  }

  /** Pauses the auto-hide while the pointer is over the toast or focus is inside it; restarts it afterwards. */
  private watchPointerAndFocus(toast: ActiveToast): void {
    const element = document.querySelector<HTMLElement>(`.notification-${toast.id}`);
    if (!element || !this.toasts.includes(toast)) {
      return;
    }
    const update = (change: Partial<Pick<ActiveToast, 'hovered' | 'focused'>>) => {
      Object.assign(toast, change);
      if (this.toasts.includes(toast)) {
        this.schedule(toast);
      }
    };
    element.addEventListener('mouseenter', () => update({ hovered: true }));
    element.addEventListener('mouseleave', () => update({ hovered: false }));
    element.addEventListener('focusin', () => update({ focused: true }));
    element.addEventListener('focusout', (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) {
        update({ focused: false });
      }
    });
  }

  /** Beyond `maxVisible`, hides the oldest toast of the lowest severity (success/info before warning before error). */
  private enforceLimit(): void {
    const max = this.options.maxVisible;
    while (max > 0 && this.toasts.length > max) {
      const lowest = Math.min(...this.toasts.map(toast => SEVERITY[toast.style]));
      const victim = this.toasts.find(toast => SEVERITY[toast.style] === lowest);
      if (!victim) {
        return;
      }
      this.hideToast(victim);
    }
  }

  private hideToast(toast: ActiveToast): void {
    toast.ref.hide();
    this.activeNotifications.delete(toast.id);
    this.notificationOpenTimes.delete(toast.id);
    this.forget(toast.id);
  }

  private forget(id: string): void {
    const toast = this.toasts.find(entry => entry.id === id);
    if (toast) {
      clearTimeout(toast.timer);
      this.toasts = this.toasts.filter(entry => entry !== toast);
    }
  }

  private addDetailsButton(notificationId: string, title: string, details: string, level: 'error' | 'warning'): void {
    // Called once the notification is rendered: find it by the unique class and modify its content
    {
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
          detailsBtn.title = this.messages.showDetails;
          detailsBtn.onclick = (event) => {
            event.stopPropagation();
            this.messageDetailsDialogService.showDetailsDialog({
              title,
              details,
              level
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
    }
  }
}
