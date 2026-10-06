import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { firstValueFrom } from 'rxjs';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { JobResponseDto } from '../shared/jobResponseDto';
import {
  SecretEnvironmentStatusDto,
  SecretSweepDumpDeleteResult,
  SecretSweepMode,
  SecretSweepReportDto,
  SecretSweepRunDto,
} from '../shared/secretAdministrationDtos';

/**
 * Bot services REST client of the SECRET value type administration (AB#5528 / AB#5544, frontend
 * handover §9): environment encryption status, tenant secret sweeps and their pre-sweep dumps.
 * Like {@link BotService}, every call takes the tenant explicitly and addresses
 * `{botServices}{tenantId}/v1/...`. Methods return `null` when the bot service URL is not
 * configured; HTTP errors (403 missing role, 400 `ConfirmationRequired`) are rethrown as
 * `HttpErrorResponse` for the caller.
 *
 * Roles (handover §6): status — any user with tenant access; sweep runs — `AdminPanelManagement`;
 * starting a sweep and deleting a dump — `SecretManagement`.
 *
 * Tenant (handover §13, 410ade02): the `{tenantId}/v1/secrets/...` routes (status, sweep runs, dump
 * delete) accept only the token's OWN tenant — always pass the current tenant, never a child tenant
 * (child-tenant links only navigate into that tenant). A restore appears as a run with
 * `trigger: Restore`, mode `Encrypt` and `dump: null`.
 */
@Injectable({ providedIn: 'root' })
export class BotSecretsService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);

  private baseUrl(tenantId: string): string | null {
    const botServicesUrl = this.configurationService.config?.botServices;
    return botServicesUrl ? `${botServicesUrl}${tenantId}/v1/` : null;
  }

  /** `GET {tenantId}/v1/secrets/status` — environment-level, identical in every tenant. */
  public async getSecretEnvironmentStatus(tenantId: string): Promise<SecretEnvironmentStatusDto | null> {
    const baseUrl = this.baseUrl(tenantId);
    if (!baseUrl) return null;
    return firstValueFrom(this.httpClient.get<SecretEnvironmentStatusDto>(`${baseUrl}secrets/status`));
  }

  /**
   * `POST {tenantId}/v1/jobs/secret-sweep?mode=&confirm=` — Encrypt and CleanupUnreadable need
   * `confirm = true` (the server answers `400 ConfirmationRequired` otherwise and takes a
   * pre-sweep dump first). Role `SecretManagement`.
   */
  public async startSecretSweep(tenantId: string, mode: SecretSweepMode, confirm = false): Promise<JobResponseDto | null> {
    const baseUrl = this.baseUrl(tenantId);
    if (!baseUrl) return null;
    let params = new HttpParams().set('mode', mode);
    if (confirm) {
      params = params.set('confirm', true);
    }
    return firstValueFrom(this.httpClient.post<JobResponseDto>(`${baseUrl}jobs/secret-sweep`, null, { params }));
  }

  /**
   * `GET {tenantId}/v1/jobs/secret-sweep/report` — the last sweep report of the tenant (counts,
   * unreadable / cleared references, never values); `null` when there is none (`404`) or the bot
   * service URL is not configured. Role `AdminPanelManagement`.
   */
  public async getSecretSweepReport(tenantId: string): Promise<SecretSweepReportDto | null> {
    const baseUrl = this.baseUrl(tenantId);
    if (!baseUrl) return null;
    try {
      return await firstValueFrom(this.httpClient.get<SecretSweepReportDto>(`${baseUrl}jobs/secret-sweep/report`));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * `GET {tenantId}/v1/secrets/sweep-runs?limit=` — newest first. Role `AdminPanelManagement`.
   * A `403` is rethrown WITHOUT the global "Access denied" toast (`MM_CALLER_HANDLED_STATUSES`): the
   * caller explains it in place.
   */
  public async getSecretSweepRuns(tenantId: string, limit = 20): Promise<SecretSweepRunDto[] | null> {
    const baseUrl = this.baseUrl(tenantId);
    if (!baseUrl) return null;
    const params = new HttpParams().set('limit', limit);
    const context = new HttpContext().set(MM_CALLER_HANDLED_STATUSES, [403]);
    return (await firstValueFrom(this.httpClient.get<SecretSweepRunDto[]>(`${baseUrl}secrets/sweep-runs`, { params, context }))) ?? [];
  }

  /**
   * `DELETE {tenantId}/v1/secrets/sweep-runs/{runId}/dump` — deletes a pre-sweep dump before it
   * expires. `404` (unknown run / no dump) and `409` (already deleted) map to a result instead of an
   * error; other errors (e.g. `403` without `SecretManagement`) are rethrown.
   */
  public async deleteSecretSweepDump(tenantId: string, runId: string): Promise<SecretSweepDumpDeleteResult | null> {
    const baseUrl = this.baseUrl(tenantId);
    if (!baseUrl) return null;
    try {
      await firstValueFrom(this.httpClient.delete(`${baseUrl}secrets/sweep-runs/${encodeURIComponent(runId)}/dump`));
      return 'Deleted';
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return 'NotFound';
      if (error instanceof HttpErrorResponse && error.status === 409) return 'AlreadyDeleted';
      throw error;
    }
  }
}
