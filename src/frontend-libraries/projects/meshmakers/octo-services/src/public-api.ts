/*
 * Public API Surface of octo-services
 */

import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {OctoServiceOptions} from './lib/options/octo-service-options';
import {OctoErrorLink} from './lib/shared/octo-error-link';
import { provideMmSharedServices } from "@meshmakers/shared-services";

export * from './lib/options/octo-service-options';
export * from './lib/shared/graphQL';
export * from './lib/shared/ckTypeMetaData';
export * from './lib/shared/rtAssociationMetaData';
export * from './lib/shared/levelMetaData';
export * from './lib/shared/octo-error-link';
export * from './lib/shared/externalLoginDto';
export * from './lib/shared/userDto';
export * from './lib/shared/registerUserDto';
export * from './lib/shared/mergeUsersRequestDto';
export * from './lib/shared/roleDto';
export * from './lib/shared/jobDto';
export * from './lib/shared/jobResponseDto';
export * from './lib/shared/health';
export * from './lib/shared/importModelResponseDto';
export * from './lib/shared/importStrategyDto';
export * from './lib/shared/progress-value';
export * from './lib/shared/progress-window.service';
export * from './lib/shared/grantTypes';
export * from './lib/shared/generatedPasswordDto';
export * from './lib/shared/exportModelResponseDto';
export * from './lib/shared/diagnosticsModel';
export * from './lib/shared/clientDto';
export * from './lib/shared/clientScope';
export * from './lib/shared/groupDto';
export * from './lib/shared/identityProviderDto';
export * from './lib/shared/tenantDto';
export * from './lib/shared/adminPanelConfigurationDto';
export * from './lib/shared/configurationDto';
export * from './lib/shared/communicationDtos';

// GraphQL generated types - re-export all for use by dependent packages
export * from './lib/graphQL/globalTypes';

// GraphQL fragment matcher - possibleTypes for Apollo InMemoryCache
export { default as possibleTypes } from './lib/graphQL/possibleTypes';

// GraphQL generated services
export * from './lib/graphQL/getCkTypeAttributes';
export * from './lib/graphQL/getCkRecordAttributes';
export * from './lib/graphQL/getCkTypeAvailableQueryColumns';
export * from './lib/graphQL/getCkTypes';
export * from './lib/graphQL/getCkModelById';

// Configuration (Interface and Token for app-specific implementations)
export * from './lib/services/configuration.service';
export * from './lib/shared/addInConfiguration';

// Business services
export * from './lib/services/attribute-selector.service';
export * from './lib/services/ck-type-attribute.service';
export * from './lib/services/ck-type-selector.service';
export * from './lib/services/ck-model.service';
export * from './lib/services/asset-repo.service';
export * from './lib/services/bot-service';
export * from './lib/services/health.service';
export * from './lib/services/identity-service';
export * from './lib/services/job-management.service';
export * from './lib/services/communication.service';
export * from './lib/services/tus-upload.service';

// Tenant provider (for tenant-specific operations)
export * from './lib/services/tenant-provider';

// Backward-compatible re-exports for legacy apps (energy-community, office-integration)
export * from './lib/compat/octo-services-module';
export * from './lib/compat/asset-repo-graph-ql-data-source';
export * from './lib/compat/octo-graph-ql-service-base';
export * from './lib/compat/paged-graph-result-dto';

export function provideOctoServices(octoServiceOptions?: OctoServiceOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideMmSharedServices(),
    OctoErrorLink,
    {
      provide: OctoServiceOptions,
      useValue: octoServiceOptions
    }
  ]);
}
