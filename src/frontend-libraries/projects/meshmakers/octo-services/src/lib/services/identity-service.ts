import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {DiagnosticsModel} from '../shared/diagnosticsModel';
import {UserDto} from '../shared/userDto';
import {RoleDto} from '../shared/roleDto';
import {PagedResultDto} from '@meshmakers/shared-services';
import {ClientDto} from '../shared/clientDto';
import {IdentityProviderDto, IdentityProvidersResult} from '../shared/identityProviderDto';
import {EmailDomainGroupRuleDto, EmailDomainGroupRulesResult} from '../shared/emailDomainGroupRuleDto';
import {GeneratedPasswordDto} from '../shared/generatedPasswordDto';
import {MergeUsersRequestDto} from '../shared/mergeUsersRequestDto';
import {CreateGroupDto, GroupDto, UpdateGroupDto} from '../shared/groupDto';
import {CreateExternalTenantUserMappingDto, ExternalTenantUserMappingDto} from '../shared/externalTenantUserMappingDto';
import {TENANT_ID_PROVIDER, TenantIdProvider} from './tenant-provider';

@Injectable({
  providedIn: 'root'
})
export class IdentityService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly tenantIdProvider: TenantIdProvider | null = inject(TENANT_ID_PROVIDER, {optional: true});

  private async getApiBaseUrl(): Promise<string | null> {
    if (!this.configurationService.config?.issuer) return null;
    let tenantId = 'octosystem';
    if (this.tenantIdProvider) {
      tenantId = await this.tenantIdProvider() ?? 'octosystem';
    }
    return `${this.configurationService.config.issuer}${tenantId}/v1/`;
  }

  async userDiagnostics(): Promise<DiagnosticsModel | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      return await firstValueFrom(this.httpClient.get<DiagnosticsModel>(
        baseUrl + 'Diagnostics'
      ));
    }
    return null;
  }

  async getUsers(skip: number, take: number): Promise<PagedResultDto<UserDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<UserDto> | null>(baseUrl + 'users/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getUserDetails(userName: string): Promise<UserDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<UserDto | null>(baseUrl + `users/${userName}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createUser(userDto: UserDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post<any>(baseUrl + 'users', userDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateUser(userName: string, userDto: UserDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `users/${userName}`, userDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteUser(userName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `users/${userName}`, {
          observe: 'response'
        })
      );
    }
  }

  async getUserRoles(userName: string): Promise<RoleDto[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto[] | null>(baseUrl + `users/${userName}/roles`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getUserDirectRoles(userName: string): Promise<RoleDto[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto[] | null>(baseUrl + `users/${userName}/directRoles`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateUserRoles(userName: string, roles: RoleDto[]): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const roleIds = roles.map((role) => role.id);

      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `users/${userName}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addUserToRole(userName: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `users/${userName}/roles/${roleName}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeRoleFromUser(userName: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `users/${userName}/roles/${roleName}`, {
          observe: 'response'
        })
      );
    }
  }

  async mergeUsers(targetUserName: string, sourceUserName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const request: MergeUsersRequestDto = { sourceUserName };
      await firstValueFrom(
        this.httpClient.post<void>(
          baseUrl + `users/${encodeURIComponent(targetUserName)}/merge`,
          request,
          { observe: 'response' }
        )
      );
    }
  }

  async resetPassword(userName: string, password: string): Promise<any> {
    const params = new HttpParams().set('userName', userName).set('password', password);

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<any>(baseUrl + 'users/ResetPassword', null, {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getClients(skip: number, take: number): Promise<PagedResultDto<ClientDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<ClientDto> | null>(baseUrl + 'clients/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getClientDetails(clientId: string): Promise<ClientDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<ClientDto>(baseUrl + `clients/${clientId}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createClient(clientDto: ClientDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post<any>(baseUrl + 'clients', clientDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateClient(clientId: string, clientDto: ClientDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.put<any>(baseUrl + `clients/${clientId}`, clientDto, {
        observe: 'response'
      }));
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.delete<any>(baseUrl + `clients/${clientId}`, {
        observe: 'response'
      }));
    }
  }

  async generatePassword(): Promise<GeneratedPasswordDto | null> {
    const params = new HttpParams();

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const r = await firstValueFrom(this.httpClient
        .get<GeneratedPasswordDto>(baseUrl + 'tools/generatePassword', {
          params,
          observe: 'response'
        }));

      return r.body;
    }
    return null;
  }

  // ========================================
  // Role Management
  // ========================================

  async getRoles(skip: number, take: number): Promise<PagedResultDto<RoleDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<RoleDto> | null>(baseUrl + 'roles/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getRoleDetails(roleName: string): Promise<RoleDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto | null>(baseUrl + `roles/names/${roleName}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createRole(roleDto: RoleDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post<any>(baseUrl + 'roles', roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateRole(roleName: string, roleDto: RoleDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `roles/${roleName}`, roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteRole(roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `roles/${roleName}`, {
          observe: 'response'
        })
      );
    }
  }

  // ========================================
  // Identity Provider Management
  // ========================================

  async getIdentityProviders(): Promise<IdentityProvidersResult | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<IdentityProvidersResult | null>(baseUrl + 'identityproviders', {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getIdentityProviderDetails(rtId: string): Promise<IdentityProvidersResult | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<IdentityProvidersResult | null>(baseUrl + `identityproviders/${rtId}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createIdentityProvider(dto: IdentityProviderDto): Promise<IdentityProviderDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<IdentityProviderDto>(baseUrl + 'identityproviders', dto, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateIdentityProvider(rtId: string, dto: IdentityProviderDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `identityproviders/${rtId}`, dto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteIdentityProvider(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `identityproviders/${rtId}`, {
          observe: 'response'
        })
      );
    }
  }

  // ========================================
  // Email Domain Group Rules
  // ========================================

  async getEmailDomainGroupRules(): Promise<EmailDomainGroupRulesResult | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<EmailDomainGroupRulesResult | null>(baseUrl + 'emaildomaingrouprules', {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getEmailDomainGroupRuleDetails(rtId: string): Promise<EmailDomainGroupRuleDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<EmailDomainGroupRuleDto | null>(baseUrl + `emaildomaingrouprules/${rtId}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createEmailDomainGroupRule(dto: EmailDomainGroupRuleDto): Promise<EmailDomainGroupRuleDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<EmailDomainGroupRuleDto>(baseUrl + 'emaildomaingrouprules', dto, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateEmailDomainGroupRule(rtId: string, dto: EmailDomainGroupRuleDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `emaildomaingrouprules/${rtId}`, dto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteEmailDomainGroupRule(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `emaildomaingrouprules/${rtId}`, {
          observe: 'response'
        })
      );
    }
  }

  // ========================================
  // Group Management
  // ========================================

  async getGroups(): Promise<GroupDto[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<GroupDto[] | null>(baseUrl + 'groups', {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getGroupsPaged(skip: number, take: number): Promise<GroupDto[] | null> {
    const params = new HttpParams().set('skip', skip.toString()).set('take', take.toString());
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<GroupDto[] | null>(baseUrl + 'groups/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getGroupById(rtId: string): Promise<GroupDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<GroupDto | null>(baseUrl + `groups/${rtId}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getGroupByName(groupName: string): Promise<GroupDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<GroupDto | null>(baseUrl + `groups/names/${encodeURIComponent(groupName)}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createGroup(dto: CreateGroupDto): Promise<GroupDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<GroupDto>(baseUrl + 'groups', dto, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateGroup(rtId: string, dto: UpdateGroupDto): Promise<GroupDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.put<GroupDto>(baseUrl + `groups/${rtId}`, dto, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async deleteGroup(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `groups/${rtId}`, {
          observe: 'response'
        })
      );
    }
  }

  async getGroupRoles(rtId: string): Promise<string[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<string[] | null>(baseUrl + `groups/${rtId}/roles`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateGroupRoles(rtId: string, roleIds: string[]): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `groups/${rtId}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addUserToGroup(rtId: string, userId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `groups/${rtId}/members/users/${userId}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeUserFromGroup(rtId: string, userId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `groups/${rtId}/members/users/${userId}`, {
          observe: 'response'
        })
      );
    }
  }

  async addGroupToGroup(rtId: string, childGroupId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<any>(baseUrl + `groups/${rtId}/members/groups/${childGroupId}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeGroupFromGroup(rtId: string, childGroupId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(baseUrl + `groups/${rtId}/members/groups/${childGroupId}`, {
          observe: 'response'
        })
      );
    }
  }

  // ========================================
  // Admin Provisioning (via system tenant)
  // ========================================

  private getSystemTenantBaseUrl(): string | null {
    if (!this.configurationService.config?.issuer) return null;
    return `${this.configurationService.config.issuer}octosystem/v1/`;
  }

  async getAdminProvisionedUsers(targetTenantId: string): Promise<ExternalTenantUserMappingDto[] | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<ExternalTenantUserMappingDto[]>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async provisionCurrentUser(targetTenantId: string): Promise<ExternalTenantUserMappingDto | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<ExternalTenantUserMappingDto>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/provisionCurrentUser`, null, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createAdminProvisioning(targetTenantId: string, dto: CreateExternalTenantUserMappingDto): Promise<ExternalTenantUserMappingDto | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<ExternalTenantUserMappingDto>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}`, dto, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async deleteAdminProvisioning(targetTenantId: string, mappingRtId: string): Promise<void> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<any>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/${encodeURIComponent(mappingRtId)}`, {
          observe: 'response'
        })
      );
    }
  }
}
