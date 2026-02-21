import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
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
        provideHttpClient(),
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
  });
});
