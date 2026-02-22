/**
 * Material Design replacement for legacy mm-notification-bar from @meshmakers/shared-ui.
 * Uses MatSnackBar to display error messages from MessageService.
 */
import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { MessageService, NotificationMessage } from '@meshmakers/shared-services';
import { MatSnackBar, MatSnackBarRef, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, fromEvent } from 'rxjs';
import { filter, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'mm-notification-bar',
  standalone: true,
  imports: [MatSnackBarModule],
  template: ''
})
 
export class MmNotificationBarComponent implements OnInit, OnDestroy {
  private readonly snackBar = inject(MatSnackBar);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private currentSnackBarRef: MatSnackBarRef<unknown> | null = null;
  private subscriptions: Subscription[] = [];
  private snackBarOpenTime = 0;

  ngOnInit(): void {
    const errorSubscription = this.messageService.getLatestErrorMessage().subscribe((value: NotificationMessage | null) => {
      if (value) {
        this.closeCurrentSnackBar();

        const message = value.details
          ? `${value.message}: ${value.details}`
          : value.message;

        this.currentSnackBarRef = this.snackBar.open(message, 'Close', {
          horizontalPosition: 'center',
          verticalPosition: 'top',
          duration: 10000,
          panelClass: ['error-snackbar']
        });

        this.snackBarOpenTime = Date.now();
      }
    });

    const navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeCurrentSnackBar();
      });

    this.setupGlobalInteractionListeners();
    this.subscriptions.push(errorSubscription, navigationSubscription);
  }

  ngOnDestroy(): void {
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
    this.ngZone.runOutsideAngular(() => {
      const events = ['click', 'keydown', 'scroll', 'touchstart'];

      events.forEach(eventType => {
        const subscription = fromEvent(document, eventType)
          .pipe(
            debounceTime(500),
            filter(() => this.currentSnackBarRef !== null),
            filter((event) => this.shouldCloseOnInteraction(event))
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

    const timeSinceOpen = Date.now() - this.snackBarOpenTime;
    if (timeSinceOpen < 1000) return false;

    const target = event.target as Element;
    const snackBarElement = document.querySelector('.mat-mdc-snack-bar-container');
    if (snackBarElement && snackBarElement.contains(target)) return false;

    if (event.type === 'keydown') {
      const keyEvent = event as KeyboardEvent;
      const excludedKeys = ['Tab', 'Shift', 'Control', 'Alt', 'Meta'];
      return !excludedKeys.includes(keyEvent.key);
    }

    return true;
  }
}
