import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import type { AssistantSendRequest, AssistantStreamEvent, AssistantTransport } from './assistant.models';
import { ASSISTANT_MESSAGES, DEFAULT_ASSISTANT_MESSAGES, resolveAssistantMessages } from './assistant.messages';

/** The (English) text the panel shows while no backend exists. */
export const ASSISTANT_NOT_CONNECTED_MESSAGE = DEFAULT_ASSISTANT_MESSAGES.notConnected;

/**
 * The default {@link AssistantTransport}: it is never `ready`, so the composer
 * cannot send, and it never produces an answer. It exists so the panel can say
 * honestly that there is no assistant backend (AB#5550) instead of faking one.
 * The message follows `ASSISTANT_MESSAGES.notConnected`.
 */
@Injectable({ providedIn: 'root' })
export class NotConnectedAssistantTransport implements AssistantTransport {
  private readonly message = resolveAssistantMessages(inject(ASSISTANT_MESSAGES, { optional: true })).notConnected;

  readonly status = signal('unavailable' as const).asReadonly();
  readonly statusMessage = signal<string | null>(this.message).asReadonly();

  send(_request: AssistantSendRequest): Observable<AssistantStreamEvent> {
    return throwError(() => new Error(this.message));
  }
}
