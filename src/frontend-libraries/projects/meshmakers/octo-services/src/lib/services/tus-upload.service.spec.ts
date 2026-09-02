import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {TusUploadService, TusUploadOptions} from './tus-upload.service';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {AddInConfiguration} from '../shared/addInConfiguration';
import {AuthorizeService} from '@meshmakers/shared-auth';

describe('TusUploadService', () => {
  let service: TusUploadService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null; loadConfigAsync: jasmine.Spy };
  let authorizeServiceMock: jasmine.SpyObj<AuthorizeService>;

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

  beforeEach(() => {
    mockConfigService = {
      config: mockConfig,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.returnValue(Promise.resolve())
    };

    authorizeServiceMock = jasmine.createSpyObj('AuthorizeService', ['getAccessTokenSync']);
    authorizeServiceMock.getAccessTokenSync.and.returnValue('test-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        TusUploadService,
        {provide: CONFIGURATION_SERVICE, useValue: mockConfigService},
        {provide: AuthorizeService, useValue: authorizeServiceMock}
      ]
    });

    service = TestBed.inject(TusUploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('startUpload', () => {
    it('should throw error when config is null', async () => {
      mockConfigService.config = null;
      const mockFile = new File(['backup data'], 'backup.tar.gz', {type: 'application/gzip'});
      const options: TusUploadOptions = {
        file: mockFile,
        tenantId: 'tenant-1',
        databaseName: 'db-1'
      };

      await expectAsync(service.startUpload(options))
        .toBeRejectedWithError('Bot services URL not configured');
    });

    it('should throw error when botServices URL is empty', async () => {
      mockConfigService.config = {...mockConfig, botServices: ''};
      const mockFile = new File(['backup data'], 'backup.tar.gz', {type: 'application/gzip'});
      const options: TusUploadOptions = {
        file: mockFile,
        tenantId: 'tenant-1',
        databaseName: 'db-1'
      };

      await expectAsync(service.startUpload(options))
        .toBeRejectedWithError('Bot services URL not configured');
    });

    // AB#5060: the restore job must be started on the tenant route. As `?tenantId=` it bypassed the
    // bot service's transport tenant gate, so a token for one tenant could restore another. The tus
    // upload itself stays on the tenant-neutral system sink by design, hence it is stubbed here.
    it('should start the restore job on the tenant route, not the system route', async () => {
      const mockFile = new File(['backup data'], 'backup.tar.gz', {type: 'application/gzip'});
      const options: TusUploadOptions = {
        file: mockFile,
        tenantId: 'tenant-1',
        databaseName: 'db-1',
        oldDatabaseName: 'db-0',
        restoreArchiveData: true
      };

      stubTusUpload('tus-file-1');

      const resultPromise = service.startUpload(options);
      await settle();

      const req = httpMock.expectOne(
        (request) => request.url === `${baseUrl}tenant-1/v1/jobs/restore-from-upload`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.params.has('tenantId')).toBeFalse();
      expect(req.request.params.get('tusFileId')).toBe('tus-file-1');
      expect(req.request.params.get('databaseName')).toBe('db-1');
      expect(req.request.params.get('oldDatabaseName')).toBe('db-0');
      expect(req.request.params.get('restoreArchiveData')).toBe('true');
      req.flush({jobId: 'job-123'});

      const result = await resultPromise;
      expect(result.jobId).toBe('job-123');
    });

    // A parent tenant's administrator restoring a child passes the child tenant; the bot service's
    // tenant controller permits it through [AllowParentTenantAdministration].
    it('should address a child tenant when one is passed', async () => {
      const mockFile = new File(['backup data'], 'backup.tar.gz', {type: 'application/gzip'});
      const options: TusUploadOptions = {
        file: mockFile,
        tenantId: 'child-tenant',
        databaseName: 'child_db'
      };

      stubTusUpload('tus-file-2');

      const resultPromise = service.startUpload(options);
      await settle();

      const req = httpMock.expectOne(
        (request) => request.url === `${baseUrl}child-tenant/v1/jobs/restore-from-upload`
      );
      req.flush({jobId: 'job-456'});

      const result = await resultPromise;
      expect(result.jobId).toBe('job-456');
    });
  });

  /**
   * Replaces the real tus transfer, which needs a tus server rather than Angular's HTTP testing
   * backend, so the assertions can focus on the job-start request.
   */
  function stubTusUpload(tusFileId: string): void {
    const internals = service as unknown as {
      performTusUpload: (botServicesUrl: string, options: TusUploadOptions) => Promise<string>;
    };
    spyOn(internals, 'performTusUpload').and.returnValue(Promise.resolve(tusFileId));
  }

  /**
   * Lets the awaited upload step resolve so the job-start request has actually been issued by the
   * time `expectOne` looks for it.
   */
  function settle(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
});
