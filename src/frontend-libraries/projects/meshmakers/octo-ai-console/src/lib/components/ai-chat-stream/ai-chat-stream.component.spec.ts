import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiChatStreamComponent } from './ai-chat-stream.component';
import { AiSessionEventDto } from '../../models/ai-session-event';

describe('AiChatStreamComponent', () => {
  let fixture: ComponentFixture<AiChatStreamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiChatStreamComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiChatStreamComponent);
  });

  it('renders an empty-state when no events are present', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.mm-ai-chat__empty');
    expect(empty).not.toBeNull();
  });

  it('sorts events by sequence regardless of input order', () => {
    const events: AiSessionEventDto[] = [
      {
        sessionId: 's',
        kind: 'Message',
        sequence: 2,
        payload: 'second',
        actorRef: 'agent',
        at: '2026-01-01T00:00:01Z',
      },
      {
        sessionId: 's',
        kind: 'Message',
        sequence: 1,
        payload: 'first',
        actorRef: 'agent',
        at: '2026-01-01T00:00:00Z',
      },
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();

    const rendered = fixture.nativeElement.querySelectorAll(
      '.mm-ai-chat__event',
    );
    expect(rendered.length).toBe(2);
    expect(rendered[0].textContent).toContain('first');
    expect(rendered[1].textContent).toContain('second');
  });
});
