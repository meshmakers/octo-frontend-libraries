import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppTitleService, BreadCrumbService, CommandService, ComponentMenuService } from '@meshmakers/shared-services';
import { AuthorizeService } from '@meshmakers/shared-auth';
import { BrandingApplicationService, provideBrandingTesting } from '@meshmakers/octo-ui/branding';

describe('AppComponent', () => {
    let mockAppTitleService: MockedObject<AppTitleService>;
    let mockBreadCrumbService: MockedObject<BreadCrumbService>;
    let mockCommandService: MockedObject<CommandService>;
    let mockComponentMenuService: MockedObject<ComponentMenuService>;
    let mockRouter: MockedObject<Router>;
    let mockAuthorizeService: MockedObject<AuthorizeService>;

    beforeEach(async () => {
        mockAppTitleService = {
            setTitle: vi.fn().mockName("AppTitleService.setTitle"),
            appTitle: of('Test App')
        };
        mockBreadCrumbService = {
            updateBreadcrumbLabels: vi.fn().mockName("BreadCrumbService.updateBreadcrumbLabels"),
            breadCrumbItems: of([])
        };
        mockCommandService = {
            setSelectedDrawerItem: vi.fn().mockName("CommandService.setSelectedDrawerItem"),
            drawerItems: of([])
        };
        mockComponentMenuService = {
            setSelectedMenuItem: vi.fn().mockName("ComponentMenuService.setSelectedMenuItem"),
            menuItems: of([])
        };
        mockRouter = {
            navigate: vi.fn().mockName("Router.navigate"),
            events: of()
        };
        mockAuthorizeService = {
            initialize: vi.fn().mockName("AuthorizeService.initialize"),
            isAuthenticated: vi.fn().mockName("AuthorizeService.isAuthenticated"),
            isInRole: vi.fn().mockName("AuthorizeService.isInRole"),
            login: vi.fn().mockName("AuthorizeService.login"),
            logout: vi.fn().mockName("AuthorizeService.logout"),
            getUsername: vi.fn().mockName("AuthorizeService.getUsername"),
            isAuthenticated$: of(false)
        };

        const mockActivatedRoute = {
            firstChild: null,
            root: { snapshot: { data: {}, params: {} }, children: [] }
        };

        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [
                provideNoopAnimations(),
                { provide: AppTitleService, useValue: mockAppTitleService },
                { provide: BreadCrumbService, useValue: mockBreadCrumbService },
                { provide: CommandService, useValue: mockCommandService },
                { provide: ComponentMenuService, useValue: mockComponentMenuService },
                { provide: Router, useValue: mockRouter },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
                { provide: AuthorizeService, useValue: mockAuthorizeService },
                provideBrandingTesting(),
                { provide: BrandingApplicationService, useValue: {} },
            ]
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });
});
