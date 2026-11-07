import { DataPermissionDto, DataPolicyDto } from '../shared/dataPermissionDto';
import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient, HttpContext, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {DiagnosticsModel} from '../shared/diagnosticsModel';
import {UserDto} from '../shared/userDto';
import {UserDirectoryEntryDto} from '../shared/userDirectoryEntryDto';
import {RoleDto} from '../shared/roleDto';
import {MM_CALLER_HANDLED_STATUSES, PagedResultDto} from '@meshmakers/shared-services';
import {ClientDto} from '../shared/clientDto';
import {ClientMirrorBackfillResponseDto, ClientMirrorDto, ClientMirrorProvisionResponseDto} from '../shared/clientMirrorDto';
import {CleanOverlayEntriesResultDto} from '../shared/clientOverlayDto';
import {IdentityProviderDto, IdentityProvidersResult} from '../shared/identityProviderDto';
import {EmailDomainGroupRuleDto, EmailDomainGroupRulesResult} from '../shared/emailDomainGroupRuleDto';
import {CreateEmailIdentifierBindingDto, EmailIdentifierBindingDto} from '../shared/emailIdentifierBindingDto';
import {GeneratedPasswordDto} from '../shared/generatedPasswordDto';
import {MergeUsersRequestDto} from '../shared/mergeUsersRequestDto';
import {ResetUserPasswordRequestDto} from '../shared/resetUserPasswordRequestDto';
import {CreateGroupDto, GroupDto, UpdateGroupDto} from '../shared/groupDto';
import {
  CreateExternalTenantUserMappingDto,
  ExternalTenantUserMappingDto,
  SourceUserLookupRequestDto,
  SourceUserLookupResultDto
} from '../shared/externalTenantUserMappingDto';
import {
  CrossTenantGrantProblemCodes,
  CrossTenantGrantRoute,
  isHttpErrorLike,
  problemCodeOf,
  toCrossTenantGrantError
} from '../shared/crossTenantGrantError';
import {
  CROSS_TENANT_GRANT_PERMISSIONS_TYPED_STATUSES,
  CrossTenantGrantPermissionsDto,
  toCrossTenantGrantPermissionsError
} from '../shared/crossTenantGrantPermissionsDto';
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

  /**
   * Reads one page of the slim user directory of the current tenant
   * (`GET {tenant}/v1/users/directory?skip=&take=&search=`, AB#5859): id and display name only.
   *
   * Unlike {@link getUsers} (`users/getPaged`, which requires the `UserManagement` role once the
   * identity service enforces tenant roles), the directory is available to any signed-in user of
   * the own tenant — the token's tenant must equal the route tenant. It is meant for pickers
   * (group members, assignees, ...) that need nothing but a user id and a name.
   *
   * Availability: introduced on the identity branch `feat/gerald/identity-rest-role-authz`, not yet
   * released. Identity versions without the endpoint answer **404**; the error is propagated as
   * `HttpErrorResponse`. Use {@link getUserDirectoryWithFallback} to transparently fall back to
   * `users/getPaged` on such versions.
   *
   * @param skip Number of entries to skip (negative values are treated as 0).
   * @param take Page size; clamped to 1..500 (the server limit). Non-finite values use 100.
   * @param search Optional case-insensitive substring of the display name; omitted when empty.
   *   The server never matches user names or e-mail addresses.
   * @returns The page (sorted by display name, then id), or `null` when no identity URL is configured.
   */
  async getUserDirectory(skip: number, take: number, search?: string): Promise<PagedResultDto<UserDirectoryEntryDto> | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    return this.fetchUserDirectory(baseUrl, skip, take, search);
  }

  /**
   * Like {@link getUserDirectory}, but falls back to `users/getPaged` when the identity service does
   * not know the directory endpoint yet (404). The missing capability is remembered per tenant for
   * the lifetime of this (root) service, so the 404 is hit at most once per tenant and session.
   *
   * The fallback maps {@link UserDto} to {@link UserDirectoryEntryDto} with the server's display
   * name rule ("First Last", else the user name) and applies `search` to the returned page only —
   * it is a best-effort bridge for old identity versions, and it still needs `UserManagement`
   * wherever `getPaged` requires it. Errors other than the 404 (401, 403, 5xx, ...) are propagated.
   */
  async getUserDirectoryWithFallback(skip: number, take: number, search?: string): Promise<PagedResultDto<UserDirectoryEntryDto> | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }

    if (!this.tenantsWithoutUserDirectory.has(baseUrl)) {
      try {
        return await this.fetchUserDirectory(baseUrl, skip, take, search);
      } catch (error) {
        if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
          throw error;
        }
        this.tenantsWithoutUserDirectory.add(baseUrl);
      }
    }

    const page = await this.getUsers(Math.max(0, Math.trunc(skip) || 0), IdentityService.clampDirectoryTake(take));
    if (!page) {
      return null;
    }
    const term = search?.trim().toLowerCase() ?? '';
    const list = (page.list ?? [])
      .map(user => IdentityService.toUserDirectoryEntry(user))
      .filter(entry => !term || entry.displayName.toLowerCase().includes(term));
    return {
      skip: page.skip,
      take: page.take,
      totalCount: term ? list.length : page.totalCount,
      list
    };
  }

  /** Base URLs (= tenants) whose identity service answered 404 for `users/directory`. */
  private readonly tenantsWithoutUserDirectory = new Set<string>();

  private static readonly maxUserDirectoryPageSize = 500;

  private static clampDirectoryTake(take: number): number {
    if (!Number.isFinite(take)) {
      return 100;
    }
    return Math.min(IdentityService.maxUserDirectoryPageSize, Math.max(1, Math.trunc(take)));
  }

  private static toUserDirectoryEntry(user: UserDto): UserDirectoryEntryDto {
    const fullName = [user.firstName, user.lastName]
      .filter(n => !!n && n.trim().length > 0)
      .map(n => n.trim())
      .join(' ');
    return { userId: user.userId, displayName: fullName.length > 0 ? fullName : (user.name ?? '') };
  }

  private async fetchUserDirectory(baseUrl: string, skip: number, take: number, search?: string): Promise<PagedResultDto<UserDirectoryEntryDto> | null> {
    let params = new HttpParams()
      .set('skip', Math.max(0, Math.trunc(skip) || 0).toString())
      .set('take', IdentityService.clampDirectoryTake(take).toString());
    const term = search?.trim();
    if (term) {
      // HttpParams URL-encodes the value.
      params = params.set('search', term);
    }
    const response = await firstValueFrom(
      this.httpClient.get<PagedResultDto<UserDirectoryEntryDto> | null>(baseUrl + 'users/directory', {
        params,
        observe: 'response'
      })
    );
    return response.body;
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

  /**
   * Sets a new password for a user (administrator reset). User name and password travel only in the JSON body;
   * the identity service refuses the password as a URL query parameter (400).
   */
  async resetPassword(userName: string, password: string): Promise<unknown> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const request: ResetUserPasswordRequestDto = { userName, password };
      const response = await firstValueFrom(
        this.httpClient.post<unknown>(baseUrl + 'users/ResetPassword', request, {
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
  // E-mail Identifier Bindings (AB#5125)
  // Admin-managed e-mail→user verified whitelist for the tenant. A whitelisted address is only as
  // trusted per message as its DKIM/DMARC verdict (evaluated on ingest); a message without a valid,
  // aligned DKIM/DMARC pass never authorizes an elevated operation.
  // ========================================

  async getEmailIdentifierBindings(): Promise<EmailIdentifierBindingDto[]> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<EmailIdentifierBindingDto[] | null>(baseUrl + 'emailidentifierbindings', {
          observe: 'response'
        })
      );
      return response.body ?? [];
    }
    return [];
  }

  async createEmailIdentifierBinding(dto: CreateEmailIdentifierBindingDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post(baseUrl + 'emailidentifierbindings', dto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteEmailIdentifierBinding(email: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const params = new HttpParams().set('email', email);
      await firstValueFrom(
        this.httpClient.delete(baseUrl + 'emailidentifierbindings', {
          params,
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

  // ========================================
  // Cross-tenant grants in the current tenant (AB#8427)
  // Route: {issuer}{currentTenant}/v1/externalTenantUserMappings
  // Contract: octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md
  // Every 403 is typed and marked caller-handled (MM_CALLER_HANDLED_STATUSES): the global error
  // interceptor shows no toast for it, the page shows its own message per `kind`. Untyped errors are
  // rethrown with the interceptor's default reporting (see callerHandles403).
  // ========================================

  /**
   * Finds exactly one user of a source tenant (a registry ancestor of the current tenant, or a tenant that
   * permits it) by exact user name or exact e-mail — `POST .../externalTenantUserMappings/sourceUserLookup`
   * (AB#8341). POST, so the identifier never appears in a URL; this service never logs it.
   *
   * @returns The user (no e-mail address), `null` for `404 SourceUserNotFound` — the one answer of every
   *   negative case — and `null` when no identity URL is configured.
   * @throws CrossTenantGrantError `SourceUserLookupRateLimited` (with `retryAfterSeconds` from the body),
   *   `NotAvailable` (404 without problem code: identity service without AB#8341), `Forbidden`.
   * @throws HttpErrorResponse for every other answer (401, validation 400, 5xx).
   */
  async lookupSourceUser(request: SourceUserLookupRequestDto): Promise<SourceUserLookupResultDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    const body: SourceUserLookupRequestDto = {sourceTenantId: request.sourceTenantId, identifier: request.identifier};
    try {
      const response = await firstValueFrom(
        this.httpClient.post<SourceUserLookupResultDto>(
          baseUrl + 'externalTenantUserMappings/sourceUserLookup', body,
          {observe: 'response', context: IdentityService.callerHandles403()}));
      return response.body;
    } catch (error) {
      if (isHttpErrorLike(error) && error.status === 404
        && problemCodeOf(error) === CrossTenantGrantProblemCodes.SourceUserNotFound) {
        return null;
      }
      throw IdentityService.crossTenantGrantErrorOr(error, 'lookup');
    }
  }

  /**
   * Grants a user of a source tenant access to the current tenant — `POST .../externalTenantUserMappings`.
   * `groupIds` (groups of the current tenant, AB#8343) is sent only when set; `null`/`undefined` leaves the
   * body as before. Take `sourceUserId`/`sourceUserName` from {@link lookupSourceUser}.
   *
   * @returns The stored mapping (`groupNames` filled), or `null` when no identity URL is configured.
   * @throws CrossTenantGrantError `SourceTenantNotPermitted`, `UnknownGroup` (with `unknownGroupIds`),
   *   `ExternalTenantUserMappingAlreadyExists` (with `existingMappingId`), `RoleChangeRefused`, `Forbidden`.
   * @throws HttpErrorResponse for every other answer.
   */
  async createExternalTenantUserMapping(dto: CreateExternalTenantUserMappingDto): Promise<ExternalTenantUserMappingDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    const {groupIds, ...rest} = dto;
    const body: CreateExternalTenantUserMappingDto = groupIds == null ? rest : {...rest, groupIds};
    try {
      const response = await firstValueFrom(
        this.httpClient.post<ExternalTenantUserMappingDto>(
          baseUrl + 'externalTenantUserMappings', body,
          {observe: 'response', context: IdentityService.callerHandles403()}));
      return response.body;
    } catch (error) {
      throw IdentityService.crossTenantGrantErrorOr(error, 'mapping');
    }
  }

  /**
   * Lists the cross-tenant users granted access to the current tenant (source tenant, user, roles, groups)
   * — `GET .../externalTenantUserMappings`. `sourceTenantId` filters by source tenant (the server then
   * ignores `skip`/`take`).
   *
   * @returns The mappings, or `null` when no identity URL is configured.
   * @throws CrossTenantGrantError `Forbidden`; HttpErrorResponse for every other error.
   */
  async getExternalTenantUserMappings(
    options?: {skip?: number; take?: number; sourceTenantId?: string}): Promise<ExternalTenantUserMappingDto[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    let params = new HttpParams();
    if (options?.skip != null) {
      params = params.set('skip', options.skip.toString());
    }
    if (options?.take != null) {
      params = params.set('take', options.take.toString());
    }
    if (options?.sourceTenantId) {
      params = params.set('sourceTenantId', options.sourceTenantId);
    }
    try {
      const response = await firstValueFrom(
        this.httpClient.get<ExternalTenantUserMappingDto[]>(
          baseUrl + 'externalTenantUserMappings',
          {params, observe: 'response', context: IdentityService.callerHandles403()}));
      return response.body;
    } catch (error) {
      throw IdentityService.crossTenantGrantErrorOr(error, 'mapping');
    }
  }

  /**
   * Removes a cross-tenant grant of the current tenant — `DELETE .../externalTenantUserMappings/{rtId}`.
   * The next token exchange of that user into this tenant is refused (AB#8344).
   *
   * @throws CrossTenantGrantError `RoleChangeRefused` (e.g. `409 last-administrator`), `Forbidden`.
   * @throws HttpErrorResponse for every other answer (404 for an unknown mapping id, 401, 5xx).
   */
  async deleteExternalTenantUserMapping(rtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return;
    }
    try {
      await firstValueFrom(
        this.httpClient.delete<void>(
          baseUrl + `externalTenantUserMappings/${encodeURIComponent(rtId)}`,
          {observe: 'response', context: IdentityService.callerHandles403()}));
    } catch (error) {
      throw IdentityService.crossTenantGrantErrorOr(error, 'mapping');
    }
  }

  /**
   * Every `403` of these routes becomes a CrossTenantGrantError (`SourceTenantNotPermitted`,
   * `RoleChangeRefused` or `Forbidden`), so the global interceptor's 403 toast is suppressed and the page
   * shows its own message. Other statuses keep the interceptor's default: the problem-shaped 400/404/409/429
   * answers are not toasted by it anyway, and an untyped error is reported exactly as for any request —
   * callers use `MmHttpErrorInterceptor.reportsToUser(error)` to decide whether to show a generic message.
   */
  private static callerHandles403(): HttpContext {
    return new HttpContext().set(MM_CALLER_HANDLED_STATUSES, [403]);
  }

  /** The typed error for documented answers, otherwise the original error unchanged. */
  private static crossTenantGrantErrorOr(error: unknown, route: CrossTenantGrantRoute): unknown {
    return toCrossTenantGrantError(error, route) ?? error;
  }

  // ========================================
  // Cross-tenant grant permissions of the current tenant as a source (AB#8430)
  // Route: {issuer}{currentTenant}/v1/crossTenantGrantPermissions (AB#8345)
  // Contract: octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md §6
  // Typed statuses (400/403/404/412) are caller-handled: no global toast, the page shows its own state.
  // ========================================

  /**
   * Reads the target tenants the current tenant permits to look up its users by exact user name or e-mail
   * and grant them access — `GET .../crossTenantGrantPermissions`. Empty = nobody (the default).
   *
   * @returns The list, or `null` when no identity URL is configured.
   * @throws CrossTenantGrantPermissionsError `Forbidden` (no administrator of this tenant), `NotAvailable`
   *   (identity service without AB#8345).
   * @throws HttpErrorResponse for every other answer (401, 5xx).
   */
  async getCrossTenantGrantPermissions(): Promise<CrossTenantGrantPermissionsDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    try {
      const response = await firstValueFrom(
        this.httpClient.get<CrossTenantGrantPermissionsDto>(
          baseUrl + 'crossTenantGrantPermissions',
          {observe: 'response', context: IdentityService.callerHandlesPermissionErrors()}));
      return {targetTenantIds: response.body?.targetTenantIds ?? []};
    } catch (error) {
      throw toCrossTenantGrantPermissionsError(error) ?? error;
    }
  }

  /**
   * Replaces the whole list of target tenants the current tenant permits — `PUT .../crossTenantGrantPermissions`.
   * `[]` permits nobody. A removed tenant's lookups and new grants stop with its next request; its existing grants
   * are refused at the user's next tenant switch.
   *
   * Concurrency: the server does not check a version yet. When AB#8432 adds `ETag`/`If-Match`, this method gets an
   * optional second parameter for the version and a `412` becomes `CrossTenantGrantPermissionsError` `Conflict`
   * (already mapped) — existing callers stay unchanged.
   *
   * @returns The stored list (trimmed, lower-cased, de-duplicated by the server), or `null` when no identity URL is
   *   configured.
   * @throws CrossTenantGrantPermissionsError `Invalid` (with the server's `validationErrors`: own tenant, invalid
   *   characters, too long, too many), `Forbidden`, `NotAvailable`.
   * @throws HttpErrorResponse for every other answer (401, 5xx).
   */
  async setCrossTenantGrantPermissions(targetTenantIds: readonly string[]): Promise<CrossTenantGrantPermissionsDto | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (!baseUrl) {
      return null;
    }
    const body: CrossTenantGrantPermissionsDto = {targetTenantIds: [...targetTenantIds]};
    try {
      const response = await firstValueFrom(
        this.httpClient.put<CrossTenantGrantPermissionsDto>(
          baseUrl + 'crossTenantGrantPermissions', body,
          {observe: 'response', context: IdentityService.callerHandlesPermissionErrors()}));
      return {targetTenantIds: response.body?.targetTenantIds ?? body.targetTenantIds};
    } catch (error) {
      throw toCrossTenantGrantPermissionsError(error) ?? error;
    }
  }

  private static callerHandlesPermissionErrors(): HttpContext {
    return new HttpContext().set(MM_CALLER_HANDLED_STATUSES, CROSS_TENANT_GRANT_PERMISSIONS_TYPED_STATUSES);
  }

  // ========================================
  // Data Permission Management (AB#4972)
  // ========================================

  async getDataPermissions(): Promise<DataPermissionDto[] | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.get<DataPermissionDto[] | null>(baseUrl + 'dataPermissions', {observe: 'response'}));
      return response.body;
    }
    return null;
  }

  async createDataPermission(dataPermission: DataPermissionDto): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post<void>(baseUrl + 'dataPermissions', dataPermission, {observe: 'response'}));
    }
  }

  async deleteDataPermission(permissionId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `dataPermissions/${permissionId}`, {observe: 'response'}));
    }
  }

  async createDataPolicy(permissionId: string, dataPolicy: DataPolicyDto): Promise<string | null> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      const response = await firstValueFrom(
        this.httpClient.post(baseUrl + `dataPermissions/${permissionId}/policies`, dataPolicy,
          {observe: 'response', responseType: 'text'}));
      return response.body;
    }
    return null;
  }

  async deleteDataPolicy(policyRtId: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `dataPermissions/policies/${policyRtId}`, {observe: 'response'}));
    }
  }

  async setDataPolicyEnforcementMode(policyRtId: string, enforcementMode: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      // The endpoint takes a raw JSON string body - Angular would default a plain string to text/plain.
      const headers = new HttpHeaders().set('Content-Type', 'application/json');
      await firstValueFrom(
        this.httpClient.put<void>(baseUrl + `dataPermissions/policies/${policyRtId}/enforcementMode`,
          JSON.stringify(enforcementMode), {headers, observe: 'response'}));
    }
  }

  async grantDataPermissionToRole(permissionId: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.post<void>(baseUrl + `dataPermissions/${permissionId}/roles/${roleName}`, null,
          {observe: 'response'}));
    }
  }

  async revokeDataPermissionFromRole(permissionId: string, roleName: string): Promise<void> {
    const baseUrl = await this.getApiBaseUrl();
    if (baseUrl) {
      await firstValueFrom(
        this.httpClient.delete<void>(baseUrl + `dataPermissions/${permissionId}/roles/${roleName}`,
          {observe: 'response'}));
    }
  }
}
