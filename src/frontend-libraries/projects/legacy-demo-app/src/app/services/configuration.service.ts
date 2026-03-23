import { Injectable } from '@angular/core';
import { IConfigurationService, AddInConfiguration } from '@meshmakers/octo-services';

const DEFAULT_CONFIG: AddInConfiguration = {
  assetServices: '/',
  issuer: 'https://localhost:5003/',
  clientId: 'octo-legacy-demo-app',
  redirectUri: window.location.origin + '/',
  postLogoutRedirectUri: window.location.origin + '/',
} as AddInConfiguration;

@Injectable()
export class ConfigurationService implements IConfigurationService {
  private configuration: AddInConfiguration = DEFAULT_CONFIG;

  get config(): AddInConfiguration {
    return this.configuration;
  }

  async loadConfigAsync(): Promise<void> {
    try {
      const result = await fetch('/octosystem/_configuration');
      if (result.ok) {
        this.configuration = await result.json() as AddInConfiguration;
        return;
      }
    } catch {
      // Endpoint not available - use default config
    }
    this.configuration = DEFAULT_CONFIG;
  }
}
