import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {NotificationMessage} from '../models/notification-message';
import {transformErrorMessage} from './error-message.utils';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  latestErrorMessage: BehaviorSubject<NotificationMessage | null>;
  errorMessages: NotificationMessage[];

  // New message stream for all message types
  private readonly messageSubject = new Subject<NotificationMessage>();
  public readonly messages$ = this.messageSubject.asObservable();

  constructor() {
    this.latestErrorMessage = new BehaviorSubject<NotificationMessage | null>(null);
    this.errorMessages = new Array<NotificationMessage>();
  }

  getErrorMessageCount(): number {
    return this.errorMessages.length;
  }

  getErrorMessage(index: number): NotificationMessage {
    return this.errorMessages[index];
  }

  getLatestErrorMessage(): Observable<NotificationMessage | null> {
    return this.latestErrorMessage.asObservable();
  }

  showErrorWithDetails(message: string, details: string): void {
    console.error(`${details}: ${message}`);

    const transformed = transformErrorMessage(message);
    const displayMessage = transformed ? transformed.userMessage : message;
    const displayDetails = transformed
      ? (details ? `${details}\n\n${transformed.technicalDetails}` : transformed.technicalDetails)
      : details;

    const notificationMessage = {
      level: "error",
      details: displayDetails,
      message: displayMessage,
      timestamp: new Date()
    } as NotificationMessage;
    this.errorMessages.push(notificationMessage);

    this.latestErrorMessage.next(notificationMessage);

    // Emit to the new message stream
    this.messageSubject.next(notificationMessage);
  }

  showError(message: string): void {
    console.error(message);

    const transformed = transformErrorMessage(message);
    const displayMessage = transformed ? transformed.userMessage : message;
    const displayDetails = transformed ? transformed.technicalDetails : undefined;

    const notificationMessage = {
      level: "error",
      message: displayMessage,
      details: displayDetails,
      timestamp: new Date()
    } as NotificationMessage;
    this.errorMessages.push(notificationMessage);

    this.latestErrorMessage.next(notificationMessage);

    // Emit to the new message stream
    this.messageSubject.next(notificationMessage);
  }

  showInformation(message: string): void {
    console.log(message);

    // Emit to the new message stream
    this.messageSubject.next({
      level: 'info',
      message,
      timestamp: new Date()
    });
  }

  showSuccess(message: string): void {
    console.log(message);

    // Emit to the new message stream
    this.messageSubject.next({
      level: 'success',
      message,
      timestamp: new Date()
    });
  }

  showWarning(message: string): void {
    console.warn(message);

    // Emit to the new message stream
    this.messageSubject.next({
      level: 'warning',
      message: message,
      timestamp: new Date()
    });
  }

  showWarningWithDetails(message: string, details: string): void {
    console.warn(`${message}: ${details}`);

    // Emit to the new message stream
    this.messageSubject.next({
      level: 'warning',
      details: details,
      message: message,
      timestamp: new Date()
    });
  }
}
