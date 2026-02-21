import { TestBed } from '@angular/core/testing';
import { CONFIGURATION_SERVICE, IConfigurationService } from './configuration.service';
import { AddInConfiguration } from '../shared/addInConfiguration';

describe('CONFIGURATION_SERVICE', () => {
  it('should be defined as an InjectionToken', () => {
    expect(CONFIGURATION_SERVICE).toBeDefined();
  });

  it('should allow providing a mock implementation', () => {
    const mockConfig: AddInConfiguration = {
      assetServices: 'https://api.example.com/',
      issuer: 'https://auth.example.com/',
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

    const mockConfigService: IConfigurationService = {
      config: mockConfig,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.returnValue(Promise.resolve())
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    const service = TestBed.inject(CONFIGURATION_SERVICE);
    expect(service).toBeTruthy();
    expect(service.config).toBe(mockConfig);
  });

  it('should support async config loading', async () => {
    let configLoaded = false;

    const mockConfigService: IConfigurationService = {
      config: {} as AddInConfiguration,
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.callFake(async () => {
        configLoaded = true;
      })
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    const service = TestBed.inject(CONFIGURATION_SERVICE);
    await service.loadConfigAsync();

    expect(configLoaded).toBeTrue();
    expect(mockConfigService.loadConfigAsync).toHaveBeenCalled();
  });
});
