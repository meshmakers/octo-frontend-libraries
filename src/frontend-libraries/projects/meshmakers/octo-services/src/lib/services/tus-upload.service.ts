import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {DetailedError, HttpRequest, Upload} from 'tus-js-client';
import {AuthorizeService} from '@meshmakers/shared-auth';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {JobResponseDto} from '../shared/jobResponseDto';

export interface TusUploadOptions {
  file: File;
  tenantId: string;
  databaseName: string;
  oldDatabaseName?: string;
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

  private async startRestoreJob(
    botServicesUrl: string,
    tusFileId: string,
    options: TusUploadOptions
  ): Promise<JobResponseDto | null> {
    let params = new HttpParams()
      .set('tusFileId', tusFileId)
      .set('tenantId', options.tenantId)
      .set('databaseName', options.databaseName);

    if (options.oldDatabaseName) {
      params = params.set('oldDatabaseName', options.oldDatabaseName);
    }

    const r = await firstValueFrom(this.httpClient.post<JobResponseDto>(
      botServicesUrl + 'system/v1/jobs/restore-from-upload',
      null,
      {params, observe: 'response'}
    ));

    return r.body;
  }
}
