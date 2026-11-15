import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideApollo } from 'apollo-angular';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { ServerError } from '@apollo/client/errors';
import { Observable, of, throwError } from 'rxjs';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { RegisterUserDto } from '../shared/registerUserDto';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';
import {
  IdentityMethodError,
  identityUserFailureOf,
  METHOD_HANDLER_NOT_AVAILABLE_CODE,
  METHOD_TARGET_NOT_FOUND_CODE,
  PASSWORD_POLICY_VIOLATION_CODE,
  USER_ALREADY_EXISTS_CODE
} from '../shared/identity-method-error';

/**
 * AB#8864: createUser and resetPassword run User.CreateUser / User.ResetPassword through GraphQL and fall back to REST
 * on a schema without the methods and on METHOD_HANDLER_NOT_AVAILABLE. A real Apollo client with an InMemoryCache runs
 * against a scripted link, so the spec sees what goes over the wire and what the cache keeps.
 */
describe('IdentityService user methods (AB#8864)', () => {
  const issuer = 'https://identity.example.com/';
  const apiPrefix = `${issuer}tenant-a/v1/`;
  // Generated per run, never a fixed literal; only compared, never printed.
  const password = `Pw1!${Math.random().toString(36).slice(2)}${Date.now()}`;

  interface Call { operationName: string; variables: Record<string, unknown>; context: Record<string, unknown> }
  let calls: Call[];
  let respond: (call: Call) => Observable<ApolloLink.Result>;
  let cache: InMemoryCache;
  let httpMock: HttpTestingController;
  let service: IdentityService;
  let tenantId: string;
  let info: ReturnType<typeof vi.spyOn>;

  const graphQlError = (code: string, extra: Record<string, unknown> = {}) => of({
    data: null,
    errors: [{ message: `The CK method call failed: ${code}`, extensions: { code, codes: [code], parameters: {}, ...extra } }]
  } as unknown as ApolloLink.Result);
  /** What GraphQL.NET sends for a schema mismatch: HTTP 400 application/json, which Apollo 4 turns into a ServerError. */
  const schemaMismatch = (): Observable<ApolloLink.Result> => throwError(() => new ServerError('Response not successful', {
    response: new Response(null, { status: 400 }),
    bodyText: JSON.stringify({
      errors: [{
        message: 'Cannot query field \'createUser\' on type \'SystemIdentityUserMutations\'.',
        extensions: { code: 'FIELDS_ON_CORRECT_TYPE', codes: ['FIELDS_ON_CORRECT_TYPE'] }
      }]
    })
  }));
  const createdUser = () => of({ data: { runtime: { __typename: 'Runtime', systemIdentityUsers: {
    __typename: 'SystemIdentityUserMutations',
    createUser: { __typename: 'SystemIdentityUserCreateUserMethodResult', invocationId: 'inv-1', result: '6ae7c66ccc5a608ccf779df9' }
  } } } } as unknown as ApolloLink.Result);
  const passwordReset = () => of({ data: { runtime: { __typename: 'Runtime', systemIdentityUsers: {
    __typename: 'SystemIdentityUserMutations',
    resetPassword: { __typename: 'SystemIdentityUserResetPasswordMethodResult', invocationId: 'inv-2' }
  } } } } as unknown as ApolloLink.Result);

  const newUser: RegisterUserDto = {
    userId: '', name: 'jane.doe', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', password
  };

  /** Lets the async service code run up to its next HTTP request. */
  const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  beforeEach(() => {
    calls = [];
    respond = () => createdUser();
    tenantId = 'tenant-a';
    cache = new InMemoryCache();
    const link = new ApolloLink(operation => {
      const call: Call = {
        operationName: operation.operationName ?? '',
        variables: operation.variables as Record<string, unknown>,
        context: operation.getContext() as Record<string, unknown>
      };
      calls.push(call);
      return respond(call);
    });
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideApollo(() => ({ link, cache })),
        { provide: CONFIGURATION_SERVICE, useValue: { config: { issuer } as AddInConfiguration, loadConfigAsync: vi.fn() } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve(tenantId) }
      ]
    });
    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function expectNoPasswordInCache(): void {
    const snapshot = JSON.stringify(cache.extract(true));
    expect(snapshot).not.toContain(password);
    expect(snapshot.toLowerCase()).not.toContain('password');
  }

  describe('createUser', () => {
    it('runs User.CreateUser silently and without cache; no request reaches POST users', async () => {
      await service.createUser(newUser);

      expect(calls.map(c => c.operationName)).toEqual(['identityUserCreateUser']);
      expect(calls[0].variables).toEqual({ input: {
        userName: 'jane.doe', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', password
      } });
      expect(calls[0].context[OCTO_SILENT_ERRORS]).toBe(true);
      httpMock.expectNone(`${apiPrefix}users`);
      expectNoPasswordInCache();
    });

    it('sends a blank e-mail and a blank password as null (invitation)', async () => {
      const invitation: RegisterUserDto = { ...newUser, email: '', password: '' };
      await service.createUser(invitation);
      expect(calls[0].variables['input']).toEqual(expect.objectContaining({ email: null, password: null }));
    });

    it('completes the same request through REST on METHOD_HANDLER_NOT_AVAILABLE and stays on REST for the tenant', async () => {
      respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);

      const first = service.createUser(newUser);
      await tick(); await tick();
      const req = httpMock.expectOne(`${apiPrefix}users`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newUser);
      expect(req.request.urlWithParams).not.toContain(password);
      req.flush(null);
      await expect(first).resolves.toBeUndefined();

      const second = service.createUser({ ...newUser, name: 'john.doe' });
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users`).flush(null);
      await second;

      expect(calls.length).toBe(1);
      expect(info).toHaveBeenCalledTimes(1);
      expect(String(info.mock.calls[0][0])).toContain('tenant-a');
      expect(String(info.mock.calls[0][0])).toContain(METHOD_HANDLER_NOT_AVAILABLE_CODE);
      expect(JSON.stringify(info.mock.calls)).not.toContain(password);
      expectNoPasswordInCache();
    });

    it('remembers the fallback per tenant', async () => {
      respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);
      const first = service.createUser(newUser);
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users`).flush(null);
      await first;

      tenantId = 'tenant-b';
      respond = () => createdUser();
      await service.createUser(newUser);
      expect(calls.length).toBe(2);
      httpMock.expectNone(`${issuer}tenant-b/v1/users`);
    });

    it('uses REST when the schema lacks the mutation (as AB#8863)', async () => {
      respond = () => schemaMismatch();
      const first = service.createUser(newUser);
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users`).flush(null);
      await first;

      const second = service.createUser(newUser);
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users`).flush(null);
      await second;
      expect(calls.length).toBe(1);
      expect(String(info.mock.calls[0][0])).toContain('schema');
    });

    it('uses REST for resetPasswordOnLogin, which the method does not take', async () => {
      const done = service.createUser({ ...newUser, resetPasswordOnLogin: true } as RegisterUserDto);
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users`).flush(null);
      await done;
      expect(calls.length).toBe(0);
    });

    it('raises a password policy refusal with the REST text and never falls back', async () => {
      respond = () => graphQlError(PASSWORD_POLICY_VIOLATION_CODE, {
        details: [{ code: 'PasswordTooShort', parameters: {} }, { code: 'PasswordRequiresDigit', parameters: {} }]
      });

      const error = await service.createUser(newUser).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(IdentityMethodError);
      expect((error as IdentityMethodError).code).toBe(PASSWORD_POLICY_VIOLATION_CODE);
      expect((error as Error).message)
        .toBe('Passwords must be at least 6 characters. Passwords must have at least one digit (\'0\'-\'9\').');
      expect(JSON.stringify(error)).not.toContain(password);
      expect((error as Error).message).not.toContain(password);
      httpMock.expectNone(`${apiPrefix}users`);
    });

    it('raises any other method refusal (METHOD_FORBIDDEN) without a REST call', async () => {
      respond = () => graphQlError('METHOD_FORBIDDEN');
      const error = await service.createUser(newUser).catch((e: unknown) => e) as IdentityMethodError;
      expect(error).toBeInstanceOf(IdentityMethodError);
      expect(error.code).toBe('METHOD_FORBIDDEN');
      httpMock.expectNone(`${apiPrefix}users`);

      // Not remembered as a fallback: the next call runs the method again.
      respond = () => createdUser();
      await service.createUser(newUser);
      expect(calls.length).toBe(2);
      expect(info).not.toHaveBeenCalled();
    });

    it('logs the fallback once when two calls fall back at the same time', async () => {
      respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);
      const both = Promise.all([service.createUser(newUser), service.createUser({ ...newUser, name: 'john.doe' })]);
      await tick(); await tick(); await tick();
      httpMock.match(`${apiPrefix}users`).forEach(req => req.flush(null));
      await both;
      expect(info).toHaveBeenCalledTimes(1);
    });

    it('raises a duplicate user name with the REST title', async () => {
      respond = () => graphQlError(USER_ALREADY_EXISTS_CODE, { parameters: { field: 'userName' } });
      const error = await service.createUser(newUser).catch((e: unknown) => e) as IdentityMethodError;
      expect(error.code).toBe(USER_ALREADY_EXISTS_CODE);
      expect(error.parameters).toEqual({ field: 'userName' });
      expect(error.message).toBe('Another user of this tenant already has this user name.');
    });

    it('creates through REST in a host without Apollo', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          { provide: CONFIGURATION_SERVICE, useValue: { config: { issuer } as AddInConfiguration, loadConfigAsync: vi.fn() } }
        ]
      });
      const restOnly = TestBed.inject(IdentityService);
      const http = TestBed.inject(HttpTestingController);
      const done = restOnly.createUser(newUser);
      await tick(); await tick();
      http.expectOne(`${issuer}octosystem/v1/users`).flush(null);
      await done;
      http.verify();
      httpMock = http;
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      respond = () => passwordReset();
    });

    async function answerLookup(): Promise<void> {
      await tick(); await tick();
      const lookup = httpMock.expectOne(`${apiPrefix}users/jane.doe`);
      expect(lookup.request.method).toBe('GET');
      lookup.flush({ userId: '6ae7c66ccc5a608ccf779df9', name: 'jane.doe' });
      await tick();
    }

    it('runs User.ResetPassword on the user\'s rtId; no request reaches POST users/ResetPassword', async () => {
      const done = service.resetPassword('jane.doe', password);
      await answerLookup();
      await expect(done).resolves.toBeNull();

      expect(calls.map(c => c.operationName)).toEqual(['identityUserResetPassword']);
      expect(calls[0].variables).toEqual({ rtId: '6ae7c66ccc5a608ccf779df9', input: { newPassword: password } });
      expect(calls[0].context[OCTO_SILENT_ERRORS]).toBe(true);
      httpMock.expectNone(`${apiPrefix}users/ResetPassword`);
      expectNoPasswordInCache();
    });

    it('completes the reset through REST on METHOD_HANDLER_NOT_AVAILABLE, then goes to REST directly', async () => {
      respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);

      const first = service.resetPassword('jane.doe', password);
      await answerLookup();
      await tick();
      const req = httpMock.expectOne(`${apiPrefix}users/ResetPassword`);
      expect(req.request.body).toEqual({ userName: 'jane.doe', password });
      expect(req.request.urlWithParams).not.toContain(password);
      req.flush({ ok: true });
      await expect(first).resolves.toEqual({ ok: true });

      const second = service.resetPassword('jane.doe', password);
      await tick(); await tick();
      httpMock.expectNone(`${apiPrefix}users/jane.doe`);
      httpMock.expectOne(`${apiPrefix}users/ResetPassword`).flush(null);
      await second;
      expect(calls.length).toBe(1);
      expect(info).toHaveBeenCalledTimes(1);
    });

    it('uses REST when the schema lacks the mutation', async () => {
      respond = () => schemaMismatch();
      const done = service.resetPassword('jane.doe', password);
      await answerLookup();
      await tick();
      httpMock.expectOne(`${apiPrefix}users/ResetPassword`).flush(null);
      await done;
      expect(calls.length).toBe(1);
      expect(info).toHaveBeenCalledTimes(1);
    });

    it('raises an unknown user as METHOD_TARGET_NOT_FOUND with the REST text', async () => {
      const done = service.resetPassword('nobody', password).catch((e: unknown) => e);
      await tick(); await tick();
      httpMock.expectOne(`${apiPrefix}users/nobody`).flush(null, { status: 404, statusText: 'Not Found' });
      const error = await done as IdentityMethodError;
      expect(error).toBeInstanceOf(IdentityMethodError);
      expect(error.code).toBe(METHOD_TARGET_NOT_FOUND_CODE);
      expect(error.message).toBe('User \'nobody\' not found.');
      expect(calls.length).toBe(0);
    });

    it('raises a password policy refusal and never falls back', async () => {
      respond = () => graphQlError(PASSWORD_POLICY_VIOLATION_CODE, { details: [{ code: 'PasswordRequiresUpper', parameters: {} }] });
      const done = service.resetPassword('jane.doe', password).catch((e: unknown) => e);
      await answerLookup();
      const error = await done as IdentityMethodError;
      expect(error.code).toBe(PASSWORD_POLICY_VIOLATION_CODE);
      expect(error.message).toBe('Passwords must have at least one uppercase (\'A\'-\'Z\').');
      httpMock.expectNone(`${apiPrefix}users/ResetPassword`);
    });
  });

  describe('identityUserFailureOf: same code and text on both paths (AB#8523 messages)', () => {
    const restError = (status: number, body: unknown) =>
      new HttpErrorResponse({ status, error: body, url: `${apiPrefix}users` });

    it('password policy', () => {
      // REST body as the identity service answers it (AB#8523 parity test, ASP.NET Identity default texts).
      const rest = identityUserFailureOf(restError(400, {
        statusCode: 400, message: 'Reset of password failed.', details: [
          { code: 'PasswordTooShort', description: 'Passwords must be at least 6 characters.' },
          { code: 'PasswordRequiresNonAlphanumeric', description: 'Passwords must have at least one non alphanumeric character.' },
          { code: 'PasswordRequiresDigit', description: 'Passwords must have at least one digit (\'0\'-\'9\').' },
          { code: 'PasswordRequiresUpper', description: 'Passwords must have at least one uppercase (\'A\'-\'Z\').' }
        ]
      }));
      const method = identityUserFailureOf({ errors: [{
        message: 'The CK method call failed: PASSWORD_POLICY_VIOLATION',
        extensions: { code: PASSWORD_POLICY_VIOLATION_CODE, parameters: {}, details: [
          { code: 'PasswordTooShort' }, { code: 'PasswordRequiresNonAlphanumeric' },
          { code: 'PasswordRequiresDigit' }, { code: 'PasswordRequiresUpper' }
        ] }
      }] });
      expect(rest).not.toBeNull();
      expect(method).toEqual(rest);
      expect(rest!.code).toBe(PASSWORD_POLICY_VIOLATION_CODE);
    });

    it('duplicate user name and e-mail', () => {
      for (const [field, title] of [
        ['userName', 'Another user of this tenant already has this user name.'],
        ['email', 'Another user of this tenant already has this e-mail address.']
      ]) {
        const rest = identityUserFailureOf(restError(409, { status: 409, title, code: USER_ALREADY_EXISTS_CODE, field }));
        const method = identityUserFailureOf({ errors: [{
          message: 'x', extensions: { code: USER_ALREADY_EXISTS_CODE, parameters: { field } }
        }] });
        expect(method).toEqual(rest);
        expect(rest!.message).toBe(title);
      }
    });

    it('unknown user', () => {
      const rest = identityUserFailureOf(restError(404, { statusCode: 404, message: 'User \'nobody\' not found.' }), 'nobody');
      const method = identityUserFailureOf({ errors: [{ message: 'x', extensions: { code: METHOD_TARGET_NOT_FOUND_CODE } }] }, 'nobody');
      expect(method).toEqual(rest);
      expect(rest!.code).toBe(METHOD_TARGET_NOT_FOUND_CODE);
    });

    it('returns null for errors that are no refusal', () => {
      expect(identityUserFailureOf(restError(500, null))).toBeNull();
      expect(identityUserFailureOf(new Error('network'))).toBeNull();
    });
  });
});
