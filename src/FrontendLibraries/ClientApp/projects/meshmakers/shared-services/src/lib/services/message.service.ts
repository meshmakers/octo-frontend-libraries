import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable } from 'rxjs';
import { ErrorMessage } from '../models/errorMessage';

@Injectable()
export class MessageService {
  private readonly snackBar = inject(MatSnackBar);

  latestErrorMessage: BehaviorSubject<ErrorMessage | null>;

  errorMessages: ErrorMessage[];

  constructor() {
    this.latestErrorMessage = new BehaviorSubject<ErrorMessage | null>(null);
    this.errorMessages = new Array<ErrorMessage>();
  }

  getErrorMessageCount(): number {
    return this.errorMessages.length;
  }

  getErrorMessage(index: number): ErrorMessage {
    return this.errorMessages[index];
  }

  getLatestErrorMessage(): Observable<ErrorMessage | null> {
    return this.latestErrorMessage.asObservable();
  }

  showError(message: string, title: string): void {
    console.error(message);

    const errorMessage = {
      title,
      message
    } as ErrorMessage;
    this.errorMessages.push(errorMessage);

    this.latestErrorMessage.next(errorMessage);
  }

  showErrorWithDetails(error: any): void {
    if (error instanceof Error) {
      this.showError(error.message, 'Error');
    } else if (error === 'string') {
      this.showError(error, 'Error');
    } else if (error instanceof Object) {
      this.showError(JSON.stringify(error), 'Error');
    } else {
      this.showError('Unknown error', 'Error');
    }
  }

  showErrorMessage(message: string): void {
    console.error(message);

    const errorMessage = {
      title: 'Error',
      message
    } as ErrorMessage;
    this.errorMessages.push(errorMessage);

    this.latestErrorMessage.next(errorMessage);
  }

  showInformation(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: 3000,
      // here specify the position
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
