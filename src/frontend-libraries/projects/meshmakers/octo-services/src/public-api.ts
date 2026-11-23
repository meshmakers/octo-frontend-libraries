/*
 * Public API Surface of octo-services
 */

import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {OctoServiceOptions} from './lib/options/octo-service-options';
import {OctoErrorLink} from './lib/shared/octo-error-link';
import { provideMmSharedServices } from '@meshmakers/shared-services';

export * from './lib/options/octo-service-options';
export * from './lib/shared/graphQL';
export * from './lib/shared/ckTypeMetaData';
export * from './lib/shared/rtAssociationMetaData';
export * from './lib/shared/levelMetaData';
export * from './lib/shared/secret-safe-attributes';
export * from './lib/shared/secret-state';
export * from './lib/shared/octo-error-link';
export * from './lib/shared/identity-method-error';
export * from './lib/shared/externalLoginDto';
export * from './lib/shared/userDto';
export * from './lib/shared/userDirectoryEntryDto';
export * from './lib/shared/registerUserDto';
export * from './lib/shared/mergeUsersRequestDto';
export * from './lib/shared/resetUserPasswordRequestDto';
export * from './lib/shared/roleDto';
export * from './lib/shared/jobDto';
export * from './lib/shared/jobResponseDto';
export * from './lib/shared/secretAdministrationDtos';
export * from './lib/shared/health';
export * from './lib/shared/importModelResponseDto';
export * from './lib/shared/importStrategyDto';
export * from './lib/shared/deepGraphFollowSpecDto';
export * from './lib/shared/timeWindowDto';
export * from './lib/shared/progress-value';
export * from './lib/shared/progress-window.service';
export * from './lib/shared/grantTypes';
export * from './lib/shared/generatedPasswordDto';
export * from './lib/shared/exportModelResponseDto';
export * from './lib/shared/diagnosticsModel';
export * from './lib/shared/clientDto';
export * from './lib/shared/clientMirrorDto';
export * from './lib/shared/clientOverlayDto';
export * from './lib/shared/clientScope';
export * from './lib/shared/groupDto';
export * from './lib/shared/dataPermissionDto';
export * from './lib/shared/identityProviderDto';
export * from './lib/shared/emailDomainGroupRuleDto';
export * from './lib/shared/emailIdentifierBindingDto';
export * from './lib/shared/externalTenantUserMappingDto';
export * from './lib/shared/crossTenantGrantError';
export * from './lib/shared/crossTenantGrantPermissionsDto';
export * from './lib/shared/provisioningSourceUserDto';
export * from './lib/shared/provisioningGroupDto';
export * from './lib/shared/tenantDto';
export * from './lib/shared/adminPanelConfigurationDto';
export * from './lib/shared/configurationDto';
export * from './lib/shared/communicationDtos';
export * from './lib/shared/tenantFeaturesDtos';
export * from './lib/shared/movePipelineDtos';
export * from './lib/shared/domainDtos';
export * from './lib/shared/ck-model-catalog.dto';
export * from './lib/shared/ck-upgrade-blockers';

// GraphQL generated types - re-export all for use by dependent packages
export * from './lib/graphQL/globalTypes';

// GraphQL fragment matcher - possibleTypes for Apollo InMemoryCache
export { default as possibleTypes } from './lib/graphQL/possibleTypes';

// GraphQL generated services
export * from './lib/graphQL/getCkTypeAttributes';
export * from './lib/graphQL/getCkRecordAttributes';
export * from './lib/graphQL/getCkTypeAvailableQueryColumns';
export * from './lib/graphQL/getCkTypes';
export * from './lib/graphQL/getDerivedCkTypes';
export * from './lib/graphQL/getCkModelById';
export * from './lib/graphQL/getCkMethodOperations';

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
export * from './lib/services/ck-method-operation.service';
export * from './lib/shared/tenant-graphql-target';
export * from './lib/services/ck-method-operation-view';
export * from './lib/services/bot-secrets.service';
export * from './lib/services/health.service';
export * from './lib/services/identity-service';
export * from './lib/services/job-management.service';
export * from './lib/services/file-download.service';
export * from './lib/services/files-client.service';
export * from './lib/services/communication.service';
export * from './lib/services/picker-users';
export * from './lib/shared/name-search-term';

// Notification subscriptions (System.Notification) - moved to the entry point
// '@meshmakers/octo-services/notifications' (AB#9650). The plain names stay here for a transition and are
// deprecated. The ɵ-prefixed aliases are not public API: they feed the new entry point, because ng-packagr does not
// allow the primary entry point to import from a secondary one while the notification code still lives here.
export * from './lib/notifications/notifications-transition-exports';
export {
  type NotificationHealth as ɵNotificationHealth,
  type NotificationRecipientProblem as ɵNotificationRecipientProblem,
  type NotificationRecipientStatus as ɵNotificationRecipientStatus,
  type NotificationDeliveryStateSnapshot as ɵNotificationDeliveryStateSnapshot,
  notificationErrorText as ɵnotificationErrorText,
  notificationRecipientStatus as ɵnotificationRecipientStatus,
  notificationSubscriptionHealth as ɵnotificationSubscriptionHealth
} from './lib/notifications/notification-status';
export {
  NOTIFICATION_MIN_INTERVAL_MS as ɵNOTIFICATION_MIN_INTERVAL_MS,
  NOTIFICATION_SCHEDULE_TYPES as ɵNOTIFICATION_SCHEDULE_TYPES,
  NOTIFICATION_DEFAULT_CRON as ɵNOTIFICATION_DEFAULT_CRON,
  type NextExecutions as ɵNextExecutions,
  nextCronExecutions as ɵnextCronExecutions,
  NOTIFICATION_NEXT_EXECUTIONS as ɵNOTIFICATION_NEXT_EXECUTIONS,
  type NotificationScheduleIssue as ɵNotificationScheduleIssue,
  notificationScheduleIssue as ɵnotificationScheduleIssue,
  withScheduleTimeZone as ɵwithScheduleTimeZone,
  browserTimeZone as ɵbrowserTimeZone,
  notificationTimeZones as ɵnotificationTimeZones
} from './lib/notifications/notification-schedule';
export {
  NOTIFICATION_COUNT_PLACEHOLDER as ɵNOTIFICATION_COUNT_PLACEHOLDER,
  unknownNotificationPlaceholders as ɵunknownNotificationPlaceholders,
  placeholderList as ɵplaceholderList,
  type NotificationColumnPath as ɵNotificationColumnPath,
  notificationColumnPath as ɵnotificationColumnPath
} from './lib/notifications/notification-placeholders';
export {
  type NotificationQueryRow as ɵNotificationQueryRow,
  type NotificationQuerySample as ɵNotificationQuerySample,
  type NotificationPreviewOptions as ɵNotificationPreviewOptions,
  type NotificationPreview as ɵNotificationPreview,
  renderNotificationPreview as ɵrenderNotificationPreview,
  formatNotificationCell as ɵformatNotificationCell
} from './lib/notifications/notification-preview';
export {
  type NotificationEntityRef as ɵNotificationEntityRef,
  type NotificationNamedRef as ɵNotificationNamedRef,
  type NotificationPage as ɵNotificationPage,
  type NotificationPageRequest as ɵNotificationPageRequest,
  type NotificationRecipientPageRequest as ɵNotificationRecipientPageRequest,
  type NotificationSubscriptionSummary as ɵNotificationSubscriptionSummary,
  type NotificationSubscriptionDetail as ɵNotificationSubscriptionDetail,
  type NotificationRecipient as ɵNotificationRecipient,
  type NotificationRecipientPage as ɵNotificationRecipientPage,
  type NotificationScheduleInput as ɵNotificationScheduleInput,
  type NotificationNewRecipient as ɵNotificationNewRecipient,
  type NotificationWriteResult as ɵNotificationWriteResult,
  type NotificationDeleteResult as ɵNotificationDeleteResult,
  type NotificationRecipientRefusal as ɵNotificationRecipientRefusal,
  NotificationRecipientRefusedError as ɵNotificationRecipientRefusedError,
  type NotificationTemplateSubscription as ɵNotificationTemplateSubscription,
  NotificationSubscriptionService as ɵNotificationSubscriptionService
} from './lib/notifications/notification-subscription.service';
export {
  type NotificationRecipientCandidate as ɵNotificationRecipientCandidate,
  type NotificationRecipientCandidatesSource as ɵNotificationRecipientCandidatesSource,
  NotificationRecipientCandidatesService as ɵNotificationRecipientCandidatesService,
  GraphQlNotificationRecipientCandidatesService as ɵGraphQlNotificationRecipientCandidatesService,
  NOTIFICATION_RECIPIENT_CANDIDATES as ɵNOTIFICATION_RECIPIENT_CANDIDATES
} from './lib/notifications/notification-recipient-candidates.service';
export * from './lib/services/reporting.service';
export * from './lib/services/ai.service';
export * from './lib/services/tus-upload.service';
export * from './lib/services/ck-model-catalog.service';

// Tenant provider (for tenant-specific operations)
export * from './lib/services/tenant-provider';

// GraphQL query for runtime entities by CK type
export * from './lib/graphQL/getEntitiesByCkType';

// Data sources for entity selection
export * from './lib/data-sources/runtime-entity-data-sources';

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
