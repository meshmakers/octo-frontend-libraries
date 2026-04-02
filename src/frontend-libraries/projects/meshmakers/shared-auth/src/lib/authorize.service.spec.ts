import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { OAuthService, OAuthEvent, TokenResponse } from 'angular-oauth2-oidc';
import { AuthorizeService, AuthorizeOptions, IUser } from './authorize.service';
import { TenantAwareOAuthStorage } from './tenant-aware-oauth-storage';
import { Roles } from './roles';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('AuthorizeService', () => {
  let service: AuthorizeService;
  let oauthServiceMock: jasmine.SpyObj<OAuthService>;
  let oauthEvents$: Subject<OAuthEvent>;
  let discoveryDocumentLoaded$: Subject<unknown>;
  let _reloadPageSpy: jasmine.Spy;

  const mockUser: IUser = {
    family_name: 'Mustermann',
    given_name: 'Max',
    name: 'Max Mustermann',
    role: [Roles.AdminPanelManagement, Roles.ReportingViewer],
    sub: 'user-123',
    idp: 'local',
    email: 'max@example.com'
  };

  const mockOptions: AuthorizeOptions = {
    issuer: 'https://auth.example.com',
    redirectUri: 'https://app.example.com/callback',
    postLogoutRedirectUri: 'https://app.example.com',
    clientId: 'test-client',
    scope: 'openid profile email',
    showDebugInformation: false,
    sessionChecksEnabled: true,
    wellKnownServiceUris: ['https://api.example.com']
  };

  beforeEach(() => {
    oauthEvents$ = new Subject<OAuthEvent>();
    discoveryDocumentLoaded$ = new Subject<unknown>();

    oauthServiceMock = jasmine.createSpyObj('OAuthService', [
      'configure',
      'setStorage',
      'loadDiscoveryDocumentAndTryLogin',
      'setupAutomaticSilentRefresh',
      'stopAutomaticRefresh',
      'hasValidIdToken',
      'refreshToken',
      'getIdentityClaims',
      'getAccessToken',
      'getIdToken',
      'initImplicitFlow',
      'logOut'
    ], {
      events: oauthEvents$.asObservable(),
      discoveryDocumentLoaded$: discoveryDocumentLoaded$.asObservable()
    });

    oauthServiceMock.loadDiscoveryDocumentAndTryLogin.and.returnValue(Promise.resolve(true));
    oauthServiceMock.hasValidIdToken.and.returnValue(false);
    oauthServiceMock.refreshToken.and.returnValue(Promise.resolve({} as TokenResponse));
    oauthServiceMock.getIdentityClaims.and.returnValue(mockUser);
    oauthServiceMock.getAccessToken.and.returnValue('mock-access-token');

    TestBed.configureTestingModule({
      providers: [
        AuthorizeService,
        { provide: OAuthService, useValue: oauthServiceMock }
      ]
    });

    service = TestBed.inject(AuthorizeService);

    // Spy on the protected reloadPage and navigateTo methods to prevent actual page navigation during tests
    _reloadPageSpy = spyOn(service as unknown as { reloadPage: () => void }, 'reloadPage');
    spyOn(service as unknown as { navigateTo: (url: string) => void }, 'navigateTo');
  });

  // =============================================================================
  // SIGNAL API TESTS (NEW - RECOMMENDED)
  // =============================================================================

  describe('Signal API', () => {
    describe('creation', () => {
      it('should be created', () => {
        expect(service).toBeTruthy();
      });

      it('should have initial state as not authenticated', () => {
        expect(service.isAuthenticated()).toBeFalse();
      });

      it('should have initial user as null', () => {
        expect(service.user()).toBeNull();
      });

      it('should have initial accessToken as null', () => {
        expect(service.accessToken()).toBeNull();
      });

      it('should have initial userInitials as null', () => {
        expect(service.userInitials()).toBeNull();
      });

      it('should have initial issuer as null', () => {
        expect(service.issuer()).toBeNull();
      });

      it('should have initial sessionLoading as false', () => {
        expect(service.sessionLoading()).toBeFalse();
      });

      it('should have initial roles as empty array', () => {
        expect(service.roles()).toEqual([]);
      });
    });

    describe('initialize', () => {
      it('should configure OAuthService with correct config', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.configure).toHaveBeenCalledWith(jasmine.objectContaining({
          issuer: mockOptions.issuer,
          redirectUri: mockOptions.redirectUri,
          postLogoutRedirectUri: mockOptions.postLogoutRedirectUri,
          clientId: mockOptions.clientId,
          scope: mockOptions.scope,
          responseType: 'code'
        }));
      });

      it('should set TenantAwareOAuthStorage as storage', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.setStorage).toHaveBeenCalledWith(jasmine.any(TenantAwareOAuthStorage));
      });

      it('should load discovery document and try login', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalled();
      });

      it('should setup automatic silent refresh', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.setupAutomaticSilentRefresh).toHaveBeenCalled();
      });

      it('should set issuer signal', async () => {
        await service.initialize(mockOptions);

        expect(service.issuer()).toBe(mockOptions.issuer!);
      });

      it('should refresh token if valid id token exists', async () => {
        oauthServiceMock.hasValidIdToken.and.returnValue(true);

        await service.initialize(mockOptions);

        expect(oauthServiceMock.refreshToken).toHaveBeenCalled();
      });

      it('should not refresh token if no valid id token exists', async () => {
        oauthServiceMock.hasValidIdToken.and.returnValue(false);

        await service.initialize(mockOptions);

        expect(oauthServiceMock.refreshToken).not.toHaveBeenCalled();
      });

      it('should re-initialize when called twice (uninitialize is called first)', async () => {
        await service.initialize(mockOptions);
        await service.initialize(mockOptions);

        expect(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalledTimes(2);
      });
    });

    describe('uninitialize', () => {
      it('should stop automatic refresh', async () => {
        await service.initialize(mockOptions);
        await service.uninitialize();

        expect(oauthServiceMock.stopAutomaticRefresh).toHaveBeenCalled();
      });

      it('should clear authorizeOptions', async () => {
        await service.initialize(mockOptions);
        await service.uninitialize();

        expect(service.getServiceUris()).toBeNull();
      });
    });

    describe('login', () => {
      it('should call initImplicitFlow', () => {
        service.login();

        expect(oauthServiceMock.initImplicitFlow).toHaveBeenCalled();
      });
    });

    describe('logout', () => {
      it('should call logOut with noRedirectToLogoutUrl=true', () => {
        service.logout();

        expect(oauthServiceMock.logOut as jasmine.Spy).toHaveBeenCalledWith(true);
      });
    });

    describe('OAuth events', () => {
      describe('token_received', () => {
        it('should load user after token received', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(service.user()).toEqual(mockUser);
        });

        it('should set isAuthenticated to true after token received', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(service.isAuthenticated()).toBeTrue();
        });

        it('should set accessToken after token received', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(service.accessToken()).toBe('mock-access-token');
        });

        it('should set roles after token received', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(service.roles()).toContain(Roles.AdminPanelManagement);
          expect(service.roles()).toContain(Roles.ReportingViewer);
        });
      });

      describe('session_terminated', () => {
        it('should reset user to null', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

          expect(service.user()).toBeNull();
        });

        it('should set isAuthenticated to false', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

          expect(service.isAuthenticated()).toBeFalse();
        });

        it('should reset accessToken to null', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

          expect(service.accessToken()).toBeNull();
        });

        it('should reset roles to empty array', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

          expect(service.roles()).toEqual([]);
        });

        it('should call reloadPage on session_terminated', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          _reloadPageSpy.calls.reset();
          oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

          expect(_reloadPageSpy).toHaveBeenCalled();
        });
      });

      describe('logout', () => {
        it('should reset user to null on logout event', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'logout' } as OAuthEvent);

          expect(service.user()).toBeNull();
        });

        it('should set isAuthenticated to false on logout event', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'logout' } as OAuthEvent);

          expect(service.isAuthenticated()).toBeFalse();
        });

        it('should reset accessToken to null on logout event', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthEvents$.next({ type: 'logout' } as OAuthEvent);

          expect(service.accessToken()).toBeNull();
        });

        it('should not call reloadPage on logout event (redirect handled by oauthService)', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          _reloadPageSpy.calls.reset();
          oauthEvents$.next({ type: 'logout' } as OAuthEvent);

          expect(_reloadPageSpy).not.toHaveBeenCalled();
        });
      });

      describe('session_unchanged', () => {
        it('should load user if user is null', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'session_unchanged' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(service.user()).toEqual(mockUser);
        });

        it('should not reload user if user is already loaded', async () => {
          await service.initialize(mockOptions);

          oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          oauthServiceMock.getIdentityClaims.calls.reset();

          oauthEvents$.next({ type: 'session_unchanged' } as OAuthEvent);
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(oauthServiceMock.getIdentityClaims).not.toHaveBeenCalled();
        });
      });
    });

    describe('userInitials', () => {
      it('should calculate initials from given_name and family_name', async () => {
        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.userInitials()).toBe('MM'); // Max Mustermann
      });

      it('should use first two chars of name if no given_name/family_name', async () => {
        const userWithoutNames: IUser = {
          ...mockUser,
          given_name: null,
          family_name: null,
          name: 'Admin'
        };
        oauthServiceMock.getIdentityClaims.and.returnValue(userWithoutNames);

        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.userInitials()).toBe('Ad');
      });

      it('should derive initials from xt_ cross-tenant username', async () => {
        const xtUser: IUser = {
          ...mockUser,
          given_name: null,
          family_name: null,
          name: 'xt_octosystem_gerald.lochner@salzburgdev.at'
        };
        oauthServiceMock.getIdentityClaims.and.returnValue(xtUser);

        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.userInitials()).toBe('GL');
      });

      it('should derive initials from plain email username', async () => {
        const emailUser: IUser = {
          ...mockUser,
          given_name: null,
          family_name: null,
          name: 'gerald.lochner@salzburgdev.at'
        };
        oauthServiceMock.getIdentityClaims.and.returnValue(emailUser);

        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.userInitials()).toBe('GL');
      });
    });

    describe('displayName', () => {
      it('should return full name from given_name and family_name', async () => {
        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.displayName()).toBe('Max Mustermann');
      });

      it('should derive display name from xt_ cross-tenant username', async () => {
        const xtUser: IUser = {
          ...mockUser,
          given_name: null,
          family_name: null,
          name: 'xt_octosystem_gerald.lochner@salzburgdev.at'
        };
        oauthServiceMock.getIdentityClaims.and.returnValue(xtUser);

        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.displayName()).toBe('Gerald Lochner');
      });

      it('should derive display name from plain email username', async () => {
        const emailUser: IUser = {
          ...mockUser,
          given_name: null,
          family_name: null,
          name: 'gerald.lochner@salzburgdev.at'
        };
        oauthServiceMock.getIdentityClaims.and.returnValue(emailUser);

        await service.initialize(mockOptions);

        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.displayName()).toBe('Gerald Lochner');
      });

      it('should return null when user is null', () => {
        expect(service.displayName()).toBeNull();
      });
    });

    describe('isInRole', () => {
      beforeEach(async () => {
        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      it('should return true for existing role', () => {
        expect(service.isInRole(Roles.AdminPanelManagement)).toBeTrue();
      });

      it('should return true for another existing role', () => {
        expect(service.isInRole(Roles.ReportingViewer)).toBeTrue();
      });

      it('should return false for non-existing role', () => {
        expect(service.isInRole(Roles.TenantManagement)).toBeFalse();
      });

      it('should return false when user is null', async () => {
        oauthEvents$.next({ type: 'logout' } as OAuthEvent);

        expect(service.isInRole(Roles.AdminPanelManagement)).toBeFalse();
      });
    });

    describe('getAccessTokenSync', () => {
      it('should return null when not authenticated', () => {
        expect(service.getAccessTokenSync()).toBeNull();
      });

      it('should return token when authenticated', async () => {
        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.getAccessTokenSync()).toBe('mock-access-token');
      });
    });

    describe('getServiceUris', () => {
      it('should return configured service URIs after initialization', async () => {
        await service.initialize(mockOptions);

        expect(service.getServiceUris()).toEqual(['https://api.example.com']);
      });

      it('should return null before initialization', () => {
        expect(service.getServiceUris()).toBeNull();
      });

      it('should return null if no service URIs configured', async () => {
        const optionsWithoutUris: AuthorizeOptions = {
          ...mockOptions,
          wellKnownServiceUris: undefined
        };

        await service.initialize(optionsWithoutUris);

        expect(service.getServiceUris()).toBeNull();
      });
    });

    describe('sessionLoading', () => {
      it('should be true when refreshing token with valid id token', async () => {
        oauthServiceMock.hasValidIdToken.and.returnValue(true);

        // Create a promise that resolves after a delay to capture sessionLoading state
        let capturedSessionLoading = false;
        oauthServiceMock.refreshToken.and.callFake(async () => {
          capturedSessionLoading = service.sessionLoading();
          return {} as TokenResponse;
        });

        await service.initialize(mockOptions);

        expect(capturedSessionLoading).toBeTrue();
      });

      it('should be false after user is loaded', async () => {
        oauthServiceMock.hasValidIdToken.and.returnValue(true);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.sessionLoading()).toBeFalse();
      });
    });

    describe('edge cases', () => {
      it('should handle null claims gracefully', async () => {
        oauthServiceMock.getIdentityClaims.and.returnValue(null as unknown as ReturnType<OAuthService['getIdentityClaims']>);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.user()).toBeNull();
      });
    });

    describe('tokenTenantId', () => {
      it('should return null when not authenticated', () => {
        expect(service.tokenTenantId()).toBeNull();
      });

      it('should return parsed tenant_id after token_received', async () => {
        const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
        oauthServiceMock.getAccessToken.and.returnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.tokenTenantId()).toBe('octosystem');
      });

      it('should return null when token has no tenant_id claim', async () => {
        const mockToken = createMockJwt({ sub: 'user-123' });
        oauthServiceMock.getAccessToken.and.returnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.tokenTenantId()).toBeNull();
      });

      it('should be cleared on logout event', async () => {
        const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
        oauthServiceMock.getAccessToken.and.returnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(service.tokenTenantId()).toBe('octosystem');

        oauthEvents$.next({ type: 'logout' } as OAuthEvent);

        expect(service.tokenTenantId()).toBeNull();
      });

      it('should be cleared on session_terminated event', async () => {
        const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
        oauthServiceMock.getAccessToken.and.returnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(service.tokenTenantId()).toBe('octosystem');

        oauthEvents$.next({ type: 'session_terminated' } as OAuthEvent);

        expect(service.tokenTenantId()).toBeNull();
      });
    });

    // =============================================================================
    // CROSS-TAB LOGOUT DETECTION TESTS
    // =============================================================================
    // Note: Storage event and BroadcastChannel tests are integration-level tests
    // because they involve browser APIs that persist across test instances.
    // The cross-tab logout functionality is implemented in the constructor:
    // 1. Storage event listener: Detects access_token removal in other tabs
    // 2. BroadcastChannel listener: Receives logout messages from other tabs
    // Both handlers clear user state and call reloadPage() when authenticated.
    // These features should be verified through E2E/integration tests.

    // =============================================================================
    // PER-TENANT STORAGE TESTS
    // =============================================================================

    describe('setStorageTenantId', () => {
      it('should pass TenantAwareOAuthStorage with correct tenant to setStorage', async () => {
        service.setStorageTenantId('maco');
        await service.initialize(mockOptions);

        const storageArg = oauthServiceMock.setStorage.calls.mostRecent().args[0] as TenantAwareOAuthStorage;
        expect(storageArg).toBeInstanceOf(TenantAwareOAuthStorage);
        expect(storageArg.getTenantId()).toBe('maco');
      });
    });

    describe('switchTenant', () => {
      beforeEach(async () => {
        await service.initialize(mockOptions);
        // Prevent actual page navigation by spying on reloadPage
        // (switchTenant uses window.location.href which we can't easily mock,
        // but the important assertions are about side effects before navigation)
      });

      it('should call stopAutomaticRefresh', () => {
        oauthServiceMock.stopAutomaticRefresh.calls.reset();

        // switchTenant will set window.location.href which triggers navigation,
        // but the stopAutomaticRefresh call happens before that
        service.switchTenant('octosystem', 'https://localhost:4200/octosystem');

        expect(oauthServiceMock.stopAutomaticRefresh).toHaveBeenCalled();
      });

      it('should store target tenant in sessionStorage for login after reload', () => {
        service.switchTenant('octosystem', 'https://localhost:4200/octosystem');

        expect(sessionStorage.getItem('octo_tenant_reauth')).toBe('octosystem');
        expect(sessionStorage.getItem('octo_tenant_switch_attempted')).toBe('octosystem');
      });

      afterEach(() => {
        sessionStorage.removeItem('octo_tenant_reauth');
        sessionStorage.removeItem('octo_tenant_switch_attempted');
      });
    });

    describe('logout with tenant storage', () => {
      it('should clear all tenant tokens on logout', () => {
        // Set up tokens in localStorage and flow keys in sessionStorage
        localStorage.setItem('maco__access_token', 'maco-token');
        localStorage.setItem('octosystem__access_token', 'octo-token');
        sessionStorage.setItem('maco__nonce', 'maco-nonce');

        service.logout();

        expect(localStorage.getItem('maco__access_token')).toBeNull();
        expect(localStorage.getItem('octosystem__access_token')).toBeNull();
        expect(sessionStorage.getItem('maco__nonce')).toBeNull();
      });
    });
  });

  // =============================================================================
  // updateRedirectUris TESTS
  // =============================================================================

  describe('updateRedirectUris', () => {
    it('should not reset discovery document endpoints', async () => {
      oauthServiceMock.hasValidIdToken.and.returnValue(false);
      oauthServiceMock.loadDiscoveryDocumentAndTryLogin.and.resolveTo(true);

      await service.initialize(mockOptions);

      // Simulate discovery document having loaded — set endpoints on the mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockObj = oauthServiceMock as any;
      mockObj.logoutUrl = 'https://auth.example.com/connect/endsession';
      mockObj.tokenEndpoint = 'https://auth.example.com/connect/token';

      // Call updateRedirectUris (this previously called configure() which reset all properties)
      service.updateRedirectUris('https://app.example.com/tenant1', 'https://app.example.com');

      // The discovery document endpoints should NOT have been reset
      expect(mockObj.logoutUrl).toBe('https://auth.example.com/connect/endsession');
      expect(mockObj.tokenEndpoint).toBe('https://auth.example.com/connect/token');

      // configure() should NOT be called again (only once during initialize)
      expect(oauthServiceMock.configure).toHaveBeenCalledTimes(1);
    });

    it('should update redirect URIs directly on the service', async () => {
      oauthServiceMock.hasValidIdToken.and.returnValue(false);
      oauthServiceMock.loadDiscoveryDocumentAndTryLogin.and.resolveTo(true);

      await service.initialize(mockOptions);

      service.updateRedirectUris('https://app.example.com/tenant1', 'https://app.example.com/logout');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockObj = oauthServiceMock as any;
      expect(mockObj.redirectUri).toBe('https://app.example.com/tenant1');
      expect(mockObj.postLogoutRedirectUri).toBe('https://app.example.com/logout');
    });
  });
});
