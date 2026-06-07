import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiToolCallComponent } from './ai-tool-call.component';
import { AiToolCallDto } from '../../models/ai-session-event';

describe('AiToolCallComponent', () => {
  let fixture: ComponentFixture<AiToolCallComponent>;

  const call: AiToolCallDto = {
    sessionId: 's',
    callId: 'c1',
    toolName: 'create_entity',
    arguments: { foo: 'bar' },
    result: { ok: true },
    status: 'Succeeded',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T00:00:01Z',
    durationMs: 1000,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiToolCallComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiToolCallComponent);
    fixture.componentRef.setInput('call', call);
    fixture.detectChanges();
  });

  it('renders the tool name + status in the header', () => {
    const header = fixture.nativeElement.querySelector(
      '.mm-ai-tool-call__header',
    );
    expect(header.textContent).toContain('create_entity');
    expect(header.textContent).toContain('Succeeded');
    expect(header.textContent).toContain('1000ms');
  });

  it('hides the body by default and reveals it on click', () => {
    expect(
      fixture.nativeElement.querySelector('.mm-ai-tool-call__body'),
    ).toBeNull();

    fixture.nativeElement
      .querySelector('.mm-ai-tool-call__header')
      .click();
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector('.mm-ai-tool-call__body');
    expect(body).not.toBeNull();
    expect(body.textContent).toContain('"foo": "bar"');
    expect(body.textContent).toContain('"ok": true');
  });
});
