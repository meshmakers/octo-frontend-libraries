import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Apollo, provideApollo } from 'apollo-angular';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { ServerError } from '@apollo/client/errors';
import { Observable, of, throwError } from 'rxjs';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';
import {
  CANNOT_MERGE_INTO_ITSELF_CODE,
  IdentityMethodError,
  METHOD_HANDLER_NOT_AVAILABLE_CODE,
  METHOD_TARGET_NOT_FOUND_CODE,
  ROLE_ALREADY_ASSIGNED_CODE,
  ROLE_NOT_ASSIGNED_CODE,
  ROLE_NOT_FOUND_CODE,
  SOURCE_USER_NOT_FOUND_CODE
} from '../shared/identity-method-error';

/**
 * AB#8863: updateUserRoles, addUserToRole, removeRoleFromUser and mergeUsers run User.SetRoles / AddRole / RemoveRole /
 * Merge through GraphQL and fall back to the deprecated REST endpoints on a schema without the methods and on
 * METHOD_HANDLER_NOT_AVAILABLE (the rule of AB#8864). A real Apollo client runs against a scripted link.
 */
describe('IdentityService role and merge methods (AB#8863)', () => {
  const issuer = 'https://identity.example.com/';
  const apiPrefix = `${issuer}tenant-a/v1/`;
  const rtId = '6ae7c66ccc5a608ccf779df9';

  interface Call { operationName: string; variables: Record<string, unknown>; context: Record<string, unknown> }
  let calls: Call[];
  let respond: (call: Call) => Observable<ApolloLink.Result>;
  let httpMock: HttpTestingController;
  let service: IdentityService;
  let info: ReturnType<typeof vi.spyOn>;

  const graphQlError = (code: string, parameters: Record<string, unknown> = {}) => of({
    data: null,
    errors: [{ message: `The CK method call failed: ${code}`, extensions: { code, codes: [code], parameters } }]
  } as unknown as ApolloLink.Result);
  const schemaMismatch = (field: string): Observable<ApolloLink.Result> => throwError(() => new ServerError('Response not successful', {
    response: new Response(null, { status: 400 }),
    bodyText: JSON.stringify({
      errors: [{
        message: `Cannot query field '${field}' on type 'SystemIdentityUserMutations'.`,
        extensions: { code: 'FIELDS_ON_CORRECT_TYPE', codes: ['FIELDS_ON_CORRECT_TYPE'] }
      }]
    })
  }));
  const success = (field: string) => () => of({ data: { runtime: { __typename: 'Runtime', systemIdentityUsers: {
    __typename: 'SystemIdentityUserMutations',
    [field]: { invocationId: 'inv-1' }
  } } } } as unknown as ApolloLink.Result);

  /** Lets the async service code run up to its next HTTP request. */
  const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  /** One row per operation: how to call it, what the method gets and which REST request the fallback sends. */
  interface Operation {
    name: 'updateUserRoles' | 'addUserToRole' | 'removeRoleFromUser' | 'mergeUsers';
    operationName: string;
    field: string;
    call: (s: IdentityService, userRtId?: string) => Promise<void>;
    input: Record<string, unknown>;
    rest: { url: string; method: string; body: unknown };
  }
  const operations: Operation[] = [
    {
      name: 'updateUserRoles', operationName: 'identityUserSetRoles', field: 'setRoles',
      call: (s, id) => s.updateUserRoles('jane.doe', [{ id: 'r1', name: 'Admin' }, { id: 'r2', name: 'Reader' }], id),
      input: { roleNames: ['Admin', 'Reader'] },
      rest: { url: `${apiPrefix}users/jane.doe/roles`, method: 'PUT', body: ['r1', 'r2'] }
    },
    {
      name: 'addUserToRole', operationName: 'identityUserAddRole', field: 'addRole',
      call: (s, id) => s.addUserToRole('jane.doe', 'Admin', id),
      input: { roleName: 'Admin' },
      rest: { url: `${apiPrefix}users/jane.doe/roles/Admin`, method: 'PUT', body: null }
    },
    {
      name: 'removeRoleFromUser', operationName: 'identityUserRemoveRole', field: 'removeRole',
      call: (s, id) => s.removeRoleFromUser('jane.doe', 'Admin', id),
      input: { roleName: 'Admin' },
      rest: { url: `${apiPrefix}users/jane.doe/roles/Admin`, method: 'DELETE', body: null }
    },
    {
      name: 'mergeUsers', operationName: 'identityUserMerge', field: 'merge',
      call: (s, id) => s.mergeUsers('jane.doe', 'jane.google', id),
      input: { sourceUserName: 'jane.google' },
      rest: { url: `${apiPrefix}users/jane.doe/merge`, method: 'POST', body: { sourceUserName: 'jane.google' } }
    }
  ];

  function configure(withApollo: boolean): void {
    const link = new ApolloLink(operation => {
      const call: Call = {
        operationName: operation.operationName ?? '',
        variables: operation.variables as Record<string, unknown>,
        context: operation.getContext() as Record<string, unknown>
      };
      calls.push(call);
      return respond(call);
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        ...(withApollo ? [provideApollo(() => ({ link, cache: new InMemoryCache() }))] : []),
        { provide: CONFIGURATION_SERVICE, useValue: { config: { issuer } as AddInConfiguration, loadConfigAsync: vi.fn() } },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('tenant-a') }
      ]
    });
    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    calls = [];
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    configure(true);
  });

  afterEach(() => httpMock.verify());

  /** Answers the one `GET users/{userName}` rtId lookup of a call without a passed rtId. */
  async function answerLookup(userName = 'jane.doe'): Promise<void> {
    await tick(); await tick();
    const lookup = httpMock.expectOne(`${apiPrefix}users/${userName}`);
    expect(lookup.request.method).toBe('GET');
    lookup.flush({ userId: rtId, name: userName });
    await tick();
  }

  /** Expects and answers the REST request of the fallback. */
  async function answerRest(op: Operation): Promise<void> {
    await tick(); await tick(); await tick();
    const req = httpMock.expectOne(op.rest.url);
    expect(req.request.method).toBe(op.rest.method);
    expect(req.request.body).toEqual(op.rest.body);
    req.flush(null);
  }

  for (const op of operations) {
    describe(op.name, () => {
      beforeEach(() => {
        respond = success(op.field);
      });

      it('sends exactly one silent method mutation and no HTTP request when the caller passes the rtId', async () => {
        await op.call(service, rtId);

        expect(calls.map(c => c.operationName)).toEqual([op.operationName]);
        expect(calls[0].variables).toEqual({ rtId, input: op.input });
        expect(calls[0].context[OCTO_SILENT_ERRORS]).toBe(true);
        httpMock.expectNone(() => true);
      });

      it('reads the rtId once with GET users/{userName} when the caller does not pass it; no REST endpoint is called', async () => {
        const done = op.call(service);
        await answerLookup();
        await done;

        expect(calls.length).toBe(1);
        expect(calls[0].variables).toEqual({ rtId, input: op.input });
        httpMock.expectNone(op.rest.url);
      });

      it('uses REST when the schema lacks the mutation, logs once and never sends the operation again', async () => {
        respond = () => schemaMismatch(op.field);

        const first = op.call(service, rtId);
        await answerRest(op);
        await first;

        const second = op.call(service, rtId);
        await answerRest(op);
        await second;

        expect(calls.length).toBe(1);
        expect(info).toHaveBeenCalledTimes(1);
        expect(String(info.mock.calls[0][0])).toContain('tenant-a');
        expect(String(info.mock.calls[0][0])).toContain('schema');
      });

      it('completes the request through REST on METHOD_HANDLER_NOT_AVAILABLE and stays on REST (AB#8864 rule)', async () => {
        respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);

        const first = op.call(service, rtId);
        await answerRest(op);
        await first;
        const second = op.call(service, rtId);
        await answerRest(op);
        await second;

        expect(calls.length).toBe(1);
        expect(info).toHaveBeenCalledTimes(1);
        expect(String(info.mock.calls[0][0])).toContain(METHOD_HANDLER_NOT_AVAILABLE_CODE);
      });

      for (const code of ['METHOD_FORBIDDEN', 'METHOD_VALIDATION_FAILED']) {
        it(`raises ${code} with the server's message and never falls back`, async () => {
          respond = () => graphQlError(code, { reason: 'self-grant' });

          const error = await op.call(service, rtId).catch((e: unknown) => e) as IdentityMethodError;

          expect(error).toBeInstanceOf(IdentityMethodError);
          expect(error.code).toBe(code);
          expect(error.message).toBe(`The CK method call failed: ${code}`);
          expect(error.parameters).toEqual({ reason: 'self-grant' });
          httpMock.expectNone(op.rest.url);
          expect(info).not.toHaveBeenCalled();

          // Not remembered as a fallback: the next call runs the method again.
          respond = success(op.field);
          await op.call(service, rtId);
          expect(calls.length).toBe(2);
        });
      }

      it('raises METHOD_TARGET_NOT_FOUND of the method with the REST text', async () => {
        respond = () => graphQlError(METHOD_TARGET_NOT_FOUND_CODE);
        const error = await op.call(service, rtId).catch((e: unknown) => e) as IdentityMethodError;
        expect(error.code).toBe(METHOD_TARGET_NOT_FOUND_CODE);
        expect(error.message).toBe(op.name === 'mergeUsers'
          ? 'Target user \'jane.doe\' not found.'
          : 'User with name \'jane.doe\' not found.');
        httpMock.expectNone(op.rest.url);
      });

      it('raises an unknown user of the rtId lookup as METHOD_TARGET_NOT_FOUND without a method call', async () => {
        const done = op.call(service).catch((e: unknown) => e);
        await tick(); await tick();
        httpMock.expectOne(`${apiPrefix}users/jane.doe`).flush(null, { status: 404, statusText: 'Not Found' });
        const error = await done as IdentityMethodError;
        expect(error).toBeInstanceOf(IdentityMethodError);
        expect(error.code).toBe(METHOD_TARGET_NOT_FOUND_CODE);
        expect(calls.length).toBe(0);
      });

      it('still falls back and still rejects with a host default errorPolicy all', async () => {
        (TestBed.inject(Apollo).client.defaultOptions as { mutate?: Record<string, unknown> }).mutate = { errorPolicy: 'all' };

        respond = () => graphQlError('METHOD_FORBIDDEN');
        const error = await op.call(service, rtId).catch((e: unknown) => e) as IdentityMethodError;
        expect(error).toBeInstanceOf(IdentityMethodError);
        httpMock.expectNone(op.rest.url);

        respond = () => graphQlError(METHOD_HANDLER_NOT_AVAILABLE_CODE);
        const done = op.call(service, rtId);
        await answerRest(op);
        await expect(done).resolves.toBeUndefined();
      });

      it('uses REST in a host without Apollo', async () => {
        TestBed.resetTestingModule();
        configure(false);
        const done = op.call(service, rtId);
        await answerRest(op);
        await done;
        expect(calls.length).toBe(0);
      });
    });
  }

  describe('texts of the role and merge codes equal the REST texts', () => {
    const cases: { op: number; code: string; parameters?: Record<string, unknown>; message: string }[] = [
      { op: 0, code: ROLE_NOT_FOUND_CODE, parameters: { roleName: 'Ghost' }, message: 'Role with name \'Ghost\' not found.' },
      { op: 1, code: ROLE_NOT_FOUND_CODE, message: 'Role with name \'Admin\' not found.' },
      { op: 1, code: ROLE_ALREADY_ASSIGNED_CODE, message: 'User \'jane.doe\' already has role \'Admin\'' },
      { op: 2, code: ROLE_NOT_ASSIGNED_CODE, message: 'User \'jane.doe\' doesn\'t have role \'Admin\'' },
      { op: 3, code: SOURCE_USER_NOT_FOUND_CODE, message: 'Source user \'jane.google\' not found.' },
      { op: 3, code: CANNOT_MERGE_INTO_ITSELF_CODE, message: 'Cannot merge a user into itself.' }
    ];
    for (const c of cases) {
      it(`${operations[c.op].name}: ${c.code}`, async () => {
        respond = () => graphQlError(c.code, c.parameters);
        const error = await operations[c.op].call(service, rtId).catch((e: unknown) => e) as IdentityMethodError;
        expect(error).toBeInstanceOf(IdentityMethodError);
        expect(error.code).toBe(c.code);
        expect(error.message).toBe(c.message);
        httpMock.expectNone(operations[c.op].rest.url);
      });
    }
  });

  /**
   * Error answers recorded on the local stack (2026-11-16, scratch tenant, asset repository + identity services `main`):
   * `extensions.details` is a string there and some codes carry `methodId` or no parameters at all.
   */
  describe('error answers recorded on the local stack', () => {
    const recorded = (field: string, code: string, parameters: Record<string, unknown>) => () => of({
      data: { runtime: { __typename: 'Runtime', systemIdentityUsers: { __typename: 'SystemIdentityUserMutations', [field]: null } } },
      errors: [{
        message: `The CK method call failed: ${code}`,
        extensions: { code, codes: [code], details: `GraphQL.ExecutionError: The CK method call failed: ${code}`, parameters }
      }]
    } as unknown as ApolloLink.Result);
    const cases: { op: number; code: string; parameters: Record<string, unknown>; message: string }[] = [
      { op: 1, code: ROLE_ALREADY_ASSIGNED_CODE, parameters: {}, message: 'User \'jane.doe\' already has role \'Admin\'' },
      { op: 1, code: ROLE_NOT_FOUND_CODE, parameters: { roleName: 'NoSuchRole' }, message: 'Role with name \'NoSuchRole\' not found.' },
      { op: 2, code: ROLE_NOT_ASSIGNED_CODE, parameters: {}, message: 'User \'jane.doe\' doesn\'t have role \'Admin\'' },
      { op: 0, code: ROLE_NOT_FOUND_CODE, parameters: { roleName: 'NoSuchRole' }, message: 'Role with name \'NoSuchRole\' not found.' },
      {
        op: 1, code: METHOD_TARGET_NOT_FOUND_CODE, parameters: { methodId: 'System.Identity/User.AddRole-1' },
        message: 'User with name \'jane.doe\' not found.'
      },
      {
        op: 3, code: METHOD_TARGET_NOT_FOUND_CODE, parameters: { methodId: 'System.Identity/User.Merge-1' },
        message: 'Target user \'jane.doe\' not found.'
      },
      { op: 3, code: SOURCE_USER_NOT_FOUND_CODE, parameters: {}, message: 'Source user \'jane.google\' not found.' },
      { op: 3, code: CANNOT_MERGE_INTO_ITSELF_CODE, parameters: {}, message: 'Cannot merge a user into itself.' }
    ];
    for (const c of cases) {
      it(`${operations[c.op].name}: ${c.code}`, async () => {
        respond = recorded(operations[c.op].field, c.code, c.parameters);
        const error = await operations[c.op].call(service, rtId).catch((e: unknown) => e) as IdentityMethodError;
        expect(error).toBeInstanceOf(IdentityMethodError);
        expect(error.code).toBe(c.code);
        expect(error.message).toBe(c.message);
        expect(error.parameters).toEqual(c.parameters);
        expect(error.details).toEqual([]);
        httpMock.expectNone(operations[c.op].rest.url);
        expect(info).not.toHaveBeenCalled();
      });
    }
  });

  it('encodes the user and role name in the REST fallback URL', async () => {
    TestBed.resetTestingModule();
    configure(false);
    const done = service.addUserToRole('a#b', 'R&D?');
    await tick(); await tick();
    const req = httpMock.expectOne(`${apiPrefix}users/a%23b/roles/R%26D%3F`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);
    await done;
  });

  it('keeps the fallback per operation: a schema without setRoles does not move addRole to REST', async () => {
    respond = () => schemaMismatch('setRoles');
    const first = operations[0].call(service, rtId);
    await answerRest(operations[0]);
    await first;

    respond = success('addRole');
    await operations[1].call(service, rtId);
    expect(calls.map(c => c.operationName)).toEqual(['identityUserSetRoles', 'identityUserAddRole']);
  });
});
