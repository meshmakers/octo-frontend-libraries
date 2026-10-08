import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NotificationService } from '@progress/kendo-angular-notification';
import { MessageDetailsDialogService, NOTIFICATION_DISPLAY_OPTIONS, NotificationDisplayService } from '@meshmakers/shared-ui';
import { SHELL_NOTIFICATION_OPTIONS } from './shell-notifications';

describe('Shell toast stacking (AB#5516)', () => {
  let service: NotificationDisplayService;
  let hides: ReturnType<typeof vi.fn>[];

  beforeEach(() => {
    vi.useFakeTimers();
    hides = [];
    TestBed.configureTestingModule({
      providers: [
        NotificationDisplayService,
        { provide: NOTIFICATION_DISPLAY_OPTIONS, useValue: SHELL_NOTIFICATION_OPTIONS },
        { provide: Router, useValue: { events: new Subject() } },
        { provide: MessageDetailsDialogService, useValue: { showDetailsDialog: vi.fn() } },
        {
          provide: NotificationService,
          useValue: {
            show: () => {
              const afterHide = new Subject<void>();
              const hide = vi.fn(() => afterHide.next());
              hides.push(hide);
              return { hide, afterHide };
            }
          }
        }
      ]
    });
    service = TestBed.inject(NotificationDisplayService);
  });

  afterEach(() => vi.useRealTimers());

  it('shows a burst of identical errors once, at most three toasts, and lets errors leave', () => {
    for (let i = 0; i < 3; i++) {
      service.showError("RtCkTypeId 'Meshmakers.Accounting/CostCategory' not found.");
    }
    service.showError("RtCkTypeId 'Meshmakers.Accounting/AccountingDocument' not found.");
    service.showError("RtCkTypeId 'Meshmakers.Accounting/FiscalYear' not found.");
    service.showWarning('Slow query');

    expect(hides.length).toBe(4);
    expect(service.visibleToasts().length).toBe(3);

    vi.advanceTimersByTime(10_000);
    expect(service.visibleToasts()).toEqual([]);
  });

  it('keeps an error with details until it is closed and drops a success before an error', () => {
    service.showError('Saving failed', 'GraphQL error: …');
    service.showError('Load failed');
    service.showWarning('Slow query');
    service.showSuccess('Saved');
    expect(service.visibleToasts()).toEqual([['error', 'Saving failed'], ['error', 'Load failed'], ['warning', 'Slow query']]);

    vi.advanceTimersByTime(60_000);
    expect(service.visibleToasts()).toEqual([['error', 'Saving failed']]);
  });
});
