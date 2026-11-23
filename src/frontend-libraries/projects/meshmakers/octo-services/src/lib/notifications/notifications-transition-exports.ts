/*
 * Transition exports of the notification API on the primary entry point '@meshmakers/octo-services' (AB#9650).
 *
 * The notification API now has its own entry point '@meshmakers/octo-services/notifications'. These aliases keep
 * existing imports from the primary entry point compiling and mark them deprecated; they will be removed. They are
 * declarations (not re-exports) on purpose: the bundled .d.ts of the package keeps a @deprecated tag only on a
 * declaration. Do not import this file anywhere but public-api.ts.
 */

import * as status from './notification-status';
import * as schedule from './notification-schedule';
import * as placeholders from './notification-placeholders';
import * as preview from './notification-preview';
import * as subscriptions from './notification-subscription.service';
import * as candidates from './notification-recipient-candidates.service';

// notification-status
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationHealth = status.NotificationHealth;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientProblem = status.NotificationRecipientProblem;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientStatus = status.NotificationRecipientStatus;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationDeliveryStateSnapshot = status.NotificationDeliveryStateSnapshot;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationErrorText = status.notificationErrorText;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationRecipientStatus = status.notificationRecipientStatus;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationSubscriptionHealth = status.notificationSubscriptionHealth;

// notification-schedule
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_MIN_INTERVAL_MS = schedule.NOTIFICATION_MIN_INTERVAL_MS;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_SCHEDULE_TYPES = schedule.NOTIFICATION_SCHEDULE_TYPES;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_DEFAULT_CRON = schedule.NOTIFICATION_DEFAULT_CRON;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NextExecutions = schedule.NextExecutions;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const nextCronExecutions = schedule.nextCronExecutions;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_NEXT_EXECUTIONS = schedule.NOTIFICATION_NEXT_EXECUTIONS;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationScheduleIssue = schedule.NotificationScheduleIssue;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationScheduleIssue = schedule.notificationScheduleIssue;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const withScheduleTimeZone = schedule.withScheduleTimeZone;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const browserTimeZone = schedule.browserTimeZone;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationTimeZones = schedule.notificationTimeZones;

// notification-placeholders
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_COUNT_PLACEHOLDER = placeholders.NOTIFICATION_COUNT_PLACEHOLDER;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const unknownNotificationPlaceholders = placeholders.unknownNotificationPlaceholders;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const placeholderList = placeholders.placeholderList;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationColumnPath = placeholders.NotificationColumnPath;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const notificationColumnPath = placeholders.notificationColumnPath;

// notification-preview
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationQueryRow = preview.NotificationQueryRow;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationQuerySample = preview.NotificationQuerySample;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationPreviewOptions = preview.NotificationPreviewOptions;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationPreview = preview.NotificationPreview;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const renderNotificationPreview = preview.renderNotificationPreview;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const formatNotificationCell = preview.formatNotificationCell;

// notification-subscription.service
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationEntityRef = subscriptions.NotificationEntityRef;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationNamedRef = subscriptions.NotificationNamedRef;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationPage<T> = subscriptions.NotificationPage<T>;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationPageRequest = subscriptions.NotificationPageRequest;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientPageRequest = subscriptions.NotificationRecipientPageRequest;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationSubscriptionSummary = subscriptions.NotificationSubscriptionSummary;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationSubscriptionDetail = subscriptions.NotificationSubscriptionDetail;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipient = subscriptions.NotificationRecipient;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientPage = subscriptions.NotificationRecipientPage;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationScheduleInput = subscriptions.NotificationScheduleInput;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationNewRecipient = subscriptions.NotificationNewRecipient;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationWriteResult = subscriptions.NotificationWriteResult;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationDeleteResult = subscriptions.NotificationDeleteResult;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientRefusal = subscriptions.NotificationRecipientRefusal;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NotificationRecipientRefusedError = subscriptions.NotificationRecipientRefusedError;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientRefusedError = subscriptions.NotificationRecipientRefusedError;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationTemplateSubscription = subscriptions.NotificationTemplateSubscription;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NotificationSubscriptionService = subscriptions.NotificationSubscriptionService;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationSubscriptionService = subscriptions.NotificationSubscriptionService;

// notification-recipient-candidates.service
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientCandidate = candidates.NotificationRecipientCandidate;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientCandidatesSource = candidates.NotificationRecipientCandidatesSource;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NotificationRecipientCandidatesService = candidates.NotificationRecipientCandidatesService;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type NotificationRecipientCandidatesService = candidates.NotificationRecipientCandidatesService;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const GraphQlNotificationRecipientCandidatesService = candidates.GraphQlNotificationRecipientCandidatesService;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export type GraphQlNotificationRecipientCandidatesService = candidates.GraphQlNotificationRecipientCandidatesService;
/** @deprecated Import from `@meshmakers/octo-services/notifications`; this path will be removed (AB#9650). */
export const NOTIFICATION_RECIPIENT_CANDIDATES = candidates.NOTIFICATION_RECIPIENT_CANDIDATES;
