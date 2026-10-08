import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { UserDto } from '../shared/userDto';
import { UserDirectoryEntryDto } from '../shared/userDirectoryEntryDto';
import { RoleDto } from '../shared/roleDto';
import { DataPermissionDto } from '../shared/dataPermissionDto';
import { ClientDto } from '../shared/clientDto';
import { DiagnosticsModel } from '../shared/diagnosticsModel';
import { GeneratedPasswordDto } from '../shared/generatedPasswordDto';
import { PagedResultDto } from '@meshmakers/shared-services';

describe('IdentityService', () => {
  let service: IdentityService;
  let httpMock: HttpTestingController;
  let mockConfigService: {
    config: AddInConfiguration | null;
    loadConfigAsync: Mock;
  };

  const baseUrl = 'https://identity.example.com/';
  const apiPrefix = `${baseUrl}octosystem/v1/`;

  const mockConfig: AddInConfiguration = {
    assetServices: 'https://asset.example.com/',
    issuer: baseUrl,
    botServices: 'https://bot.example.com/',
    communicationServices: 'https://comm.example.com/',
    meshAdapterUrl: 'https://mesh.example.com/',
    aiServices: 'https://ai.example.com/',
    reportingServices: 'https://reporting.example.com/',
    crateDbAdminUrl: 'https://crate.example.com/',
    grafanaUrl: 'https://grafana.example.com/',
    systemTenantId: 'system',
    clientId: 'test-client',
    redirectUri: 'https://app.example.com/',
    postLogoutRedirectUri: 'https://app.example.com/logout'
  };

  const mockUser: UserDto = {
    userId: 'user-1',
    name: 'john.doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  };

  const mockRole: RoleDto = {
    id: 'role-1',
    name: 'Admin'
  };

  const mockClient: ClientDto = {
    isEnabled: true,
    clientId: 'client-1',
    clientName: 'Test Client',
    clientUri: 'https://client.example.com',
    clientSecret: 'secret',
    requireClientSecret: false,
    allowedGrantTypes: ['authorization_code'],
    redirectUris: ['https://client.example.com/callback'],
    postLogoutRedirectUris: ['https://client.example.com/logout'],
    allowedCorsOrigins: ['https://client.example.com'],
    allowedScopes: ['openid', 'profile'],
    isOfflineAccessEnabled: true
  };

  /** Flush microtask queue so the async getApiBaseUrl() resolves before expectOne. */
  async function tick(): Promise<void> {
    await Promise.resolve();
  }

  beforeEach(() => {
    mockConfigService = {
      config: mockConfig,
      loadConfigAsync: vi.fn().mockName('loadConfigAsync').mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        IdentityService,
        { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
      ]
    });

    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('User Management', () => {
    describe('getUsers', () => {
      it('should return paged users', async () => {
        const mockResponse: PagedResultDto<UserDto> = {
          skip: 0,
          take: 10,
          totalCount: 1,
          list: [mockUser]
        };

        const resultPromise = service.getUsers(0, 10);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/getPaged?skip=0&take=10`);
        expect(req.request.method).toBe('GET');
        req.flush(mockResponse);

        const result = await resultPromise;
        expect(result).toEqual(mockResponse);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getUsers(0, 10);
        expect(result).toBeNull();
      });
    });

    describe('getUserDirectory (AB#5859)', () => {
      const directoryPage: PagedResultDto<UserDirectoryEntryDto> = {
        skip: 0,
        take: 100,
        totalCount: 1,
        list: [{ userId: 'user-1', displayName: 'John Doe' }]
      };

      it('requests users/directory with skip, take and search and returns the page', async () => {
        const resultPromise = service.getUserDirectory(20, 100, 'Jo');
        await tick();

        const req = httpMock.expectOne(r => r.url === `${apiPrefix}users/directory`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('skip')).toBe('20');
        expect(req.request.params.get('take')).toBe('100');
        expect(req.request.params.get('search')).toBe('Jo');
        req.flush(directoryPage);

        expect(await resultPromise).toEqual(directoryPage);
      });

      it('URL-encodes the search term', async () => {
        const resultPromise = service.getUserDirectory(0, 10, 'Müller & Co');
        await tick();

        const req = httpMock.expectOne(r => r.url === `${apiPrefix}users/directory`);
        expect(req.request.urlWithParams).toBe(`${apiPrefix}users/directory?skip=0&take=10&search=M%C3%BCller%20%26%20Co`);
        req.flush(directoryPage);
        await resultPromise;
      });

      it.each([
        [0, '1'],
        [-5, '1'],
        [1, '1'],
        [500, '500'],
        [501, '500'],
        [10000, '500'],
        [12.7, '12'],
        [Number.NaN, '100']
      ])('clamps take %p to %s', async (take, expected) => {
        const resultPromise = service.getUserDirectory(0, take);
        await tick();

        const req = httpMock.expectOne(r => r.url === `${apiPrefix}users/directory`);
        expect(req.request.params.get('take')).toBe(expected);
        req.flush(directoryPage);
        await resultPromise;
      });

      it('treats a negative skip as 0', async () => {
        const resultPromise = service.getUserDirectory(-3, 10);
        await tick();

        const req = httpMock.expectOne(r => r.url === `${apiPrefix}users/directory`);
        expect(req.request.params.get('skip')).toBe('0');
        req.flush(directoryPage);
        await resultPromise;
      });

      it.each([undefined, '', '   '])('omits an empty search (%p)', async (search) => {
        const resultPromise = service.getUserDirectory(0, 10, search);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/directory?skip=0&take=10`);
        expect(req.request.params.has('search')).toBe(false);
        req.flush(directoryPage);
        await resultPromise;
      });

      it('propagates a 404 from identity versions without the endpoint', async () => {
        const resultPromise = service.getUserDirectory(0, 10);
        await tick();

        httpMock.expectOne(`${apiPrefix}users/directory?skip=0&take=10`)
          .flush('Not Found', { status: 404, statusText: 'Not Found' });

        await expect(resultPromise).rejects.toMatchObject({ status: 404 });
      });

      it('returns null when config is not available', async () => {
        mockConfigService.config = null;
        expect(await service.getUserDirectory(0, 10)).toBeNull();
      });
    });

    describe('getUserDirectoryWithFallback (AB#5859)', () => {
      const legacyPage: PagedResultDto<UserDto> = {
        skip: 0,
        take: 10,
        totalCount: 3,
        list: [
          mockUser,
          { userId: 'user-2', name: 'jane', firstName: '', lastName: '', email: 'jane@example.com' },
          { userId: 'user-3', name: 'bob', firstName: ' Bob ', lastName: '', email: 'bob@example.com' }
        ]
      };

      it('returns the directory page when the endpoint exists', async () => {
        const page: PagedResultDto<UserDirectoryEntryDto> = {
          skip: 0, take: 10, totalCount: 1, list: [{ userId: 'user-1', displayName: 'John Doe' }]
        };
        const resultPromise = service.getUserDirectoryWithFallback(0, 10);
        await tick();

        httpMock.expectOne(`${apiPrefix}users/directory?skip=0&take=10`).flush(page);
        expect(await resultPromise).toEqual(page);
      });

      it('falls back to users/getPaged on 404, maps display names and remembers the capability per tenant', async () => {
        const first = service.getUserDirectoryWithFallback(0, 10);
        await tick();
        httpMock.expectOne(`${apiPrefix}users/directory?skip=0&take=10`)
          .flush('Not Found', { status: 404, statusText: 'Not Found' });
        await tick();
        await tick();
        httpMock.expectOne(`${apiPrefix}users/getPaged?skip=0&take=10`).flush(legacyPage);

        expect(await first).toEqual({
          skip: 0,
          take: 10,
          totalCount: 3,
          list: [
            { userId: 'user-1', displayName: 'John Doe' },
            { userId: 'user-2', displayName: 'jane' },
            { userId: 'user-3', displayName: 'Bob' }
          ]
        });

        // Second call: no directory request any more, straight to getPaged.
        const second = service.getUserDirectoryWithFallback(0, 10, 'JA');
        await tick();
        await tick();
        httpMock.expectNone(r => r.url === `${apiPrefix}users/directory`);
        httpMock.expectOne(`${apiPrefix}users/getPaged?skip=0&take=10`).flush(legacyPage);

        const filtered = await second;
        expect(filtered?.list).toEqual([{ userId: 'user-2', displayName: 'jane' }]);
        expect(filtered?.totalCount).toBe(1);
      });

      it('propagates errors other than 404 without falling back', async () => {
        const resultPromise = service.getUserDirectoryWithFallback(0, 10);
        await tick();

        httpMock.expectOne(`${apiPrefix}users/directory?skip=0&take=10`)
          .flush('Forbidden', { status: 403, statusText: 'Forbidden' });

        await expect(resultPromise).rejects.toMatchObject({ status: 403 });
        httpMock.expectNone(r => r.url === `${apiPrefix}users/getPaged`);
      });

      it('returns null when config is not available', async () => {
        mockConfigService.config = null;
        expect(await service.getUserDirectoryWithFallback(0, 10)).toBeNull();
      });
    });

    describe('getUserDetails', () => {
      it('should return user details', async () => {
        const resultPromise = service.getUserDetails('john.doe');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe`);
        expect(req.request.method).toBe('GET');
        req.flush(mockUser);

        const result = await resultPromise;
        expect(result).toEqual(mockUser);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getUserDetails('john.doe');
        expect(result).toBeNull();
      });
    });

    describe('createUser', () => {
      it('should create user', async () => {
        const resultPromise = service.createUser(mockUser);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(mockUser);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.createUser(mockUser);
      });
    });

    describe('updateUser', () => {
      it('should update user', async () => {
        const updatedUser = { ...mockUser, firstName: 'Jane' };
        const resultPromise = service.updateUser('john.doe', updatedUser);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(updatedUser);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.updateUser('john.doe', mockUser);
      });
    });

    describe('deleteUser', () => {
      it('should delete user', async () => {
        const resultPromise = service.deleteUser('john.doe');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.deleteUser('john.doe');
      });
    });

    describe('getUserRoles', () => {
      it('should return user roles', async () => {
        const mockRoles: RoleDto[] = [mockRole];
        const resultPromise = service.getUserRoles('john.doe');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe/roles`);
        expect(req.request.method).toBe('GET');
        req.flush(mockRoles);

        const result = await resultPromise;
        expect(result).toEqual(mockRoles);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getUserRoles('john.doe');
        expect(result).toBeNull();
      });
    });

    describe('getUserDirectRoles', () => {
      it('should return user direct roles', async () => {
        const mockRoles: RoleDto[] = [mockRole];
        const resultPromise = service.getUserDirectRoles('john.doe');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe/directRoles`);
        expect(req.request.method).toBe('GET');
        req.flush(mockRoles);

        const result = await resultPromise;
        expect(result).toEqual(mockRoles);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getUserDirectRoles('john.doe');
        expect(result).toBeNull();
      });
    });

    describe('updateUserRoles', () => {
      it('should update user roles', async () => {
        const roles: RoleDto[] = [mockRole, { id: 'role-2', name: 'User' }];
        const resultPromise = service.updateUserRoles('john.doe', roles);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe/roles`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(['role-1', 'role-2']);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.updateUserRoles('john.doe', [mockRole]);
      });
    });

    describe('addUserToRole', () => {
      it('should add user to role', async () => {
        const resultPromise = service.addUserToRole('john.doe', 'Admin');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe/roles/Admin`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toBeNull();
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.addUserToRole('john.doe', 'Admin');
      });
    });

    describe('removeRoleFromUser', () => {
      it('should remove role from user', async () => {
        const resultPromise = service.removeRoleFromUser('john.doe', 'Admin');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/john.doe/roles/Admin`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.removeRoleFromUser('john.doe', 'Admin');
      });
    });

    describe('resetPassword', () => {
      it('should reset password', async () => {
        const resultPromise = service.resetPassword('john.doe', 'newPassword123');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}users/ResetPassword?userName=john.doe&password=newPassword123`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toBeNull();
        req.flush({ success: true });

        const result = await resultPromise;
        expect(result).toEqual({ success: true });
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.resetPassword('john.doe', 'newPassword123');
        expect(result).toBeNull();
      });
    });
  });

  describe('Client Management', () => {
    describe('getClients', () => {
      it('should return paged clients', async () => {
        const mockResponse: PagedResultDto<ClientDto> = {
          skip: 0,
          take: 10,
          totalCount: 1,
          list: [mockClient]
        };

        const resultPromise = service.getClients(0, 10);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients/getPaged?skip=0&take=10`);
        expect(req.request.method).toBe('GET');
        req.flush(mockResponse);

        const result = await resultPromise;
        expect(result).toEqual(mockResponse);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getClients(0, 10);
        expect(result).toBeNull();
      });
    });

    describe('getClientDetails', () => {
      it('should return client details', async () => {
        const resultPromise = service.getClientDetails('client-1');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients/client-1`);
        expect(req.request.method).toBe('GET');
        req.flush(mockClient);

        const result = await resultPromise;
        expect(result).toEqual(mockClient);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getClientDetails('client-1');
        expect(result).toBeNull();
      });
    });

    describe('createClient', () => {
      it('should create client', async () => {
        const resultPromise = service.createClient(mockClient);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(mockClient);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.createClient(mockClient);
      });
    });

    describe('updateClient', () => {
      it('should update client', async () => {
        const updatedClient = { ...mockClient, clientName: 'Updated Client' };
        const resultPromise = service.updateClient('client-1', updatedClient);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients/client-1`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(updatedClient);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.updateClient('client-1', mockClient);
      });
    });

    describe('deleteClient', () => {
      it('should delete client', async () => {
        const resultPromise = service.deleteClient('client-1');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients/client-1`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.deleteClient('client-1');
      });
    });

    describe('cleanOverlayEntries', () => {
      it('should DELETE cleanOverlayEntries on the current tenant with no filter', async () => {
        const resultPromise = service.cleanOverlayEntries();
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}clients/cleanOverlayEntries`);
        expect(req.request.method).toBe('DELETE');
        expect(req.request.params.has('overlayName')).toBe(false);
        req.flush({ overlayName: null, clientsAffected: 2, totalEntriesRemoved: 5, clientResults: [] });

        const result = await resultPromise;
        expect(result?.totalEntriesRemoved).toBe(5);
      });

      it('should pass overlayName as a query parameter when provided', async () => {
        const resultPromise = service.cleanOverlayEntries('local-dev');
        await tick();

        const req = httpMock.expectOne((r) => r.url === `${apiPrefix}clients/cleanOverlayEntries` && r.params.get('overlayName') === 'local-dev');
        expect(req.request.method).toBe('DELETE');
        req.flush({ overlayName: 'local-dev', clientsAffected: 0, totalEntriesRemoved: 0, clientResults: [] });

        await resultPromise;
      });

      it('should target an explicit tenant, bypassing the route tenant', async () => {
        const resultPromise = service.cleanOverlayEntries(undefined, 'child-tenant');
        await tick();

        const req = httpMock.expectOne(`${baseUrl}child-tenant/v1/clients/cleanOverlayEntries`);
        expect(req.request.method).toBe('DELETE');
        req.flush({ overlayName: null, clientsAffected: 1, totalEntriesRemoved: 3, clientResults: [] });

        const result = await resultPromise;
        expect(result?.clientsAffected).toBe(1);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.cleanOverlayEntries(undefined, 'child-tenant');
        expect(result).toBeNull();
      });
    });
  });

  describe('Role Management', () => {
    describe('getRoles', () => {
      it('should return paged roles', async () => {
        const mockResponse: PagedResultDto<RoleDto> = {
          skip: 0,
          take: 10,
          totalCount: 1,
          list: [mockRole]
        };

        const resultPromise = service.getRoles(0, 10);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}roles/getPaged?skip=0&take=10`);
        expect(req.request.method).toBe('GET');
        req.flush(mockResponse);

        const result = await resultPromise;
        expect(result).toEqual(mockResponse);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getRoles(0, 10);
        expect(result).toBeNull();
      });
    });

    describe('getRoleDetails', () => {
      it('should return role details', async () => {
        const resultPromise = service.getRoleDetails('Admin');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}roles/names/Admin`);
        expect(req.request.method).toBe('GET');
        req.flush(mockRole);

        const result = await resultPromise;
        expect(result).toEqual(mockRole);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.getRoleDetails('Admin');
        expect(result).toBeNull();
      });
    });

    describe('createRole', () => {
      it('should create role', async () => {
        const resultPromise = service.createRole(mockRole);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}roles`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(mockRole);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.createRole(mockRole);
      });
    });

    describe('updateRole', () => {
      it('should update role', async () => {
        const updatedRole = { ...mockRole, name: 'SuperAdmin' };
        const resultPromise = service.updateRole('Admin', updatedRole);
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}roles/Admin`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(updatedRole);
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.updateRole('Admin', mockRole);
      });
    });

    describe('deleteRole', () => {
      it('should delete role', async () => {
        const resultPromise = service.deleteRole('Admin');
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}roles/Admin`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);

        await resultPromise;
      });

      it('should not make request when config is not available', async () => {
        mockConfigService.config = null;
        await service.deleteRole('Admin');
      });
    });
  });

  describe('Utility Methods', () => {
    describe('userDiagnostics', () => {
      it('should return diagnostics', async () => {
        const mockDiagnostics: DiagnosticsModel = { name: 'TestUser', claims: [] };
        const resultPromise = service.userDiagnostics();
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}Diagnostics`);
        expect(req.request.method).toBe('GET');
        req.flush(mockDiagnostics);

        const result = await resultPromise;
        expect(result).toEqual(mockDiagnostics);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.userDiagnostics();
        expect(result).toBeNull();
      });
    });

    describe('generatePassword', () => {
      it('should generate password', async () => {
        const mockPassword: GeneratedPasswordDto = { value: 'GeneratedP@ss123' };
        const resultPromise = service.generatePassword();
        await tick();

        const req = httpMock.expectOne(`${apiPrefix}tools/generatePassword`);
        expect(req.request.method).toBe('GET');
        req.flush(mockPassword);

        const result = await resultPromise;
        expect(result).toEqual(mockPassword);
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null;
        const result = await service.generatePassword();
        expect(result).toBeNull();
      });
    });
  });

  describe('Tenant-Aware Routing', () => {
    it('should use tenant ID from provider when available', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          IdentityService,
          { provide: CONFIGURATION_SERVICE, useValue: mockConfigService },
          { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve('meshtest') }
        ]
      });

      const tenantService = TestBed.inject(IdentityService);
      const tenantHttpMock = TestBed.inject(HttpTestingController);

      const resultPromise = tenantService.getUsers(0, 10);
      await tick();

      const req = tenantHttpMock.expectOne(`${baseUrl}meshtest/v1/users/getPaged?skip=0&take=10`);
      expect(req.request.method).toBe('GET');
      req.flush({ skip: 0, take: 10, totalCount: 0, list: [] });

      await resultPromise;
      tenantHttpMock.verify();
    });

    it('should fall back to octosystem when provider returns null', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          IdentityService,
          { provide: CONFIGURATION_SERVICE, useValue: mockConfigService },
          { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve(null) }
        ]
      });

      const tenantService = TestBed.inject(IdentityService);
      const tenantHttpMock = TestBed.inject(HttpTestingController);

      const resultPromise = tenantService.getUsers(0, 10);
      await tick();

      const req = tenantHttpMock.expectOne(`${apiPrefix}users/getPaged?skip=0&take=10`);
      expect(req.request.method).toBe('GET');
      req.flush({ skip: 0, take: 10, totalCount: 0, list: [] });

      await resultPromise;
      tenantHttpMock.verify();
    });
  });

  describe('admin provisioning source users & roles', () => {
    it('should search provisioning source users via the system tenant', async () => {
      const resultPromise = service.getProvisioningSourceUsers('meshmakers', 'ger');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}adminProvisioning/meshmakers/sourceUsers?take=20&search=ger`);
      expect(req.request.method).toBe('GET');
      req.flush([
        { sourceTenantId: 'octosystem', userId: 'u1', userName: 'gerald@x', email: 'gerald@x' }
      ]);

      const result = await resultPromise;
      expect(result?.length).toBe(1);
      expect(result?.[0].sourceTenantId).toBe('octosystem');
      httpMock.verify();
    });

    it('should omit the search param when no term is given', async () => {
      const resultPromise = service.getProvisioningSourceUsers('meshmakers');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}adminProvisioning/meshmakers/sourceUsers?take=20`);
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await resultPromise;
      httpMock.verify();
    });

    it('should fetch provisioning roles via the system tenant', async () => {
      const resultPromise = service.getProvisioningRoles('meshmakers');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}adminProvisioning/meshmakers/roles`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'role-1', name: 'DashboardViewer' }]);

      const result = await resultPromise;
      expect(result?.[0].name).toBe('DashboardViewer');
      httpMock.verify();
    });

    it('should fetch provisioning groups via the system tenant', async () => {
      const resultPromise = service.getProvisioningGroups('meshmakers');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}adminProvisioning/meshmakers/groups`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'grp-1', name: 'Viewers', description: 'read only' }]);

      const result = await resultPromise;
      expect(result?.[0].name).toBe('Viewers');
      httpMock.verify();
    });

    it('should create a group-based provisioning via withGroups', async () => {
      const resultPromise = service.createAdminProvisioningWithGroups('meshmakers', {
        sourceTenantId: 'octosystem', sourceUserId: 'u1', sourceUserName: 'gerald@x', groupIds: ['grp-1']
      });
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}adminProvisioning/meshmakers/withGroups`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.groupIds).toEqual(['grp-1']);
      req.flush({ sourceTenantId: 'octosystem', sourceUserId: 'u1', sourceUserName: 'gerald@x', roleIds: [], groupNames: ['Viewers'] });

      const result = await resultPromise;
      expect(result?.groupNames).toEqual(['Viewers']);
      httpMock.verify();
    });
  });

  describe('Data Permission Management', () => {
    const mockPermission: DataPermissionDto = {
      id: 'aa0000000000000000000320',
      permissionId: 'accounting.documents',
      description: 'Docs access',
      grantedRoleNames: ['AccountingManagement'],
      policies: [{
        id: 'aa0000000000000000000322',
        targetCkTypeIds: ['Meshmakers.Accounting/UploadedDocument'],
        actions: ['Read', 'Write'],
        scope: 'OwnedOnly',
        enforcementMode: 'AuditOnly'
      }]
    };

    it('should return all data permissions', async () => {
      const resultPromise = service.getDataPermissions();
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions`);
      expect(req.request.method).toBe('GET');
      req.flush([mockPermission]);

      const result = await resultPromise;
      expect(result).toEqual([mockPermission]);
    });

    it('should create a data permission', async () => {
      const resultPromise = service.createDataPermission(mockPermission);
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockPermission);
      req.flush(null);

      await resultPromise;
    });

    it('should delete a data permission', async () => {
      const resultPromise = service.deleteDataPermission('accounting.documents');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/accounting.documents`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await resultPromise;
    });

    it('should create a data policy and return its rtId', async () => {
      const resultPromise = service.createDataPolicy('accounting.documents', mockPermission.policies[0]);
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/accounting.documents/policies`);
      expect(req.request.method).toBe('POST');
      req.flush('aa0000000000000000000322');

      const result = await resultPromise;
      expect(result).toBe('aa0000000000000000000322');
    });

    it('should delete a data policy', async () => {
      const resultPromise = service.deleteDataPolicy('aa0000000000000000000322');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/policies/aa0000000000000000000322`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await resultPromise;
    });

    it('should set the enforcement mode as a JSON string body', async () => {
      const resultPromise = service.setDataPolicyEnforcementMode('aa0000000000000000000322', 'Enforce');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/policies/aa0000000000000000000322/enforcementMode`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.body).toBe('"Enforce"');
      req.flush(null);

      await resultPromise;
    });

    it('should grant a data permission to a role', async () => {
      const resultPromise = service.grantDataPermissionToRole('accounting.documents', 'AccountingManagement');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/accounting.documents/roles/AccountingManagement`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await resultPromise;
    });

    it('should revoke a data permission from a role', async () => {
      const resultPromise = service.revokeDataPermissionFromRole('accounting.documents', 'AccountingManagement');
      await tick();

      const req = httpMock.expectOne(`${apiPrefix}dataPermissions/accounting.documents/roles/AccountingManagement`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await resultPromise;
    });
  });

});
