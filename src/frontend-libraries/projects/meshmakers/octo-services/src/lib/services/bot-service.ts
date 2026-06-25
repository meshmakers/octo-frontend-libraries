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

  public async runFixupScripts(tenantId: string): Promise<JobResponseDto | null> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.botServices) {
      const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(this.configurationService.config.botServices + 'system/v1/jobs/run-fixup-scripts', null, {
        params,
        observe: 'response'
      }));

      return r.body;
    }
    return null;
  }

  public async dumpRepository(tenantId: string): Promise<JobResponseDto | null> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.botServices) {
      const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(this.configurationService.config.botServices + 'system/v1/jobs/dump-repository', null, {
        params,
        observe: 'response'
      }));

      return r.body;
    }
    return null;
  }

  /** @deprecated Use TusUploadService.startUpload() instead for resumable uploads supporting large files. */
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
   * Frozen bot contract:
   * `POST system/v1/jobs/export-archive-data?tenantId=&archiveRtId=&fromUtc=&toUtc=` → `{ jobId }`.
   */
  public async startExportArchiveData(
    tenantId: string,
    archiveRtId: string,
    window?: TimeWindowDto
  ): Promise<JobResponseDto | null> {
    if (!this.configurationService.config?.botServices) {
      return null;
    }

    let params = new HttpParams()
      .set('tenantId', tenantId)
      .set('archiveRtId', archiveRtId);

    if (window) {
      params = params.set('fromUtc', window.fromUtc).set('toUtc', window.toUtc);
    }

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      this.configurationService.config.botServices + 'system/v1/jobs/export-archive-data',
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
   * Frozen bot contract:
   * 1. TUS upload to `system/v1/tus-upload` (metadata: `filename`, `filetype`, `tenantId`,
   *    `archiveRtId`, `importMode`).
   * 2. `POST system/v1/jobs/import-archive-data-from-upload?tusFileId=&tenantId=&archiveRtId=&mode=`
   *    → `{ jobId }`.
   */
  public async startImportArchiveDataWithUpload(
    tenantId: string,
    archiveRtId: string,
    file: File,
    mode: ImportStrategyDto,
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  ): Promise<JobResponseDto | null> {
    const botServicesUrl = this.configurationService.config?.botServices;
    if (!botServicesUrl) {
      return null;
    }

    const tusFileId = await this.uploadArchiveDataZip(botServicesUrl, tenantId, archiveRtId, mode, file, onProgress);

    const params = new HttpParams()
      .set('tusFileId', tusFileId)
      .set('tenantId', tenantId)
      .set('archiveRtId', archiveRtId)
      .set('mode', mode.toString());

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      botServicesUrl + 'system/v1/jobs/import-archive-data-from-upload',
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
