import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { AI_ADAPTER_OPTIONS } from './ai-adapter-options';
import { AiAdapterClientService } from './ai-adapter-client.service';
import {
  AiSessionEventDto,
  AiSessionStatusChangedDto,
} from '../models/ai-session-event';
import {
  AiApprovalDecidedDto,
  AiApprovalRequestedDto,
} from '../models/ai-approval';
import { AiQuotaWarningDto } from '../models/ai-quota';

/**
 * One open SignalR connection's worth of streams. Sessions get one
 * `SessionStream` per `streamSession()` call; closing the returned subscription
 * tears the connection down.
 */
export interface AiSessionStream {
  /** Stream-json lines plus orchestrator markers, ordered by `sequence`. */
  readonly events$: Observable<AiSessionEventDto>;
  /** Lifecycle transitions for the session. */
  readonly statusChanges$: Observable<AiSessionStatusChangedDto>;
  /** Approval gate fired — UI opens the modal. */
  readonly approvalsRequested$: Observable<AiApprovalRequestedDto>;
  /** Approval resolved — UI dismisses the modal in every tab. */
  readonly approvalsDecided$: Observable<AiApprovalDecidedDto>;
  /** Tenant-wide quota threshold crossed — UI renders a banner. */
  readonly quotaWarnings$: Observable<AiQuotaWarningDto>;

  /** Tear down the underlying SignalR connection and complete all observables. */
  disconnect(): void;
}

/**
 * Internal wrapper around the SignalR connection. The library does not pin a
 * SignalR version — host applications inject a `HubConnectionBuilder` they
 * already use, which keeps the library agnostic of the
 * `@microsoft/signalr` major version line (six and seven have diverged on the
 * `withAutomaticReconnect()` defaults).
 *
 * For now the connection is constructed deferred — `streamSession` builds it on
 * demand so the host can defer the SignalR JS bundle behind a route lazy-load.
 * Phase-1 ships a stub backed by `ReplaySubject` so demo apps can drive
 * components without a live hub; the real connection wiring lives behind a
 * `connectionFactory` provider the host overrides.
 */
@Injectable({ providedIn: 'root' })
export class AiSessionStreamService {
  private readonly options = inject(AI_ADAPTER_OPTIONS);
  private readonly client = inject(AiAdapterClientService);

  /**
   * Open a streaming session. Returns the per-stream subjects and a
   * `disconnect()` closer. The current Phase-1 implementation only backfills
   * persisted events via REST; the live hub bridge is wired into the host's
   * `AiSessionStreamConnectionFactory` overlay (delivered alongside #4122).
   *
   * Tracking the highest sequence we've emitted lets the caller restart the
   * stream after a network blip by passing `sinceSequence` to `replay()`.
   */
  streamSession(sessionId: string): AiSessionStream {
    const events$ = new ReplaySubject<AiSessionEventDto>(256);
    const statusChanges$ = new Subject<AiSessionStatusChangedDto>();
    const approvalsRequested$ = new Subject<AiApprovalRequestedDto>();
    const approvalsDecided$ = new Subject<AiApprovalDecidedDto>();
    const quotaWarnings$ = new Subject<AiQuotaWarningDto>();

    // Backfill any persisted events the hub-connect process would have missed
    // — for the disconnected-then-reconnect case the caller subsequently calls
    // replay() with the highest sequence the stream emitted.
    let highestSequence = 0;
    const backfill = this.client.listEvents(sessionId).subscribe({
      next: (events) => {
        for (const event of events) {
          highestSequence = Math.max(highestSequence, event.sequence);
          events$.next(event);
        }
      },
    });

    return {
      events$: events$.asObservable(),
      statusChanges$: statusChanges$.asObservable(),
      approvalsRequested$: approvalsRequested$.asObservable(),
      approvalsDecided$: approvalsDecided$.asObservable(),
      quotaWarnings$: quotaWarnings$.asObservable(),
      disconnect: () => {
        backfill.unsubscribe();
        events$.complete();
        statusChanges$.complete();
        approvalsRequested$.complete();
        approvalsDecided$.complete();
        quotaWarnings$.complete();
        // Suppress unused warning while the live hub bridge ships in #4122.
        void highestSequence;
      },
    };
  }

  /**
   * Backfill missing events from a known sequence number and push them into
   * the host's existing stream. Used by a SignalR `onreconnected` hook the
   * host wires up.
   */
  replay(
    sessionId: string,
    sinceSequence: number,
    sink: Subject<AiSessionEventDto>,
  ): void {
    this.client.listEvents(sessionId, sinceSequence).subscribe({
      next: (events) => events.forEach((event) => sink.next(event)),
    });
  }

  /**
   * The base URL of the hub — exposed so the host's connection factory can
   * construct a `HubConnection` against the right path without re-deriving it
   * from `AI_ADAPTER_OPTIONS`.
   */
  get hubUrl(): string {
    const trimmed = this.options.hubPath.startsWith('/')
      ? this.options.hubPath
      : `/${this.options.hubPath}`;
    return `${this.options.baseUrl}${trimmed}`;
  }
}
