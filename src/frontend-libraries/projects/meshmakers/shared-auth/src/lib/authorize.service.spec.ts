import type { Mock, MockedObject } from 'vitest';
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
  let oauthServiceMock: MockedObject<OAuthService>;
  let oauthEvents$: Subject<OAuthEvent>;
  let discoveryDocumentLoaded$: Subject<unknown>;
  let _reloadPageSpy: Mock;
  let _navigateToSpy: Mock;

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

    oauthServiceMock = {
      configure: vi.fn().mockName('OAuthService.configure'),
      setStorage: vi.fn().mockName('OAuthService.setStorage'),
      loadDiscoveryDocumentAndTryLogin: vi.fn().mockName('OAuthService.loadDiscoveryDocumentAndTryLogin'),
      setupAutomaticSilentRefresh: vi.fn().mockName('OAuthService.setupAutomaticSilentRefresh'),
      stopAutomaticRefresh: vi.fn().mockName('OAuthService.stopAutomaticRefresh'),
      hasValidIdToken: vi.fn().mockName('OAuthService.hasValidIdToken'),
      refreshToken: vi.fn().mockName('OAuthService.refreshToken'),
      getIdentityClaims: vi.fn().mockName('OAuthService.getIdentityClaims'),
      getAccessToken: vi.fn().mockName('OAuthService.getAccessToken'),
      getIdToken: vi.fn().mockName('OAuthService.getIdToken'),
      initImplicitFlow: vi.fn().mockName('OAuthService.initImplicitFlow'),
      logOut: vi.fn().mockName('OAuthService.logOut'),
      events: oauthEvents$.asObservable(),
      discoveryDocumentLoaded$: discoveryDocumentLoaded$.asObservable()
    } as unknown as MockedObject<OAuthService>;

    oauthServiceMock.loadDiscoveryDocumentAndTryLogin.mockResolvedValue(true);
    oauthServiceMock.hasValidIdToken.mockReturnValue(false);
    oauthServiceMock.refreshToken.mockResolvedValue({} as TokenResponse);
    oauthServiceMock.getIdentityClaims.mockReturnValue(mockUser);
    oauthServiceMock.getAccessToken.mockReturnValue('mock-access-token');

    TestBed.configureTestingModule({
      providers: [
        AuthorizeService,
        { provide: OAuthService, useValue: oauthServiceMock }
      ]
    });

    service = TestBed.inject(AuthorizeService);

    // Spy on the protected reloadPage and navigateTo methods to prevent actual page navigation during tests
    _reloadPageSpy = vi.spyOn(service as unknown as {
      reloadPage: () => void;
    }, 'reloadPage').mockReturnValue(undefined);
    _navigateToSpy = vi.spyOn(service as unknown as {
      navigateTo: (url: string) => void;
    }, 'navigateTo').mockReturnValue(undefined);
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
        expect(service.isAuthenticated()).toBe(false);
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
        expect(service.sessionLoading()).toBe(false);
      });

      it('should have initial roles as empty array', () => {
        expect(service.roles()).toEqual([]);
      });
    });

    describe('initialize', () => {
      it('should configure OAuthService with correct config', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.configure).toHaveBeenCalledWith(expect.objectContaining({
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

        expect(oauthServiceMock.setStorage).toHaveBeenCalledWith(expect.any(TenantAwareOAuthStorage));
      });

      it('should load discovery document and try login', async () => {
        await service.initialize(mockOptions);

        expect(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalled();
      });

      it('should retry loadDiscoveryDocumentAndTryLogin when it fails transiently', async () => {
        oauthServiceMock.loadDiscoveryDocumentAndTryLogin.mockImplementation(() => {
          const callCount = vi.mocked(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).mock.calls.length;
          return callCount < 3
            ? Promise.reject(new Error('CORS / network error'))
            : Promise.resolve(true);
        });

        await service.initialize({
          ...mockOptions,
          // Tight policy to keep the test fast; backoff is exponential.
          discoveryDocumentRetry: { attempts: 5, initialDelayMs: 1, maxDelayMs: 4 }
        });

        expect(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalledTimes(3);
        expect(service.discoveryDocumentError()).toBeNull();
        expect(service.discoveryDocumentRetryAttempt()).toBe(0);
      });

      it('should surface the last error after exhausting all retry attempts', async () => {
        const failure = new Error('OIDC unavailable');
        oauthServiceMock.loadDiscoveryDocumentAndTryLogin.mockRejectedValue(failure);

        await expect(service.initialize({
          ...mockOptions,
          discoveryDocumentRetry: { attempts: 3, initialDelayMs: 1, maxDelayMs: 4 }
        })).rejects.toThrow();

        expect(oauthServiceMock.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalledTimes(3);
        expect(service.discoveryDocumentError()).toBe(failure);
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
        oauthServiceMock.hasValidIdToken.mockReturnValue(true);

        await service.initialize(mockOptions);

        expect(oauthServiceMock.refreshToken).toHaveBeenCalled();
      });

      it('should not refresh token if no valid id token exists', async () => {
        oauthServiceMock.hasValidIdToken.mockReturnValue(false);

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

        expect(oauthServiceMock.logOut as Mock).toHaveBeenCalledWith(true);
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

          expect(service.isAuthenticated()).toBe(true);
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

          expect(service.isAuthenticated()).toBe(false);
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

          _reloadPageSpy.mockClear();
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

          expect(service.isAuthenticated()).toBe(false);
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

          _reloadPageSpy.mockClear();
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

          oauthServiceMock.getIdentityClaims.mockClear();

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
        oauthServiceMock.getIdentityClaims.mockReturnValue(userWithoutNames);

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
        oauthServiceMock.getIdentityClaims.mockReturnValue(xtUser);

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
        oauthServiceMock.getIdentityClaims.mockReturnValue(emailUser);

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
        oauthServiceMock.getIdentityClaims.mockReturnValue(xtUser);

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
        oauthServiceMock.getIdentityClaims.mockReturnValue(emailUser);

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
        expect(service.isInRole(Roles.AdminPanelManagement)).toBe(true);
      });

      it('should return true for another existing role', () => {
        expect(service.isInRole(Roles.ReportingViewer)).toBe(true);
      });

      it('should return false for non-existing role', () => {
        expect(service.isInRole(Roles.TenantManagement)).toBe(false);
      });

      it('should return false when user is null', async () => {
        oauthEvents$.next({ type: 'logout' } as OAuthEvent);

        expect(service.isInRole(Roles.AdminPanelManagement)).toBe(false);
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
        oauthServiceMock.hasValidIdToken.mockReturnValue(true);

        // Create a promise that resolves after a delay to capture sessionLoading state
        let capturedSessionLoading = false;
        oauthServiceMock.refreshToken.mockImplementation(async () => {
          capturedSessionLoading = service.sessionLoading();
          return {} as TokenResponse;
        });

        await service.initialize(mockOptions);

        expect(capturedSessionLoading).toBe(true);
      });

      it('should be false after user is loaded', async () => {
        oauthServiceMock.hasValidIdToken.mockReturnValue(true);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.sessionLoading()).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null claims gracefully', async () => {
        oauthServiceMock.getIdentityClaims.mockReturnValue(null as unknown as ReturnType<OAuthService['getIdentityClaims']>);

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
        oauthServiceMock.getAccessToken.mockReturnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.tokenTenantId()).toBe('octosystem');
      });

      it('should return null when token has no tenant_id claim', async () => {
        const mockToken = createMockJwt({ sub: 'user-123' });
        oauthServiceMock.getAccessToken.mockReturnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(service.tokenTenantId()).toBeNull();
      });

      it('should be cleared on logout event', async () => {
        const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
        oauthServiceMock.getAccessToken.mockReturnValue(mockToken);

        await service.initialize(mockOptions);
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(service.tokenTenantId()).toBe('octosystem');

        oauthEvents$.next({ type: 'logout' } as OAuthEvent);

        expect(service.tokenTenantId()).toBeNull();
      });

      it('should be cleared on session_terminated event', async () => {
        const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
        oauthServiceMock.getAccessToken.mockReturnValue(mockToken);

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

        const storageArg = vi.mocked(oauthServiceMock.setStorage).mock.lastCall![0] as TenantAwareOAuthStorage;
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
        oauthServiceMock.stopAutomaticRefresh.mockClear();

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

      it('should persist the current tenant in octo_post_logout_tenant before clearing', () => {
        // The IdS end_session round-trip drops the tenant path; without this
        // hint the post-logout return would land the user on the host app's
        // default-tenant redirect instead of the tenant they signed out of.
        sessionStorage.removeItem('octo_post_logout_tenant');
        service.setStorageTenantId('meshtest');

        service.logout();

        expect(sessionStorage.getItem('octo_post_logout_tenant')).toBe('meshtest');
      });

      it('should not write octo_post_logout_tenant when no tenant is set', () => {
        sessionStorage.removeItem('octo_post_logout_tenant');
        service.setStorageTenantId(null);

        service.logout();

        expect(sessionStorage.getItem('octo_post_logout_tenant')).toBeNull();
      });
    });
  });

  // =============================================================================
  // TENANT MISMATCH DETECTION TESTS
  // =============================================================================

  describe('tenant mismatch detection', () => {
    it('should NOT trigger switchTenant on initial login (not previously authenticated)', async () => {
      // Arrange: Set storage tenant to a different tenant than what the token contains
      service.setStorageTenantId('meshtest');
      const mockToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(mockToken);

      _navigateToSpy.mockClear();

      await service.initialize(mockOptions);

      // Act: Initial login (not previously authenticated)
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert: Should NOT trigger switchTenant because this is the initial login
      expect(_navigateToSpy).not.toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(true);
      expect(service.tokenTenantId()).toBe('octosystem');
    });

    it('should trigger switchTenant when previously authenticated and tenant_id mismatches storage', async () => {
      // Arrange: First login with matching tenant
      service.setStorageTenantId('octosystem');
      const initialToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(initialToken);

      await service.initialize(mockOptions);
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(service.isAuthenticated()).toBe(true);

      // Now simulate a refresh that returns a token for the wrong tenant
      service.setStorageTenantId('meshtest');
      const mismatchedToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(mismatchedToken);

      _navigateToSpy.mockClear();

      // Act: Simulate token refresh (previously authenticated = true)
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert: Should trigger switchTenant because token tenant doesn't match storage
      expect(_navigateToSpy).toHaveBeenCalled();
    });

    it('should NOT trigger switchTenant when tenant_id matches storage on refresh', async () => {
      // Arrange: First login
      service.setStorageTenantId('octosystem');
      const token = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(token);

      await service.initialize(mockOptions);
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      _navigateToSpy.mockClear();

      // Act: Refresh returns same tenant
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert: No switch needed
      expect(_navigateToSpy).not.toHaveBeenCalled();
    });

    it('should NOT trigger switchTenant when token has no tenant_id', async () => {
      // Arrange: First login with a token that has tenant_id
      service.setStorageTenantId('octosystem');
      const initialToken = createMockJwt({ tenant_id: 'octosystem', sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(initialToken);

      await service.initialize(mockOptions);
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Now simulate refresh returning token without tenant_id
      const tokenWithoutTenant = createMockJwt({ sub: 'user-123' });
      oauthServiceMock.getAccessToken.mockReturnValue(tokenWithoutTenant);

      _navigateToSpy.mockClear();

      // Act
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert: No switch — can't determine mismatch without tenant_id
      expect(_navigateToSpy).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // updateRedirectUris TESTS
  // =============================================================================

  describe('updateRedirectUris', () => {
    it('should not reset discovery document endpoints', async () => {
      oauthServiceMock.hasValidIdToken.mockReturnValue(false);
      oauthServiceMock.loadDiscoveryDocumentAndTryLogin.mockResolvedValue(true);

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
      oauthServiceMock.hasValidIdToken.mockReturnValue(false);
      oauthServiceMock.loadDiscoveryDocumentAndTryLogin.mockResolvedValue(true);

      await service.initialize(mockOptions);

      service.updateRedirectUris('https://app.example.com/tenant1', 'https://app.example.com/logout');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockObj = oauthServiceMock as any;
      expect(mockObj.redirectUri).toBe('https://app.example.com/tenant1');
      expect(mockObj.postLogoutRedirectUri).toBe('https://app.example.com/logout');
    });
  });
  describe('switchTenantByExchange', () => {
    const sourceToken = createMockJwt({
      tenant_id: 'bierok',
      allowed_tenants: ['bierok', 'tecob', 'bernkopf']
    });
    const exchangedToken = createMockJwt({
      tenant_id: 'tecob',
      allowed_tenants: ['bierok', 'tecob', 'bernkopf']
    });
    const userInfo = {
      sub: 'shadow-user-1',
      name: 'xt_bernkopf_kbernkopf',
      role: ['AccountingManagement']
    };

    let fetchSpy: Mock;

    function stubEndpoints(tokenStatus = 200, userInfoStatus = 200): void {
      fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('userinfo')) {
          return Promise.resolve(new Response(JSON.stringify(userInfo), { status: userInfoStatus }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          access_token: exchangedToken,
          refresh_token: 'refresh-token-1',
          expires_in: 3600,
          scope: 'openid profile octo_api'
        }), { status: tokenStatus }));
      });
    }

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockObj = oauthServiceMock as any;
      mockObj.tokenEndpoint = 'https://auth.example.com/connect/token';
      mockObj.userinfoEndpoint = 'https://auth.example.com/connect/userinfo';
      oauthServiceMock.getAccessToken.mockReturnValue(sourceToken);

      await service.initialize(mockOptions);
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
      // Jasmine restored every spy after each spec; Vitest does not by itself, and vi.spyOn on
      // an already-spied member returns the SAME mock, so window.fetch would keep its call
      // history across the tests below. The global afterEach in testing/vitest-setup.ts already
      // restores it — this call is a belt-and-braces duplicate kept next to the spy it belongs to.
      fetchSpy.mockRestore();

      for (const key of ['tecob__access_token', 'tecob__refresh_token', 'tecob__expires_at',
        'tecob__access_token_stored_at', 'tecob__granted_scopes',
        'tecob__id_token_claims_obj']) {
        localStorage.removeItem(key);
      }
    });

    it('adopts the target tenant without a redirect', async () => {
      stubEndpoints();

      const switched = await service.switchTenantByExchange('tecob');

      expect(switched).toBe(true);
      expect(service.tokenTenantId()).toBe('tecob');
      expect(service.accessToken()).toBe(exchangedToken);
      expect(_navigateToSpy).not.toHaveBeenCalled();
      expect(_reloadPageSpy).not.toHaveBeenCalled();
    });

    it('requests the token exchange for the target tenant', async () => {
      stubEndpoints();

      await service.switchTenantByExchange('tecob');

      const [, init] = vi.mocked(fetchSpy).mock.calls[0] as [
        string,
        RequestInit
      ];
      const body = new URLSearchParams(init.body as string);
      expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
      expect(body.get('subject_token')).toBe(sourceToken);
      expect(body.get('acr_values')).toBe('tenant:tecob');
      expect(body.get('client_id')).toBe(mockOptions.clientId ?? null);
    });

    it('stores the exchanged session under the target tenant', async () => {
      stubEndpoints();

      await service.switchTenantByExchange('tecob');

      expect(localStorage.getItem('tecob__access_token')).toBe(exchangedToken);
      expect(localStorage.getItem('tecob__refresh_token')).toBe('refresh-token-1');
      // The exchange returns no id_token, so the userinfo profile takes its place.
      expect(JSON.parse(localStorage.getItem('tecob__id_token_claims_obj') ?? '{}'))
        .toEqual(expect.objectContaining({ name: userInfo.name }));
    });

    it('refuses a tenant the token does not allow, without calling the endpoint', async () => {
      stubEndpoints();

      const switched = await service.switchTenantByExchange('someone-elses-tenant');

      expect(switched).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('reports failure when the exchange is refused, leaving the session untouched', async () => {
      stubEndpoints(403);

      const switched = await service.switchTenantByExchange('tecob');

      expect(switched).toBe(false);
      expect(service.tokenTenantId()).toBe('bierok');
      expect(localStorage.getItem('tecob__access_token')).toBeNull();
    });

    it('reports failure when the profile cannot be loaded', async () => {
      stubEndpoints(200, 500);

      const switched = await service.switchTenantByExchange('tecob');

      expect(switched).toBe(false);
      expect(localStorage.getItem('tecob__access_token')).toBeNull();
    });
  });
});
