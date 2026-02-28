import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {DiagnosticsModel} from '../shared/diagnosticsModel';
import {UserDto} from '../shared/userDto';
import {RoleDto} from '../shared/roleDto';
import {PagedResultDto} from '@meshmakers/shared-services';
import {ClientDto} from '../shared/clientDto';
import {GeneratedPasswordDto} from '../shared/generatedPasswordDto';
import {MergeUsersRequestDto} from '../shared/mergeUsersRequestDto';

@Injectable({
  providedIn: 'root'
})
export class IdentityService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);


  async userDiagnostics(): Promise<DiagnosticsModel | null> {
    if (this.configurationService.config?.issuer) {
      return await firstValueFrom(this.httpClient.get<DiagnosticsModel>(
        this.configurationService.config.issuer + 'system/v1/Diagnostics'
      ));
    }
    return null;
  }

  async getUsers(skip: number, take: number): Promise<PagedResultDto<UserDto> | null> {
    const params = new HttpParams().set('skip', '' + skip.toString()).set('take', '' + take.toString());

    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<UserDto> | null>(this.configurationService.config.issuer + 'system/v1/users/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getUserDetails(userName: string): Promise<UserDto | null> {
    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<UserDto | null>(this.configurationService.config.issuer + `system/v1/users/${userName}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createUser(userDto: UserDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.post<void>(this.configurationService.config.issuer + 'system/v1/users', userDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateUser(userName: string, userDto: UserDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.put<void>(this.configurationService.config.issuer + `system/v1/users/${userName}`, userDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteUser(userName: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.delete<void>(this.configurationService.config.issuer + `system/v1/users/${userName}`, {
          observe: 'response'
        })
      );
    }
  }

  async getUserRoles(userName: string): Promise<RoleDto[] | null> {
    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto[] | null>(this.configurationService.config.issuer + `system/v1/users/${userName}/roles`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async updateUserRoles(userName: string, roles: RoleDto[]): Promise<void> {
    if (this.configurationService.config?.issuer) {
      const roleIds = roles.map((role) => role.id);

      await firstValueFrom(
        this.httpClient.put<void>(this.configurationService.config.issuer + `system/v1/users/${userName}/roles`, roleIds, {
          observe: 'response'
        })
      );
    }
  }

  async addUserToRole(userName: string, roleName: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.put<void>(this.configurationService.config.issuer + `system/v1/users/${userName}/roles/${roleName}`, null, {
          observe: 'response'
        })
      );
    }
  }

  async removeRoleFromUser(userName: string, roleName: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.delete<void>(this.configurationService.config.issuer + `system/v1/users/${userName}/roles/${roleName}`, {
          observe: 'response'
        })
      );
    }
  }

  async mergeUsers(targetUserName: string, sourceUserName: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      const request: MergeUsersRequestDto = { sourceUserName };
      await firstValueFrom(
        this.httpClient.post<void>(
          this.configurationService.config.issuer + `system/v1/users/${encodeURIComponent(targetUserName)}/merge`,
          request,
          { observe: 'response' }
        )
      );
    }
  }

  async resetPassword(userName: string, password: string): Promise<unknown> {
    const params = new HttpParams().set('userName', userName).set('password', password);

    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.post<unknown>(this.configurationService.config.issuer + 'system/v1/users/ResetPassword', null, {
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

    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<ClientDto> | null>(this.configurationService.config.issuer + 'system/v1/clients/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getClientDetails(clientId: string): Promise<ClientDto | null> {
    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<ClientDto>(this.configurationService.config.issuer + `system/v1/clients/${clientId}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createClient(clientDto: ClientDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.post<void>(this.configurationService.config.issuer + 'system/v1/clients', clientDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateClient(clientId: string, clientDto: ClientDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(this.httpClient.put<void>(this.configurationService.config.issuer + `system/v1/clients/${clientId}`, clientDto, {
        observe: 'response'
      }));
    }
  }

 async deleteClient(clientId: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(this.httpClient.delete<void>(this.configurationService.config.issuer + `system/v1/clients/${clientId}`, {
        observe: 'response'
      }));
    }
  }

  async generatePassword(): Promise<GeneratedPasswordDto | null> {
    const params = new HttpParams();

    if (this.configurationService.config?.issuer) {
      const r = await firstValueFrom(this.httpClient
        .get<GeneratedPasswordDto>(this.configurationService.config.issuer + 'system/v1/tools/generatePassword', {
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

    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<PagedResultDto<RoleDto> | null>(this.configurationService.config.issuer + 'system/v1/roles/getPaged', {
          params,
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async getRoleDetails(roleName: string): Promise<RoleDto | null> {
    if (this.configurationService.config?.issuer) {
      const response = await firstValueFrom(
        this.httpClient.get<RoleDto | null>(this.configurationService.config.issuer + `system/v1/roles/names/${roleName}`, {
          observe: 'response'
        })
      );
      return response.body;
    }
    return null;
  }

  async createRole(roleDto: RoleDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.post<void>(this.configurationService.config.issuer + 'system/v1/roles', roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async updateRole(roleName: string, roleDto: RoleDto): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.put<void>(this.configurationService.config.issuer + `system/v1/roles/${roleName}`, roleDto, {
          observe: 'response'
        })
      );
    }
  }

  async deleteRole(roleName: string): Promise<void> {
    if (this.configurationService.config?.issuer) {
      await firstValueFrom(
        this.httpClient.delete<void>(this.configurationService.config.issuer + `system/v1/roles/${roleName}`, {
          observe: 'response'
        })
      );
    }
  }
}
