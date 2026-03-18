import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {TENANT_ID_PROVIDER, TenantIdProvider} from './tenant-provider';
import {TenantDto} from '../shared/tenantDto';
import {firstValueFrom} from 'rxjs';
import {ImportModelResponseDto} from '../shared/importModelResponseDto';
import {ExportModelResponseDto} from '../shared/exportModelResponseDto';
import {PagedResultDto} from '@meshmakers/shared-services';
import {ImportStrategyDto} from '../shared/importStrategyDto';

@Injectable({
  providedIn: 'root'
})
export class AssetRepoService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly tenantIdProvider: TenantIdProvider | null = inject(TENANT_ID_PROVIDER, {optional: true});

  private async getTenantApiBaseUrl(): Promise<string | null> {
    if (!this.configurationService.config?.assetServices) return null;
    let tenantId = 'octosystem';
    if (this.tenantIdProvider) {
      tenantId = await this.tenantIdProvider() ?? 'octosystem';
    }
    return `${this.configurationService.config.assetServices}${tenantId}/v1/tenants`;
  }

  public async getTenants(skip: number, take: number): Promise<PagedResultDto<TenantDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient
        .get<PagedResultDto<TenantDto>>(baseUrl, {
          params,
          observe: 'response'
        }));
      return r.body;
    }
    return null;
  }

  public async getTenantDetails(childTenantId: string): Promise<TenantDto | null> {
    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient
        .get<TenantDto>(`${baseUrl}/${childTenantId}`, {
          observe: 'response'
        }));
      return r.body;
    }
    return null;
  }

  public async createTenant(tenantDto: TenantDto): Promise<void> {
    const params = new HttpParams().set('childTenantId', tenantDto.tenantId).set('databaseName', tenantDto.database);

    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.post<void>(baseUrl, null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async attachTenant(dataSourceDto: TenantDto): Promise<void> {
    const params = new HttpParams().set('childTenantId', dataSourceDto.tenantId).set('databaseName', dataSourceDto.database);

    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.post<void>(`${baseUrl}/attach`, null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async detachTenant(childTenantId: string): Promise<void> {
    const params = new HttpParams().set('childTenantId', childTenantId);

    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.post<void>(`${baseUrl}/detach`, null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async deleteTenant(childTenantId: string): Promise<void> {
    const params = new HttpParams().set('childTenantId', childTenantId);

    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.delete<void>(baseUrl, {
        params,
        observe: 'response'
      }));
    }
  }

  public async importRtModel(tenantId: string, file: File, importStrategy: ImportStrategyDto = ImportStrategyDto.InsertOnly): Promise<string | null> {
    const params = new HttpParams()
      .set('importStrategy', importStrategy.toString());
    if (this.configurationService.config?.assetServices) {

      const formData: FormData = new FormData();
      formData.append("file", file);
      const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(this.configurationService.config.assetServices + tenantId + '/v1/Models/ImportRt', formData, {
        params,
        observe: 'response'
      }));

      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async importCkModel(tenantId: string, file: File, importStrategy: ImportStrategyDto = ImportStrategyDto.InsertOnly): Promise<string | null> {
    const params = new HttpParams()
      .set('importStrategy', importStrategy.toString());
    if (this.configurationService.config?.assetServices) {
      const formData: FormData = new FormData();
      formData.append("file", file);
      const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(this.configurationService.config.assetServices + tenantId + '/v1/Models/ImportCk', formData, {
        params,
        observe: 'response'
      }));
      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async exportRtModelByQuery(tenantId: string, queryId: string): Promise<string | null> {
    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .post<ExportModelResponseDto>(
          this.configurationService.config.assetServices + tenantId + '/v1/Models/ExportRtByQuery',
          {queryId},
          {
            observe: 'response'
          }
        ));

      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async exportRtModelDeepGraph(tenantId: string, originRtIds: string[], originCkTypeId: string): Promise<string | null> {
    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .post<ExportModelResponseDto>(
          this.configurationService.config.assetServices + tenantId + '/v1/Models/ExportRtByDeepGraph',
          {originRtIds, originCkTypeId},
          {
            observe: 'response'
          }
        ));
        return r.body?.jobId ?? null;
    }
    return null;
  }
}
