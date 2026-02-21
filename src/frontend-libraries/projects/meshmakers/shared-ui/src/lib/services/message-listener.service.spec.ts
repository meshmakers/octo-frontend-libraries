import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MessageService, NotificationMessage } from '@meshmakers/shared-services';

import { MessageListenerService } from './message-listener.service';
import { NotificationDisplayService } from './notification-display.service';

describe('MessageListenerService', () => {
  let service: MessageListenerService;
  let messageServiceMock: jasmine.SpyObj<MessageService>;
  let notificationDisplayMock: jasmine.SpyObj<NotificationDisplayService>;
  let messagesSubject: Subject<NotificationMessage>;

  const createMessage = (level: 'error' | 'warning' | 'info' | 'success', message: string, details?: string): NotificationMessage => ({
    level,
    message,
    details,
    timestamp: new Date()
  });

  beforeEach(() => {
    messagesSubject = new Subject<NotificationMessage>();

    messageServiceMock = jasmine.createSpyObj('MessageService', [], {
      messages$: messagesSubject.asObservable()
    });

    notificationDisplayMock = jasmine.createSpyObj('NotificationDisplayService', [
      'showError',
      'showWarning',
      'showInfo',
      'showSuccess'
    ]);

    TestBed.configureTestingModule({
      providers: [
        MessageListenerService,
        { provide: MessageService, useValue: messageServiceMock },
        { provide: NotificationDisplayService, useValue: notificationDisplayMock }
      ]
    });
    service = TestBed.inject(MessageListenerService);
  });

  afterEach(() => {
    service.stop();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialize', () => {
    it('should subscribe to messages$', () => {
      service.initialize();

      // Emit a message to verify subscription
      messagesSubject.next(createMessage('info', 'Test'));

      expect(notificationDisplayMock.showInfo).toHaveBeenCalledWith('Test');
    });

    it('should not subscribe multiple times when called repeatedly', () => {
      service.initialize();
      service.initialize();

      messagesSubject.next(createMessage('info', 'Test'));

      // Should only be called once
      expect(notificationDisplayMock.showInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('message routing', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should route error messages to showError', () => {
      messagesSubject.next(createMessage('error', 'Error message', 'Error details'));

      expect(notificationDisplayMock.showError).toHaveBeenCalledWith('Error message', 'Error details');
    });

    it('should route warning messages to showWarning', () => {
      messagesSubject.next(createMessage('warning', 'Warning message', 'Warning details'));

      expect(notificationDisplayMock.showWarning).toHaveBeenCalledWith('Warning message', 'Warning details');
    });

    it('should route info messages to showInfo', () => {
      messagesSubject.next(createMessage('info', 'Info message'));

      expect(notificationDisplayMock.showInfo).toHaveBeenCalledWith('Info message');
    });

    it('should route success messages to showSuccess', () => {
      messagesSubject.next(createMessage('success', 'Success message'));

      expect(notificationDisplayMock.showSuccess).toHaveBeenCalledWith('Success message');
    });
  });

  describe('stop', () => {
    it('should unsubscribe from messages$', () => {
      service.initialize();
      service.stop();

      // Emit a message after stopping
      messagesSubject.next(createMessage('info', 'Test'));

      expect(notificationDisplayMock.showInfo).not.toHaveBeenCalled();
    });

    it('should allow re-initialization after stop', () => {
      service.initialize();
      service.stop();
      service.initialize();

      messagesSubject.next(createMessage('info', 'Test'));

      expect(notificationDisplayMock.showInfo).toHaveBeenCalledWith('Test');
    });
  });

  describe('ngOnDestroy', () => {
    it('should call stop on destroy', () => {
      spyOn(service, 'stop');

      service.ngOnDestroy();

      expect(service.stop).toHaveBeenCalled();
    });
  });
});
