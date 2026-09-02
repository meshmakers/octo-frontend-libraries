import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {AiService} from './ai.service';
import {CONFIGURATION_SERVICE, IConfigurationService} from './configuration.service';
import {AddInConfiguration} from '../shared/addInConfiguration';

describe('AiService', () => {
  let service: AiService;
  let httpMock: HttpTestingController;
  let mockConfigService: jasmine.SpyObj<IConfigurationService>;

  const mockConfig: AddInConfiguration = {
    communicationServices: 'https://api.example.com/communication/',
    assetServices: 'https://api.example.com/asset/',
    botServices: 'https://api.example.com/bot/',
    meshAdapterUrl: '',
    aiServices: 'https://api.example.com/ai/',
    reportingServices: '',
    crateDbAdminUrl: '',
    issuer: '',
    grafanaUrl: '',
    systemTenantId: 'system',
    clientId: 'test-client',
    redirectUri: '',
    postLogoutRedirectUri: ''
  };

  const tenantId = 'test-tenant';

  beforeEach(() => {
    mockConfigService = jasmine.createSpyObj<IConfigurationService>('ConfigurationService', [], {
      config: mockConfig
    });

    TestBed.configureTestingModule({
      providers: [
        AiService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {provide: CONFIGURATION_SERVICE, useValue: mockConfigService}
      ]
    });

    service = TestBed.inject(AiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('enableAi', () => {
    it('should POST the tenant-scoped enable endpoint', async () => {
      const promise = service.enableAi(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.aiServices}${tenantId}/v1/aiservice/enable`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await promise;
    });

    it('should propagate errors', async () => {
      const promise = service.enableAi(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.aiServices}${tenantId}/v1/aiservice/enable`
      );
      req.flush({errorMessage: 'boom'}, {status: 409, statusText: 'Conflict'});

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('disableAi', () => {
    it('should POST the tenant-scoped disable endpoint', async () => {
      const promise = service.disableAi(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.aiServices}${tenantId}/v1/aiservice/disable`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null);

      await promise;
    });

    it('should propagate errors', async () => {
      const promise = service.disableAi(tenantId);

      const req = httpMock.expectOne(
        `${mockConfig.aiServices}${tenantId}/v1/aiservice/disable`
      );
      req.flush({errorMessage: 'boom'}, {status: 500, statusText: 'Server Error'});

      await expectAsync(promise).toBeRejected();
    });
  });

  describe('when aiServices is not configured (service not installed)', () => {
    beforeEach(() => {
      Object.defineProperty(mockConfigService, 'config', {
        get: () => ({...mockConfig, aiServices: ''})
      });
    });

    it('enableAi should throw and not make an HTTP call', async () => {
      await expectAsync(service.enableAi(tenantId)).toBeRejected();
      httpMock.expectNone(() => true);
    });

    it('disableAi should throw and not make an HTTP call', async () => {
      await expectAsync(service.disableAi(tenantId)).toBeRejected();
      httpMock.expectNone(() => true);
    });
  });
});
