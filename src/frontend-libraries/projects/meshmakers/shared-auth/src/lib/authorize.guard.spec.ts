import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, UrlSegment } from '@angular/router';
import { authorizeGuard, authorizeChildGuard, authorizeMatchGuard, authorizeDeactivateGuard, TENANT_MISMATCH_PATH } from './authorize.guard';
import { AuthorizeService } from './authorize.service';
import { Roles } from './roles';

// =============================================================================
// FUNCTIONAL GUARDS TESTS (using Signal API)
// =============================================================================

describe('Functional Guards', () => {
  let authServiceMock: MockedObject<AuthorizeService>;
  let routerMock: MockedObject<Router>;

  // Signal mock values
  let isAuthenticatedValue = false;
  let rolesValue: string[] = [];
  let tokenTenantIdValue: string | null = null;

  beforeEach(() => {
    isAuthenticatedValue = false;
    rolesValue = [];
    tokenTenantIdValue = null;

    // Create mock with signals (callable functions)
    authServiceMock = {
      login: vi.fn().mockName('AuthorizeService.login'),
      switchTenant: vi.fn().mockName('AuthorizeService.switchTenant'),
      switchTenantByExchange: vi.fn().mockName('AuthorizeService.switchTenantByExchange'),
      consumePendingTenantSwitch: vi.fn().mockName('AuthorizeService.consumePendingTenantSwitch'),
      consumeSwitchAttempted: vi.fn().mockName('AuthorizeService.consumeSwitchAttempted'),
      // Signal mocks - these return a function that returns the value
      isAuthenticated: vi.fn().mockName('isAuthenticated').mockImplementation(() => isAuthenticatedValue),
      roles: vi.fn().mockName('roles').mockImplementation(() => rolesValue),
      tokenTenantId: vi.fn().mockName('tokenTenantId').mockImplementation(() => tokenTenantIdValue)
    } as unknown as MockedObject<AuthorizeService>;
    authServiceMock.consumePendingTenantSwitch.mockReturnValue(null);
    authServiceMock.consumeSwitchAttempted.mockReturnValue(null);
    authServiceMock.switchTenant.mockReturnValue(true);
    authServiceMock.switchTenantByExchange.mockResolvedValue(false);

    routerMock = {
      navigate: vi.fn().mockName('Router.navigate'),
      createUrlTree: vi.fn().mockName('Router.createUrlTree').mockImplementation((commands: string[]) => ({ commands }))
    } as unknown as MockedObject<Router>;
    routerMock.navigate.mockResolvedValue(true);

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

        expect(result).toBe(false);
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

        expect(result).toBe(true);
      });

      it('should return true when user has required role', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [Roles.AdminPanelManagement, Roles.ReportingViewer];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBe(true);
      });

      it('should return true when user has one of multiple required roles', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement, Roles.TenantManagement] };
        rolesValue = [Roles.TenantManagement];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBe(true);
      });

      it('should return false when user does not have required role', async () => {
        mockRoute.data = { roles: [Roles.AdminPanelManagement] };
        rolesValue = [Roles.ReportingViewer];

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mockRoute, mockState));

        expect(result).toBe(false);
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

        expect(result).toBe(false);
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

        expect(result).toBe(true);
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

        expect(result).toBe(true);
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

        expect(result).toBe(false);
        // Must use state.url (target URL), not window.location.href (current URL)
        expect(authServiceMock.switchTenant).toHaveBeenCalledWith('meshtest', expect.stringContaining('/meshtest/dashboard'));
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

        expect(result).toBe(true);
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

        expect(result).toBe(true);
        expect(authServiceMock.login).not.toHaveBeenCalled();
      });

      const mismatchRoute = (): ActivatedRouteSnapshot => ({
        data: { roles: [] },
        params: {},
        parent: { params: { tenantId: 'meshtest' }, parent: null } as unknown as ActivatedRouteSnapshot
      } as unknown as ActivatedRouteSnapshot);

      it('should NOT fall through but block when switchTenant returns false (flag set, token tenant mismatch)', async () => {
        tokenTenantIdValue = 'octosystem';
        authServiceMock.switchTenant.mockReturnValue(false);
        mockState = { url: '/meshtest' } as RouterStateSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mismatchRoute(), mockState));

        expect(authServiceMock.switchTenant).toHaveBeenCalledWith('meshtest', expect.stringContaining('/meshtest'));
        expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/', 'meshtest', TENANT_MISMATCH_PATH]);
        expect(result).toEqual({ commands: ['/', 'meshtest', TENANT_MISMATCH_PATH] });
      });

      it('should try the token exchange first and not redirect when it succeeds', async () => {
        tokenTenantIdValue = 'octosystem';
        authServiceMock.switchTenantByExchange.mockImplementation(async () => {
          tokenTenantIdValue = 'meshtest'; // the exchange swaps the session in place
          return true;
        });
        mockState = { url: '/meshtest' } as RouterStateSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mismatchRoute(), mockState));

        expect(authServiceMock.switchTenantByExchange).toHaveBeenCalledWith('meshtest');
        expect(authServiceMock.switchTenant).not.toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should redirect (auth-code flow) when the exchange is not possible', async () => {
        tokenTenantIdValue = 'octosystem';
        authServiceMock.switchTenantByExchange.mockResolvedValue(false);
        mockState = { url: '/meshtest' } as RouterStateSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mismatchRoute(), mockState));

        expect(authServiceMock.switchTenantByExchange).toHaveBeenCalledWith('meshtest');
        expect(authServiceMock.switchTenant).toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it('should block when the exchange reports success but the token tenant still differs', async () => {
        tokenTenantIdValue = 'octosystem';
        authServiceMock.switchTenantByExchange.mockResolvedValue(true);
        mockState = { url: '/meshtest' } as RouterStateSnapshot;

        const result = await TestBed.runInInjectionContext(() => authorizeGuard(mismatchRoute(), mockState));

        expect(result).toEqual({ commands: ['/', 'meshtest', TENANT_MISMATCH_PATH] });
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

      expect(result).toBe(true);
    });

    it('should use child route data for role check', async () => {
      const mockRoute = { data: { roles: [Roles.AdminPanelManagement] } } as unknown as ActivatedRouteSnapshot;
      const mockState = { url: '/parent/child' } as RouterStateSnapshot;

      isAuthenticatedValue = true;
      rolesValue = [Roles.ReportingViewer];

      const result = await TestBed.runInInjectionContext(() => authorizeChildGuard(mockRoute, mockState));

      expect(result).toBe(false);
    });
  });

  describe('authorizeMatchGuard', () => {
    it('should return true when authenticated', async () => {
      isAuthenticatedValue = true;

      const result = await TestBed.runInInjectionContext(() => authorizeMatchGuard({} as unknown as Route, [] as UrlSegment[], {} as unknown as ActivatedRouteSnapshot));

      expect(result).toBe(true);
    });

    it('should return false when not authenticated', async () => {
      isAuthenticatedValue = false;

      const result = await TestBed.runInInjectionContext(() => authorizeMatchGuard({} as unknown as Route, [] as UrlSegment[], {} as unknown as ActivatedRouteSnapshot));

      expect(result).toBe(false);
    });

    it('should call login when not authenticated', async () => {
      isAuthenticatedValue = false;

      await TestBed.runInInjectionContext(() => authorizeMatchGuard({} as unknown as Route, [] as UrlSegment[], {} as unknown as ActivatedRouteSnapshot));

      expect(authServiceMock.login).toHaveBeenCalled();
    });
  });

  describe('authorizeDeactivateGuard', () => {
    it('should always return true', () => {
      const result = authorizeDeactivateGuard();

      expect(result).toBe(true);
    });
  });
});
