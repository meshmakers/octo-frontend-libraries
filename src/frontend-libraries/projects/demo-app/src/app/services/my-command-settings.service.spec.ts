import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { MyCommandSettingsService } from './my-command-settings.service';
import { TenantService } from './tenant.service';
import { CONFIGURATION_SERVICE } from '@meshmakers/octo-services';
import { AuthorizeService } from '@meshmakers/shared-auth';

describe('MyCommandSettingsService', () => {
  let service: MyCommandSettingsService;

  beforeEach(() => {
    const mockActivatedRoute = {
      firstChild: {
        params: of({ tenantId: 'test-tenant' })
      }
    };

    const mockConfigurationService = {
      config: {
        systemTenantId: 'system',
        issuer: 'http://localhost:5001/',
        botServices: 'http://localhost:5002/',
        assetServices: 'http://localhost:5000/',
        communicationServices: 'http://localhost:5003/',
        grafanaUrl: 'http://localhost:3000/',
        crateDbAdminUrl: 'http://localhost:4200/'
      }
    };

    const mockTenantService = jasmine.createSpyObj('TenantService', ['isModelAvailable']);
    mockTenantService.isModelAvailable.and.returnValue(Promise.resolve(true));

    const mockAuthorizeService = jasmine.createSpyObj('AuthorizeService', ['isInRole']);
    mockAuthorizeService.isInRole.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        MyCommandSettingsService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigurationService },
        { provide: TenantService, useValue: mockTenantService },
        { provide: AuthorizeService, useValue: mockAuthorizeService }
      ]
    });
    service = TestBed.inject(MyCommandSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
