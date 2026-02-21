import { TestBed } from '@angular/core/testing';
import { MessageService } from './message.service';
import { NotificationMessage } from '../models/notification-message';

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageService]
    });
    service = TestBed.inject(MessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have no error messages initially', () => {
      expect(service.getErrorMessageCount()).toBe(0);
    });

    it('should have null as latest error message initially', (done) => {
      service.getLatestErrorMessage().subscribe(msg => {
        expect(msg).toBeNull();
        done();
      });
    });
  });

  describe('showError', () => {
    it('should add error message to errorMessages array', () => {
      service.showError('Test error');

      expect(service.getErrorMessageCount()).toBe(1);
    });

    it('should set correct message level', () => {
      service.showError('Test error');

      const msg = service.getErrorMessage(0);
      expect(msg.level).toBe('error');
    });

    it('should set correct message text', () => {
      service.showError('Test error message');

      const msg = service.getErrorMessage(0);
      expect(msg.message).toBe('Test error message');
    });

    it('should set timestamp', () => {
      const before = new Date();
      service.showError('Test error');
      const after = new Date();

      const msg = service.getErrorMessage(0);
      expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should update latestErrorMessage', (done) => {
      service.showError('Latest error');

      service.getLatestErrorMessage().subscribe(msg => {
        expect(msg?.message).toBe('Latest error');
        done();
      });
    });

    it('should emit to messages$ stream', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('error');
        expect(msg.message).toBe('Stream error');
        done();
      });

      service.showError('Stream error');
    });
  });

  describe('showErrorWithDetails', () => {
    it('should add error message with details', () => {
      service.showErrorWithDetails('Error message', 'Error details');

      const msg = service.getErrorMessage(0);
      expect(msg.message).toBe('Error message');
      expect(msg.details).toBe('Error details');
    });

    it('should set correct message level', () => {
      service.showErrorWithDetails('Error', 'Details');

      const msg = service.getErrorMessage(0);
      expect(msg.level).toBe('error');
    });

    it('should update latestErrorMessage', (done) => {
      service.showErrorWithDetails('Error', 'Details');

      service.getLatestErrorMessage().subscribe(msg => {
        expect(msg?.details).toBe('Details');
        done();
      });
    });

    it('should emit to messages$ stream with details', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('error');
        expect(msg.details).toBe('Stream details');
        done();
      });

      service.showErrorWithDetails('Error', 'Stream details');
    });
  });

  describe('showInformation', () => {
    it('should emit info message to messages$ stream', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('info');
        expect(msg.message).toBe('Info message');
        done();
      });

      service.showInformation('Info message');
    });

    it('should not add to errorMessages array', () => {
      service.showInformation('Info message');

      expect(service.getErrorMessageCount()).toBe(0);
    });

    it('should set timestamp', (done) => {
      const before = new Date();

      service.messages$.subscribe(msg => {
        const after = new Date();
        expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        done();
      });

      service.showInformation('Info');
    });
  });

  describe('showSuccess', () => {
    it('should emit success message to messages$ stream', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('success');
        expect(msg.message).toBe('Success message');
        done();
      });

      service.showSuccess('Success message');
    });

    it('should not add to errorMessages array', () => {
      service.showSuccess('Success');

      expect(service.getErrorMessageCount()).toBe(0);
    });
  });

  describe('showWarning', () => {
    it('should emit warning message to messages$ stream', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('warning');
        expect(msg.message).toBe('Warning message');
        done();
      });

      service.showWarning('Warning message');
    });

    it('should not add to errorMessages array', () => {
      service.showWarning('Warning');

      expect(service.getErrorMessageCount()).toBe(0);
    });
  });

  describe('showWarningWithDetails', () => {
    it('should emit warning message with details to messages$ stream', (done) => {
      service.messages$.subscribe(msg => {
        expect(msg.level).toBe('warning');
        expect(msg.message).toBe('Warning message');
        expect(msg.details).toBe('Warning details');
        done();
      });

      service.showWarningWithDetails('Warning message', 'Warning details');
    });

    it('should not add to errorMessages array', () => {
      service.showWarningWithDetails('Warning', 'Details');

      expect(service.getErrorMessageCount()).toBe(0);
    });
  });

  describe('error message tracking', () => {
    it('should track multiple error messages', () => {
      service.showError('Error 1');
      service.showError('Error 2');
      service.showError('Error 3');

      expect(service.getErrorMessageCount()).toBe(3);
    });

    it('should return correct error by index', () => {
      service.showError('First');
      service.showError('Second');
      service.showError('Third');

      expect(service.getErrorMessage(0).message).toBe('First');
      expect(service.getErrorMessage(1).message).toBe('Second');
      expect(service.getErrorMessage(2).message).toBe('Third');
    });

    it('should update latestErrorMessage with each new error', () => {
      const receivedMessages: (NotificationMessage | null)[] = [];

      service.getLatestErrorMessage().subscribe(msg => {
        receivedMessages.push(msg);
      });

      service.showError('Error 1');
      service.showError('Error 2');

      // First is null (initial), then Error 1, then Error 2
      expect(receivedMessages.length).toBe(3);
      expect(receivedMessages[0]).toBeNull();
      expect(receivedMessages[1]?.message).toBe('Error 1');
      expect(receivedMessages[2]?.message).toBe('Error 2');
    });
  });

  describe('messages$ stream', () => {
    it('should emit all message types in order', () => {
      const receivedMessages: NotificationMessage[] = [];

      service.messages$.subscribe(msg => {
        receivedMessages.push(msg);
      });

      service.showError('Error');
      service.showWarning('Warning');
      service.showInformation('Info');
      service.showSuccess('Success');

      expect(receivedMessages.length).toBe(4);
      expect(receivedMessages[0].level).toBe('error');
      expect(receivedMessages[1].level).toBe('warning');
      expect(receivedMessages[2].level).toBe('info');
      expect(receivedMessages[3].level).toBe('success');
    });
  });
});
