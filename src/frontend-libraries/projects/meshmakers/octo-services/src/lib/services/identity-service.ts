import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {DiagnosticsModel} from '../shared/diagnosticsModel';
import {UserDto} from '../shared/userDto';
import {RoleDto} from '../shared/roleDto';
import {PagedResultDto} from '@meshmakers/shared-services';
import {ClientDto} from '../shared/clientDto';
import {ClientMirrorBackfillResponseDto, ClientMirrorDto, ClientMirrorProvisionResponseDto} from '../shared/clientMirrorDto';
import {CleanOverlayEntriesResultDto} from '../shared/clientOverlayDto';
import {IdentityProviderDto, IdentityProvidersResult} from '../shared/identityProviderDto';
import {EmailDomainGroupRuleDto, EmailDomainGroupRulesResult} from '../shared/emailDomainGroupRuleDto';
import {GeneratedPasswordDto} from '../shared/generatedPasswordDto';
import {MergeUsersRequestDto} from '../shared/mergeUsersRequestDto';
import {CreateGroupDto, GroupDto, UpdateGroupDto} from '../shared/groupDto';
import {CreateExternalTenantUserMappingDto, ExternalTenantUserMappingDto} from '../shared/externalTenantUserMappingDto';
import {ProvisioningSourceUserDto} from '../shared/provisioningSourceUserDto';
import {CreateExternalTenantUserGroupMappingDto, ProvisioningGroupDto} from '../shared/provisioningGroupDto';
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
    return this.getApiBaseUrlForTenant(tenantId);
  }

  /**
   * Builds the identity API base URL for an explicit tenant, bypassing the ambient
   * {@link TENANT_ID_PROVIDER}. Used when an operation must target a tenant other than the
   * currently-routed one — e.g. cleaning overlay URIs on a child tenant before its backup.
   */
  private getApiBaseUrlForTenant(tenantId: string): string | null {
    if (!this.configurationService.config?.issuer) return null;
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
        this.httpClient.post<void>(baseUrl + 'users', userDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateUser(userName: string, userDto: UserDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `users/${userName}`, userDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteUser(userName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `users/${userName}`, {
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
        this.httpClient.put<void>(baseUrl + `users/${userName}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addUserToRole(userName: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `users/${userName}/roles/${roleName}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeRoleFromUser(userName: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `users/${userName}/roles/${roleName}`, {
          observe: 'response'
        })
      );
    }
  }

  // ----- Client role assignment (AB#4183) -----

  async getClientRoles(clientId: string): Promise<string[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<string[] | null>(baseUrl + `clients/${clientId}/roles`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateClientRoles(clientId: string, roleIds: string[]): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `clients/${clientId}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addClientToRole(clientId: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `clients/${clientId}/roles/${roleName}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeRoleFromClient(clientId: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `clients/${clientId}/roles/${roleName}`, {
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

  async resetPassword(userName: string, password: string): Promise<unknown> {
    const params = new HttpParams().set('userName', userName).set('password', password);

    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<unknown>(baseUrl + 'users/ResetPassword', null, {
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
        this.httpClient.post<void>(baseUrl + 'clients', clientDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateClient(clientId: string, clientDto: ClientDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.put<void>(baseUrl + `clients/${clientId}`, clientDto, {
        observe: 'response'
      }));
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(this.httpClient.delete<void>(baseUrl + `clients/${clientId}`, {
        observe: 'response'
      }));
    }
  }

  // ---- Multi-tenant client mirrors (Epic 3054 #4045) -----------------------

  /**
   * Lists the sub-tenants this `ClientCredentials` client has been
   * auto-provisioned into. Empty array when the client has no mirrors.
   */
  async getClientMirrors(clientId: string): Promise<ClientMirrorDto[]> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<ClientMirrorDto[]>(baseUrl + `clients/${clientId}/mirrors`, {
          observe: 'response'
        })
      );
      return response.body ?? [];
    }
    return [];
  }

  /**
   * Backfill: provisions a flagged client into every existing sub-tenant of
   * the calling tenant. Server returns `400` if the client is not flagged.
   */
  async provisionClientInExistingTenants(clientId: string): Promise<ClientMirrorBackfillResponseDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<ClientMirrorBackfillResponseDto>(
          baseUrl + `clients/${clientId}/mirrors/provisionInExistingTenants`,
          null,
          { observe: 'response' }
        )
      );
      return response.body;
    }
    return null;
  }

  /**
   * Manually provisions a flagged client into one specific sub-tenant.
   */
  async provisionClientInTenant(clientId: string, childTenantId: string): Promise<ClientMirrorProvisionResponseDto | null> {
    const params = new HttpParams().set('childTenantId', childTenantId);
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<ClientMirrorProvisionResponseDto>(
          baseUrl + `clients/${clientId}/mirrors/provisionInTenant`,
          null,
          { params, observe: 'response' }
        )
      );
      return response.body;
    }
    return null;
  }

  /**
   * Removes a single mirror (drops both the child-side client and the parent's
   * tracking row).
   */
  async unprovisionClientFromTenant(clientId: string, childTenantId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `clients/${clientId}/mirrors/${childTenantId}`, {
          observe: 'response'
        })
      );
    }
  }

  /**
   * Flips the `AutoProvisionInChildTenants` flag on a client without rewriting
   * the full client object. Flipping `false → true` does NOT auto-backfill —
   * use {@link provisionClientInExistingTenants} for that.
   */
  async setClientAutoProvisionInChildTenants(clientId: string, enabled: boolean): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.patch<void>(
          baseUrl + `clients/${clientId}/autoProvisionInChildTenants`,
          { enabled },
          { observe: 'response' }
        )
      );
    }
  }

  // ---- Client overlay URIs (AB#4209, deliverable 7) -----------------------

  /**
   * Strips overlay URI entries from every blueprint-managed client of a tenant. Without
   * {@link overlayName} every `overlay:*` source is removed; with it, only `overlay:<name>`.
   * `base` and `api` sourced URIs are always preserved. Destructive — the typical use is
   * producing a template-clean tenant dump; overlays can be re-applied afterwards via the
   * octo-tools `Apply-IdentityOverlay` cmdlet.
   *
   * `tenantId` targets a specific tenant explicitly (e.g. a child tenant being backed up),
   * bypassing the ambient route tenant. Omit it to use the current route tenant.
   */
  async cleanOverlayEntries(overlayName?: string, tenantId?: string): Promise<CleanOverlayEntriesResultDto | null> {
    const baseUrl = tenantId
      ? this.getApiBaseUrlForTenant(tenantId)
      : await this.getApiBaseUrl();
    if (!baseUrl) return null;

    let params = new HttpParams();
    if (overlayName) {
      params = params.set('overlayName', overlayName);
    }

    const response = await firstValueFrom(
      this.httpClient.delete<CleanOverlayEntriesResultDto>(baseUrl + 'clients/cleanOverlayEntries', {
        params,
        observe: 'response'
      })
    );
    return response.body;
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
        this.httpClient.post<void>(baseUrl + 'roles', roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateRole(roleName: string, roleDto: RoleDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `roles/${roleName}`, roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteRole(roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `roles/${roleName}`, {
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
        this.httpClient.put<void>(baseUrl + `identityproviders/${rtId}`, dto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteIdentityProvider(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `identityproviders/${rtId}`, {
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
        this.httpClient.put<void>(baseUrl + `emaildomaingrouprules/${rtId}`, dto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteEmailDomainGroupRule(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `emaildomaingrouprules/${rtId}`, {
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
        this.httpClient.delete<void>(baseUrl + `groups/${rtId}`, {
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
        this.httpClient.put<void>(baseUrl + `groups/${rtId}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addUserToGroup(rtId: string, userId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `groups/${rtId}/members/users/${userId}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeUserFromGroup(rtId: string, userId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `groups/${rtId}/members/users/${userId}`, {
          observe: 'response'
        })
      );
    }
  }

  async addClientToGroup(rtId: string, clientId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `groups/${rtId}/members/clients/${clientId}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeClientFromGroup(rtId: string, clientId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `groups/${rtId}/members/clients/${clientId}`, {
          observe: 'response'
        })
      );
    }
  }

  async addGroupToGroup(rtId: string, childGroupId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `groups/${rtId}/members/groups/${childGroupId}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeGroupFromGroup(rtId: string, childGroupId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `groups/${rtId}/members/groups/${childGroupId}`, {
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
        this.httpClient.delete<void>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/${encodeURIComponent(mappingRtId)}`, {
            observe: 'response'
          })
      );
    }
  }

  /**
   * Searches provisionable users from the target tenant's ancestor (parent) tenants. Powers the
   * cross-tenant user picker on the Admin Provisioning page. Matches on username or email; an empty
   * search returns the first users. Cross-tenant shadow users (xt_) are excluded server-side.
   */
  async getProvisioningSourceUsers(
    targetTenantId: string, search?: string, take = 20): Promise<ProvisioningSourceUserDto[] | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      let params = new HttpParams().set('take', take.toString());
      if (search) {
        params = params.set('search', search);
      }
      const response = await firstValueFrom(
        this.httpClient.get<ProvisioningSourceUserDto[]>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/sourceUsers`, {
            params,
            observe: 'response'
          })
      );
      return response.body;
    }
    return null;
  }

  /**
   * Returns the roles defined in the target tenant, offered as assignable options when creating a
   * cross-tenant user mapping.
   */
  async getProvisioningRoles(targetTenantId: string): Promise<RoleDto[] | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto[]>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/roles`, {
            observe: 'response'
          })
      );
      return response.body;
    }
    return null;
  }

  /**
   * Returns the groups defined in the target tenant, offered as assignable options when creating a
   * cross-tenant user mapping. Assigning a group makes the mapping a GroupMember (group-based role
   * inheritance) — the idiomatic grant, consistent with provisionCurrentUser.
   */
  async getProvisioningGroups(targetTenantId: string): Promise<ProvisioningGroupDto[] | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<ProvisioningGroupDto[]>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/groups`, {
            observe: 'response'
          })
      );
      return response.body;
    }
    return null;
  }

  /**
   * Creates a cross-tenant user mapping and makes it a member of the given target-tenant groups, so
   * the user inherits the groups' roles.
   */
  async createAdminProvisioningWithGroups(
    targetTenantId: string, dto: CreateExternalTenantUserGroupMappingDto): Promise<ExternalTenantUserMappingDto | null> {
    const baseUrl = this.getSystemTenantBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post<ExternalTenantUserMappingDto>(
          baseUrl + `adminProvisioning/${encodeURIComponent(targetTenantId)}/withGroups`, dto, {
            observe: 'response'
          })
      );
      return response.body;
    }
    return null;
  }
}
