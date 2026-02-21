import { InjectionToken } from '@angular/core';
import { AddInConfiguration } from '../shared/addInConfiguration';

/**
 * Interface for the ConfigurationService.
 * Must be implemented by each application to provide configuration loading logic.
 *
 * @example
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class AppConfigurationService implements IConfigurationService {
 *   private readonly _config: AddInConfiguration = {} as AddInConfiguration;
 *
 *   get config(): AddInConfiguration {
 *     return this._config;
 *   }
 *
 *   async loadConfigAsync(): Promise<void> {
 *     // App-specific loading logic
 *   }
 * }
 * ```
 */
export interface IConfigurationService {
  /**
   * The loaded configuration.
   * Available after loadConfigAsync() has been called.
   */
  readonly config: AddInConfiguration;

  /**
   * Loads the configuration asynchronously.
   * Typically called during app initialization (APP_INITIALIZER).
   */
  loadConfigAsync(): Promise<void>;
}

/**
 * Injection token for the ConfigurationService.
 * Allows each application to provide its own implementation.
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * providers: [
 *   { provide: CONFIGURATION_SERVICE, useClass: AppConfigurationService }
 * ]
 * ```
 */
export const CONFIGURATION_SERVICE = new InjectionToken<IConfigurationService>(
  'IConfigurationService'
);
