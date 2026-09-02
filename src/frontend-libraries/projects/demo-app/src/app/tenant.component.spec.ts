import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { ApolloLink } from '@apollo/client';
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

        const mockAuthorizeService = {
            initialize: vi.fn().mockName("AuthorizeService.initialize")
        };
        mockAuthorizeService.initialize.mockResolvedValue(undefined);

        const mockHttpLink = {
            create: vi.fn().mockName("HttpLink.create")
        };
        // Real ApolloLink instances: the component feeds both this and OctoErrorLink to
        // `ApolloLink.from`, which concatenates them and throws on a plain object.
        mockHttpLink.create.mockReturnValue(ApolloLink.empty());

        const mockApollo = {
            removeClient: vi.fn().mockName("Apollo.removeClient"),
            create: vi.fn().mockName("Apollo.create")
        };

        const mockTitleService = {
            setTitle: vi.fn().mockName("Title.setTitle")
        };

        const mockAppTitleService = {
            setTitle: vi.fn().mockName("AppTitleService.setTitle")
        };

        const mockOctoErrorLink = ApolloLink.empty();

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
