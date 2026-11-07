import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { MM_CALLER_HANDLED_STATUSES } from '@meshmakers/shared-services';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import {
  CrossTenantGrantPermissionsError,
  toCrossTenantGrantPermissionsError
} from '../shared/crossTenantGrantPermissionsDto';

/**
 * AB#8430: allow-list client of the source tenant (`{issuer}{S}/v1/crossTenantGrantPermissions`, AB#8345),
 * contract `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md` §6.
 */
describe('IdentityService cross-tenant grant permissions (AB#8430)', () => {
  let service: IdentityService;
  let httpMock: HttpTestingController;

  const issuer = 'https://identity.example.com/';
  const url = `${issuer}source-s/v1/crossTenantGrantPermissions`;

  async function tick(): Promise<void> {
    await Promise.resolve();
  }

  async function failWith<T>(call: () => Promise<T>, status: number, body: object | string | null): Promise<unknown> {
    const settled = call().then(() => undefined, (e: unknown) => e);
    await tick();
    httpMock.expectOne(url).flush(body, { status, statusText: 'Error' });
    return settled;
  }

  function setup(issuerValue: string | null = issuer): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        IdentityService,
        { provide: CONFIGURATION_SERVICE, useValue: { config: { issuer: issuerValue ?? undefined } as AddInConfiguration, loadConfigAsync: vi.fn() } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('source-s') }
      ]
    });
    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  describe('getCrossTenantGrantPermissions', () => {
    beforeEach(() => setup());

    it('GETs the list of the current tenant', async () => {
      const promise = service.getCrossTenantGrantPermissions();
      await tick();
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush({ targetTenantIds: ['customer-a'] });
      expect(await promise).toEqual({ targetTenantIds: ['customer-a'] });
    });

    it('returns an empty list for a fresh tenant', async () => {
      const promise = service.getCrossTenantGrantPermissions();
      await tick();
      httpMock.expectOne(url).flush({ targetTenantIds: [] });
      expect(await promise).toEqual({ targetTenantIds: [] });
    });

    it('reads a missing list as empty', async () => {
      const promise = service.getCrossTenantGrantPermissions();
      await tick();
      httpMock.expectOne(url).flush({});
      expect(await promise).toEqual({ targetTenantIds: [] });
    });

    it('marks the typed statuses as caller-handled, so the interceptor shows no toast', async () => {
      const promise = service.getCrossTenantGrantPermissions();
      await tick();
      const req = httpMock.expectOne(url);
      expect(req.request.context.get(MM_CALLER_HANDLED_STATUSES)).toEqual([400, 403, 404, 412]);
      req.flush({ targetTenantIds: [] });
      await promise;
    });

    it('maps 403 to Forbidden', async () => {
      const error = await failWith(() => service.getCrossTenantGrantPermissions(), 403, null);
      expect(error).toBeInstanceOf(CrossTenantGrantPermissionsError);
      expect((error as CrossTenantGrantPermissionsError).kind).toBe('Forbidden');
      expect((error as CrossTenantGrantPermissionsError).status).toBe(403);
    });

    it('maps 404 to NotAvailable (identity service without AB#8345)', async () => {
      const error = await failWith(() => service.getCrossTenantGrantPermissions(), 404, null);
      expect((error as CrossTenantGrantPermissionsError).kind).toBe('NotAvailable');
    });

    it('rethrows untyped errors unchanged', async () => {
      const error = await failWith(() => service.getCrossTenantGrantPermissions(), 500, 'boom');
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(500);
    });
  });

  describe('setCrossTenantGrantPermissions', () => {
    beforeEach(() => setup());

    it('PUTs exactly the given list and returns the stored list', async () => {
      const promise = service.setCrossTenantGrantPermissions(['customer-a']);
      await tick();
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ targetTenantIds: ['customer-a'] });
      expect(req.request.headers.has('If-Match')).toBe(false);
      req.flush({ targetTenantIds: ['customer-a'] });
      expect(await promise).toEqual({ targetTenantIds: ['customer-a'] });
    });

    it('PUTs an empty list to permit nobody', async () => {
      const promise = service.setCrossTenantGrantPermissions([]);
      await tick();
      const req = httpMock.expectOne(url);
      expect(req.request.body).toEqual({ targetTenantIds: [] });
      req.flush({ targetTenantIds: [] });
      expect(await promise).toEqual({ targetTenantIds: [] });
    });

    it('returns the normalised list of the server', async () => {
      const promise = service.setCrossTenantGrantPermissions(['Customer-A ']);
      await tick();
      httpMock.expectOne(url).flush({ targetTenantIds: ['customer-a'] });
      expect(await promise).toEqual({ targetTenantIds: ['customer-a'] });
    });

    it('does not keep a reference to the caller array', async () => {
      const ids = ['customer-a'];
      const promise = service.setCrossTenantGrantPermissions(ids);
      await tick();
      const req = httpMock.expectOne(url);
      ids.push('late');
      expect(req.request.body).toEqual({ targetTenantIds: ['customer-a'] });
      req.flush({ targetTenantIds: ['customer-a'] });
      await promise;
    });

    it('maps a 400 validation problem to Invalid with the readable reasons', async () => {
      const error = await failWith(() => service.setCrossTenantGrantPermissions(['source-s']), 400, {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { TargetTenantIds: ['The tenant cannot permit itself.', 'Too long.'] }
      });
      const typed = error as CrossTenantGrantPermissionsError;
      expect(typed.kind).toBe('Invalid');
      expect(typed.validationErrors).toEqual(['The tenant cannot permit itself.', 'Too long.']);
      expect(typed.message).toBe('The tenant cannot permit itself.');
    });

    it('maps 403 to Forbidden', async () => {
      const error = await failWith(() => service.setCrossTenantGrantPermissions(['customer-a']), 403, null);
      expect((error as CrossTenantGrantPermissionsError).kind).toBe('Forbidden');
    });

    it('maps 412 to Conflict (prepared for If-Match, AB#8432)', async () => {
      const error = await failWith(() => service.setCrossTenantGrantPermissions(['customer-a']), 412, null);
      expect((error as CrossTenantGrantPermissionsError).kind).toBe('Conflict');
    });

    it('carries no request data in the error', async () => {
      const error = await failWith(() => service.setCrossTenantGrantPermissions(['secret-tenant']), 403, null);
      expect(JSON.stringify(error)).not.toContain('secret-tenant');
      expect((error as Error).message).not.toContain('secret-tenant');
    });
  });

  describe('without identity URL', () => {
    beforeEach(() => setup(null));

    it('returns null and sends nothing', async () => {
      expect(await service.getCrossTenantGrantPermissions()).toBeNull();
      expect(await service.setCrossTenantGrantPermissions(['customer-a'])).toBeNull();
    });
  });

  describe('toCrossTenantGrantPermissionsError', () => {
    beforeEach(() => setup());

    it('ignores non-HTTP errors', () => {
      expect(toCrossTenantGrantPermissionsError(new Error('x'))).toBeNull();
    });

    it('reads a validation problem sent as text', () => {
      const error = new HttpErrorResponse({
        status: 400,
        error: JSON.stringify({ errors: { TargetTenantIds: ['Invalid characters.'] } })
      });
      expect(toCrossTenantGrantPermissionsError(error)?.validationErrors).toEqual(['Invalid characters.']);
    });

    it('returns null for 401', () => {
      expect(toCrossTenantGrantPermissionsError(new HttpErrorResponse({ status: 401 }))).toBeNull();
    });
  });
});
