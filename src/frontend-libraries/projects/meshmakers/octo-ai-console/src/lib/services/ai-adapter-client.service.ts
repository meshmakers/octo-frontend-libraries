import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AI_ADAPTER_OPTIONS } from './ai-adapter-options';
import {
  AiSessionDto,
  CreateSessionRequestDto,
  CreateSessionResponseDto,
} from '../models/ai-session';
import { AiSessionEventDto } from '../models/ai-session-event';
import { AiApprovalDecisionDto } from '../models/ai-approval';

/**
 * Typed REST client for the AI Adapter's session endpoints. Every method maps
 * 1:1 to a controller route on the C# side
 * (`src/AiServices/TenantApi/v1/Controllers/SessionsController.cs`).
 *
 * The service does NOT cache responses or hold session state — each call is a
 * pure pass-through to `HttpClient`. Components that need a derived view (e.g.
 * a session list with status counts) should compose over the returned
 * observables themselves; that keeps the client free of UI concerns and lets
 * host apps mix Apollo / GraphQL state in the same component without dueling
 * caches.
 */
@Injectable({ providedIn: 'root' })
export class AiAdapterClientService {
  private readonly http = inject(HttpClient);
  private readonly options = inject(AI_ADAPTER_OPTIONS);

  /**
   * `GET /{tenantId}/v1/sessions` — list all sessions for the configured tenant.
   * Optional `status` filter narrows to one lifecycle state when present.
   */
  listSessions(status?: string): Observable<AiSessionDto[]> {
    const url = `${this.tenantBase()}/sessions`;
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<AiSessionDto[]>(url, { params });
  }

  /** `GET /{tenantId}/v1/sessions/{sessionId}` — single session by rtId. */
  getSession(sessionId: string): Observable<AiSessionDto> {
    return this.http.get<AiSessionDto>(
      `${this.tenantBase()}/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  /**
   * `POST /{tenantId}/v1/sessions` — start a new session. Returns the persisted
   * session plus the quota gate's decision so the caller can render either a
   * "Running" pill or a "Queued (n)" pill without a second round-trip.
   */
  createSession(
    request: CreateSessionRequestDto,
  ): Observable<CreateSessionResponseDto> {
    return this.http.post<CreateSessionResponseDto>(
      `${this.tenantBase()}/sessions`,
      request,
    );
  }

  /**
   * `POST /{tenantId}/v1/sessions/{sessionId}/cancel` — request graceful
   * cancellation; the orchestrator transitions the session to `Cancelled`
   * once the worker has acknowledged.
   */
  cancelSession(sessionId: string): Observable<AiSessionDto> {
    return this.http.post<AiSessionDto>(
      `${this.tenantBase()}/sessions/${encodeURIComponent(sessionId)}/cancel`,
      null,
    );
  }

  /**
   * `GET /{tenantId}/v1/sessions/{sessionId}/events?sinceSequence=N` — replay
   * persisted events for a session. UI uses this on reconnect to backfill any
   * events SignalR missed while disconnected (drives the resume-from-sequence
   * path in {@link AiSessionStreamService}).
   */
  listEvents(
    sessionId: string,
    sinceSequence?: number,
  ): Observable<AiSessionEventDto[]> {
    const url = `${this.tenantBase()}/sessions/${encodeURIComponent(sessionId)}/events`;
    let params = new HttpParams();
    if (sinceSequence != null) {
      params = params.set('sinceSequence', sinceSequence.toString());
    }
    return this.http.get<AiSessionEventDto[]>(url, { params });
  }

  /**
   * `POST /{tenantId}/v1/sessions/{sessionId}/approvals/{requestId}` — submit
   * the user's decision on a paused approval gate. Server fans
   * `OnApprovalDecidedAsync` to every connection on the session.
   */
  decideApproval(
    sessionId: string,
    requestId: string,
    decision: AiApprovalDecisionDto,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.tenantBase()}/sessions/${encodeURIComponent(sessionId)}` +
        `/approvals/${encodeURIComponent(requestId)}`,
      decision,
    );
  }

  private tenantBase(): string {
    return `${this.options.baseUrl}/${encodeURIComponent(this.options.tenantId)}/v1`;
  }
}
