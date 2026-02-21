import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HealthService } from './health.service';
import { CONFIGURATION_SERVICE, IConfigurationService } from './configuration.service';
import { HealthCheck, HealthStatus } from '../shared/health';
import { AddInConfiguration } from '../shared/addInConfiguration';

describe('HealthService', () => {
  let service: HealthService;
  let httpMock: HttpTestingController;
  let mockConfigService: IConfigurationService;

  const mockConfig: AddInConfiguration = {
    assetServices: 'https://asset.example.com/',
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

  const mockHealthyResponse: HealthCheck = {
    status: HealthStatus.Healthy,
    results: [
      {
        title: 'Database',
        status: HealthStatus.Healthy,
        description: 'Database is healthy',
        data: null
      }
    ]
  };

  const mockUnhealthyResponse: HealthCheck = {
    status: HealthStatus.Unhealthy,
    results: [
      {
        title: 'Database',
        status: HealthStatus.Unhealthy,
        description: 'Database connection failed',
        data: null
      }
    ]
  };

  const mockDegradedResponse: HealthCheck = {
    status: HealthStatus.Degraded,
    results: [
      {
        title: 'Cache',
        status: HealthStatus.Degraded,
        description: 'Cache is slow',
        data: null
      }
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
        HealthService,
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    service = TestBed.inject(HealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAssetRepoServiceHealthAsync', () => {
    const expectedUrl = 'https://asset.example.com/health';

    it('should return HealthCheck on successful response', async () => {
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthyResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockHealthyResponse);
    });

    it('should return HealthCheck with degraded status', async () => {
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockDegradedResponse);

      const result = await resultPromise;
      expect(result?.status).toBe(HealthStatus.Degraded);
    });

    it('should return error body on 503 service unavailable', async () => {
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockUnhealthyResponse, { status: 503, statusText: 'Service Unavailable' });

      const result = await resultPromise;
      expect(result).toEqual(mockUnhealthyResponse);
      expect(result?.status).toBe(HealthStatus.Unhealthy);
    });

    it('should return null on network error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      const result = await resultPromise;
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should return null on 500 server error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should return null on 404 not found', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  describe('getIdentityServiceAsync', () => {
    const expectedUrl = 'https://identity.example.com/health';

    it('should return HealthCheck on successful response', async () => {
      const resultPromise = service.getIdentityServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthyResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockHealthyResponse);
    });

    it('should return error body on 503 service unavailable', async () => {
      const resultPromise = service.getIdentityServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockUnhealthyResponse, { status: 503, statusText: 'Service Unavailable' });

      const result = await resultPromise;
      expect(result?.status).toBe(HealthStatus.Unhealthy);
    });

    it('should return null on error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getIdentityServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  describe('getBotServiceAsync', () => {
    const expectedUrl = 'https://bot.example.com/health';

    it('should return HealthCheck on successful response', async () => {
      const resultPromise = service.getBotServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthyResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockHealthyResponse);
    });

    it('should return error body on 503 service unavailable', async () => {
      const resultPromise = service.getBotServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockUnhealthyResponse, { status: 503, statusText: 'Service Unavailable' });

      const result = await resultPromise;
      expect(result?.status).toBe(HealthStatus.Unhealthy);
    });

    it('should return null on error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getBotServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  describe('getCommunicationControllerServiceAsync', () => {
    const expectedUrl = 'https://comm.example.com/health';

    it('should return HealthCheck on successful response', async () => {
      const resultPromise = service.getCommunicationControllerServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthyResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockHealthyResponse);
    });

    it('should return error body on 503 service unavailable', async () => {
      const resultPromise = service.getCommunicationControllerServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockUnhealthyResponse, { status: 503, statusText: 'Service Unavailable' });

      const result = await resultPromise;
      expect(result?.status).toBe(HealthStatus.Unhealthy);
    });

    it('should return null on error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getCommunicationControllerServiceAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  describe('getMeshAdapterAsync', () => {
    const expectedUrl = 'https://mesh.example.com/health';

    it('should return HealthCheck on successful response', async () => {
      const resultPromise = service.getMeshAdapterAsync();

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthyResponse);

      const result = await resultPromise;
      expect(result).toEqual(mockHealthyResponse);
    });

    it('should return error body on 503 service unavailable', async () => {
      const resultPromise = service.getMeshAdapterAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.flush(mockUnhealthyResponse, { status: 503, statusText: 'Service Unavailable' });

      const result = await resultPromise;
      expect(result?.status).toBe(HealthStatus.Unhealthy);
    });

    it('should return null on error', async () => {
      spyOn(console, 'error');
      const resultPromise = service.getMeshAdapterAsync();

      const req = httpMock.expectOne(expectedUrl);
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  describe('URL construction', () => {
    it('should construct correct URL for asset repo service', async () => {
      const resultPromise = service.getAssetRepoServiceHealthAsync();

      const req = httpMock.expectOne('https://asset.example.com/health');
      expect(req.request.url).toBe('https://asset.example.com/health');
      req.flush(mockHealthyResponse);

      await resultPromise;
    });

    it('should construct correct URL for identity service', async () => {
      const resultPromise = service.getIdentityServiceAsync();

      const req = httpMock.expectOne('https://identity.example.com/health');
      expect(req.request.url).toBe('https://identity.example.com/health');
      req.flush(mockHealthyResponse);

      await resultPromise;
    });

    it('should construct correct URL for bot service', async () => {
      const resultPromise = service.getBotServiceAsync();

      const req = httpMock.expectOne('https://bot.example.com/health');
      expect(req.request.url).toBe('https://bot.example.com/health');
      req.flush(mockHealthyResponse);

      await resultPromise;
    });

    it('should construct correct URL for communication service', async () => {
      const resultPromise = service.getCommunicationControllerServiceAsync();

      const req = httpMock.expectOne('https://comm.example.com/health');
      expect(req.request.url).toBe('https://comm.example.com/health');
      req.flush(mockHealthyResponse);

      await resultPromise;
    });

    it('should construct correct URL for mesh adapter', async () => {
      const resultPromise = service.getMeshAdapterAsync();

      const req = httpMock.expectOne('https://mesh.example.com/health');
      expect(req.request.url).toBe('https://mesh.example.com/health');
      req.flush(mockHealthyResponse);

      await resultPromise;
    });
  });
});
