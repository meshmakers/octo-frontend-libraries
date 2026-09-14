import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {DetailedError, HttpRequest, Upload} from 'tus-js-client';
import {AuthorizeService} from '@meshmakers/shared-auth';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {JobResponseDto} from '../shared/jobResponseDto';

/**
 * Builds the bot service's tus upload endpoint for a tenant.
 *
 * Tenant-routed since AB#5060. It used to be `system/v1/tus-upload` with the tenant sent only as
 * upload metadata, which the bot service's transport tenant gate never saw — the gate reads the
 * route value — and which bound nothing, because the file was stored flat under its tus file id and
 * no consumer read the metadata back. The service now stages uploads under the tenant's own
 * directory. `tenantId` is still sent as metadata for compatibility; the service refuses a metadata
 * tenant that disagrees with the route rather than silently preferring one.
 *
 * Exported so it can be asserted directly: the upload itself needs a real tus server, so specs stub
 * the transfer out — and a stubbed transfer hides the URL, which is the part that matters here.
 */
export function buildTusEndpoint(botServicesUrl: string, tenantId: string): string {
  return `${botServicesUrl}${encodeURIComponent(tenantId)}/v1/tus-upload`;
}

export interface TusUploadOptions {
  file: File;
  tenantId: string;
  databaseName: string;
  oldDatabaseName?: string;
  /**
   * Opt-in flag (AB#4231, concept §7) to also restore the tenant's CrateDB archive row data when
   * the uploaded artifact is an `.octobak.zip` container that carries archives. Defaults to
   * `false`, in which case only the Mongo dump is restored (identical to legacy behaviour); a
   * legacy `.tar.gz` ignores the flag.
   */
  restoreArchiveData?: boolean;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  /**
   * Status callback for the phase after the upload: invoked when the restore-job start is being
   * retried (see the 403 retry on `startUpload`), so a progress UI can say why nothing moves.
   */
  onStatus?: (statusText: string) => void;
}

export interface TusUploadResult {
  jobId: string;
}

@Injectable({
  providedIn: 'root'
})
export class TusUploadService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly authorizeService = inject(AuthorizeService);

  /**
   * Delays between retries of a restore-job start that answered 403 (AB#5227). The bot service's
   * tenant gate authorizes a parent administrator against an EXISTING child tenant, and its
   * hierarchy answer is cached for up to 60 seconds — so a restore right after (re-)creating the
   * tenant can be refused although the tenant is there. The ladder spans ~75s, one TTL plus slack.
   * A genuine permission denial still fails, after the ladder, with the server's own reason.
   * Overridable so specs don't wait.
   */
  public restoreForbiddenRetryDelaysMs: number[] = [5_000, 10_000, 15_000, 20_000, 25_000];

  public async startUpload(options: TusUploadOptions): Promise<TusUploadResult> {
    const botServicesUrl = this.configurationService.config?.botServices;
    if (!botServicesUrl) {
      throw new Error('Bot services URL not configured');
    }

    const tusFileId = await this.performTusUpload(botServicesUrl, options);
    const jobResponse = await this.startRestoreJobWithForbiddenRetry(botServicesUrl, tusFileId, options);

    if (!jobResponse?.jobId) {
      throw new Error('Failed to start restore job');
    }

    return {jobId: jobResponse.jobId};
  }

  /**
   * Starts the restore job, retrying a 403 across the tenant-hierarchy cache TTL (see
   * {@link restoreForbiddenRetryDelaysMs}). Only the job start is retried — the uploaded artifact
   * is already staged, so no bytes are re-transferred. Every other error propagates immediately.
   */
  private async startRestoreJobWithForbiddenRetry(
    botServicesUrl: string,
    tusFileId: string,
    options: TusUploadOptions
  ): Promise<JobResponseDto | null> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.startRestoreJob(botServicesUrl, tusFileId, options);
      } catch (error) {
        const isForbidden = error instanceof HttpErrorResponse && error.status === 403;
        if (!isForbidden || attempt >= this.restoreForbiddenRetryDelaysMs.length) {
          throw error;
        }
        const delayMs = this.restoreForbiddenRetryDelaysMs[attempt];
        options.onStatus?.(
          `Waiting for tenant authorization to propagate (retry ${attempt + 1} of ` +
          `${this.restoreForbiddenRetryDelaysMs.length} in ${Math.round(delayMs / 1000)}s)...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  private performTusUpload(botServicesUrl: string, options: TusUploadOptions): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const metadata: Record<string, string> = {
        filename: options.file.name,
        filetype: options.file.type || 'application/gzip',
        tenantId: options.tenantId,
        databaseName: options.databaseName
      };

      if (options.oldDatabaseName) {
        metadata['oldDatabaseName'] = options.oldDatabaseName;
      }

      const upload = new Upload(options.file, {
        endpoint: buildTusEndpoint(botServicesUrl, options.tenantId),
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
          options.onProgress?.(bytesUploaded, bytesTotal);
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

  /**
   * Starts the restore job for the uploaded artifact.
   *
   * The tenant travels as a **route segment** (`{tenantId}/v1/jobs/restore-from-upload`, AB#5060),
   * matching the `{serviceUrl}{tenantId}/v1/...` shape of the other tenant-addressed services. That
   * is what puts the call in front of the bot service's transport tenant gate; as a `?tenantId=`
   * query parameter it was invisible to it. The route accepts a child tenant too — the tenant
   * controller carries `[AllowParentTenantAdministration]`, which is what the Child Tenants restore
   * relies on.
   *
   * The tus upload above is on the tenant route as well since stage 3 of AB#5060, so both hops are
   * gated; the service stages the file under the tenant's own directory.
   */
  private async startRestoreJob(
    botServicesUrl: string,
    tusFileId: string,
    options: TusUploadOptions
  ): Promise<JobResponseDto | null> {
    let params = new HttpParams()
      .set('tusFileId', tusFileId)
      .set('databaseName', options.databaseName)
      .set('restoreArchiveData', options.restoreArchiveData ?? false);

    if (options.oldDatabaseName) {
      params = params.set('oldDatabaseName', options.oldDatabaseName);
    }

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      `${botServicesUrl}${options.tenantId}/v1/jobs/restore-from-upload`,
      null,
      {params, observe: 'response'}
    ));

    return r.body;
  }
}
