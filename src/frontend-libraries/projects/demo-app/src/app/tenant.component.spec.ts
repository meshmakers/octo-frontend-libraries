import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';

import { TenantComponent } from './tenant.component';
import { CONFIGURATION_SERVICE, OctoErrorLink } from '@meshmakers/octo-services';
import { AuthorizeService } from '@meshmakers/shared-auth';
import { AppTitleService } from '@meshmakers/shared-services';

describe('TenantComponent', () => {
  let component: TenantComponent;
  let fixture: ComponentFixture<TenantComponent>;

  beforeEach(async () => {
    const mockActivatedRoute = {
      params: of({ tenantId: 'test-tenant' })
    };

    const mockConfigurationService = {
      config: {
        assetServices: 'http://localhost:5000/',
        redirectUri: 'http://localhost:4200/',
        postLogoutRedirectUri: 'http://localhost:4200/'
      }
    };

    const mockAuthorizeService = jasmine.createSpyObj('AuthorizeService', ['initialize']);
    mockAuthorizeService.initialize.and.returnValue(Promise.resolve());

    const mockHttpLink = jasmine.createSpyObj('HttpLink', ['create']);
    mockHttpLink.create.and.returnValue({});

    const mockApollo = jasmine.createSpyObj('Apollo', ['removeClient', 'create']);

    const mockTitleService = jasmine.createSpyObj('Title', ['setTitle']);

    const mockAppTitleService = jasmine.createSpyObj('AppTitleService', ['setTitle']);

    const mockOctoErrorLink = {};

    await TestBed.configureTestingModule({
      imports: [TenantComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigurationService },
        { provide: AuthorizeService, useValue: mockAuthorizeService },
        { provide: HttpLink, useValue: mockHttpLink },
        { provide: Apollo, useValue: mockApollo },
        { provide: Title, useValue: mockTitleService },
        { provide: AppTitleService, useValue: mockAppTitleService },
        { provide: OctoErrorLink, useValue: mockOctoErrorLink }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
