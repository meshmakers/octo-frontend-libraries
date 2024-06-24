import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable } from 'rxjs';
import { ErrorMessage } from '../models/errorMessage';

@Injectable()
export class MessageService {
  latestErrorMessage: BehaviorSubject<ErrorMessage | null>;

  errorMessages: ErrorMessage[];

  constructor(private readonly snackBar: MatSnackBar) {
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
