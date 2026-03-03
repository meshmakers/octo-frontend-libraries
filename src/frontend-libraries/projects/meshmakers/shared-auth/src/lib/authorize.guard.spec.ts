import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlSegment } from '@angular/router';
import {
  authorizeGuard,
  authorizeChildGuard,
  authorizeMatchGuard,
  authorizeDeactivateGuard
} from './authorize.guard';
import { AuthorizeService } from './authorize.service';
import { Roles } from './roles';

// =============================================================================
// FUNCTIONAL GUARDS TESTS (using Signal API)
// =============================================================================

describe('Functional Guards', () => {
  let authServiceMock: jasmine.SpyObj<AuthorizeService>;
  let routerMock: jasmine.SpyObj<Router>;

  // Signal mock values
  let isAuthenticatedValue = false;
  let rolesValue: string[] = [];
  let tokenTenantIdValue: string | null = null;

  beforeEach(() => {
    isAuthenticatedValue = false;
    rolesValue = [];
    tokenTenantIdValue = null;

    // Create mock with signals (callable functions)
    authServiceMock = jasmine.createSpyObj('AuthorizeService', ['login', 'switchTenant', 'consumePendingTenantSwitch', 'consumeSwitchAttempted'], {
      // Signal mocks - these return a function that returns the value
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.callFake(() => isAuthenticatedValue),
      roles: jasmine.createSpy('roles').and.callFake(() => rolesValue),
      tokenTenantId: jasmine.createSpy('tokenTenantId').and.callFake(() => tokenTenantIdValue)
    });
    authServiceMock.consumePendingTenantSwitch.and.returnValue(null);
    authServiceMock.consumeSwitchAttempted.and.returnValue(null);
    authServiceMock.switchTenant.and.returnValue(true);

    routerMock = jasmine.createSpyObj('Router', ['navigate']);
    routerMock.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthorizeService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    });
  });

  describe('authorizeGuard', () => {
    let mockRoute: ActivatedRouteSnapshot;
    let mockState: RouterStateSnapshot;

    beforeEach(() => {
      mockRoute = {
        data: {}
      } as ActivatedRouteSnapshot;

      mockState = {
        url: '/protected'
      } as RouterStateSnapshot;
    });

    describe('when user is not authenticated', () => {
      beforeEach(() => {
        isAuthenticatedValue = false;
      });

      it('should call login', async () => {
        await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(authServiceMock.login).toHaveBeenCalled();
      });

      it('should return false', async () => {
        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeFalse();
      });
    });

    describe('when user is authenticated', () => {
      beforeEach(() => {
        isAuthenticatedValue = true;
      });

      it('should return true when no roles are required', async () => {
        mockRoute.data = {};
        rolesValue = [Roles.ReportingViewer];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
      });

      it('should return true when user has required role', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [Roles.AdminPanelManagement, Roles.ReportingViewer];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
      });

      it('should return true when user has one of multiple required roles', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement, Roles.TenantManagement] };
        rolesValue = [Roles.TenantManagement];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
      });

      it('should return false when user does not have required role', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [Roles.ReportingViewer];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeFalse();
      });

      it('should navigate to home when user does not have required role', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [Roles.ReportingViewer];

        await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(routerMock.navigate).toHaveBeenCalledWith(['']);
      });

      it('should not call login when authenticated', async () => {
        mockRoute.data = {};
        rolesValue = [];

        await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should return false when user has no roles and roles are required', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeFalse();
      });
    });

    describe('tenant mismatch detection', () => {
      beforeEach(() => {
        isAuthenticatedValue = true;
        rolesValue = [Roles.AdminPanelManagement];
      });

      it('should allow access when token tenant_id matches route tenantId', async () => {
        tokenTenantIdValue = 'octosystem';
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: {
            params: { tenantId: 'octosystem' },
            parent: null
          } as unknown as ActivatedRouteSnapshot
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should allow access when token tenant_id matches route tenantId case-insensitively', async () => {
        tokenTenantIdValue = 'OctoSystem';
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: {
            params: { tenantId: 'octosystem' },
            parent: null
          } as unknown as ActivatedRouteSnapshot
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should call switchTenant with target URL when token tenant_id differs from route tenantId', async () => {
        tokenTenantIdValue = 'octosystem';
        mockState = { url: '/meshtest/dashboard' } as RouterStateSnapshot;
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: {
            params: { tenantId: 'meshtest' },
            parent: null
          } as unknown as ActivatedRouteSnapshot
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeFalse();
        // Must use state.url (target URL), not window.location.href (current URL)
        expect(authServiceMock.switchTenant).toHaveBeenCalledWith('meshtest', jasmine.stringContaining('/meshtest/dashboard'));
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should skip tenant check when tokenTenantId is null', async () => {
        tokenTenantIdValue = null;
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: {
            params: { tenantId: 'meshtest' },
            parent: null
          } as unknown as ActivatedRouteSnapshot
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should skip tenant check when route has no tenantId', async () => {
        tokenTenantIdValue = 'octosystem';
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: null
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBeTrue();
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      it('should fall through to role check when switchTenant returns false (loop prevention)', async () => {
        tokenTenantIdValue = 'octosystem';
        authServiceMock.switchTenant.and.returnValue(false);
        mockState = { url: '/meshtest' } as RouterStateSnapshot;
        mockRoute = {
          data: { roles: [] },
          params: {},
          parent: {
            params: { tenantId: 'meshtest' },
            parent: null
          } as unknown as ActivatedRouteSnapshot
        } as unknown as ActivatedRouteSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        // switchTenant was called but returned false (loop prevention)
        expect(authServiceMock.switchTenant).toHaveBeenCalledWith('meshtest', jasmine.stringContaining('/meshtest'));
        // Guard falls through to role check — empty roles means access granted
        expect(result).toBeTrue();
      });
    });
  });

  describe('authorizeChildGuard', () => {
    it('should delegate to authorizeGuard', async () => {
      const mockRoute = { data: {} } as ActivatedRouteSnapshot;
      const mockState = { url: '/parent/child' } as RouterStateSnapshot;

      isAuthenticatedValue = true;
      rolesValue = [Roles.ReportingViewer];

      const result = await TestBed.runInInjectionContext(() => authorizeChildGuard(mockRoute, mockState));

      expect(result).toBeTrue();
    });

    it('should use child route data for role check', async () => {
      const mockRoute = { data: { roles: [Roles.AdminPanelManagement] } } as unknown as ActivatedRouteSnapshot;
      const mockState = { url: '/parent/child' } as RouterStateSnapshot;

      isAuthenticatedValue = true;
      rolesValue = [Roles.ReportingViewer];

      const result = await TestBed.runInInjectionContext(() => authorizeChildGuard(mockRoute, mockState));

      expect(result).toBeFalse();
    });
  });

  describe('authorizeMatchGuard', () => {
    it('should return true when authenticated', async () => {
      isAuthenticatedValue = true;

      const result = await TestBed.runInInjectionContext(() =>
        authorizeMatchGuard({} as any, [] as UrlSegment[])
      );

      expect(result).toBeTrue();
    });

    it('should return false when not authenticated', async () => {
      isAuthenticatedValue = false;

      const result = await TestBed.runInInjectionContext(() =>
        authorizeMatchGuard({} as any, [] as UrlSegment[])
      );

      expect(result).toBeFalse();
    });

    it('should call login when not authenticated', async () => {
      isAuthenticatedValue = false;

      await TestBed.runInInjectionContext(() =>
        authorizeMatchGuard({} as any, [] as UrlSegment[])
      );

      expect(authServiceMock.login).toHaveBeenCalled();
    });
  });

  describe('authorizeDeactivateGuard', () => {
    it('should always return true', () => {
      const result = authorizeDeactivateGuard();

      expect(result).toBeTrue();
    });
  });
});
