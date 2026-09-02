import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {firstValueFrom, map} from 'rxjs';
import {DetailedError, HttpRequest, Upload} from 'tus-js-client';
import {AuthorizeService} from '@meshmakers/shared-auth';
import {JobResponseDto} from '../shared/jobResponseDto';
import {JobDto} from '../shared/jobDto';
import {ImportStrategyDto} from '../shared/importStrategyDto';
import {TimeWindowDto} from '../shared/timeWindowDto';
import {CONFIGURATION_SERVICE} from './configuration.service';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly authorizeService = inject(AuthorizeService);

  /**
   * Builds the tenant-scoped jobs API base URL for an explicit tenant (AB#5060), following the same
   * `{serviceUrl}{tenantId}/v1/...` shape the other tenant-addressed services use.
   *
   * The tenant is deliberately an argument rather than the ambient `TENANT_ID_PROVIDER` route
   * tenant: these operations legitimately target a *child* tenant (backing up a child from the
   * Child Tenants list), which the bot service permits via `[AllowParentTenantAdministration]`.
   * Putting the tenant in the route is what makes the transport tenant gate see these calls at all —
   * as a `?tenantId=` query parameter they bypassed it.
   */
  private jobsBaseUrlForTenant(tenantId: string): string | null {
    const botServicesUrl = this.configurationService.config?.botServices;
    if (!botServicesUrl) return null;
    return `${botServicesUrl}${tenantId}/v1/jobs/`;
  }

  public async runFixupScripts(tenantId: string): Promise<JobResponseDto | null> {
    const baseUrl = this.jobsBaseUrlForTenant(tenantId);

    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(baseUrl + 'run-fixup-scripts', null, {
        observe: 'response'
      }));

      return r.body;
    }
    return null;
  }

  /**
   * Starts a tenant repository dump (backup) job.
   *
   * When `includeArchiveData` is `true` the produced artifact additionally bundles the tenant's
   * CrateDB archive row data (AB#4231, concept §7). The default (`false`) keeps the historical,
   * fully backward-compatible behaviour (Mongo metadata/config only → single `.tar.gz`); with the
   * flag set the bot job emits a larger `.octobak.zip` container instead.
   *
   * Bot contract: `POST {tenantId}/v1/jobs/dump-repository?includeArchiveData=` (AB#5060).
   */
  public async dumpRepository(tenantId: string, includeArchiveData = false): Promise<JobResponseDto | null> {
    const params = new HttpParams()
      .set('includeArchiveData', includeArchiveData);

    const baseUrl = this.jobsBaseUrlForTenant(tenantId);
    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(baseUrl + 'dump-repository', null, {
        params,
        observe: 'response'
      }));

      return r.body;
    }
    return null;
  }

  /**
   * @deprecated Dead as of AB#5060 — do not migrate it, remove it.
   *
   * There is no `restore-repository` route in the bot service any more, on the system API or
   * anywhere else: only the `IRestoreRepositoryJob` this multipart variant used to enqueue survives,
   * and `restore-from-upload` is what enqueues it now. So this method posts to an endpoint that does
   * not exist, and its only callers are its own spec tests — the tus flow superseded it.
   *
   * It is left in place rather than deleted because it is public API of a published package; removing
   * it is a breaking change that belongs in a deliberate major, not in this migration. It is called
   * out here so that stage 3 does not mistake it for a caller still to be moved.
   */
  public async restoreRepository(tenantId: string, databaseName: string, file: File): Promise<JobResponseDto | null> {
    const params = new HttpParams().set('tenantId', tenantId).set('databaseName', databaseName);

    if (this.configurationService.config?.botServices) {
      const formData: FormData = new FormData();
      formData.append('file', file, file.name);

      const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(this.configurationService.config.botServices + 'system/v1/jobs/restore-repository', formData, {
        params,
        observe: 'response'
      }));

      return r.body;
    }
    return null;
  }

  /**
   * Downloads the artifact a finished job produced.
   *
   * Deliberately still on the system route (AB#5060): a Hangfire job id is global to the instance,
   * so this action is instance-scoped rather than tenant-scoped and got no tenant route. It is
   * guarded by the job API scope alone — the transport tenant gate reads a *route* tenant, and a
   * system route has none.
   */
  public async downloadJobResultBinary(tenantId: string, jobId: string): Promise<Blob | null> {
    const params = new HttpParams().set('tenantId', tenantId).set('id', jobId);

    if (this.configurationService.config?.botServices) {
      return await firstValueFrom(this.httpClient.get(this.configurationService.config.botServices + 'system/v1/jobs/download', {
        params,
        responseType: 'blob'
      }));
    }
    return null;
  }

  /**
   * Polls a job by id. Job ids are not tenant-addressed, so this stays on the system route
   * (AB#5060 moved only the five tenant-securing verbs).
   */
  public async getJobStatus(jobId: string): Promise<JobDto | null> {
    const params = new HttpParams().set('id', jobId);

    if (this.configurationService.config?.botServices) {
      return firstValueFrom(this.httpClient
        .get<JobDto>(this.configurationService.config.botServices + 'system/v1/jobs', {
          params,
          observe: 'response'
        })
        .pipe(
          map((res) => {
            return res.body;
          })
        ));
    }
    return null;
  }

  /**
   * Starts an asynchronous archive-data export job (AB#4230, concept §5.1 / §8.2). The bot job
   * orchestrates the CrateDB row stream into a downloadable ZIP (`metadata.json` + `data.ndjson`);
   * the produced artifact is fetched afterwards via {@link downloadJobResultBinary}.
   *
   * When `window` is omitted the whole archive is exported; when supplied only rows whose
   * timestamp / `window_start` fall in `[fromUtc, toUtc)` are included.
   *
   * Bot contract:
   * `POST {tenantId}/v1/jobs/export-archive-data?archiveRtId=&fromUtc=&toUtc=` → `{ jobId }` (AB#5060).
   */
  public async startExportArchiveData(
    tenantId: string,
    archiveRtId: string,
    window?: TimeWindowDto
  ): Promise<JobResponseDto | null> {
    const baseUrl = this.jobsBaseUrlForTenant(tenantId);
    if (!baseUrl) {
      return null;
    }

    let params = new HttpParams()
      .set('archiveRtId', archiveRtId);

    if (window) {
      params = params.set('fromUtc', window.fromUtc).set('toUtc', window.toUtc);
    }

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      baseUrl + 'export-archive-data',
      null,
      {params, observe: 'response'}
    ));

    return r.body;
  }

  /**
   * Uploads an archive-data ZIP via TUS (resumable, large-file safe — same transport as tenant
   * restore) and starts the import job (AB#4230, concept §5.1 / §8.2). The job validates the
   * `metadata.json` schema against the live target archive (concept §6) before any write; on a
   * mismatch the job fails with a field-level message that surfaces through
   * `JobManagementService.waitForJob` → `MessageService.showErrorWithDetails`.
   *
   * Bot contract:
   * 1. TUS upload to `system/v1/tus-upload` (metadata: `filename`, `filetype`, `tenantId`,
   *    `archiveRtId`, `importMode`). The upload sink stays tenant-neutral by design (AB#5060): it
   *    is a staging area keyed by tus file id, and the tenant-carrying, gated decision is step 2.
   * 2. `POST {tenantId}/v1/jobs/import-archive-data-from-upload?tusFileId=&archiveRtId=&mode=`
   *    → `{ jobId }` (AB#5060).
   */
  public async startImportArchiveDataWithUpload(
    tenantId: string,
    archiveRtId: string,
    file: File,
    mode: ImportStrategyDto,
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  ): Promise<JobResponseDto | null> {
    const botServicesUrl = this.configurationService.config?.botServices;
    const baseUrl = this.jobsBaseUrlForTenant(tenantId);
    if (!botServicesUrl || !baseUrl) {
      return null;
    }

    const tusFileId = await this.uploadArchiveDataZip(botServicesUrl, tenantId, archiveRtId, mode, file, onProgress);

    const params = new HttpParams()
      .set('tusFileId', tusFileId)
      .set('archiveRtId', archiveRtId)
      .set('mode', mode.toString());

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      baseUrl + 'import-archive-data-from-upload',
      null,
      {params, observe: 'response'}
    ));

    return r.body;
  }

  private uploadArchiveDataZip(
    botServicesUrl: string,
    tenantId: string,
    archiveRtId: string,
    mode: ImportStrategyDto,
    file: File,
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const metadata: Record<string, string> = {
        filename: file.name,
        filetype: file.type || 'application/zip',
        tenantId,
        archiveRtId,
        importMode: mode.toString()
      };

      const upload = new Upload(file, {
        endpoint: botServicesUrl + 'system/v1/tus-upload',
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: 50 * 1024 * 1024,
        metadata,
        onBeforeRequest: (req: HttpRequest) => {
          const token = this.authorizeService.getAccessTokenSync();
          if (token) {
            req.setHeader('Authorization', `Bearer ${token}`);
          }
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          onProgress?.(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          const uploadUrl = upload.url;
          if (!uploadUrl) {
            reject(new Error('Upload succeeded but no URL returned'));
            return;
          }
          const tusFileId = uploadUrl.substring(uploadUrl.lastIndexOf('/') + 1);
          resolve(tusFileId);
        },
        onError: (error: Error | DetailedError) => {
          reject(new Error(`Upload failed: ${error.message}`));
        }
      });

      upload.start();
    });
  }
}
