import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OperationProgressComponent } from './operation-progress.component';
import { OperationProgressView } from './operation-progress.model';

describe('OperationProgressComponent (AB#8448)', () => {
  let fixture: ComponentFixture<OperationProgressComponent>;

  async function render(view: OperationProgressView, inputs: Record<string, unknown> = {}): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [OperationProgressComponent],
      providers: [provideNoopAnimations()]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationProgressComponent);
    fixture.componentRef.setInput('view', view);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const running: OperationProgressView = {
    status: 'running',
    methodLabel: 'Tenant backup',
    startedAt: '2026-11-14T06:29:12Z'
  };

  it('shows state, method and start time of a running operation', async () => {
    const el = await render(running);
    expect(el.querySelector('[data-state]')?.textContent?.trim()).toBe('Running');
    expect(el.querySelector('[data-method]')?.textContent?.trim()).toBe('Tenant backup');
    expect(el.querySelector('[data-started]')?.textContent?.trim()).toBeTruthy();
  });

  it('renders an indeterminate bar while no percentage is reported', async () => {
    const el = await render(running);
    expect(el.querySelector('[data-progress="indeterminate"]')).not.toBeNull();
    expect(el.querySelector('[data-progress="determinate"]')).toBeNull();
  });

  it('renders a determinate bar with the reported percentage, clamped to 0–100', async () => {
    const el = await render({ ...running, percent: 140, stageText: 'Dumping the database' });
    expect(el.querySelector('[data-progress="determinate"]')).not.toBeNull();
    expect((fixture.componentInstance as unknown as { percent: () => number }).percent()).toBe(100);
    expect(el.querySelector('[data-stage]')?.textContent).toContain('Dumping the database');
  });

  it('never shows a cancel button', async () => {
    const el = await render(running);
    const labels = Array.from(el.querySelectorAll('button')).map(b => b.textContent?.trim().toLowerCase());
    expect(labels).not.toContain('cancel');
  });

  it('offers the download and shows the expiry date of a succeeded operation', async () => {
    const el = await render({
      status: 'succeeded', methodLabel: 'Tenant backup', canDownload: true,
      completedAt: '2026-11-14T06:30:00Z', expiresAt: '2026-11-21T06:30:00Z'
    });
    let downloads = 0;
    fixture.componentInstance.download.subscribe(() => downloads++);
    expect(el.querySelector('[data-expires]')?.textContent).toContain('Available for download until');
    (el.querySelector('[data-download]') as HTMLButtonElement).click();
    expect(downloads).toBe(1);
    expect(el.querySelector('kendo-progressbar')).toBeNull();
  });

  it('shows error code and message of a failed operation', async () => {
    const el = await render({
      status: 'failed', methodLabel: 'Tenant backup', errorCode: 'DUMP_FAILED', errorMessage: 'The dump job failed.'
    });
    expect(el.querySelector('[data-error-code]')?.textContent).toBe('DUMP_FAILED');
    expect(el.querySelector('[data-error-message]')?.textContent).toBe('The dump job failed.');
    expect(el.querySelector('[data-outcome-unknown]')).toBeNull();
  });

  it('shows the distinct outcome-unknown message with a start-again action', async () => {
    const el = await render({ status: 'outcomeUnknown', methodLabel: 'Tenant backup', canStartNew: true });
    let starts = 0;
    fixture.componentInstance.startNew.subscribe(() => starts++);
    expect(el.querySelector('[data-state]')?.textContent?.trim()).toBe('Outcome unknown');
    expect(el.querySelector('[data-outcome-unknown]')?.textContent).toContain('not restarted automatically');
    (el.querySelector('[data-start-new]') as HTMLButtonElement).click();
    expect(starts).toBe(1);
  });

  it('says that an expired or unknown operation is no longer available', async () => {
    const el = await render({ status: 'notAvailable', methodLabel: 'Tenant backup' });
    expect(el.querySelector('[data-not-available]')?.textContent).toContain('kept for 7 days');
    expect(el.querySelector('kendo-progressbar')).toBeNull();
  });

  it('shows the connection hint while a running operation cannot be read', async () => {
    const el = await render({ ...running, connectionLost: true });
    expect(el.querySelector('[data-connection-lost]')).not.toBeNull();
  });

  it('emits openOperations from the My operations link', async () => {
    const el = await render(running, { showOperationsLink: true });
    let opened = 0;
    fixture.componentInstance.openOperations.subscribe(() => opened++);
    (el.querySelector('[data-open-operations]') as HTMLButtonElement).click();
    expect(opened).toBe(1);
  });

  it('uses message overrides', async () => {
    const el = await render(running, { messages: { running: 'Läuft' } });
    expect(el.querySelector('[data-state]')?.textContent?.trim()).toBe('Läuft');
  });
});
