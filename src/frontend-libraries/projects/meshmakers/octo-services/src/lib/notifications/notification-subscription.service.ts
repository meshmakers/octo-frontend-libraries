import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CronParserService } from '@meshmakers/shared-ui';
import {
  AssociationModOptionsDto,
  DeleteStrategiesDto,
  FieldFilterDto,
  FieldFilterOperatorsDto,
  RtEntityIdDto,
  SearchFilterDto,
  SortDto
} from '../graphQL/globalTypes';
import { GraphQL } from '../shared/graphQL';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';
import { CommunicationService } from '../services/communication.service';
import { NotificationsGetSubscriptionsDtoGQL, NotificationsGetSubscriptionsQueryDto } from '../graphQL/notificationsGetSubscriptions';
import { NotificationsGetSubscriptionDtoGQL } from '../graphQL/notificationsGetSubscription';
import { NotificationsGetRecipientsDtoGQL, NotificationsGetRecipientsQueryDto } from '../graphQL/notificationsGetRecipients';
import { NotificationsGetPreferenceDtoGQL } from '../graphQL/notificationsGetPreference';
import { NotificationsCreatePreferenceDtoGQL } from '../graphQL/notificationsCreatePreference';
import { NotificationsUpdatePreferenceDtoGQL } from '../graphQL/notificationsUpdatePreference';
import { NotificationsDeleteEntitiesDtoGQL } from '../graphQL/notificationsDeleteEntities';
import { NotificationsGetTemplateSubscriptionsDtoGQL } from '../graphQL/notificationsGetTemplateSubscriptions';
import { NotificationsGetQuerySampleDtoGQL } from '../graphQL/notificationsGetQuerySample';
import { NotificationHealth, NotificationRecipientStatus, notificationRecipientStatus, notificationSubscriptionHealth } from './notification-status';
import { NotificationScheduleIssue, notificationScheduleIssue } from './notification-schedule';
import { NotificationQueryRow, NotificationQuerySample } from './notification-preview';
import { NOTIFICATION_RECIPIENT_CANDIDATES, NotificationRecipientCandidate } from './notification-recipient-candidates.service';

const RECIPIENT_PAGE = 1000;

export interface NotificationEntityRef {
  rtId: string;
  ckTypeId: string;
}

export interface NotificationNamedRef extends NotificationEntityRef {
  name: string;
}

export interface NotificationPage<T> {
  items: T[];
  totalCount: number;
}

export interface NotificationPageRequest {
  skip: number;
  take: number;
  sort?: SortDto[] | null;
  fieldFilter?: FieldFilterDto[] | null;
  searchFilter?: SearchFilterDto | null;
}

export interface NotificationRecipientPageRequest {
  skip: number;
  take: number;
  sort?: SortDto[] | null;
  searchText?: string | null;
}

export interface NotificationSubscriptionSummary extends NotificationEntityRef {
  name: string;
  enabled: boolean;
  recipientCount: number;
  health: NotificationHealth | null;
  preferences: NotificationEntityRef[];
  deliveryStates: NotificationEntityRef[];
  query: NotificationNamedRef | null;
  template: NotificationNamedRef | null;
}

export interface NotificationSubscriptionDetail extends NotificationEntityRef {
  name: string;
  description: string | null;
  enabled: boolean;
  query: NotificationNamedRef | null;
  template: NotificationNamedRef | null;
}

export interface NotificationRecipient extends NotificationEntityRef {
  subjectId: string;
  userLabel: string;
  cronExpression: string;
  timeZone: string | null;
  lastSentAt: unknown;
  deliveryState: NotificationEntityRef | null;
  status: NotificationRecipientStatus;
}

export type NotificationRecipientPage = NotificationPage<NotificationRecipient>;

export interface NotificationScheduleInput {
  cronExpression: string;
  timeZone: string;
}

export interface NotificationNewRecipient extends NotificationScheduleInput {
  subjectId: string;
}

export interface NotificationWriteResult {
  rtId: string;
  scheduleSyncError: unknown;
}

export interface NotificationDeleteResult {
  deliveryStateError: unknown;
  scheduleSyncError: unknown;
}

export type NotificationRecipientRefusal = 'DUPLICATE' | NotificationScheduleIssue;

export class NotificationRecipientRefusedError extends Error {
  constructor(readonly reason: NotificationRecipientRefusal, readonly existingRtId: string | null = null) {
    super(`Notification recipient refused: ${reason}`);
    this.name = 'NotificationRecipientRefusedError';
  }
}

export interface NotificationTemplateSubscription extends NotificationEntityRef {
  name: string;
  queryRtId: string | null;
  queryColumns: string[] | null;
}

type SubscriptionItem = NonNullable<NonNullable<NonNullable<NonNullable<NotificationsGetSubscriptionsQueryDto['runtime']>['systemNotificationNotificationSubscription']>['items']>[number]>;
type SubscriptionPreference = NonNullable<NonNullable<NonNullable<SubscriptionItem['preferences']>['items']>[number]>;
type RecipientSubscription = NonNullable<NonNullable<NonNullable<NonNullable<NotificationsGetRecipientsQueryDto['runtime']>['systemNotificationNotificationSubscription']>['items']>[number]>;
type RecipientItem = Extract<NonNullable<NonNullable<NonNullable<RecipientSubscription['preferences']>['items']>[number]>, { subjectId: string }>;

interface RawDeliveryState {
  rtId: string;
  ckTypeId: string;
  subjectId?: string | null;
  lastRunAt?: unknown;
  lastSentAt?: unknown;
  lastError?: string | null;
}

interface RawRef {
  rtId?: string;
  ckTypeId?: string;
  name?: string;
  rtWellKnownName?: string | null;
}

function namedRef(item: RawRef | null | undefined): NotificationNamedRef | null {
  if (!item?.rtId || !item.ckTypeId) return null;
  return { rtId: item.rtId, ckTypeId: item.ckTypeId, name: item.name ?? item.rtWellKnownName ?? item.rtId };
}

function deliveryStateOf(subjectId: string, states: readonly (RawDeliveryState | null)[] | null | undefined): RawDeliveryState | null {
  const recorded = states?.find(state => state !== null);
  if (!recorded) return null;
  if (recorded.subjectId && recorded.subjectId !== subjectId) {
    return { rtId: recorded.rtId, ckTypeId: recorded.ckTypeId };
  }
  return recorded;
}

function toEntityId(ref: NotificationEntityRef): RtEntityIdDto {
  return { rtId: ref.rtId, ckTypeId: ref.ckTypeId };
}

@Injectable({ providedIn: 'root' })
export class NotificationSubscriptionService {
  private readonly getSubscriptionsGQL = inject(NotificationsGetSubscriptionsDtoGQL);
  private readonly getSubscriptionGQL = inject(NotificationsGetSubscriptionDtoGQL);
  private readonly getRecipientsGQL = inject(NotificationsGetRecipientsDtoGQL);
  private readonly getPreferenceGQL = inject(NotificationsGetPreferenceDtoGQL);
  private readonly createPreferenceGQL = inject(NotificationsCreatePreferenceDtoGQL);
  private readonly updatePreferenceGQL = inject(NotificationsUpdatePreferenceDtoGQL);
  private readonly deleteEntitiesGQL = inject(NotificationsDeleteEntitiesDtoGQL);
  private readonly getTemplateSubscriptionsGQL = inject(NotificationsGetTemplateSubscriptionsDtoGQL);
  private readonly getQuerySampleGQL = inject(NotificationsGetQuerySampleDtoGQL);
  private readonly communication = inject(CommunicationService);
  private readonly cronParser = inject(CronParserService);
  private readonly candidates = inject(NOTIFICATION_RECIPIENT_CANDIDATES);

  async getSubscriptions(request: NotificationPageRequest): Promise<NotificationPage<NotificationSubscriptionSummary>> {
    const result = await firstValueFrom(this.getSubscriptionsGQL.fetch({
      variables: {
        first: request.take,
        after: GraphQL.offsetToCursor(request.skip),
        sortOrder: request.sort ?? null,
        fieldFilter: request.fieldFilter ?? null,
        searchFilter: request.searchFilter ?? null
      },
      fetchPolicy: 'network-only'
    }));
    const connection = result.data?.runtime?.systemNotificationNotificationSubscription;
    const items = (connection?.items ?? []).filter((item): item is SubscriptionItem => item !== null);
    const summaries = await Promise.all(items.map(async item => this.summaryOf(item, await this.allPreferences(item))));
    return { items: summaries, totalCount: connection?.totalCount ?? 0 };
  }

  async getSubscription(rtId: string): Promise<NotificationSubscriptionDetail | null> {
    const result = await firstValueFrom(this.getSubscriptionGQL.fetch({ variables: { rtId }, fetchPolicy: 'network-only' }));
    const item = result.data?.runtime?.systemNotificationNotificationSubscription?.items?.find(entry => entry !== null);
    if (!item) return null;
    return {
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      name: item.name,
      description: item.description ?? null,
      enabled: item.enabled,
      query: namedRef(item.query?.items?.find(entry => entry !== null) as RawRef | undefined),
      template: namedRef(item.template?.items?.find(entry => entry !== null) as RawRef | undefined)
    };
  }

  deploy(tenantId: string, subscriptionRtId: string): Promise<void> {
    return this.communication.deployNotificationSubscription(tenantId, subscriptionRtId);
  }

  undeploy(tenantId: string, subscriptionRtId: string): Promise<void> {
    return this.communication.undeployNotificationSubscription(tenantId, subscriptionRtId);
  }

  loadUsers(): Promise<NotificationRecipientCandidate[]> {
    return this.candidates.load();
  }

  scheduleIssue(cronExpression: string | null | undefined): NotificationScheduleIssue | null {
    return notificationScheduleIssue((cron, count) => this.cronParser.getNextExecutions(cron, count), cronExpression);
  }

  async getRecipients(subscriptionRtId: string, request: NotificationRecipientPageRequest): Promise<NotificationRecipientPage> {
    const users = await this.usersById();
    const fieldFilter: FieldFilterDto[] = [];
    const term = request.searchText?.trim().toLowerCase();
    if (term) {
      const matching = [...(users?.values() ?? [])].filter(user => user.label.toLowerCase().includes(term)).map(user => user.id);
      if (matching.length === 0) return { items: [], totalCount: 0 };
      fieldFilter.push({ attributePath: 'subjectId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: matching });
    }
    const result = await firstValueFrom(this.getRecipientsGQL.fetch({
      variables: {
        rtId: subscriptionRtId,
        first: request.take,
        after: GraphQL.offsetToCursor(request.skip),
        sortOrder: request.sort ?? null,
        fieldFilter: fieldFilter.length > 0 ? fieldFilter : null
      },
      fetchPolicy: 'network-only'
    }));
    const subscription = result.data?.runtime?.systemNotificationNotificationSubscription?.items?.find(item => item !== null);
    const connection = subscription?.preferences;
    const deployed = subscription?.enabled ?? false;
    const items = (connection?.items ?? []).filter((item): item is RecipientItem => item !== null && 'subjectId' in item);
    return {
      items: items.map(item => this.recipientOf(item, deployed, users)),
      totalCount: connection?.totalCount ?? 0
    };
  }

  async getRecipient(rtId: string, subscriptionDeployed: boolean): Promise<NotificationRecipient | null> {
    const [result, users] = await Promise.all([
      firstValueFrom(this.getPreferenceGQL.fetch({ variables: { rtId }, fetchPolicy: 'network-only' })),
      this.usersById()
    ]);
    const item = result.data?.runtime?.systemNotificationNotificationPreference?.items?.find(entry => entry !== null);
    return item ? this.recipientOf(item as RecipientItem, subscriptionDeployed, users) : null;
  }

  async addRecipient(tenantId: string, subscription: NotificationEntityRef, input: NotificationNewRecipient): Promise<NotificationWriteResult> {
    this.refuseInvalidSchedule(input.cronExpression);
    const existing = await this.findRecipient(subscription.rtId, input.subjectId);
    if (existing) throw new NotificationRecipientRefusedError('DUPLICATE', existing);
    const result = await firstValueFrom(this.createPreferenceGQL.mutate({
      variables: {
        entities: [{
          subjectId: input.subjectId,
          cronExpression: input.cronExpression,
          skipExistingRows: false,
          timeZone: input.timeZone,
          subscription: [{ modOption: AssociationModOptionsDto.CreateDto, target: toEntityId(subscription) }]
        }]
      }
    }));
    const rtId = result.data?.runtime?.systemNotificationNotificationPreferences?.create?.[0]?.rtId;
    if (!rtId) throw new Error('The recipient was not created');
    return { rtId, scheduleSyncError: await this.syncSchedule(tenantId, [rtId]) };
  }

  async updateRecipient(tenantId: string, rtId: string, input: NotificationScheduleInput): Promise<NotificationWriteResult> {
    this.refuseInvalidSchedule(input.cronExpression);
    await firstValueFrom(this.updatePreferenceGQL.mutate({
      variables: { entities: [{ rtId, item: { cronExpression: input.cronExpression, timeZone: input.timeZone } }] }
    }));
    return { rtId, scheduleSyncError: await this.syncSchedule(tenantId, [rtId]) };
  }

  async deleteRecipients(tenantId: string, recipients: readonly Pick<NotificationRecipient, 'rtId' | 'ckTypeId' | 'deliveryState'>[]): Promise<NotificationDeleteResult> {
    if (recipients.length === 0) return { deliveryStateError: null, scheduleSyncError: null };
    await firstValueFrom(this.deleteEntitiesGQL.mutate({ variables: { rtEntityIds: recipients.map(toEntityId) } }));
    const states = recipients.flatMap(recipient => recipient.deliveryState ? [toEntityId(recipient.deliveryState)] : []);
    let deliveryStateError: unknown = null;
    if (states.length > 0) {
      try {
        await firstValueFrom(this.deleteEntitiesGQL.mutate({ variables: { rtEntityIds: states, options: DeleteStrategiesDto.EraseDto } }));
      } catch (error) {
        deliveryStateError = error;
      }
    }
    return { deliveryStateError, scheduleSyncError: await this.syncSchedule(tenantId, recipients.map(recipient => recipient.rtId)) };
  }

  async getTemplateSubscriptions(templateRtId: string): Promise<NotificationTemplateSubscription[]> {
    const result = await firstValueFrom(this.getTemplateSubscriptionsGQL.fetch({
      variables: { rtId: templateRtId },
      fetchPolicy: 'network-only'
    }));
    const template = result.data?.runtime?.systemNotificationNotificationTemplate?.items?.find(item => item !== null);
    return (template?.subscriptions?.items ?? []).flatMap(item => {
      if (!item || !('rtId' in item)) return [];
      const query = item.query?.items?.find(entry => entry !== null && 'columns' in entry) as { rtId?: string; columns?: (string | null)[] | null } | undefined;
      return [{
        rtId: item.rtId,
        ckTypeId: item.ckTypeId,
        name: item.name,
        queryRtId: query?.rtId ?? null,
        queryColumns: query?.columns ? query.columns.filter((column): column is string => !!column) : null
      }];
    });
  }

  async getQuerySample(queryRtId: string, take: number): Promise<NotificationQuerySample | null> {
    try {
      const result = await firstValueFrom(this.getQuerySampleGQL.fetch({
        variables: { rtId: queryRtId, first: take },
        fetchPolicy: 'network-only',
        errorPolicy: 'none',
        context: { [OCTO_SILENT_ERRORS]: true }
      }));
      const rows = result.data?.runtime?.runtimeQuery?.items?.find(item => item !== null)?.rows;
      if (!rows) return null;
      return {
        totalCount: rows.totalCount ?? 0,
        rows: (rows.items ?? []).flatMap(row => row && 'cells' in row
          ? [Object.fromEntries((row.cells?.items ?? []).flatMap(cell => cell ? [[cell.attributePath, cell.value]] : [])) as NotificationQueryRow]
          : [])
      };
    } catch {
      return null;
    }
  }

  private refuseInvalidSchedule(cronExpression: string): void {
    const issue = this.scheduleIssue(cronExpression);
    if (issue) throw new NotificationRecipientRefusedError(issue);
  }

  private async findRecipient(subscriptionRtId: string, subjectId: string): Promise<string | null> {
    const result = await firstValueFrom(this.getRecipientsGQL.fetch({
      variables: {
        rtId: subscriptionRtId,
        first: 1,
        fieldFilter: [{ attributePath: 'subjectId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: subjectId }]
      },
      fetchPolicy: 'network-only'
    }));
    const preferences = result.data?.runtime?.systemNotificationNotificationSubscription?.items?.find(item => item !== null)?.preferences;
    return preferences?.items?.find(item => item !== null && 'rtId' in item)?.rtId ?? null;
  }

  private async syncSchedule(tenantId: string, preferenceRtIds: readonly string[]): Promise<unknown> {
    let failure: unknown = null;
    for (const rtId of preferenceRtIds) {
      try {
        await this.communication.syncNotificationSchedule(tenantId, rtId);
      } catch (error) {
        failure ??= error;
      }
    }
    return failure;
  }

  private async usersById(): Promise<Map<string, NotificationRecipientCandidate> | null> {
    try {
      return new Map((await this.candidates.load()).map(user => [user.id, user]));
    } catch {
      return null;
    }
  }

  private recipientOf(item: RecipientItem, subscriptionDeployed: boolean,
    users: Map<string, NotificationRecipientCandidate> | null): NotificationRecipient {
    const state = deliveryStateOf(item.subjectId, item.deliveryState?.items as (RawDeliveryState | null)[] | null | undefined);
    const user = users?.get(item.subjectId);
    const userExists = users === null || users.size === 0 || !!user;
    return {
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      subjectId: item.subjectId,
      userLabel: user?.label ?? item.subjectId,
      cronExpression: item.cronExpression,
      timeZone: item.timeZone ?? null,
      lastSentAt: state?.lastSentAt ?? null,
      deliveryState: state ? { rtId: state.rtId, ckTypeId: state.ckTypeId } : null,
      status: notificationRecipientStatus(state, subscriptionDeployed, userExists, this.scheduleIssue(item.cronExpression) === null)
    };
  }

  private summaryOf(item: SubscriptionItem, allPreferences: readonly (SubscriptionPreference | null)[]): NotificationSubscriptionSummary {
    const preferences = allPreferences.filter((p): p is SubscriptionPreference & NotificationEntityRef => p !== null && 'rtId' in p);
    const states = preferences.map(p => p.deliveryState?.items?.find(state => state !== null));
    return {
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      name: item.name,
      enabled: item.enabled,
      recipientCount: preferences.length,
      health: notificationSubscriptionHealth(states, item.enabled),
      preferences: preferences.map(p => ({ rtId: p.rtId, ckTypeId: p.ckTypeId })),
      deliveryStates: preferences.flatMap(p => (p.deliveryState?.items ?? [])
        .filter(state => state !== null)
        .map(state => ({ rtId: state.rtId, ckTypeId: state.ckTypeId }))),
      query: namedRef(item.query?.items?.find(entry => entry !== null) as RawRef | undefined),
      template: namedRef(item.template?.items?.find(entry => entry !== null) as RawRef | undefined)
    };
  }

  private async allPreferences(item: SubscriptionItem): Promise<(SubscriptionPreference | null)[]> {
    const preferences: (SubscriptionPreference | null)[] = [...(item.preferences?.items ?? [])];
    const total = item.preferences?.totalCount ?? preferences.length;
    while (preferences.length < total) {
      const result = await firstValueFrom(this.getRecipientsGQL.fetch({
        variables: { rtId: item.rtId, first: RECIPIENT_PAGE, after: GraphQL.offsetToCursor(preferences.length) },
        fetchPolicy: 'network-only'
      }));
      const page = result.data?.runtime?.systemNotificationNotificationSubscription?.items?.[0]?.preferences?.items ?? [];
      if (page.length === 0) break;
      preferences.push(...page as (SubscriptionPreference | null)[]);
    }
    return preferences;
  }
}
