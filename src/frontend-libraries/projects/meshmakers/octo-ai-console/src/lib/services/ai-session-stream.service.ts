import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import {
  AI_ADAPTER_OPTIONS,
  AI_SESSION_STREAM_CONNECTION_FACTORY,
  AiHubConnectionLike,
} from './ai-adapter-options';
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
/**
 * Not `providedIn: 'root'` — see <see cref="AiAdapterClientService"/> for the
 * rationale: `AI_ADAPTER_OPTIONS` is a per-route token, the root injector
 * cannot resolve it. Element-level injection picks up the route-level provider.
 */
@Injectable()
export class AiSessionStreamService {
  private readonly options = inject(AI_ADAPTER_OPTIONS);
  private readonly client = inject(AiAdapterClientService);
  private readonly connectionFactory = inject(
    AI_SESSION_STREAM_CONNECTION_FACTORY,
    { optional: true },
  );

  /**
   * Open a streaming session. Returns the per-stream subjects and a
   * `disconnect()` closer. When the host has provided an
   * {@link AI_SESSION_STREAM_CONNECTION_FACTORY}, a live SignalR connection is
   * built against {@link hubUrl} and the five hub callbacks
   * (`OnSessionEventAsync`, `OnSessionStatusChangedAsync`,
   * `OnApprovalRequestedAsync`, `OnApprovalDecidedAsync`, `OnQuotaWarningAsync`)
   * are routed into the matching subject. Without a factory, the service
   * degrades to REST-only backfill — the original Phase-1 stub contract.
   *
   * Tracking the highest sequence we've emitted lets the host reconnect after a
   * network blip by passing `sinceSequence` to {@link replay} (the SignalR
   * `onreconnected` hook fires that with the highest seen sequence).
   */
  streamSession(sessionId: string): AiSessionStream {
    const events$ = new ReplaySubject<AiSessionEventDto>(256);
    const statusChanges$ = new Subject<AiSessionStatusChangedDto>();
    const approvalsRequested$ = new Subject<AiApprovalRequestedDto>();
    const approvalsDecided$ = new Subject<AiApprovalDecidedDto>();
    const quotaWarnings$ = new Subject<AiQuotaWarningDto>();

    // Backfill any persisted events the hub-connect process would have missed
    // — REST returns the full history up to "now", and the live channel takes
    // it from there. The combination is at-least-once with deterministic
    // ordering courtesy of the persisted `sequence` field.
    let highestSequence = 0;
    const backfill = this.client.listEvents(sessionId).subscribe({
      next: (events) => {
        for (const event of events) {
          highestSequence = Math.max(highestSequence, event.sequence);
          events$.next(event);
        }
      },
    });

    let connection: AiHubConnectionLike | null = null;
    if (this.connectionFactory) {
      connection = this.connectionFactory(this.hubUrl);
    }

    if (connection) {
      const conn = connection;
      conn.on('OnSessionEventAsync', (payload) => {
        const event = payload as AiSessionEventDto;
        highestSequence = Math.max(highestSequence, event.sequence ?? 0);
        events$.next(event);
      });
      conn.on('OnSessionStatusChangedAsync', (payload) => {
        statusChanges$.next(payload as AiSessionStatusChangedDto);
      });
      conn.on('OnApprovalRequestedAsync', (payload) => {
        approvalsRequested$.next(payload as AiApprovalRequestedDto);
      });
      conn.on('OnApprovalDecidedAsync', (payload) => {
        approvalsDecided$.next(payload as AiApprovalDecidedDto);
      });
      conn.on('OnQuotaWarningAsync', (payload) => {
        quotaWarnings$.next(payload as AiQuotaWarningDto);
      });
      conn.onreconnected(() => {
        // Pull anything we missed during the disconnect window so the
        // events$ stream stays gap-free without the caller having to do
        // their own bookkeeping.
        this.replay(sessionId, highestSequence, events$);
      });

      // Start the connection, then ask the hub to scope this connection's
      // group membership to the session. Failures are intentionally swallowed
      // — backfill stays valid and the UI degrades to REST-only instead of
      // crashing.
      conn
        .start()
        .then(() => conn.invoke('SubscribeToSessionAsync', sessionId))
        .catch(() => {
          /* hub start / subscribe failed — REST backfill still serves the UI */
        });
    }

    return {
      events$: events$.asObservable(),
      statusChanges$: statusChanges$.asObservable(),
      approvalsRequested$: approvalsRequested$.asObservable(),
      approvalsDecided$: approvalsDecided$.asObservable(),
      quotaWarnings$: quotaWarnings$.asObservable(),
      disconnect: () => {
        backfill.unsubscribe();
        if (connection) {
          // Best-effort — `stop()` may reject during teardown; the subjects
          // get completed regardless so consumers see clean termination.
          connection.stop().catch(() => undefined);
          connection = null;
        }
        events$.complete();
        statusChanges$.complete();
        approvalsRequested$.complete();
        approvalsDecided$.complete();
        quotaWarnings$.complete();
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
    sink: Subject<AiSessionEventDto> | ReplaySubject<AiSessionEventDto>,
  ): void {
    this.client.listEvents(sessionId, sinceSequence).subscribe({
      next: (events) => events.forEach((event) => sink.next(event)),
    });
  }

  /**
   * Tenant-scoped hub URL. Composition matches the AI Adapter's hub map —
   * `app.MapHub<AiHub>("/{tenantId:tenantId}/aiHub")` — so the host's
   * `hubPath` is appended after the tenant segment. Host apps that mount the
   * hub at a different relative path override `hubPath` via
   * `AI_ADAPTER_OPTIONS`.
   */
  get hubUrl(): string {
    const trimmed = this.options.hubPath.startsWith('/')
      ? this.options.hubPath
      : `/${this.options.hubPath}`;
    return `${this.options.baseUrl}/${this.options.tenantId}${trimmed}`;
  }
}
