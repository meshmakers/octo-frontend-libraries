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

  it('keeps errors and warnings with details sticky when configured', () => {
    const service = create({ errorHideAfter: 10_000, warningHideAfter: 8_000, stickyWithDetails: true });
    service.showError('With details', 'stack trace');
    service.showWarning('Warn with details', 'more');
    service.showError('Plain');
    vi.advanceTimersByTime(20_000);
    expect(service.visibleToasts()).toEqual([['error', 'With details'], ['warning', 'Warn with details']]);
  });

  it('pauses the auto-hide while hovered or focused and restarts it afterwards', () => {
    const service = create({ errorHideAfter: 10_000 });
    service.showError('Hover me');
    // Stand-in for the element Kendo renders; the service finds it by its class after 50 ms.
    const element = document.createElement('div');
    element.className = shown[0].settings.cssClass as string;
    document.body.appendChild(element);
    vi.advanceTimersByTime(50);

    element.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(30_000);
    expect(shown[0].hide).not.toHaveBeenCalled();

    element.dispatchEvent(new FocusEvent('focusin'));
    element.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(30_000);
    expect(shown[0].hide).not.toHaveBeenCalled();

    element.dispatchEvent(new FocusEvent('focusout'));
    vi.advanceTimersByTime(9_999);
    expect(shown[0].hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(shown[0].hide).toHaveBeenCalled();
    element.remove();
  });

  it('de-duplicates on type, text AND details', () => {
    const service = create();
    service.showError('Save failed', 'first cause');
    service.showError('Save failed', 'first cause');
    service.showError('Save failed', 'second cause');
    expect(shown.length).toBe(2);
  });

  it('never evicts an error or warning in favour of a success or info', () => {
    const service = create({ maxVisible: 2 });
    service.showError('e1');
    service.showWarning('w1');
    service.showSuccess('saved');
    expect(service.visibleToasts()).toEqual([['error', 'e1'], ['warning', 'w1']]);
    service.showError('e2');
    // The warning is the lowest severity left.
    expect(service.visibleToasts()).toEqual([['error', 'e1'], ['error', 'e2']]);
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
