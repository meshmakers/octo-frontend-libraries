/*
 * Public API Surface of @meshmakers/octo-services/notifications (AB#9650)
 *
 * The notification subscription API (System.Notification): service, recipient candidates, schedule checks,
 * placeholders, preview and status helpers. Import it from here; the same names on '@meshmakers/octo-services' are
 * deprecated and will be removed from the primary entry point.
 *
 * The code still lives in the primary entry point for the transition and is re-exported here through its internal
 * ɵ aliases (ng-packagr forbids an import cycle between entry points).
 */
export {
  // notification-status
  type ɵNotificationHealth as NotificationHealth,
  type ɵNotificationRecipientProblem as NotificationRecipientProblem,
  type ɵNotificationRecipientStatus as NotificationRecipientStatus,
  type ɵNotificationDeliveryStateSnapshot as NotificationDeliveryStateSnapshot,
  ɵnotificationErrorText as notificationErrorText,
  ɵnotificationRecipientStatus as notificationRecipientStatus,
  ɵnotificationSubscriptionHealth as notificationSubscriptionHealth,
  // notification-schedule
  ɵNOTIFICATION_MIN_INTERVAL_MS as NOTIFICATION_MIN_INTERVAL_MS,
  ɵNOTIFICATION_SCHEDULE_TYPES as NOTIFICATION_SCHEDULE_TYPES,
  ɵNOTIFICATION_DEFAULT_CRON as NOTIFICATION_DEFAULT_CRON,
  type ɵNextExecutions as NextExecutions,
  ɵnextCronExecutions as nextCronExecutions,
  ɵNOTIFICATION_NEXT_EXECUTIONS as NOTIFICATION_NEXT_EXECUTIONS,
  type ɵNotificationScheduleIssue as NotificationScheduleIssue,
  ɵnotificationScheduleIssue as notificationScheduleIssue,
  ɵwithScheduleTimeZone as withScheduleTimeZone,
  ɵbrowserTimeZone as browserTimeZone,
  ɵnotificationTimeZones as notificationTimeZones,
  // notification-placeholders
  ɵNOTIFICATION_COUNT_PLACEHOLDER as NOTIFICATION_COUNT_PLACEHOLDER,
  ɵunknownNotificationPlaceholders as unknownNotificationPlaceholders,
  ɵplaceholderList as placeholderList,
  type ɵNotificationColumnPath as NotificationColumnPath,
  ɵnotificationColumnPath as notificationColumnPath,
  // notification-preview
  type ɵNotificationQueryRow as NotificationQueryRow,
  type ɵNotificationQuerySample as NotificationQuerySample,
  type ɵNotificationPreviewOptions as NotificationPreviewOptions,
  type ɵNotificationPreview as NotificationPreview,
  ɵrenderNotificationPreview as renderNotificationPreview,
  ɵformatNotificationCell as formatNotificationCell,
  // notification-subscription.service
  type ɵNotificationEntityRef as NotificationEntityRef,
  type ɵNotificationNamedRef as NotificationNamedRef,
  type ɵNotificationPage as NotificationPage,
  type ɵNotificationPageRequest as NotificationPageRequest,
  type ɵNotificationRecipientPageRequest as NotificationRecipientPageRequest,
  type ɵNotificationSubscriptionSummary as NotificationSubscriptionSummary,
  type ɵNotificationSubscriptionDetail as NotificationSubscriptionDetail,
  type ɵNotificationRecipient as NotificationRecipient,
  type ɵNotificationRecipientPage as NotificationRecipientPage,
  type ɵNotificationScheduleInput as NotificationScheduleInput,
  type ɵNotificationNewRecipient as NotificationNewRecipient,
  type ɵNotificationWriteResult as NotificationWriteResult,
  type ɵNotificationDeleteResult as NotificationDeleteResult,
  type ɵNotificationRecipientRefusal as NotificationRecipientRefusal,
  ɵNotificationRecipientRefusedError as NotificationRecipientRefusedError,
  type ɵNotificationTemplateSubscription as NotificationTemplateSubscription,
  ɵNotificationSubscriptionService as NotificationSubscriptionService,
  // notification-recipient-candidates.service
  type ɵNotificationRecipientCandidate as NotificationRecipientCandidate,
  type ɵNotificationRecipientCandidatesSource as NotificationRecipientCandidatesSource,
  ɵNotificationRecipientCandidatesService as NotificationRecipientCandidatesService,
  ɵGraphQlNotificationRecipientCandidatesService as GraphQlNotificationRecipientCandidatesService,
  ɵNOTIFICATION_RECIPIENT_CANDIDATES as NOTIFICATION_RECIPIENT_CANDIDATES
} from '@meshmakers/octo-services';
