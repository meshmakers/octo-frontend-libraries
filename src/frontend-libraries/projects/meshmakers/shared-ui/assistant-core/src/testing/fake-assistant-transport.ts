import { signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AssistantSendRequest, AssistantStreamEvent, AssistantTransport, AssistantTransportStatus } from '../assistant.models';

/**
 * Test double for {@link AssistantTransport} (specs only — never provided by the app).
 * Each `send` returns a Subject the spec drives with `emit` / `complete`.
 */
export class FakeAssistantTransport implements AssistantTransport {
  readonly status = signal<AssistantTransportStatus>('ready');
  readonly statusMessage = signal<string | null>(null);
  readonly requests: AssistantSendRequest[] = [];
  private turn: Subject<AssistantStreamEvent> | null = null;

  send(request: AssistantSendRequest): Observable<AssistantStreamEvent> {
    this.requests.push(request);
    this.turn = new Subject<AssistantStreamEvent>();
    return this.turn.asObservable();
  }

  emit(event: AssistantStreamEvent): void {
    this.turn?.next(event);
  }

  fail(error: Error): void {
    this.turn?.error(error);
  }

  complete(): void {
    this.turn?.complete();
  }
}
