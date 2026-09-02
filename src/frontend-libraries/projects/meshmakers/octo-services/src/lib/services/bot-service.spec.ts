import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { BotService } from './bot-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { JobResponseDto } from '../shared/jobResponseDto';
import { JobDto } from '../shared/jobDto';
import { ImportStrategyDto } from '../shared/importStrategyDto';
import { AuthorizeService } from '@meshmakers/shared-auth';

describe('BotService', () => {
  let service: BotService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null; loadConfigAsync: jasmine.Spy };

  const baseUrl = 'https://bot.example.com/';

  const mockConfig: AddInConfiguration = {
    assetServices: 'https://asset.example.com/',
    issuer: 'https://identity.example.com/',
    botServices: baseUrl,
    communicationServices: 'https://comm.example.com/',
    meshAdapterUrl: 'https://mesh.example.com/',
    aiServices: 'https://ai.example.com/',
    reportingServices: 'https://reporting.example.com/',
    crateDbAdminUrl: 'https://crate.example.com/',
    grafanaUrl: 'https://grafana.example.com/',
    systemTenantId: 'system',
    clientId: 'test-client',
    redirectUri: 'https://app.example.com/',
    postLogoutRedirectUri: 'https://app.example.com/logout'
  };

  const mockJobResponse: JobResponseDto = {
    jobId: 'job-123'
  };

  const mockJobDto: JobDto = {
    id: 'job-123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    stateChangedAt: new Date('2024-01-01T00:01:00Z'),
    status: 'Succeeded',
    reason: null,
    errorMessage: null
  };

  beforeEach(() => {
    mockConfigService = {
      config: mockConfig,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.returnValue(Promise.resolve())
    };

    const mockAuthorizeService = {
      getAccessTokenSync: jasmine.createSpy('getAccessTokenSync').and.returnValue('test-token')
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        BotService,
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService },
        { provide: AuthorizeService, useValue: mockAuthorizeService }
      ]
    });

    service = TestBed.inject(BotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('runFixupScripts', () => {
    it('should run fixup scripts and return job response', async () => {
      const resultPromise = service.runFixupScripts('tenant-1');

      const req = httpMock.expectOne(`${baseUrl}tenant-1/v1/jobs/run-fixup-scripts`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
      expect(result?.jobId).toBe('job-123');
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.runFixupScripts('tenant-1');
      expect(result).toBeNull();
    });

    it('should return null when botServices is empty', async () => {
      mockConfigService.config = { ...mockConfig, botServices: '' };

      const result = await service.runFixupScripts('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('dumpRepository', () => {
    it('should dump repository with includeArchiveData=false by default', async () => {
      const resultPromise = service.dumpRepository('tenant-1');

      const req = httpMock.expectOne(
        `${baseUrl}tenant-1/v1/jobs/dump-repository?includeArchiveData=false`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      expect(req.request.params.get('includeArchiveData')).toBe('false');
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
    });

    it('should dump repository with includeArchiveData=true when requested', async () => {
      const resultPromise = service.dumpRepository('tenant-1', true);

      const req = httpMock.expectOne(
        `${baseUrl}tenant-1/v1/jobs/dump-repository?includeArchiveData=true`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.params.get('includeArchiveData')).toBe('true');
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
    });

    // AB#5060: the tenant must travel as a route segment. As a `?tenantId=` query parameter the
    // call bypassed the bot service's transport tenant gate entirely, so a regression here is a
    // cross-tenant hole, not a cosmetic URL change.
    it('should address the tenant through the route, not a query parameter', async () => {
      const resultPromise = service.dumpRepository('tenant-1');

      const req = httpMock.expectOne((request) => request.url.startsWith(`${baseUrl}tenant-1/v1/jobs/`));
      expect(req.request.params.has('tenantId')).toBeFalse();
      req.flush(mockJobResponse);

      await resultPromise;
    });

    // Backing up a child tenant from the Child Tenants list passes the child, not the route tenant;
    // the bot service's tenant controller allows this via [AllowParentTenantAdministration].
    it('should target a child tenant when one is passed', async () => {
      const resultPromise = service.dumpRepository('child-tenant', true);

      const req = httpMock.expectOne(
        `${baseUrl}child-tenant/v1/jobs/dump-repository?includeArchiveData=true`
      );
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.dumpRepository('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('restoreRepository (deprecated)', () => {
    it('should restore repository using form POST and return job response', async () => {
      const mockFile = new File(['backup data'], 'backup.gz', { type: 'application/gzip' });

      const resultPromise = service.restoreRepository('tenant-1', 'test_db', mockFile);

      const req = httpMock.expectOne(`${baseUrl}system/v1/jobs/restore-repository?tenantId=tenant-1&databaseName=test_db`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;
      const mockFile = new File(['backup data'], 'backup.gz', { type: 'application/gzip' });

      const result = await service.restoreRepository('tenant-1', 'test_db', mockFile);
      expect(result).toBeNull();
    });
  });

  describe('downloadJobResultBinary', () => {
    it('should download job result as blob', async () => {
      const mockBlob = new Blob(['binary data'], { type: 'application/octet-stream' });
      const resultPromise = service.downloadJobResultBinary('tenant-1', 'job-123');

      const req = httpMock.expectOne(`${baseUrl}system/v1/jobs/download?tenantId=tenant-1&id=job-123`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(mockBlob);

      const result = await resultPromise;
      expect(result).toBeTruthy();
      expect(result instanceof Blob).toBeTrue();
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.downloadJobResultBinary('tenant-1', 'job-123');
      expect(result).toBeNull();
    });
  });

  describe('getJobStatus', () => {
    it('should get job status', async () => {
      const resultPromise = service.getJobStatus('job-123');

      const req = httpMock.expectOne(`${baseUrl}system/v1/jobs?id=job-123`);
      expect(req.request.method).toBe('GET');
      req.flush(mockJobDto);

      const result = await resultPromise;
      expect(result).toEqual(mockJobDto);
      expect(result?.status).toBe('Succeeded');
    });

    it('should return job with failed status', async () => {
      const failedJobDto: JobDto = {
        ...mockJobDto,
        status: 'Failed',
        reason: 'Database connection failed'
      };

      const resultPromise = service.getJobStatus('job-456');

      const req = httpMock.expectOne(`${baseUrl}system/v1/jobs?id=job-456`);
      req.flush(failedJobDto);

      const result = await resultPromise;
      expect(result?.status).toBe('Failed');
      expect(result?.reason).toBe('Database connection failed');
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.getJobStatus('job-123');
      expect(result).toBeNull();
    });
  });

  describe('startExportArchiveData', () => {
    it('should start a whole-archive export without window bounds', async () => {
      const resultPromise = service.startExportArchiveData('tenant-1', 'archive-1');

      const req = httpMock.expectOne(
        `${baseUrl}tenant-1/v1/jobs/export-archive-data?archiveRtId=archive-1`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      expect(req.request.params.has('fromUtc')).toBeFalse();
      expect(req.request.params.has('toUtc')).toBeFalse();
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockJobResponse);
    });

    it('should start a windowed export with from/to bounds', async () => {
      const resultPromise = service.startExportArchiveData('tenant-1', 'archive-1', {
        fromUtc: '2026-06-01T00:00:00Z',
        toUtc: '2026-07-01T00:00:00Z'
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}tenant-1/v1/jobs/export-archive-data` &&
          request.params.get('archiveRtId') === 'archive-1' &&
          request.params.get('fromUtc') === '2026-06-01T00:00:00Z' &&
          request.params.get('toUtc') === '2026-07-01T00:00:00Z'
      );
      expect(req.request.method).toBe('POST');
      req.flush(mockJobResponse);

      const result = await resultPromise;
      expect(result?.jobId).toBe('job-123');
    });

    it('should return null when config is not available', async () => {
      mockConfigService.config = null;

      const result = await service.startExportArchiveData('tenant-1', 'archive-1');
      expect(result).toBeNull();
    });
  });

  describe('startImportArchiveDataWithUpload', () => {
    it('should return null when config is not available', async () => {
      mockConfigService.config = null;
      const mockFile = new File(['zip data'], 'export.zip', { type: 'application/zip' });

      const result = await service.startImportArchiveDataWithUpload(
        'tenant-1', 'archive-1', mockFile, ImportStrategyDto.Upsert
      );
      expect(result).toBeNull();
    });
  });
});
