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
import {
  IssueAiCredentialTicketRequestDto,
  IssueAiCredentialTicketResponseDto,
} from '../models/ai-credential-ticket';

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
/**
 * Not `providedIn: 'root'` — `AI_ADAPTER_OPTIONS` is provided per-route in host
 * apps (the tenant id is read from the route param, which the root injector
 * doesn't see). A root-provided service would resolve through the root injector
 * and fail with NG0201 on `AI_ADAPTER_OPTIONS`. Standalone components that
 * inject this service pick up the route-level provider via the element
 * injector hierarchy.
 */
@Injectable()
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

  /**
   * `POST /{tenantId}/v1/credentials/tickets` — mint a one-time credential-
   * registration ticket (#4133). The admin sees the plaintext code once in
   * the response; the server stores only the SHA-256 hash. The matching
   * redemption call (`POST /v1/credentials/tickets/redeem`) is anonymous and
   * NOT in this client because the redeemer is by design a different person
   * on a different machine — they use the bastion CLI, not the Studio.
   */
  issueCredentialTicket(
    request: IssueAiCredentialTicketRequestDto,
  ): Observable<IssueAiCredentialTicketResponseDto> {
    return this.http.post<IssueAiCredentialTicketResponseDto>(
      `${this.tenantBase()}/credentials/tickets`,
      request,
    );
  }

  private tenantBase(): string {
    return `${this.options.baseUrl}/${encodeURIComponent(this.options.tenantId)}/v1`;
  }
}
