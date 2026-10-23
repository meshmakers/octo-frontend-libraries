import type { Mock, MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { OAuthService, OAuthEvent } from 'angular-oauth2-oidc';
import { AuthorizeService, AuthorizeOptions, IUser } from './authorize.service';
import { SESSION_IDENTITY_SINK, SessionIdentitySink } from './session-identity';

/** AB#7327: AuthorizeService drives an optional session identity sink (set / clear). */

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const tokenFor = (tenant: string): string =>
  createMockJwt({ tenant_id: tenant, allowed_tenants: ['t1', 't2'] });

const mockUser: IUser = {
  family_name: 'Mustermann',
  given_name: 'Max',
  name: 'Max Mustermann',
  role: null,
  sub: 'user-123',
  idp: 'local',
  email: 'max@example.com'
};

const options: AuthorizeOptions = {
  issuer: 'https://auth.example.com',
  redirectUri: 'https://app.example.com/callback',
  postLogoutRedirectUri: 'https://app.example.com',
  clientId: 'test-client',
  scope: 'openid profile email',
  showDebugInformation: false,
  sessionChecksEnabled: true
};

describe('AuthorizeService session identity sink (AB#7327)', () => {
  let oauthEvents$: Subject<OAuthEvent>;
  let oauthServiceMock: MockedObject<OAuthService>;
  let service: AuthorizeService;
  let sink: { set: Mock; clear: Mock };

  function setUp(sinkProvider?: SessionIdentitySink): void {
    oauthEvents$ = new Subject<OAuthEvent>();
    oauthServiceMock = {
      configure: vi.fn(),
      setStorage: vi.fn(),
      loadDiscoveryDocumentAndTryLogin: vi.fn().mockResolvedValue(true),
      setupAutomaticSilentRefresh: vi.fn(),
      stopAutomaticRefresh: vi.fn(),
      hasValidIdToken: vi.fn().mockReturnValue(false),
      refreshToken: vi.fn().mockResolvedValue({}),
      getIdentityClaims: vi.fn().mockReturnValue(mockUser),
      getAccessToken: vi.fn().mockReturnValue(tokenFor('t1')),
      getIdToken: vi.fn(),
      initImplicitFlow: vi.fn(),
      logOut: vi.fn(),
      events: oauthEvents$.asObservable(),
      discoveryDocumentLoaded$: new Subject<unknown>().asObservable(),
      tokenEndpoint: 'https://auth.example.com/connect/token',
      userinfoEndpoint: 'https://auth.example.com/connect/userinfo'
    } as unknown as MockedObject<OAuthService>;

    TestBed.configureTestingModule({
      providers: [
        AuthorizeService,
        { provide: OAuthService, useValue: oauthServiceMock },
        ...(sinkProvider ? [{ provide: SESSION_IDENTITY_SINK, useValue: sinkProvider }] : [])
      ]
    });
    service = TestBed.inject(AuthorizeService);
    vi.spyOn(service as unknown as { reloadPage: () => void }, 'reloadPage').mockReturnValue(undefined);
    vi.spyOn(service as unknown as { navigateTo: (u: string) => void }, 'navigateTo').mockReturnValue(undefined);
  }

  async function signIn(): Promise<void> {
    await service.initialize(options);
    oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.tick();
  }

  beforeEach(() => {
    sink = { set: vi.fn(), clear: vi.fn() };
  });

  describe('with a sink', () => {
    beforeEach(() => setUp(sink));

    it('does nothing while anonymous', async () => {
      await service.initialize(options);
      TestBed.tick();

      expect(sink.set).not.toHaveBeenCalled();
      expect(sink.clear).not.toHaveBeenCalled();
    });

    it('sets exactly one identity on login, tenant taken from the access token', async () => {
      await signIn();

      expect(sink.set).toHaveBeenCalledTimes(1);
      expect(sink.set).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'Max Mustermann',
        email: 'max@example.com',
        tenantId: 't1'
      });
      expect(sink.clear).not.toHaveBeenCalled();
    });

    it('does not repeat set when a token refresh yields the same identity', async () => {
      await signIn();

      oauthServiceMock.getIdentityClaims.mockReturnValue({ ...mockUser });
      oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
      await new Promise(resolve => setTimeout(resolve, 0));
      TestBed.tick();

      expect(sink.set).toHaveBeenCalledTimes(1);
    });

    it('passes null for a missing e-mail', async () => {
      oauthServiceMock.getIdentityClaims.mockReturnValue({ ...mockUser, email: null });

      await signIn();

      expect(sink.set).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
    });

    describe('tenant switch by token exchange', () => {
      const exchanged = tokenFor('t2');
      const userInfo = { sub: 'user-123', name: 'Max Mustermann', email: 'max@example.com' };

      function stubEndpoints(tokenStatus = 200): void {
        vi.spyOn(window, 'fetch').mockImplementation((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.includes('userinfo')) {
            return Promise.resolve(new Response(JSON.stringify(userInfo), { status: 200 }));
          }
          return Promise.resolve(new Response(JSON.stringify({
            access_token: exchanged, refresh_token: 'r', expires_in: 3600, scope: 'openid'
          }), { status: tokenStatus }));
        });
      }

      afterEach(() => {
        for (const key of ['t2__access_token', 't2__refresh_token', 't2__expires_at',
          't2__access_token_stored_at', 't2__granted_scopes', 't2__id_token_claims_obj']) {
          localStorage.removeItem(key);
        }
      });

      it('sets the same user with the new tenant', async () => {
        await signIn();
        stubEndpoints();
        sink.set.mockClear();

        expect(await service.switchTenantByExchange('t2')).toBe(true);
        TestBed.tick();

        expect(sink.set).toHaveBeenCalledTimes(1);
        expect(sink.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-123', tenantId: 't2' }));
        expect(sink.clear).not.toHaveBeenCalled();
      });

      it('reports nothing when the exchange fails (no wrong tenant)', async () => {
        await signIn();
        stubEndpoints(400);
        sink.set.mockClear();

        expect(await service.switchTenantByExchange('t2')).toBe(false);
        TestBed.tick();

        expect(sink.set).not.toHaveBeenCalled();
        expect(sink.clear).not.toHaveBeenCalled();
      });
    });

    describe('tenant switch by redirect fallback', () => {
      afterEach(() => {
        sessionStorage.removeItem('octo_tenant_reauth');
        sessionStorage.removeItem('octo_tenant_switch_attempted');
      });

      it('clears before the redirect and sets the new tenant after the reload', async () => {
        await signIn();
        sink.set.mockClear();

        service.switchTenant('t2', 'https://localhost:4200/t2');
        TestBed.tick();
        expect(sink.clear).toHaveBeenCalledTimes(1);

        // page reloads into t2: the new service instance loads the user from the t2 session
        oauthServiceMock.getAccessToken.mockReturnValue(tokenFor('t2'));
        oauthEvents$.next({ type: 'token_received' } as OAuthEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
        TestBed.tick();

        expect(sink.set).toHaveBeenCalledTimes(1);
        expect(sink.set).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't2' }));
      });
    });

    describe('session end', () => {
      it.each(['logout', 'session_terminated', 'token_refresh_error'])('clears on the %s event', async (type) => {
        await signIn();

        oauthEvents$.next({ type } as OAuthEvent);
        TestBed.tick();

        expect(sink.clear).toHaveBeenCalledTimes(1);
      });

      it('clears when another tab removes the access token (storage event)', async () => {
        await signIn();

        window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: null }));
        TestBed.tick();

        expect(sink.clear).toHaveBeenCalledTimes(1);
      });

      it.skipIf(typeof BroadcastChannel === 'undefined')('clears on a cross-tab logout broadcast', async () => {
        await signIn();

        const other = new BroadcastChannel('octo-auth-logout');
        other.postMessage({ type: 'logout' });
        await new Promise(resolve => setTimeout(resolve, 50));
        other.close();
        TestBed.tick();

        expect(sink.clear).toHaveBeenCalledTimes(1);
      });

      it('clears once only, not again when a later event finds nobody signed in', async () => {
        await signIn();

        oauthEvents$.next({ type: 'logout' } as OAuthEvent);
        TestBed.tick();
        oauthEvents$.next({ type: 'logout' } as OAuthEvent);
        TestBed.tick();

        expect(sink.clear).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('with a throwing sink', () => {
    let warnSpy: Mock;

    beforeEach(() => {
      const failing: SessionIdentitySink = {
        set: vi.fn(() => { throw new Error('boom for max@example.com'); }),
        clear: vi.fn(() => { throw new Error('boom for Max Mustermann'); })
      };
      setUp(failing);
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined) as unknown as Mock;
    });

    it('still completes login and logs one warning without name or e-mail', async () => {
      await signIn();

      expect(service.isAuthenticated()).toBe(true);
      expect(service.tokenTenantId()).toBe('t1');
      const sinkWarnings = warnSpy.mock.calls.filter(c => String(c[0]).includes('session identity sink'));
      expect(sinkWarnings).toHaveLength(1);
      const text = JSON.stringify(sinkWarnings[0]);
      expect(text).not.toContain('Max');
      expect(text).not.toContain('max@example.com');
    });

    it('still completes logout and logs one warning for clear', async () => {
      await signIn();
      warnSpy.mockClear();

      oauthEvents$.next({ type: 'logout' } as OAuthEvent);
      TestBed.tick();

      expect(service.isAuthenticated()).toBe(false);
      const sinkWarnings = warnSpy.mock.calls.filter(c => String(c[0]).includes('session identity sink'));
      expect(sinkWarnings).toHaveLength(1);
      expect(JSON.stringify(sinkWarnings[0])).not.toContain('Max');
    });
  });

  describe('without a sink', () => {
    it('behaves as before: login and logout work, no warning', async () => {
      setUp();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await signIn();
      expect(service.user()?.sub).toBe('user-123');
      oauthEvents$.next({ type: 'logout' } as OAuthEvent);
      TestBed.tick();

      expect(service.isAuthenticated()).toBe(false);
      expect(warnSpy.mock.calls.filter(c => String(c[0]).includes('session identity'))).toHaveLength(0);
    });
  });
});
