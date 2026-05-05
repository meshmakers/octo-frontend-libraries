import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppTitleService, BreadCrumbService, CommandService, ComponentMenuService } from '@meshmakers/shared-services';
import { AuthorizeService } from '@meshmakers/shared-auth';
import { BrandingApplicationService, provideBrandingTesting } from '@meshmakers/octo-ui/branding';

describe('AppComponent', () => {
  let mockAppTitleService: jasmine.SpyObj<AppTitleService>;
  let mockBreadCrumbService: jasmine.SpyObj<BreadCrumbService>;
  let mockCommandService: jasmine.SpyObj<CommandService>;
  let mockComponentMenuService: jasmine.SpyObj<ComponentMenuService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAuthorizeService: jasmine.SpyObj<AuthorizeService>;

  beforeEach(async () => {
    mockAppTitleService = jasmine.createSpyObj('AppTitleService', ['setTitle'], {
      appTitle: of('Test App')
    });
    mockBreadCrumbService = jasmine.createSpyObj('BreadCrumbService', ['updateBreadcrumbLabels'], {
      breadCrumbItems: of([])
    });
    mockCommandService = jasmine.createSpyObj('CommandService', ['setSelectedDrawerItem'], {
      drawerItems: of([])
    });
    mockComponentMenuService = jasmine.createSpyObj('ComponentMenuService', ['setSelectedMenuItem'], {
      menuItems: of([])
    });
    mockRouter = jasmine.createSpyObj('Router', ['navigate'], {
      events: of()
    });
    mockAuthorizeService = jasmine.createSpyObj('AuthorizeService', [
      'initialize', 'isAuthenticated', 'isInRole', 'login', 'logout', 'getUsername'
    ], {
      isAuthenticated$: of(false)
    });

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
