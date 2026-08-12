import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpParams,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { authorizeInterceptor } from './authorize.interceptor';
import { AuthorizeService } from './authorize.service';

// =============================================================================
// FUNCTIONAL INTERCEPTOR TESTS
// =============================================================================

describe('authorizeInterceptor (functional)', () => {
  let authServiceMock: jasmine.SpyObj<AuthorizeService>;
  let nextFn: jasmine.Spy<HttpHandlerFn>;

  beforeEach(() => {
    authServiceMock = jasmine.createSpyObj('AuthorizeService', ['getAccessTokenSync', 'getServiceUris']);
    authServiceMock.getAccessTokenSync.and.returnValue(null);
    authServiceMock.getServiceUris.and.returnValue(null);

    nextFn = jasmine.createSpy('nextFn').and.callFake((req: HttpRequest<unknown>) => {
      return of(new HttpResponse({ status: 200, body: {}, url: req.url }));
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthorizeService, useValue: authServiceMock }
      ]
    });
  });

  describe('without token', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue(null);
    });

    it('should not add Authorization header to same-origin request', (done) => {
      const req = new HttpRequest('GET', '/api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });

    it('should not add Authorization header to external request', (done) => {
      const req = new HttpRequest('GET', 'https://external.com/api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });
  });

  describe('with token', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue('test-access-token');
    });

    describe('same-origin requests', () => {
      it('should add Authorization header to relative URL', (done) => {
        const req = new HttpRequest('GET', '/api/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to absolute same-origin URL', (done) => {
        const req = new HttpRequest('GET', `${window.location.origin}/api/data`);

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to protocol-relative same-origin URL', (done) => {
        const req = new HttpRequest('GET', `//${window.location.host}/api/data`);

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to nested relative URL', (done) => {
        const req = new HttpRequest('GET', '/api/v1/users/123');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });
    });

    describe('external requests', () => {
      it('should not add Authorization header to external URL', (done) => {
        const req = new HttpRequest('GET', 'https://external-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should not add Authorization header to protocol-relative external URL', (done) => {
        const req = new HttpRequest('GET', '//external-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });
    });

    describe('known service URIs', () => {
      beforeEach(() => {
        authServiceMock.getServiceUris.and.returnValue([
          'https://api.example.com',
          'https://graphql.example.com/v1'
        ]);
      });

      it('should add Authorization header to known service URI', (done) => {
        const req = new HttpRequest('GET', 'https://api.example.com/users');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should add Authorization header to another known service URI', (done) => {
        const req = new HttpRequest('GET', 'https://graphql.example.com/v1/query');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should not add Authorization header to unknown external URL', (done) => {
        const req = new HttpRequest('GET', 'https://unknown-api.com/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should ignore a blank entry instead of matching every URL', (done) => {
        authServiceMock.getServiceUris.and.returnValue(['https://api.example.com', '']);
        const req = new HttpRequest('GET', 'https://telemetry.third-party.com/ingest');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should ignore a bare slash, which is what the platform returns for an unconfigured service', (done) => {
        authServiceMock.getServiceUris.and.returnValue(['https://api.example.com', '/']);
        const req = new HttpRequest('GET', '//telemetry.third-party.com/ingest');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should not match a host that merely starts with a configured URI', (done) => {
        // Plain prefix matching hands the operator's bearer to any origin whose name
        // begins with a configured one, which an attacker can register at will.
        const req = new HttpRequest('GET', 'https://api.example.com.attacker.test/steal');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should match a configured URI that already ends in a slash', (done) => {
        authServiceMock.getServiceUris.and.returnValue(['https://api.example.com/']);
        const req = new HttpRequest('GET', 'https://api.example.com/users');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should match the configured URI itself, with nothing after it', (done) => {
        const req = new HttpRequest('GET', 'https://api.example.com');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });

      it('should still match the configured hosts when a blank entry is present', (done) => {
        authServiceMock.getServiceUris.and.returnValue(['', 'https://api.example.com']);
        const req = new HttpRequest('POST', 'https://api.example.com/meshtest/sendMessage', {});

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(req, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });
    });

    describe('request immutability', () => {
      it('should not modify the original request', (done) => {
        const originalReq = new HttpRequest('GET', '/api/data');
        const originalHeaders = originalReq.headers;

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(originalReq, nextFn).subscribe(() => {
            expect(originalReq.headers).toBe(originalHeaders);
            expect(originalReq.headers.has('Authorization')).toBeFalse();
            done();
          });
        });
      });

      it('should create a cloned request with Authorization header', (done) => {
        const originalReq = new HttpRequest('GET', '/api/data');

        TestBed.runInInjectionContext(() => {
          authorizeInterceptor(originalReq, nextFn).subscribe(() => {
            const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
            expect(handledReq).not.toBe(originalReq);
            expect(handledReq.headers.get('Authorization')).toBe('Bearer test-access-token');
            done();
          });
        });
      });
    });
  });

  describe('acr_values injection for token endpoint', () => {
    beforeEach(() => {
      authServiceMock = jasmine.createSpyObj('AuthorizeService',
        ['getAccessTokenSync', 'getServiceUris', 'getStorageTenantId']);
      authServiceMock.getAccessTokenSync.and.returnValue('test-token');
      authServiceMock.getServiceUris.and.returnValue(null);

      TestBed.overrideProvider(AuthorizeService, { useValue: authServiceMock });
    });

    it('should inject acr_values into /connect/token POST for refresh_token grant', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const body = new HttpParams().set('grant_type', 'refresh_token').set('refresh_token', 'abc123');
      const req = new HttpRequest('POST', 'https://auth.example.com/connect/token', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          expect(handledReq.body).toBeInstanceOf(HttpParams);
          expect((handledReq.body as HttpParams).get('acr_values')).toBe('tenant:meshtest');
          done();
        });
      });
    });

    it('should NOT inject acr_values into /connect/token POST for authorization_code grant', (done) => {
      // Authorization-code exchanges already carry the tenant via the code itself.
      // Injecting a stale storage tenant here caused an infinite reload loop:
      // the code-exchange succeeded (server ignored acr_values), but the immediate
      // refresh used the storage tenant which no longer matched the freshly issued
      // token's tenant -> 400 invalid_grant -> token_refresh_error -> reload -> loop.
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const body = new HttpParams()
        .set('grant_type', 'authorization_code')
        .set('code', 'abc123')
        .set('client_id', 'my-client');
      const req = new HttpRequest('POST', 'https://auth.example.com/connect/token', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          expect((handledReq.body as HttpParams).has('acr_values')).toBeFalse();
          done();
        });
      });
    });

    it('should not inject acr_values when no tenantId in storage', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue(null);

      const body = new HttpParams().set('grant_type', 'refresh_token');
      const req = new HttpRequest('POST', 'https://auth.example.com/connect/token', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          expect((handledReq.body as HttpParams).has('acr_values')).toBeFalse();
          done();
        });
      });
    });

    it('should not inject acr_values for non-token endpoint POST', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const body = new HttpParams().set('data', 'value');
      const req = new HttpRequest('POST', '/api/data', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          expect((handledReq.body as HttpParams).has('acr_values')).toBeFalse();
          done();
        });
      });
    });

    it('should not inject acr_values for GET request to token endpoint', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const req = new HttpRequest('GET', 'https://auth.example.com/connect/token');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          // GET requests don't have body manipulation
          expect(handledReq.url).toContain('/connect/token');
          done();
        });
      });
    });

    it('should inject acr_values into a token endpoint URL carrying a query string', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const body = new HttpParams().set('grant_type', 'refresh_token').set('refresh_token', 'abc123');
      const req = new HttpRequest('POST', 'https://auth.example.com/connect/token?x=1', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          expect((handledReq.body as HttpParams).get('acr_values')).toBe('tenant:meshtest');
          done();
        });
      });
    });

    it('should preserve existing form body params when injecting acr_values for refresh_token', (done) => {
      authServiceMock.getStorageTenantId.and.returnValue('meshtest');

      const body = new HttpParams()
        .set('grant_type', 'refresh_token')
        .set('refresh_token', 'abc123')
        .set('client_id', 'my-client');
      const req = new HttpRequest('POST', 'https://auth.example.com/connect/token', body);

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<HttpParams>;
          const params = handledReq.body as HttpParams;
          expect(params.get('grant_type')).toBe('refresh_token');
          expect(params.get('refresh_token')).toBe('abc123');
          expect(params.get('client_id')).toBe('my-client');
          expect(params.get('acr_values')).toBe('tenant:meshtest');
          done();
        });
      });
    });
  });

  describe('URL pattern matching edge cases', () => {
    beforeEach(() => {
      authServiceMock.getAccessTokenSync.and.returnValue('test-token');
    });

    it('should not match root-relative URL without leading slash', (done) => {
      const req = new HttpRequest('GET', 'api/data');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.has('Authorization')).toBeFalse();
          done();
        });
      });
    });

    it('should match URL with query parameters', (done) => {
      const req = new HttpRequest('GET', '/api/data?param=value');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.get('Authorization')).toBe('Bearer test-token');
          done();
        });
      });
    });

    it('should match URL with hash fragment', (done) => {
      const req = new HttpRequest('GET', '/api/data#section');

      TestBed.runInInjectionContext(() => {
        authorizeInterceptor(req, nextFn).subscribe(() => {
          const handledReq = nextFn.calls.mostRecent().args[0] as HttpRequest<unknown>;
          expect(handledReq.headers.get('Authorization')).toBe('Bearer test-token');
          done();
        });
      });
    });
  });
});

// =============================================================================
// 401 REFRESH-AND-RETRY TESTS
// =============================================================================

describe('authorizeInterceptor (401 refresh and retry)', () => {
  const OLD_TOKEN = 'old-access-token';
  const NEW_TOKEN = 'new-access-token';

  let authServiceMock: jasmine.SpyObj<AuthorizeService>;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function refreshYieldsNewToken(): void {
    authServiceMock.refreshAccessToken.and.callFake(async () => {
      authServiceMock.getAccessTokenSync.and.returnValue(NEW_TOKEN);
    });
  }

  function unauthorized(request: TestRequest): void {
    request.flush({ error: 'invalid_token' }, { status: 401, statusText: 'Unauthorized' });
  }

  beforeEach(() => {
    authServiceMock = jasmine.createSpyObj('AuthorizeService',
      ['getAccessTokenSync', 'getServiceUris', 'getStorageTenantId', 'refreshAccessToken']);
    authServiceMock.getAccessTokenSync.and.returnValue(OLD_TOKEN);
    authServiceMock.getServiceUris.and.returnValue(['https://auth.example.com']);
    authServiceMock.getStorageTenantId.and.returnValue('meshtest');
    authServiceMock.refreshAccessToken.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthorizeService, useValue: authServiceMock },
        provideHttpClient(withInterceptors([authorizeInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should refresh once and retry the request carrying the NEW bearer', fakeAsync(() => {
    refreshYieldsNewToken();

    http.get('/api/data').subscribe();

    const first = httpMock.expectOne('/api/data');
    expect(first.request.headers.get('Authorization')).toBe(`Bearer ${OLD_TOKEN}`);
    unauthorized(first);
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);

    const retry = httpMock.expectOne('/api/data');
    expect(retry.request.headers.get('Authorization')).toBe(`Bearer ${NEW_TOKEN}`);
    retry.flush({ ok: true });
    tick();
  }));

  it('should deliver the retried response to the caller', fakeAsync(() => {
    refreshYieldsNewToken();

    const responses: unknown[] = [];
    const errors: unknown[] = [];
    http.get('/api/data').subscribe({ next: (value) => responses.push(value), error: (err) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    httpMock.expectOne('/api/data').flush({ ok: true });
    tick();

    expect(responses).toEqual([{ ok: true }]);
    expect(errors).toEqual([]);
  }));

  // The hosts classify purely on status, so a 403 answering the RETRIED request must not be
  // reported as the 401 that started the recovery: "sign in again" is the wrong instruction
  // for a missing role, and signing in again cannot fix it.
  it('should deliver a 403 from the retried request as 403, not as the original 401', fakeAsync(() => {
    refreshYieldsNewToken();

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    // The refreshed token is valid; the operator simply lacks the required role.
    httpMock.expectOne('/api/data').flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    tick();

    expect(errors.length).toBe(1);
    expect(errors[0].status).toBe(403);
  }));

  // AB#4782: the server names why it refused, and only an expired token is worth a refresh.
  // Every other reason describes something the next token shares, so refreshing would spend one
  // grant per operator action, forever, without ever changing the answer.
  it('should NOT refresh when the challenge names a reason a refresh cannot repair', fakeAsync(() => {
    refreshYieldsNewToken();

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    httpMock.expectOne('/api/data').flush({ error: 'invalid_token' }, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'WWW-Authenticate': 'Bearer error="invalid_token", ' +
          'error_description="The access token was issued by another authority", error_code="issuer_invalid"'
      }
    });
    tick();

    expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(errors[0].status).toBe(401);
  }));

  it('should refresh when the challenge names an expired token', fakeAsync(() => {
    refreshYieldsNewToken();

    http.get('/api/data').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/data').flush({ error: 'invalid_token' }, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'WWW-Authenticate': 'Bearer error="invalid_token", ' +
          'error_description="The access token has expired", error_code="token_expired"'
      }
    });
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    httpMock.expectOne('/api/data').flush({ ok: true });
    tick();
  }));

  // Services that predate the challenge must keep the recovery this interceptor exists for.
  it('should refresh a 401 that names no reason at all', fakeAsync(() => {
    refreshYieldsNewToken();

    http.get('/api/data').subscribe({ error: () => undefined });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    httpMock.expectOne('/api/data').flush({ ok: true });
    tick();
  }));

  it('should NOT refresh a 401 on a request that carried no token', fakeAsync(() => {
    authServiceMock.getAccessTokenSync.and.returnValue(null);

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    const first = httpMock.expectOne('/api/data');
    expect(first.request.headers.has('Authorization')).toBeFalse();
    unauthorized(first);
    tick();

    expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(errors[0].status).toBe(401);
  }));

  it('should NOT refresh a 401 on an external request the token was withheld from', fakeAsync(() => {
    const errors: HttpErrorResponse[] = [];
    http.get('https://unknown-api.com/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    const first = httpMock.expectOne('https://unknown-api.com/data');
    expect(first.request.headers.has('Authorization')).toBeFalse();
    unauthorized(first);
    tick();

    expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(errors[0].status).toBe(401);
  }));

  it('should NOT refresh a 401 from the token endpoint itself', fakeAsync(() => {
    refreshYieldsNewToken();

    const body = new HttpParams().set('grant_type', 'refresh_token').set('refresh_token', 'abc123');
    const errors: HttpErrorResponse[] = [];
    http.post('https://auth.example.com/connect/token', body).subscribe({
      error: (err: HttpErrorResponse) => errors.push(err)
    });

    const tokenRequest = httpMock.expectOne('https://auth.example.com/connect/token');
    expect(tokenRequest.request.headers.get('Authorization')).toBe(`Bearer ${OLD_TOKEN}`);
    unauthorized(tokenRequest);
    tick();

    expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(errors[0].status).toBe(401);
  }));

  // A guard keyed on the raw URL misses every suffixed form of the same endpoint. The miss
  // is silent rather than noisy: the refresh posts to that very endpoint through this very
  // chain, so the single-flight promise ends up waiting on itself. It never settles, its
  // `finally` never runs, and because it is module state, every later 401 anywhere in the
  // page then awaits a promise that can no longer resolve.
  [
    { label: 'a query string', url: 'https://auth.example.com/connect/token?x=1' },
    { label: 'a trailing slash', url: 'https://auth.example.com/connect/token/' },
    { label: 'a hash fragment', url: 'https://auth.example.com/connect/token#fragment' }
  ].forEach(({ label, url }) => {
    it(`should NOT refresh a 401 from the token endpoint carrying ${label}`, fakeAsync(() => {
      refreshYieldsNewToken();

      const body = new HttpParams().set('grant_type', 'refresh_token').set('refresh_token', 'abc123');
      const errors: HttpErrorResponse[] = [];
      http.post(url, body).subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

      unauthorized(httpMock.expectOne(url));
      tick();

      expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
      expect(errors[0].status).toBe(401);
    }));
  });

  it('should still refresh a 401 from a path that merely starts like the token endpoint', fakeAsync(() => {
    refreshYieldsNewToken();

    http.get('https://auth.example.com/connect/tokens/list').subscribe();

    unauthorized(httpMock.expectOne('https://auth.example.com/connect/tokens/list'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    httpMock.expectOne('https://auth.example.com/connect/tokens/list').flush({ ok: true });
    tick();
  }));

  [
    { label: '403 Forbidden', status: 403, statusText: 'Forbidden' },
    { label: '500 Internal Server Error', status: 500, statusText: 'Internal Server Error' }
  ].forEach(({ label, status, statusText }) => {
    it(`should NOT refresh on ${label}`, fakeAsync(() => {
      refreshYieldsNewToken();

      const errors: HttpErrorResponse[] = [];
      http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

      httpMock.expectOne('/api/data').flush({ error: 'nope' }, { status, statusText });
      tick();

      expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
      expect(errors[0].status).toBe(status);
    }));
  });

  it('should NOT refresh on a network error (status 0)', fakeAsync(() => {
    refreshYieldsNewToken();

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    httpMock.expectOne('/api/data').error(new ProgressEvent('error'));
    tick();

    expect(authServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(errors[0].status).toBe(0);
  }));

  it('should trigger exactly ONE refresh for two concurrent 401s', fakeAsync(() => {
    refreshYieldsNewToken();

    http.get('/api/first').subscribe();
    http.get('/api/second').subscribe();

    unauthorized(httpMock.expectOne('/api/first'));
    unauthorized(httpMock.expectOne('/api/second'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);

    const retryFirst = httpMock.expectOne('/api/first');
    const retrySecond = httpMock.expectOne('/api/second');
    expect(retryFirst.request.headers.get('Authorization')).toBe(`Bearer ${NEW_TOKEN}`);
    expect(retrySecond.request.headers.get('Authorization')).toBe(`Bearer ${NEW_TOKEN}`);
    retryFirst.flush({ ok: true });
    retrySecond.flush({ ok: true });
    tick();
  }));

  it('should NOT refresh again for a 401 that lands after an earlier refresh finished', fakeAsync(() => {
    // Single-flight only covers the window while the refresh runs. A slower request that
    // went out with the same stale token reports its 401 afterwards; its failure is already
    // explained by the token that has just been replaced, so refreshing again buys nothing
    // and spends an extra grant at the Identity Server.
    refreshYieldsNewToken();

    http.get('/api/fast').subscribe();
    http.get('/api/slow').subscribe();

    const fast = httpMock.expectOne('/api/fast');
    const slow = httpMock.expectOne('/api/slow');
    expect(fast.request.headers.get('Authorization')).toBe(`Bearer ${OLD_TOKEN}`);
    expect(slow.request.headers.get('Authorization')).toBe(`Bearer ${OLD_TOKEN}`);

    unauthorized(fast);
    tick();
    httpMock.expectOne('/api/fast').flush({ ok: true });
    tick();

    unauthorized(slow);
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);

    const slowRetry = httpMock.expectOne('/api/slow');
    expect(slowRetry.request.headers.get('Authorization')).toBe(`Bearer ${NEW_TOKEN}`);
    slowRetry.flush({ ok: true });
    tick();
  }));

  it('should clear the single-flight state when the refresh rejects', fakeAsync(() => {
    // The `finally` is load-bearing: a refresh that never clears the module-level promise
    // would leave every later 401 in the page awaiting a promise nobody will settle.
    authServiceMock.refreshAccessToken.and.rejectWith(new Error('refresh failed'));

    http.get('/api/first').subscribe({ error: () => undefined });
    unauthorized(httpMock.expectOne('/api/first'));
    tick();

    http.get('/api/second').subscribe({ error: () => undefined });
    unauthorized(httpMock.expectOne('/api/second'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(2);
  }));

  it('should surface the ORIGINAL 401 when the refresh itself fails', fakeAsync(() => {
    authServiceMock.refreshAccessToken.and.rejectWith(new Error('refresh failed'));

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(errors[0]).toBeInstanceOf(HttpErrorResponse);
    expect(errors[0].status).toBe(401);
  }));

  it('should not retry when the token is unchanged after the refresh', fakeAsync(() => {
    authServiceMock.refreshAccessToken.and.resolveTo();

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(errors[0].status).toBe(401);
    httpMock.expectNone('/api/data');
  }));

  it('should not retry when no token is available after the refresh', fakeAsync(() => {
    authServiceMock.refreshAccessToken.and.callFake(async () => {
      authServiceMock.getAccessTokenSync.and.returnValue(null);
    });

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    expect(errors[0].status).toBe(401);
    httpMock.expectNone('/api/data');
  }));

  it('should retry at most once when the retried request also returns 401', fakeAsync(() => {
    refreshYieldsNewToken();

    const errors: HttpErrorResponse[] = [];
    http.get('/api/data').subscribe({ error: (err: HttpErrorResponse) => errors.push(err) });

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    unauthorized(httpMock.expectOne('/api/data'));
    tick();

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(errors[0].status).toBe(401);
    httpMock.expectNone('/api/data');
  }));
});
