import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {TENANT_ID_PROVIDER, TenantIdProvider} from './tenant-provider';
import {TenantDto} from '../shared/tenantDto';
import {TenantFeaturesStatus} from '../shared/tenantFeaturesDtos';
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

  /**
   * Returns the tenant the caller is currently signed into, including its database name.
   *
   * The tenants list only contains child tenants, and a tenant's own registry entry lives in
   * its parent's database — so the current tenant's database name is not derivable client-side
   * and comes from this dedicated endpoint (AB#4601). Needed by any operation that has to name
   * the database of the current tenant, such as restoring it from a backup.
   */
  public async getOwnTenant(): Promise<TenantDto | null> {
    const baseUrl = await this.getTenantApiBaseUrl();
    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient
        .get<TenantDto>(`${baseUrl}/self`, {
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

  /**
   * Enables the Stream Data feature for a tenant: switches the tenant flag on
   * and imports the `System.StreamData` CK model. No time-series storage is
   * provisioned until an archive is activated. Errors propagate to the caller.
   *
   * Tenant-scoped REST endpoint: `POST {assetServices}{tenantId}/v1/streamdata/enable`.
   */
  public async enableStreamData(tenantId: string): Promise<void> {
    if (this.configurationService.config?.assetServices) {
      const uri = `${this.configurationService.config.assetServices}${tenantId}/v1/streamdata/enable`;
      await firstValueFrom(this.httpClient.post<void>(uri, null, {observe: 'response'}));
    }
  }

  /**
   * Disables the Stream Data feature for a tenant: a reversible flag flip.
   * Refused with HTTP 409 while any archive of the tenant is still activated —
   * the `OperationFailedErrorDto` body names them and the remediation
   * (`DisableArchive` / `DeleteArchive`). The `System.StreamData` model, the
   * archive definitions and the stored stream data are kept; re-enabling
   * restores access. Precondition for tenant delete/detach (AB#4255). Errors
   * propagate to the caller.
   *
   * Tenant-scoped REST endpoint: `POST {assetServices}{tenantId}/v1/streamdata/disable`.
   */
  public async disableStreamData(tenantId: string): Promise<void> {
    if (this.configurationService.config?.assetServices) {
      const uri = `${this.configurationService.config.assetServices}${tenantId}/v1/streamdata/disable`;
      await firstValueFrom(this.httpClient.post<void>(uri, null, {observe: 'response'}));
    }
  }

  /**
   * Reads the aggregate tenant feature status: the enabled flags of Stream
   * Data, Communication, Reporting and AI Services — the same flags the tenant
   * delete/detach guard evaluates (AB#4255), so the Tenant Features panel and
   * the guard never disagree (AB#4884). CK model presence is deliberately not
   * the source (a disable keeps the model). Whether a service is installed at
   * all comes from the `_configuration` document (empty URL = not installed),
   * except Stream Data's `instanceEnabled` flag, which is part of the status.
   * Returns `null` when the asset service is not configured. Errors propagate
   * to the caller.
   *
   * Tenant-scoped REST endpoint: `GET {assetServices}{tenantId}/v1/features/status`.
   */
  public async getTenantFeaturesStatus(tenantId: string): Promise<TenantFeaturesStatus | null> {
    if (!this.configurationService.config?.assetServices) {
      return null;
    }
    const uri = `${this.configurationService.config.assetServices}${tenantId}/v1/features/status`;
    return await firstValueFrom(this.httpClient.get<TenantFeaturesStatus>(uri));
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
