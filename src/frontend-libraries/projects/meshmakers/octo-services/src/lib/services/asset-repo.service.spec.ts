import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetRepoService } from './asset-repo.service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TenantDto } from '../shared/tenantDto';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { PagedResultDto } from '@meshmakers/shared-services';
import { ImportStrategyDto } from '../shared/importStrategyDto';

describe('AssetRepoService', () => {
  let service: AssetRepoService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null; loadConfigAsync: jasmine.Spy };

  const baseUrl = 'https://asset.example.com/';

  const mockConfig: AddInConfiguration = {
    assetServices: baseUrl,
    issuer: 'https://identity.example.com/',
    botServices: 'https://bot.example.com/',
    communicationServices: 'https://comm.example.com/',
    meshAdapterUrl: 'https://mesh.example.com/',
    crateDbAdminUrl: 'https://crate.example.com/',
    grafanaUrl: 'https://grafana.example.com/',
    systemTenantId: 'system',
    clientId: 'test-client',
    redirectUri: 'https://app.example.com/',
    postLogoutRedirectUri: 'https://app.example.com/logout'
  };

  const mockTenant: TenantDto = {
    tenantId: 'tenant-1',
    database: 'tenant_1_db'
  };

  const mockTenantsResponse: PagedResultDto<TenantDto> = {
    skip: 0,
    take: 10,
    totalCount: 2,
    list: [
      { tenantId: 'tenant-1', database: 'tenant_1_db' },
      { tenantId: 'tenant-2', database: 'tenant_2_db' }
    ]
  };

  beforeEach(() => {
    mockConfigService = {
      config: mockConfig,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.returnValue(Promise.resolve())
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AssetRepoService,
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    service = TestBed.inject(AssetRepoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTenants', () => {
    it('should return paged tenants on success', async () => {
      const resultPromise = service.getTenants(0, 10);

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants?skip=0&take=10`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTenantsResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockTenantsResponse);
      expect(result?.list.length).toBe(2);
      expect(result?.totalCount).toBe(2);
    });

    it('should pass correct skip and take parameters', async () => {
      const resultPromise = service.getTenants(5, 20);

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants?skip=5&take=20`);
      expect(req.request.params.get('skip')).toBe('5');
      expect(req.request.params.get('take')).toBe('20');
      req.flush(mockTenantsResponse);

      await resultPromise;
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.getTenants(0, 10);
      expect(result).toBeNull();
    });

    it('should return null when assetServices is empty', async () => {
      mockConfigService.config = { ...mockConfig, assetServices: '' };

      const result = await service.getTenants(0, 10);
      expect(result).toBeNull();
    });
  });

  describe('getTenantDetails', () => {
    it('should return tenant details on success', async () => {
      const resultPromise = service.getTenantDetails('tenant-1');

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants/tenant-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTenant);

      const result = await resultPromise;
      expect(result).toEqual(mockTenant);
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.getTenantDetails('tenant-1');
      expect(result).toBeNull();
    });

    it('should handle tenant not found', async () => {
      const resultPromise = service.getTenantDetails('non-existent');

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants/non-existent`);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      await expectAsync(resultPromise).toBeRejected();
    });
  });

  describe('createTenant', () => {
    it('should create tenant with correct parameters', async () => {
      const resultPromise = service.createTenant(mockTenant);

      const req = httpMock.expectOne(
        `${baseUrl}system/v1/tenants?tenantId=${mockTenant.tenantId}&databaseName=${mockTenant.database}`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await resultPromise;
    });

    it('should not make request when config is not available', async () => {
      mockConfigService.config = null;

      await service.createTenant(mockTenant);
      // No HTTP request should be made
    });
  });

  describe('attachTenant', () => {
    it('should attach tenant with correct parameters', async () => {
      const resultPromise = service.attachTenant(mockTenant);

      const req = httpMock.expectOne(
        `${baseUrl}system/v1/tenants/attach?tenantId=${mockTenant.tenantId}&databaseName=${mockTenant.database}`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await resultPromise;
    });

    it('should not make request when config is not available', async () => {
      mockConfigService.config = null;

      await service.attachTenant(mockTenant);
      // No HTTP request should be made
    });
  });

  describe('detachTenant', () => {
    it('should detach tenant with correct parameters', async () => {
      const resultPromise = service.detachTenant('tenant-1');

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants/detach?tenantId=tenant-1`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await resultPromise;
    });

    it('should not make request when config is not available', async () => {
      mockConfigService.config = null;

      await service.detachTenant('tenant-1');
      // No HTTP request should be made
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant with correct parameters', async () => {
      const resultPromise = service.deleteTenant('tenant-1');

      const req = httpMock.expectOne(`${baseUrl}system/v1/tenants?tenantId=tenant-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await resultPromise;
    });

    it('should not make request when config is not available', async () => {
      mockConfigService.config = null;

      await service.deleteTenant('tenant-1');
      // No HTTP request should be made
    });
  });

  describe('importRtModel', () => {
    it('should import RT model with default strategy and return job ID', async () => {
      const mockFile = new File(['test content'], 'model.json', { type: 'application/json' });
      const mockResponse = { jobId: 'job-123' };

      const resultPromise = service.importRtModel('tenant-1', mockFile);

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ImportRt?tenantId=tenant-1&importStrategy=0`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result).toBe('job-123');
    });

    it('should import RT model with Upsert strategy', async () => {
      const mockFile = new File(['test content'], 'model.json', { type: 'application/json' });
      const mockResponse = { jobId: 'job-789' };

      const resultPromise = service.importRtModel('tenant-1', mockFile, ImportStrategyDto.Upsert);

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ImportRt?tenantId=tenant-1&importStrategy=1`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result).toBe('job-789');
    });

    it('should return null when response has no jobId', async () => {
      const mockFile = new File(['test content'], 'model.json', { type: 'application/json' });

      const resultPromise = service.importRtModel('tenant-1', mockFile);

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ImportRt?tenantId=tenant-1&importStrategy=0`);
      req.flush({});

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;
      const mockFile = new File(['test content'], 'model.json', { type: 'application/json' });

      const result = await service.importRtModel('tenant-1', mockFile);
      expect(result).toBeNull();
    });
  });

  describe('importCkModel', () => {
    it('should import CK model and return job ID', async () => {
      const mockFile = new File(['test content'], 'ck-model.json', { type: 'application/json' });
      const mockResponse = { jobId: 'job-456' };

      const resultPromise = service.importCkModel('tenant-1', mockFile);

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ImportCk?tenantId=tenant-1&importStrategy=0`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result).toBe('job-456');
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;
      const mockFile = new File(['test content'], 'ck-model.json', { type: 'application/json' });

      const result = await service.importCkModel('tenant-1', mockFile);
      expect(result).toBeNull();
    });
  });

  describe('exportRtModelByQuery', () => {
    it('should export RT model by query and return job ID', async () => {
      const mockResponse = { jobId: 'export-job-789' };

      const resultPromise = service.exportRtModelByQuery('tenant-1', 'query-123');

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ExportRtByQuery?tenantId=tenant-1`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ queryId: 'query-123' });
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result).toBe('export-job-789');
    });

    it('should return null when response has no jobId', async () => {
      const resultPromise = service.exportRtModelByQuery('tenant-1', 'query-123');

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ExportRtByQuery?tenantId=tenant-1`);
      req.flush({});

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.exportRtModelByQuery('tenant-1', 'query-123');
      expect(result).toBeNull();
    });
  });

  describe('exportRtModelDeepGraph', () => {
    it('should export RT model deep graph and return job ID', async () => {
      const mockResponse = { jobId: 'deep-export-job-101' };
      const originRtIds = ['rt-1', 'rt-2'];
      const originCkTypeId = 'ck-type-1';

      const resultPromise = service.exportRtModelDeepGraph('tenant-1', originRtIds, originCkTypeId);

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ExportRtByDeepGraph?tenantId=tenant-1`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ originRtIds, originCkTypeId });
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result).toBe('deep-export-job-101');
    });

    it('should return null when response has no jobId', async () => {
      const resultPromise = service.exportRtModelDeepGraph('tenant-1', ['rt-1'], 'ck-type-1');

      const req = httpMock.expectOne(`${baseUrl}system/v1/Models/ExportRtByDeepGraph?tenantId=tenant-1`);
      req.flush({});

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.exportRtModelDeepGraph('tenant-1', ['rt-1'], 'ck-type-1');
      expect(result).toBeNull();
    });
  });
});
