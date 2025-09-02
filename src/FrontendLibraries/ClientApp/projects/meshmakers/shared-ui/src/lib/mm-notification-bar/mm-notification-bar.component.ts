import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { NotificationSnackBar } from "./notification-snack-bar/notification-snack-bar";
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, fromEvent } from 'rxjs';
import { filter, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'mm-notification-bar',
  standalone: false,
  templateUrl: './mm-notification-bar.component.html',
  styleUrls: ['./mm-notification-bar.component.scss']
})
export class MmNotificationBarComponent implements OnInit, OnDestroy {
  private readonly snackBar = inject(MatSnackBar);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  public errorMessage: ErrorMessage | null;
  private currentSnackBarRef: MatSnackBarRef<NotificationSnackBar> | null = null;
  private subscriptions: Subscription[] = [];
  private autoCloseOnInteraction = true;
  private interactionDebounceTime = 500; // ms
  private snackBarOpenTime: number = 0;
  private gracePeriod = 1000; // ms - prevent immediate closure after opening

  constructor() {
    this.errorMessage = null;
  }

  ngOnInit(): void {
    // Subscribe to error messages
    const errorSubscription = this.messageService.getLatestErrorMessage().subscribe((value) => {
      this.errorMessage = value;
      if (this.errorMessage) {
        // Close previous snack bar if exists
        this.closeCurrentSnackBar();

        // Open new snack bar
        this.currentSnackBarRef = this.snackBar.openFromComponent(NotificationSnackBar, {
          data: this.errorMessage,
          horizontalPosition: "center",
          verticalPosition: "top"
        });
        
        // Record when the snack bar was opened
        this.snackBarOpenTime = Date.now();
      }
    });

    // Subscribe to navigation events to auto-close snack bar
    const navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeCurrentSnackBar();
      });

    // Subscribe to global user interactions to auto-close snack bar
    this.setupGlobalInteractionListeners();

    this.subscriptions.push(errorSubscription, navigationSubscription);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.closeCurrentSnackBar();
  }

  private closeCurrentSnackBar(): void {
    if (this.currentSnackBarRef) {
      this.currentSnackBarRef.dismiss();
      this.currentSnackBarRef = null;
    }
  }

  private setupGlobalInteractionListeners(): void {
    if (!this.autoCloseOnInteraction) return;

    this.ngZone.runOutsideAngular(() => {
      // Listen for various user interaction events
      const events = ['click', 'keydown', 'scroll', 'touchstart'];

      events.forEach(eventType => {
        const subscription = fromEvent(document, eventType)
          .pipe(
            debounceTime(this.interactionDebounceTime),
            filter(() => this.currentSnackBarRef !== null),
            filter((event) => this.shouldCloseOnInteraction(event as Event))
          )
          .subscribe(() => {
            this.ngZone.run(() => {
              this.closeCurrentSnackBar();
            });
          });

        this.subscriptions.push(subscription);
      });
    });
  }

  private shouldCloseOnInteraction(event: Event): boolean {
    if (!this.currentSnackBarRef) return false;

    // Don't close if we're still in the grace period after opening
    const timeSinceOpen = Date.now() - this.snackBarOpenTime;
    if (timeSinceOpen < this.gracePeriod) {
      return false;
    }

    const target = event.target as Element;

    // Don't close if the interaction is within the snack bar itself
    const snackBarElement = document.querySelector('mm-notification-snack-bar') ||
                           document.querySelector('.mat-mdc-snack-bar-container');

    if (snackBarElement && snackBarElement.contains(target)) {
      return false;
    }

    // Don't close on certain key presses (like Tab for accessibility)
    if (event.type === 'keydown') {
      const keyEvent = event as KeyboardEvent;
      const excludedKeys = ['Tab', 'Shift', 'Control', 'Alt', 'Meta'];
      return !excludedKeys.includes(keyEvent.key);
    }

    return true;
  }
}
