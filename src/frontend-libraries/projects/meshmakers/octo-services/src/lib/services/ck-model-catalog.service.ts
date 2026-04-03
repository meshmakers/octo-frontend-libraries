import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER, TenantIdProvider } from './tenant-provider';
import {
  BatchDependencyResolutionResponseDto,
  CkModelCatalogDto,
  CkModelCatalogListResponseDto,
  CkModelLibraryStatusResponseDto,
  DependencyResolutionResponseDto,
  ImportFromCatalogBatchRequestDto,
  ImportFromCatalogRequestDto,
  UpgradeCheckResponseDto
} from '../shared/ck-model-catalog.dto';
import { ImportModelResponseDto } from '../shared/importModelResponseDto';

@Injectable({
  providedIn: 'root'
})
export class CkModelCatalogService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly tenantIdProvider: TenantIdProvider | null = inject(TENANT_ID_PROVIDER, { optional: true });

  private getSystemApiBaseUrl(): string | null {
    if (!this.configurationService.config?.assetServices) return null;
    return `${this.configurationService.config.assetServices}system/v1/ckmodelcatalog`;
  }

  private async getTenantApiBaseUrl(): Promise<string | null> {
    if (!this.configurationService.config?.assetServices) return null;
    let tenantId = 'octosystem';
    if (this.tenantIdProvider) {
      tenantId = await this.tenantIdProvider() ?? 'octosystem';
    }
    return `${this.configurationService.config.assetServices}${tenantId}/v1/models`;
  }

  // --- System-scope endpoints ---

  public async getCatalogs(): Promise<CkModelCatalogDto[] | null> {
    const baseUrl = this.getSystemApiBaseUrl();
    if (!baseUrl) return null;
    const r = await firstValueFrom(this.httpClient.get<CkModelCatalogDto[]>(
      `${baseUrl}/catalogs`, { observe: 'response' }));
    return r.body;
  }

  public async listModels(skip = 0, take = 100): Promise<CkModelCatalogListResponseDto | null> {
    const baseUrl = this.getSystemApiBaseUrl();
    if (!baseUrl) return null;
    const params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());
    const r = await firstValueFrom(this.httpClient.get<CkModelCatalogListResponseDto>(
      baseUrl, { params, observe: 'response' }));
    return r.body;
  }

  public async searchModels(q: string, skip = 0, take = 100): Promise<CkModelCatalogListResponseDto | null> {
    const baseUrl = this.getSystemApiBaseUrl();
    if (!baseUrl) return null;
    const params = new HttpParams().set('q', q).set('skip', skip.toString()).set('take', take.toString());
    const r = await firstValueFrom(this.httpClient.get<CkModelCatalogListResponseDto>(
      `${baseUrl}/search`, { params, observe: 'response' }));
    return r.body;
  }

  public async refreshCatalogs(): Promise<void> {
    const baseUrl = this.getSystemApiBaseUrl();
    if (!baseUrl) return;
    await firstValueFrom(this.httpClient.post(`${baseUrl}/refresh`, null));
  }

  // --- Tenant-scope endpoints ---

  public async importFromCatalog(tenantId: string, catalogName: string, modelId: string): Promise<ImportModelResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/ImportFromCatalog`;
    const body: ImportFromCatalogRequestDto = { catalogName, modelId };
    const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(
      url, body, { observe: 'response' }));
    return r.body;
  }

  public async resolveDependencies(tenantId: string, catalogName: string, modelId: string): Promise<DependencyResolutionResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/ResolveDependencies`;
    const body: ImportFromCatalogRequestDto = { catalogName, modelId };
    const r = await firstValueFrom(this.httpClient.post<DependencyResolutionResponseDto>(
      url, body, { observe: 'response' }));
    return r.body;
  }

  public async checkUpgrade(tenantId: string, catalogName: string, modelId: string): Promise<UpgradeCheckResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/CheckUpgrade`;
    const body: ImportFromCatalogRequestDto = { catalogName, modelId };
    const r = await firstValueFrom(this.httpClient.post<UpgradeCheckResponseDto>(
      url, body, { observe: 'response' }));
    return r.body;
  }

  // --- Combined endpoints (business logic on backend) ---

  public async getLibraryStatus(tenantId: string): Promise<CkModelLibraryStatusResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/LibraryStatus`;
    const r = await firstValueFrom(this.httpClient.get<CkModelLibraryStatusResponseDto>(
      url, { observe: 'response' }));
    return r.body;
  }

  public async resolveDependenciesBatch(tenantId: string, models: ImportFromCatalogRequestDto[]): Promise<BatchDependencyResolutionResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/ResolveDependenciesBatch`;
    const r = await firstValueFrom(this.httpClient.post<BatchDependencyResolutionResponseDto>(
      url, models, { observe: 'response' }));
    return r.body;
  }

  public async importFromCatalogBatch(tenantId: string, catalogName: string, modelIds: string[]): Promise<ImportModelResponseDto | null> {
    if (!this.configurationService.config?.assetServices) return null;
    const url = `${this.configurationService.config.assetServices}${tenantId}/v1/models/ImportFromCatalogBatch`;
    const body: ImportFromCatalogBatchRequestDto = { catalogName, modelIds };
    const r = await firstValueFrom(this.httpClient.post<ImportModelResponseDto>(
      url, body, { observe: 'response' }));
    return r.body;
  }
}
