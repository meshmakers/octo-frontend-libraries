import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IConfigurationService, AddInConfiguration, AdminPanelConfigurationDto, ConfigurationDto } from '@meshmakers/octo-services';

/**
 * App-specific implementation of IConfigurationService.
 * Loads configuration from /assets/config.json and the admin panel endpoint.
 */
@Injectable({
  providedIn: 'root'
})
export class AppConfigurationService implements IConfigurationService {
  private readonly httpClient = inject(HttpClient);

  private readonly _config: AddInConfiguration;

  constructor() {
    this._config = {} as AddInConfiguration;
  }

  public get config(): AddInConfiguration {
    return this._config;
  }

  public async loadConfigAsync(): Promise<void> {
    console.debug('loading config');

    const config = await firstValueFrom(this.httpClient.get<ConfigurationDto>('/assets/config.json'));
    let adminUri = config.adminUri;
    if (!adminUri.endsWith('/')) {
      adminUri = `${adminUri}/`;
    }
    console.debug('adminUri', adminUri);

    const adminPanelConfig = await firstValueFrom(this.httpClient.get<AdminPanelConfigurationDto>(`${adminUri}octosystem/_configuration`));

    this._config.issuer = adminPanelConfig.issuer;
    this._config.assetServices = adminPanelConfig.assetServices;
    this._config.botServices = adminPanelConfig.botServices;
    this._config.communicationServices = adminPanelConfig.communicationServices;
    this._config.meshAdapterUrl = adminPanelConfig.meshAdapterUrl;
    this._config.grafanaUrl = adminPanelConfig.grafanaUrl;
    this._config.crateDbAdminUrl = adminPanelConfig.crateDbAdminUrl;
    this._config.systemTenantId = adminPanelConfig.systemTenantId;
    this._config.clientId = config.clientId;
    this._config.redirectUri = config.redirectUri;
    this._config.postLogoutRedirectUri = config.postLogoutRedirectUri;

    console.debug('end loading config function', this._config);
  }
}
