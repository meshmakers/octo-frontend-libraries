import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ErrorMessage, MessageService } from '@meshmakers/shared-services';
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { NotificationSnackBar } from "./notification-snack-bar/notification-snack-bar";
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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

  public errorMessage: ErrorMessage | null;
  private currentSnackBarRef: MatSnackBarRef<NotificationSnackBar> | null = null;
  private subscriptions: Subscription[] = [];

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
      }
    });
    
    // Subscribe to navigation events to auto-close snack bar
    const navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeCurrentSnackBar();
      });
    
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
}
