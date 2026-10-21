import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthorizeService } from './authorize.service';
import { TenantTopologyService } from './tenant-topology.service';
import { TenantTopologyResult, topologyDirectChildren, topologyLeaves, topologyTenantIds } from './tenant-topology';

const ISSUER = 'https://identity.example.com';
const ENDPOINT = `${ISSUER}/api/tenant-topology`;

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.SECRET-SIGNATURE`;
}

describe('TenantTopologyService', () => {
  let service: TenantTopologyService;
  let http: HttpTestingController;
  let issuer: WritableSignal<string | null>;
  let authenticated: WritableSignal<boolean>;
  let token: string | null;
  let interceptorCalls: number;

  const setToken = (tenant: string, allowed: string[], nonce = 'a') => {
    token = jwt({ tenant_id: tenant, allowed_tenants: allowed, nonce });
  };

  const topologyBody = (scope = 'R') => ({
    scope,
    scopeHasChildren: true,
    tenants: [
      { tenantId: 'leaf', depth: 1, hasChildren: false },
      { tenantId: 'group', depth: 1, hasChildren: true },
      { tenantId: 'deep', depth: 2, hasChildren: false, extra: 'ignored' }
    ]
  });

  /** Sends one load and answers its single request; returns the result. */
  const answer = async (
    scope: string,
    respond: (req: TestRequest) => void,
    options?: { refresh?: boolean }
  ): Promise<TenantTopologyResult> => {
    const promise = service.load(scope, options);
    respond(http.expectOne((r) => r.url === ENDPOINT));
    return promise;
  };

  beforeEach(() => {
    issuer = signal<string | null>(ISSUER);
    authenticated = signal(true);
    setToken('R', ['R', 'leaf', 'group', 'deep']);
    interceptorCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthorizeService,
          useValue: { issuer, isAuthenticated: authenticated, getAccessTokenSync: () => token }
        },
        provideHttpClient(
          withInterceptors([
            (req, next) => {
              interceptorCalls++;
              return next(req);
            }
          ])
        ),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(TenantTopologyService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  describe('known topology', () => {
    it('exposes exactly tenantId, depth and hasChildren and the helpers split leaves and direct children', async () => {
      const result = await answer('R', (r) => r.flush(topologyBody()));

      expect(result.topologyKnown).toBe(true);
      expect(result.scopeHasChildren).toBe(true);
      expect(result.tenants).toEqual([
        { tenantId: 'leaf', depth: 1, hasChildren: false },
        { tenantId: 'group', depth: 1, hasChildren: true },
        { tenantId: 'deep', depth: 2, hasChildren: false }
      ]);
      expect(Object.keys(result.tenants[2]).sort()).toEqual(['depth', 'hasChildren', 'tenantId']);
      expect(topologyLeaves(result).map((t) => t.tenantId)).toEqual(['leaf', 'deep']);
      expect(topologyDirectChildren(result).map((t) => t.tenantId)).toEqual(['leaf', 'group']);
      expect(topologyTenantIds(result)).toEqual(['leaf', 'group', 'deep']);
    });

    it('treats an empty list with scopeHasChildren=false (legacy) as known and distinct from unknown', async () => {
      const result = await answer('R', (r) => r.flush({ scope: 'R', scopeHasChildren: false, tenants: [] }));

      expect(result).toEqual({ topologyKnown: true, scope: 'R', scopeHasChildren: false, tenants: [] });
      expect(topologyLeaves(result)).toEqual([]);
    });

    it('helpers return empty arrays for an unknown result', async () => {
      const result = await answer('R', (r) => r.flush(null, { status: 404, statusText: 'x' }));

      expect(topologyLeaves(result)).toEqual([]);
      expect(topologyDirectChildren(result)).toEqual([]);
      expect(topologyTenantIds(result)).toEqual([]);
    });
  });

  describe('degraded results (one request, no fallback)', () => {
    const statusCases: [number, string][] = [
      [404, 'identity-too-old'],
      [503, 'hierarchy-unreadable'],
      [401, 'unauthorized'],
      [403, 'unauthorized'],
      [429, 'rate-limited'],
      [400, 'not-configured'],
      [502, 'network'],
      [500, 'network'],
      [418, 'invalid-response']
    ];

    for (const [status, reason] of statusCases) {
      it(`HTTP ${status} resolves with reason ${reason}`, async () => {
        const result = await answer('R', (r) => r.flush({ detail: 'secret body' }, { status, statusText: 'x' }));

        expect(result).toEqual({ topologyKnown: false, reason, tenants: [], scopeHasChildren: null });
        http.expectNone((r) => r.url !== ENDPOINT);
      });
    }

    it('a transport error resolves with reason network', async () => {
      const result = await answer('R', (r) => r.error(new ProgressEvent('error')));

      expect(result).toMatchObject({ topologyKnown: false, reason: 'network' });
    });

    it('a timeout resolves with reason network', async () => {
      vi.useFakeTimers();
      try {
        const promise = service.load('R');
        http.expectOne((r) => r.url === ENDPOINT);
        await vi.advanceTimersByTimeAsync(10_001);
        expect(await promise).toMatchObject({ topologyKnown: false, reason: 'network' });
      } finally {
        vi.useRealTimers();
      }
    });

    const badBodies: [string, object | string | null][] = [
      ['a string', 'nope'],
      ['null', null],
      ['no tenants array', { scope: 'R', scopeHasChildren: true }],
      ['scopeHasChildren not boolean', { scope: 'R', scopeHasChildren: 'yes', tenants: [] }],
      ['another scope', { scope: 'Other', scopeHasChildren: false, tenants: [] }],
      ['a node without tenantId', { scope: 'R', scopeHasChildren: true, tenants: [{ depth: 1, hasChildren: false }] }],
      ['a node with depth 0', { scope: 'R', scopeHasChildren: true, tenants: [{ tenantId: 'a', depth: 0, hasChildren: false }] }],
      ['a node with non-boolean hasChildren', { scope: 'R', scopeHasChildren: true, tenants: [{ tenantId: 'a', depth: 1, hasChildren: 1 }] }]
    ];

    for (const [name, body] of badBodies) {
      it(`a 200 with ${name} resolves with reason invalid-response`, async () => {
        const result = await answer('R', (r) => r.flush(body));

        expect(result).toMatchObject({ topologyKnown: false, reason: 'invalid-response' });
      });
    }

    it('no issuer resolves not-configured without a request', async () => {
      issuer.set(null);

      expect(await service.load('R')).toMatchObject({ topologyKnown: false, reason: 'not-configured' });
      http.expectNone(() => true);
    });

    it('a non-http issuer resolves not-configured without a request', async () => {
      issuer.set('javascript:alert(1)');

      expect(await service.load('R')).toMatchObject({ topologyKnown: false, reason: 'not-configured' });
      http.expectNone(() => true);
    });

    it('no access token resolves not-configured without a request', async () => {
      token = null;

      expect(await service.load('R')).toMatchObject({ topologyKnown: false, reason: 'not-configured' });
      http.expectNone(() => true);
    });

    it('never rejects, even when the auth service throws', async () => {
      vi.spyOn(console, 'debug').mockImplementation(() => undefined);
      token = null;
      issuer.set(undefined as unknown as string);

      await expect(service.load('R')).resolves.toMatchObject({ topologyKnown: false });
    });
  });

  describe('caching and concurrency', () => {
    it('two parallel calls send one request and share the result', async () => {
      const a = service.load('R');
      const b = service.load('R');
      http.expectOne((r) => r.url === ENDPOINT).flush(topologyBody());

      expect(await a).toBe(await b);
    });

    it('a second call after success sends no request; scope matching is case-insensitive', async () => {
      const first = await answer('Tenant1', (r) => r.flush(topologyBody('Tenant1')));
      const second = await service.load('tenant1');

      expect(second).toBe(first);
      http.expectNone(() => true);
    });

    it('a changed token tenant causes a new request', async () => {
      await answer('R', (r) => r.flush(topologyBody()));
      setToken('leaf', ['R', 'leaf', 'group', 'deep'], 'b');

      await answer('R', (r) => r.flush(topologyBody()));
    });

    it('a changed allowed_tenants claim causes a new request', async () => {
      await answer('R', (r) => r.flush(topologyBody()));
      setToken('R', ['R', 'leaf'], 'b');

      await answer('R', (r) => r.flush(topologyBody()));
    });

    it('a refreshed token with the same tenant and claim is served from the cache', async () => {
      await answer('R', (r) => r.flush(topologyBody()));
      setToken('R', ['deep', 'group', 'leaf', 'R'], 'new-nonce');

      await service.load('R');
      http.expectNone(() => true);
    });

    it('refresh: true bypasses the cache', async () => {
      await answer('R', (r) => r.flush(topologyBody()));

      await answer('R', (r) => r.flush({ scope: 'R', scopeHasChildren: false, tenants: [] }), { refresh: true });
      expect(await service.load('R')).toMatchObject({ scopeHasChildren: false });
    });

    it('sign-out clears the cache', async () => {
      await answer('R', (r) => r.flush(topologyBody()));

      authenticated.set(false);
      TestBed.tick();
      authenticated.set(true);
      TestBed.tick();

      await answer('R', (r) => r.flush(topologyBody()));
    });

    it('a response that arrives after sign-out is not cached', async () => {
      const pending = service.load('R');
      const request = http.expectOne((r) => r.url === ENDPOINT);
      authenticated.set(false);
      TestBed.tick();
      authenticated.set(true);
      TestBed.tick();
      request.flush(topologyBody());
      await pending;

      await answer('R', (r) => r.flush(topologyBody()));
    });

    for (const status of [503, 401, 429]) {
      it(`HTTP ${status} is not cached`, async () => {
        await answer('R', (r) => r.flush(null, { status, statusText: 'x' }));

        expect(await answer('R', (r) => r.flush(topologyBody()))).toMatchObject({ topologyKnown: true });
      });
    }

    it('a network error is not cached', async () => {
      await answer('R', (r) => r.error(new ProgressEvent('error')));

      expect(await answer('R', (r) => r.flush(topologyBody()))).toMatchObject({ topologyKnown: true });
    });

    it('identity-too-old is cached for the session', async () => {
      await answer('R', (r) => r.flush(null, { status: 404, statusText: 'Not Found' }));

      expect(await service.load('R')).toMatchObject({ topologyKnown: false, reason: 'identity-too-old' });
      http.expectNone(() => true);
    });
  });

  describe('no token leakage', () => {
    const rejected = ['', '   ', 'a/b', '../x', 'a?b=c', 'a#b', 'a b', 'R&scope=other', 'R\n', 'x'.repeat(65), 'ä'];

    for (const scope of rejected) {
      it(`rejects scope ${JSON.stringify(scope)} as not-configured without a request`, async () => {
        expect(await service.load(scope)).toMatchObject({ topologyKnown: false, reason: 'not-configured' });
        http.expectNone(() => true);
      });
    }

    it('rejects an injection string without a request', async () => {
      const result = await service.load('R/../../connect/token?x=1#');

      expect(result).toMatchObject({ topologyKnown: false, reason: 'not-configured' });
      http.expectNone(() => true);
    });

    it('sends a valid scope as the scope query parameter to the issuer endpoint', async () => {
      const promise = service.load('My_Tenant-1');
      const req = http.expectOne((r) => r.url === ENDPOINT);

      expect(req.request.method).toBe('GET');
      expect(req.request.urlWithParams).toBe(`${ENDPOINT}?scope=My_Tenant-1`);
      req.flush(topologyBody('My_Tenant-1'));
      await promise;
    });

    it('tolerates a trailing slash on the issuer', async () => {
      issuer.set(`${ISSUER}/`);

      const result = await answer('R', (r) => r.flush(topologyBody()));

      expect(result.topologyKnown).toBe(true);
    });

    it('attaches the current bearer to this request, once, without any interceptor', async () => {
      const promise = service.load('R');
      const req = http.expectOne((r) => r.url === ENDPOINT);

      expect(req.request.headers.getAll('Authorization')).toEqual([`Bearer ${token}`]);
      expect(interceptorCalls).toBe(0);
      req.flush(topologyBody());
      await promise;
    });

    it('does not let an interceptor of the host (identity host in wellKnownServiceUris) duplicate the header', async () => {
      // The host interceptor is registered above; the service must not run through it at all.
      const promise = service.load('R');
      const req = http.expectOne((r) => r.url === ENDPOINT);
      expect(req.request.headers.getAll('Authorization')).toHaveLength(1);
      req.flush(topologyBody());
      await promise;
      expect(interceptorCalls).toBe(0);
    });

    it('does not put the bearer on any other request of the app', () => {
      TestBed.inject(HttpClient).get('https://other.example.com/x').subscribe();
      const req = http.expectOne('https://other.example.com/x');

      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('logs no token, header or response body on any console method and returns no HttpErrorResponse', async () => {
      const spies = (['log', 'debug', 'info', 'warn', 'error'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => undefined)
      );

      const results = [
        await answer('R', (r) => r.flush({ detail: 'BODY-SECRET' }, { status: 503, statusText: 'x' })),
        await answer('R', (r) => r.flush({ detail: 'BODY-SECRET' }, { status: 401, statusText: 'x' })),
        await answer('R', (r) => r.error(new ProgressEvent('error'))),
        await answer('R', (r) => r.flush('BODY-SECRET')),
        await answer('R', (r) => r.flush(topologyBody()))
      ];

      const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      expect(logged).not.toContain(token as string);
      expect(logged).not.toContain('SECRET');
      expect(logged).not.toContain('Bearer');
      expect(logged).not.toContain(ENDPOINT);
      for (const result of results) {
        expect(JSON.stringify(result)).not.toContain('SECRET');
        expect(JSON.stringify(result)).not.toContain('Bearer');
        expect(JSON.stringify(result)).not.toContain(ISSUER);
        expect(JSON.stringify(result)).not.toContain('ProgressEvent');
        expect(result).not.toBeInstanceOf(HttpErrorResponse);
      }
    });
  });
});
