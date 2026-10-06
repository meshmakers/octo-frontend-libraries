import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NotificationService, NotificationSettings } from '@progress/kendo-angular-notification';
import { MessageDetailsDialogService } from '../message-details-dialog/message-details-dialog.service';
import {
  NOTIFICATION_DISPLAY_OPTIONS,
  NotificationDisplayOptions,
  NotificationDisplayService
} from './notification-display.service';

describe('NotificationDisplayService', () => {
  interface FakeRef { settings: NotificationSettings; hide: ReturnType<typeof vi.fn<() => void>>; afterHide: Subject<void> }
  let shown: FakeRef[];

  function create(options?: NotificationDisplayOptions): NotificationDisplayService {
    shown = [];
    TestBed.configureTestingModule({
      providers: [
        NotificationDisplayService,
        { provide: Router, useValue: { events: new Subject() } },
        { provide: MessageDetailsDialogService, useValue: { showDetailsDialog: vi.fn() } },
        {
          provide: NotificationService,
          useValue: {
            show: (settings: NotificationSettings) => {
              const afterHide = new Subject<void>();
              const ref: FakeRef = { settings, afterHide, hide: vi.fn<() => void>(() => afterHide.next()) };
              shown.push(ref);
              return ref;
            }
          }
        },
        ...(options ? [{ provide: NOTIFICATION_DISPLAY_OPTIONS, useValue: options }] : [])
      ]
    });
    return TestBed.inject(NotificationDisplayService);
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows an identical message only once and restarts its timer', () => {
    const service = create({ errorHideAfter: 10_000 });
    service.showError('Type not found');
    vi.advanceTimersByTime(8_000);
    service.showError('Type not found');
    service.showError('Type not found');

    expect(shown.length).toBe(1);
    vi.advanceTimersByTime(8_000);
    expect(shown[0].hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(shown[0].hide).toHaveBeenCalled();
    expect(service.visibleToasts()).toEqual([]);
  });

  it('shows the same text again once the first one is gone', () => {
    const service = create();
    service.showError('Boom');
    shown[0].hide();
    service.showError('Boom');
    expect(shown.length).toBe(2);
  });

  it('auto-hides errors and warnings after the configured time, except an explicit sticky one', () => {
    const service = create({ errorHideAfter: 10_000, warningHideAfter: 5_000 });
    service.showError('Not critical');
    service.showWarning('Careful');
    service.showError('Critical', undefined, 0);

    vi.advanceTimersByTime(10_000);
    expect(shown[0].hide).toHaveBeenCalled();
    expect(shown[1].hide).toHaveBeenCalled();
    expect(shown[2].hide).not.toHaveBeenCalled();
    expect(service.visibleToasts()).toEqual([['error', 'Critical']]);
  });

  it('keeps errors without options (former behaviour)', () => {
    const service = create();
    service.showError('Stays');
    vi.advanceTimersByTime(60_000);
    expect(shown[0].hide).not.toHaveBeenCalled();
    expect(service.visibleToasts()).toEqual([['error', 'Stays']]);
  });

  it('caps the stack by hiding the oldest toast', () => {
    const service = create({ maxVisible: 3 });
    ['a', 'b', 'c', 'd'].forEach(text => service.showError(text));

    expect(shown[0].hide).toHaveBeenCalled();
    expect(service.visibleToasts().map(([, text]) => text)).toEqual(['b', 'c', 'd']);
  });

  it('still hides success and info toasts after three seconds', () => {
    const service = create();
    service.showSuccess('Saved');
    service.showInfo('FYI');
    vi.advanceTimersByTime(3_000);
    expect(shown.every(ref => ref.hide.mock.calls.length > 0)).toBe(true);
  });
});
