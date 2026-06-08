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

  function makeEvent(overrides: Partial<AiSessionEventDto>): AiSessionEventDto {
    return {
      sessionId: 'session-1',
      kind: 'Message',
      sequence: 0,
      payload: '{}',
      actorRef: 'agent',
      at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('renders an empty-state when no events are present', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.mm-ai-chat__empty');
    expect(empty).not.toBeNull();
  });

  it('renders an assistant frame with the text content', () => {
    const assistant = makeEvent({
      sequence: 1,
      payload: JSON.stringify({
        type: 'assistant',
        message: {
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: 'pong' }],
          usage: { input_tokens: 6, output_tokens: 1 },
        },
      }),
    });
    fixture.componentRef.setInput('events', [assistant]);
    fixture.detectChanges();

    const bubble = fixture.nativeElement.querySelector(
      '.mm-ai-chat__bubble--assistant',
    );
    expect(bubble).not.toBeNull();
    expect(bubble.textContent).toContain('pong');
    expect(bubble.textContent).toContain('claude-opus-4-7');
  });

  it('collapses a system init event into a single row', () => {
    const init = makeEvent({
      kind: 'StatusChange',
      sequence: 1,
      payload: JSON.stringify({
        type: 'system',
        subtype: 'init',
        model: 'claude-opus-4-7',
      }),
    });
    fixture.componentRef.setInput('events', [init]);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.mm-ai-chat__system--init');
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Worker initialised');
  });

  it('renders the terminal result with duration and tokens', () => {
    const result = makeEvent({
      kind: 'StatusChange',
      sequence: 6,
      payload: JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'pong',
        duration_ms: 2051,
        terminal_reason: 'completed',
        usage: { input_tokens: 6, output_tokens: 6 },
        total_cost_usd: 0.06956,
      }),
    });
    fixture.componentRef.setInput('events', [result]);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.mm-ai-chat__result');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('completed');
    expect(card.textContent).toContain('2.05 s');
    expect(card.textContent).toContain('$0.0696');
  });

  it('sorts events by sequence regardless of input order', () => {
    const second = makeEvent({
      sequence: 2,
      payload: JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'second' }] },
      }),
    });
    const first = makeEvent({
      sequence: 1,
      payload: JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'first' }] },
      }),
    });
    fixture.componentRef.setInput('events', [second, first]);
    fixture.detectChanges();

    const bubbles = fixture.nativeElement.querySelectorAll(
      '.mm-ai-chat__bubble--assistant .mm-ai-chat__text',
    );
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].textContent.trim()).toBe('first');
    expect(bubbles[1].textContent.trim()).toBe('second');
  });
});
