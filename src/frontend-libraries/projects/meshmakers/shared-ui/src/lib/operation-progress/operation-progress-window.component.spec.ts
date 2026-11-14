import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { BehaviorSubject } from 'rxjs';
import { OperationProgressWindowComponent } from './operation-progress-window.component';
import { OperationProgressView } from './operation-progress.model';

describe('OperationProgressWindowComponent (AB#8448)', () => {
  function create(view: OperationProgressView, setup?: (component: OperationProgressWindowComponent) => void) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [OperationProgressWindowComponent],
      providers: [provideNoopAnimations(), { provide: DialogRef, useValue: { close } }]
    });
    const fixture = TestBed.createComponent(OperationProgressWindowComponent);
    const views = new BehaviorSubject<OperationProgressView>(view);
    fixture.componentInstance.viewChanges = views;
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
    return { fixture, views, close, el: fixture.nativeElement as HTMLElement };
  }

  it('follows the view stream and offers Download once the operation succeeded', () => {
    const onDownload = vi.fn();
    const { fixture, views, el } = create({ status: 'running', methodLabel: 'Tenant backup' }, c => c.onDownload = onDownload);
    expect(el.querySelector('[data-download]')).toBeNull();
    expect(el.querySelector('[data-close]')).not.toBeNull();

    views.next({ status: 'succeeded', methodLabel: 'Tenant backup', canDownload: true });
    fixture.detectChanges();
    (el.querySelector('[data-download]') as HTMLButtonElement).click();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('logs a rejected host download instead of leaving an unhandled rejection', async () => {
    const onDownload = vi.fn().mockRejectedValue(new Error('offline'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { el } = create({ status: 'succeeded', methodLabel: 'Tenant backup', canDownload: true }, c => c.onDownload = onDownload);
    (el.querySelector('[data-download]') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve));
    expect(onDownload).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Operation download failed', expect.any(Error));
  });

  it('calls the host download synchronously within the click', () => {
    const onDownload = vi.fn();
    const { el } = create({ status: 'succeeded', methodLabel: 'Tenant backup', canDownload: true }, c => c.onDownload = onDownload);
    (el.querySelector('[data-download]') as HTMLButtonElement).click();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('closes on Close without any cancel action', () => {
    const { el, close } = create({ status: 'running', methodLabel: 'Tenant backup' });
    const labels = Array.from(el.querySelectorAll('button')).map(b => b.textContent?.trim());
    expect(labels).not.toContain('Cancel');
    (el.querySelector('[data-close]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalled();
  });

  it('closes and hands over to the host for "Start again" of a lost operation', () => {
    const onStartNew = vi.fn();
    const { el, close } = create({ status: 'outcomeUnknown', methodLabel: 'Tenant backup', canStartNew: true },
      c => c.onStartNew = onStartNew);
    (el.querySelector('kendo-dialog-actions [data-start-new]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalled();
    expect(onStartNew).toHaveBeenCalled();
  });

  it('closes and hands over to the host for the My operations link', () => {
    const onOpenOperations = vi.fn();
    const { el, close } = create({ status: 'running', methodLabel: 'Tenant backup' }, c => c.onOpenOperations = onOpenOperations);
    (el.querySelector('[data-open-operations]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalled();
    expect(onOpenOperations).toHaveBeenCalled();
  });
});
