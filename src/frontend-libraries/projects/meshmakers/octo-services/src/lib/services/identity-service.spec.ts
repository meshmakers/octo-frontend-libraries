import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { IdentityService } from './identity-service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { TENANT_ID_PROVIDER } from './tenant-provider';
import { AddInConfiguration } from '../shared/addInConfiguration';
import { UserDto } from '../shared/userDto';
import { RoleDto } from '../shared/roleDto';
import { ClientDto } from '../shared/clientDto';
import { DiagnosticsModel } from '../shared/diagnosticsModel';
import { GeneratedPasswordDto } from '../shared/generatedPasswordDto';
import { PagedResultDto } from '@meshmakers/shared-services';

describe('IdentityService', () => {
  let service: IdentityService;
  let httpMock: HttpTestingController;
  let mockConfigService: { config: AddInConfiguration | null; loadConfigAsync: jasmine.Spy };

  const baseUrl = 'https://identity.example.com/';
  const apiPrefix = `${baseUrl}octosystem/v1/`;

  const mockConfig: AddInConfiguration = {
    assetServices: 'https://asset.example.com/',
    issuer: baseUrl,
    botServices: 'https://bot.example.com/',
    communicationServices: 'https://comm.example.com/',
    meshAdapterUrl: 'https://mesh.example.com/',
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
      loadConfigAsync: jasmine.createSpy('loadConfigAsync').and.returnValue(Promise.resolve())
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
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
        mockConfigService.config = null as any;
        const result = await service.getUsers(0, 10);
        expect(result).toBeNull();
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
        const result = await service.getUserRoles('john.doe');
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
        await service.removeRoleFromUser('john.doe', 'Admin');
      });
    });

    describe('resetPassword', () => {
      it('should reset password', async () => {
        const resultPromise = service.resetPassword('john.doe', 'newPassword123');
        await tick();

        const req = httpMock.expectOne(
          `${apiPrefix}users/ResetPassword?userName=john.doe&password=newPassword123`
        );
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toBeNull();
        req.flush({ success: true });

        const result = await resultPromise;
        expect(result).toEqual({ success: true });
      });

      it('should return null when config is not available', async () => {
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
        await service.deleteClient('client-1');
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
        mockConfigService.config = null as any;
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
          provideHttpClient(),
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
          provideHttpClient(),
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
});
