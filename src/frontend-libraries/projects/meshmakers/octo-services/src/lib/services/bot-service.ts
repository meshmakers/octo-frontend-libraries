import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {firstValueFrom, map} from 'rxjs';
import {JobResponseDto} from '../shared/jobResponseDto';
import {JobDto} from '../shared/jobDto';
import {CONFIGURATION_SERVICE} from './configuration.service';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);

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
}
