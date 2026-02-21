import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {TenantDto} from '../shared/tenantDto';
import {firstValueFrom} from 'rxjs';
import {ImportModelResponseDto} from '../shared/importModelResponseDto';
import {ExportModelResponseDto} from '../shared/exportModelResponseDto';
import {PagedResultDto} from '@meshmakers/shared-services';
import {ImportStrategyDto} from '@meshmakers/shared-ui';

@Injectable({
  providedIn: 'root'
})
export class AssetRepoService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);


  public async getTenants(skip: number, take: number): Promise<PagedResultDto<TenantDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .get<PagedResultDto<TenantDto>>(this.configurationService.config.assetServices + 'system/v1/tenants', {
          params,
          observe: 'response'
        }));
      return r.body;
    }
    return null;
  }

  public async getTenantDetails(tenantId: string): Promise<TenantDto | null> {
    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .get<TenantDto>(this.configurationService.config.assetServices + `system/v1/tenants/${tenantId}`, {
          observe: 'response'
        }));
      return r.body;
    }
    return null;
  }

  public async createTenant(tenantDto: TenantDto): Promise<void> {
    const params = new HttpParams().set('tenantId', tenantDto.tenantId).set('databaseName', tenantDto.database);

    if (this.configurationService.config?.assetServices) {
      await firstValueFrom(this.httpClient.post<void>(this.configurationService.config.assetServices + 'system/v1/tenants', null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async attachTenant(dataSourceDto: TenantDto): Promise<void> {
    const params = new HttpParams().set('tenantId', dataSourceDto.tenantId).set('databaseName', dataSourceDto.database);

    if (this.configurationService.config?.assetServices) {
      await firstValueFrom(this.httpClient.post<void>(this.configurationService.config.assetServices + 'system/v1/tenants/attach', null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async detachTenant(tenantId: string): Promise<void> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.assetServices) {
      await firstValueFrom(this.httpClient.post<void>(this.configurationService.config.assetServices + 'system/v1/tenants/detach', null, {
        params,
        observe: 'response'
      }));
    }
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.assetServices) {
      await firstValueFrom(this.httpClient.delete<void>(this.configurationService.config.assetServices + 'system/v1/tenants', {
        params,
        observe: 'response'
      }));
    }
  }

  public async importRtModel(tenantId: string, file: File, importStrategy: ImportStrategyDto = ImportStrategyDto.InsertOnly): Promise<string | null> {
    const params = new HttpParams()
      .set('tenantId', tenantId)
      .set('importStrategy', importStrategy.toString());
    if (this.configurationService.config?.assetServices) {

      const formData: FormData = new FormData();
      formData.append("file", file);
      const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(this.configurationService.config.assetServices + 'system/v1/Models/ImportRt', formData, {
        params,
        observe: 'response'
      }));

      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async importCkModel(tenantId: string, file: File, importStrategy: ImportStrategyDto = ImportStrategyDto.InsertOnly): Promise<string | null> {
    const params = new HttpParams()
      .set('tenantId', tenantId)
      .set('importStrategy', importStrategy.toString());
    if (this.configurationService.config?.assetServices) {
      const formData: FormData = new FormData();
      formData.append("file", file);
      const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(this.configurationService.config.assetServices + 'system/v1/Models/ImportCk', formData, {
        params,
        observe: 'response'
      }));
      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async exportRtModelByQuery(tenantId: string, queryId: string): Promise<string | null> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .post<ExportModelResponseDto>(
          this.configurationService.config.assetServices + 'system/v1/Models/ExportRtByQuery',
          {queryId},
          {
            params,
            observe: 'response'
          }
        ));

      return r.body?.jobId ?? null;
    }
    return null;
  }

  public async exportRtModelDeepGraph(tenantId: string, originRtIds: string[], originCkTypeId: string): Promise<string | null> {
    const params = new HttpParams().set('tenantId', tenantId);

    if (this.configurationService.config?.assetServices) {
      const r = await firstValueFrom(this.httpClient
        .post<ExportModelResponseDto>(
          this.configurationService.config.assetServices + 'system/v1/Models/ExportRtByDeepGraph',
          {originRtIds, originCkTypeId},
          {
            params,
            observe: 'response'
          }
        ));
        return r.body?.jobId ?? null;
    }
    return null;
  }
}
