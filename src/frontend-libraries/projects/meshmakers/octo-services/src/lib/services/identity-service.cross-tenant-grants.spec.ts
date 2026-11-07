import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES, MmHttpErrorInterceptor } from '@meshmakers/shared-services';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { CrossTenantGrantError, toCrossTenantGrantError } from '../shared/crossTenantGrantError';
import { ExternalTenantUserMappingDto } from '../shared/externalTenantUserMappingDto';

/**
 * AB#8427: tenant-scoped cross-tenant grant client (`{issuer}{T}/v1/externalTenantUserMappings`), contract
 * `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md` §2, §5, §9.
 */
describe('IdentityService cross-tenant grants in the current tenant (AB#8427)', () => {
  let service: IdentityService;
  let httpMock: HttpTestingController;

  const issuer = 'https://identity.example.com/';
  const tenantPrefix = `${issuer}customer-a/v1/externalTenantUserMappings`;
  const identifier = 'alice@source.example';

  const config = { issuer } as AddInConfiguration;

  const mapping: ExternalTenantUserMappingDto = {
    id: 'map-1',
    sourceTenantId: 'meshmakers',
    sourceUserId: 'u-1',
    sourceUserName: 'alice',
    roleIds: [],
    groupNames: ['Viewers']
  };

  async function tick(): Promise<void> {
    await Promise.resolve();
  }

  function problem(status: number, body: object | string | null, statusText = 'Error') {
    return { body, opts: { status, statusText } };
  }

  /** Starts the call, answers the one expected request with an error and returns the settled rejection. */
  async function failWith<T>(
    call: () => Promise<T>, url: string, answer: ReturnType<typeof problem>): Promise<unknown> {
    const promise = call();
    const settled = promise.then(() => undefined, (e: unknown) => e);
    await tick();
    httpMock.expectOne(url).flush(answer.body, answer.opts);
    return settled;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        IdentityService,
        { provide: CONFIGURATION_SERVICE, useValue: { config, loadConfigAsync: vi.fn() } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('customer-a') }
      ]
    });
    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('lookupSourceUser', () => {
    const request = { sourceTenantId: 'meshmakers', identifier };
    const lookupUrl = `${tenantPrefix}/sourceUserLookup`;

    it('POSTs the request to the current tenant and returns the user', async () => {
      const promise = service.lookupSourceUser(request);
      await tick();

      const req = httpMock.expectOne(lookupUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ sourceTenantId: 'meshmakers', identifier });
      expect(req.request.urlWithParams).not.toContain('alice');
      req.flush({ sourceTenantId: 'meshmakers', userId: 'u-1', userName: 'alice', displayName: 'Alice A.' });

      expect(await promise).toEqual({ sourceTenantId: 'meshmakers', userId: 'u-1', userName: 'alice', displayName: 'Alice A.' });
    });

    it('sends only the two contract fields', async () => {
      const promise = service.lookupSourceUser({ ...request, extra: 'x' } as typeof request);
      await tick();
      const req = httpMock.expectOne(lookupUrl);
      expect(Object.keys(req.request.body).sort()).toEqual(['identifier', 'sourceTenantId']);
      req.flush({ sourceTenantId: 'meshmakers', userId: 'u-1', userName: 'alice' });
      await promise;
    });

    it('returns null for 404 SourceUserNotFound', async () => {
      const promise = service.lookupSourceUser(request);
      await tick();
      httpMock.expectOne(lookupUrl).flush(
        { status: 404, title: 'Source user not found', code: 'SourceUserNotFound' },
        { status: 404, statusText: 'Not Found' });

      expect(await promise).toBeNull();
    });

    it('returns null for SourceUserNotFound sent as unparsed problem text', async () => {
      const promise = service.lookupSourceUser(request);
      await tick();
      httpMock.expectOne(lookupUrl).flush(
        JSON.stringify({ status: 404, code: 'SourceUserNotFound' }), { status: 404, statusText: 'Not Found' });

      expect(await promise).toBeNull();
    });

    it('throws NotAvailable (never null) for a 404 without code', async () => {
      const error = await failWith(() => service.lookupSourceUser(request), lookupUrl, problem(404, null, 'Not Found'));

      expect(error).toBeInstanceOf(CrossTenantGrantError);
      expect((error as CrossTenantGrantError).kind).toBe('NotAvailable');
      expect((error as CrossTenantGrantError).status).toBe(404);
    });

    it('throws SourceUserLookupRateLimited with retryAfterSeconds from the body', async () => {
      const error = await failWith(() => service.lookupSourceUser(request), lookupUrl, problem(429, {
        status: 429, title: 'Too many lookups', code: 'SourceUserLookupRateLimited', retryAfterSeconds: 240
      }, 'Too Many Requests'));

      expect(error).toBeInstanceOf(CrossTenantGrantError);
      const typed = error as CrossTenantGrantError;
      expect(typed.kind).toBe('SourceUserLookupRateLimited');
      expect(typed.retryAfterSeconds).toBe(240);
      expect(typed.title).toBe('Too many lookups');
    });

    it('throws Forbidden with the title for a 403', async () => {
      const error = await failWith(() => service.lookupSourceUser(request), lookupUrl,
        problem(403, { message: "Access is denied: this operation requires the role 'UserManagement' in the tenant." }, 'Forbidden'));

      expect((error as CrossTenantGrantError).kind).toBe('Forbidden');
      expect((error as CrossTenantGrantError).message).toContain("requires the role 'UserManagement'");
    });

    it('rethrows other errors unchanged', async () => {
      const error = await failWith(() => service.lookupSourceUser(request), lookupUrl, problem(500, null, 'Server Error'));

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(500);
    });

    it('never writes the identifier to the console and never carries it in the error', async () => {
      const spies = (['log', 'info', 'debug', 'warn', 'error', 'trace'] as const)
        .map(method => vi.spyOn(console, method).mockImplementation(() => undefined));

      const notFound = service.lookupSourceUser(request);
      await tick();
      httpMock.expectOne(lookupUrl).flush({ code: 'SourceUserNotFound' }, { status: 404, statusText: 'Not Found' });
      await notFound;

      const error = await failWith(() => service.lookupSourceUser(request), lookupUrl,
        problem(429, { code: 'SourceUserLookupRateLimited', retryAfterSeconds: 3 }, 'Too Many Requests'));

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
      expect(JSON.stringify(error)).not.toContain(identifier);
      expect((error as Error).message).not.toContain(identifier);
      expect((error as Error).stack ?? '').not.toContain(identifier);
    });
  });

  describe('createExternalTenantUserMapping', () => {
    const base = { sourceTenantId: 'meshmakers', sourceUserId: 'u-1', sourceUserName: 'alice' };

    it('POSTs to the current tenant and omits groupIds when not set', async () => {
      const promise = service.createExternalTenantUserMapping(base);
      await tick();

      const req = httpMock.expectOne(tenantPrefix);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(base);
      expect('groupIds' in req.request.body).toBe(false);
      req.flush(mapping, { status: 201, statusText: 'Created' });

      expect(await promise).toEqual(mapping);
    });

    it('omits groupIds when null', async () => {
      const promise = service.createExternalTenantUserMapping({ ...base, groupIds: null });
      await tick();
      const req = httpMock.expectOne(tenantPrefix);
      expect('groupIds' in req.request.body).toBe(false);
      req.flush(mapping, { status: 201, statusText: 'Created' });
      await promise;
    });

    it('sends groupIds when set', async () => {
      const promise = service.createExternalTenantUserMapping({ ...base, groupIds: ['grp-1'] });
      await tick();
      const req = httpMock.expectOne(tenantPrefix);
      expect(req.request.body.groupIds).toEqual(['grp-1']);
      req.flush(mapping, { status: 201, statusText: 'Created' });
      await promise;
    });

    it('throws SourceTenantNotPermitted for 403 with that code', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping(base), tenantPrefix,
        problem(403, { status: 403, title: 'Source tenant not permitted', code: 'SourceTenantNotPermitted' }, 'Forbidden'));

      expect((error as CrossTenantGrantError).kind).toBe('SourceTenantNotPermitted');
      expect((error as CrossTenantGrantError).problemCode).toBe('SourceTenantNotPermitted');
    });

    it('throws UnknownGroup with the unknown group ids', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping({ ...base, groupIds: ['g1', 'g2'] }),
        tenantPrefix, problem(400, { status: 400, code: 'UnknownGroup', unknownGroupIds: ['g2'] }, 'Bad Request'));

      expect((error as CrossTenantGrantError).kind).toBe('UnknownGroup');
      expect((error as CrossTenantGrantError).unknownGroupIds).toEqual(['g2']);
    });

    it('throws ExternalTenantUserMappingAlreadyExists with existingMappingId', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping(base), tenantPrefix,
        problem(409, {
          status: 409, title: 'A mapping for this source user already exists',
          code: 'ExternalTenantUserMappingAlreadyExists', existingMappingId: 'map-7'
        }, 'Conflict'));

      expect((error as CrossTenantGrantError).kind).toBe('ExternalTenantUserMappingAlreadyExists');
      expect((error as CrossTenantGrantError).existingMappingId).toBe('map-7');
    });

    it('throws RoleChangeRefused with the guard title for 403 role-not-held', async () => {
      const title = "You cannot grant the built-in role 'TenantOwners' because you do not hold it.";
      const error = await failWith(() => service.createExternalTenantUserMapping({ ...base, groupIds: ['g1'] }),
        tenantPrefix, problem(403, { status: 403, title, code: 'role-not-held', roleNames: ['TenantOwners'] }, 'Forbidden'));

      const typed = error as CrossTenantGrantError;
      expect(typed.kind).toBe('RoleChangeRefused');
      expect(typed.title).toBe(title);
      expect(typed.message).toBe(title);
      expect(typed.roleNames).toEqual(['TenantOwners']);
    });

    it('throws Forbidden with the title for any other 403', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping(base), tenantPrefix,
        problem(403, { status: 403, title: 'Something else' }, 'Forbidden'));

      expect((error as CrossTenantGrantError).kind).toBe('Forbidden');
      expect((error as CrossTenantGrantError).title).toBe('Something else');
    });

    it('does not map a 404 to NotAvailable on the mapping route', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping(base), tenantPrefix,
        problem(404, null, 'Not Found'));

      expect(error).toBeInstanceOf(HttpErrorResponse);
    });
  });

  describe('getExternalTenantUserMappings', () => {
    it('GETs the mappings of the current tenant', async () => {
      const promise = service.getExternalTenantUserMappings();
      await tick();

      const req = httpMock.expectOne(tenantPrefix);
      expect(req.request.method).toBe('GET');
      req.flush([mapping]);

      expect(await promise).toEqual([mapping]);
    });

    it('passes skip, take and sourceTenantId as query parameters', async () => {
      const promise = service.getExternalTenantUserMappings({ skip: 0, take: 50, sourceTenantId: 'meshmakers' });
      await tick();

      const req = httpMock.expectOne(`${tenantPrefix}?skip=0&take=50&sourceTenantId=meshmakers`);
      req.flush([]);

      expect(await promise).toEqual([]);
    });
  });

  describe('deleteExternalTenantUserMapping', () => {
    it('DELETEs the mapping in the current tenant', async () => {
      const promise = service.deleteExternalTenantUserMapping('map-1');
      await tick();

      const req = httpMock.expectOne(`${tenantPrefix}/map-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await promise;
    });

    it('throws RoleChangeRefused for 409 last-administrator', async () => {
      const error = await failWith(() => service.deleteExternalTenantUserMapping('map-1'), `${tenantPrefix}/map-1`,
        problem(409, { status: 409, title: 'This would remove the last administrator.', code: 'last-administrator' }, 'Conflict'));

      expect((error as CrossTenantGrantError).kind).toBe('RoleChangeRefused');
      expect((error as CrossTenantGrantError).status).toBe(409);
    });

    it('rethrows a 404 for an unknown mapping id unchanged', async () => {
      const error = await failWith(() => service.deleteExternalTenantUserMapping('nope'), `${tenantPrefix}/nope`,
        problem(404, null, 'Not Found'));

      expect(error).toBeInstanceOf(HttpErrorResponse);
    });
  });

  it('marks only 403 (always typed) as caller-handled so the global interceptor shows no second toast', async () => {
    const lookup = service.lookupSourceUser({ sourceTenantId: 's', identifier });
    const create = service.createExternalTenantUserMapping({ sourceTenantId: 's', sourceUserId: 'u', sourceUserName: 'n' });
    const list = service.getExternalTenantUserMappings();
    const remove = service.deleteExternalTenantUserMapping('map-1');
    await tick();

    const lookupReq = httpMock.expectOne(`${tenantPrefix}/sourceUserLookup`);
    const createReq = httpMock.expectOne(r => r.method === 'POST' && r.url === tenantPrefix);
    const listReq = httpMock.expectOne(r => r.method === 'GET' && r.url === tenantPrefix);
    const deleteReq = httpMock.expectOne(`${tenantPrefix}/map-1`);
    expect(lookupReq.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403]);
    expect(createReq.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403]);
    expect(listReq.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403]);
    expect(deleteReq.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([403]);

    lookupReq.flush({ sourceTenantId: 's', userId: 'u', userName: 'n' });
    createReq.flush(mapping);
    listReq.flush([]);
    deleteReq.flush(null);
    await Promise.all([lookup, create, list, remove]);
  });

  describe('untyped answers keep the interceptor default (review PR #329)', () => {
    const base = { sourceTenantId: 'meshmakers', sourceUserId: 'u-1', sourceUserName: 'alice' };

    it.each([
      ['lookup 429 without code', 429, { title: 'Too Many Requests' }],
      ['lookup 404 with another code', 404, { code: 'SomethingElse' }]
    ])('rethrows %s unchanged', async (_name, status, body) => {
      const error = await failWith(() => service.lookupSourceUser({ sourceTenantId: 's', identifier }),
        `${tenantPrefix}/sourceUserLookup`, problem(status, body));

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(status);
    });

    it('rethrows a validation 400 of create unchanged', async () => {
      const error = await failWith(() => service.createExternalTenantUserMapping(base), tenantPrefix,
        problem(400, { status: 400, title: 'One or more validation errors occurred.', errors: { sourceUserId: ['required'] } }));

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(400);
    });

    it('rethrows a 409 without a known code unchanged and leaves its reporting to the interceptor', async () => {
      const error = await failWith(() => service.deleteExternalTenantUserMapping('map-1'), `${tenantPrefix}/map-1`,
        problem(409, { message: 'Concurrent update, retry.' }));

      expect(error).toBeInstanceOf(HttpErrorResponse);
      // Not caller-handled: the interceptor reports such a 409 itself, so the page shows no second message.
      expect(MmHttpErrorInterceptor.reportsToUser(error)).toBe(true);
    });
  });

  it('maps an HttpErrorResponse of another Angular copy structurally', () => {
    const foreign = { name: 'HttpErrorResponse', status: 409, error: { code: 'ExternalTenantUserMappingAlreadyExists', existingMappingId: 'm-9' } };

    const mapped = toCrossTenantGrantError(foreign, 'mapping');

    expect(mapped?.kind).toBe('ExternalTenantUserMappingAlreadyExists');
    expect(mapped?.existingMappingId).toBe('m-9');
    expect(toCrossTenantGrantError(new Error('x'), 'mapping')).toBeNull();
  });

  it('returns null without a request when no identity URL is configured', async () => {
    config.issuer = '';
    try {
      expect(await service.lookupSourceUser({ sourceTenantId: 's', identifier })).toBeNull();
      expect(await service.createExternalTenantUserMapping({ sourceTenantId: 's', sourceUserId: 'u', sourceUserName: 'n' })).toBeNull();
      expect(await service.getExternalTenantUserMappings()).toBeNull();
      await service.deleteExternalTenantUserMapping('map-1');
      httpMock.expectNone(() => true);
    } finally {
      config.issuer = issuer;
    }
  });
});
