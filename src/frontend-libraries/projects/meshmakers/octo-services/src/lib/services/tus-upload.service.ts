import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
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

  public async startUpload(options: TusUploadOptions): Promise<TusUploadResult> {
    const botServicesUrl = this.configurationService.config?.botServices;
    if (!botServicesUrl) {
      throw new Error('Bot services URL not configured');
    }

    const tusFileId = await this.performTusUpload(botServicesUrl, options);
    const jobResponse = await this.startRestoreJob(botServicesUrl, tusFileId, options);

    if (!jobResponse?.jobId) {
      throw new Error('Failed to start restore job');
    }

    return {jobId: jobResponse.jobId};
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
