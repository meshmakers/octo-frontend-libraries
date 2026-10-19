import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AssociationModOptionsDto,
  DeleteStrategiesDto,
  FieldFilterDto,
  FieldFilterOperatorsDto,
  RtAssociationInputDto,
  RtEntityIdDto,
  SearchFilterDto,
  SearchFilterTypesDto,
  SortDto
} from '../graphQL/globalTypes';
import { GraphQL } from '../shared/graphQL';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';
import { nameSearchTerm } from '../shared/name-search-term';
import { NotificationsGetSubscriptionsDtoGQL, NotificationsGetSubscriptionsQueryDto } from '../graphQL/notificationsGetSubscriptions';
import { NotificationsGetSubscriptionDtoGQL } from '../graphQL/notificationsGetSubscription';
import { NotificationsGetRecipientsDtoGQL, NotificationsGetRecipientsQueryDto } from '../graphQL/notificationsGetRecipients';
import { NotificationsGetPreferenceDtoGQL } from '../graphQL/notificationsGetPreference';
import { NotificationsCreateSubscriptionDtoGQL } from '../graphQL/notificationsCreateSubscription';
import { NotificationsUpdateSubscriptionDtoGQL } from '../graphQL/notificationsUpdateSubscription';
import { NotificationsCreatePreferenceDtoGQL } from '../graphQL/notificationsCreatePreference';
import { NotificationsUpdatePreferenceDtoGQL } from '../graphQL/notificationsUpdatePreference';
import { NotificationsDeleteEntitiesDtoGQL } from '../graphQL/notificationsDeleteEntities';
import { NotificationsGetQueriesDtoGQL } from '../graphQL/notificationsGetQueries';
import { NotificationsGetEmailTemplatesDtoGQL } from '../graphQL/notificationsGetEmailTemplates';
import { NotificationsGetPlaceholderSourcesDtoGQL } from '../graphQL/notificationsGetPlaceholderSources';
import { NotificationsGetTemplateSubscriptionsDtoGQL } from '../graphQL/notificationsGetTemplateSubscriptions';
import { NotificationsGetQuerySampleDtoGQL } from '../graphQL/notificationsGetQuerySample';
import { NotificationSubscriptionHealth, notificationSubscriptionHealth } from './notification-status';
import { NotificationQueryRow, NotificationQuerySample } from './notification-preview';

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

export interface NotificationSubscriptionSummary extends NotificationEntityRef {
  name: string;
  enabled: boolean;
  recipientCount: number;
  health: NotificationSubscriptionHealth;
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

export interface NotificationSubscriptionInput {
  name: string;
  description: string | null;
  query: NotificationNamedRef | null;
  template: NotificationNamedRef | null;
}

export interface NotificationDeliveryStateInfo extends NotificationEntityRef {
  lastRunAt: unknown;
  lastSentAt: unknown;
  lastError: string | null;
  runningSince: unknown;
}

export interface NotificationRecipientInfo extends NotificationEntityRef {
  subjectId: string;
  cronExpression: string;
  skipExistingRows: boolean;
  timeZone: string | null;
  deliveryState: NotificationDeliveryStateInfo | null;
}

export interface NotificationRecipientPage extends NotificationPage<NotificationRecipientInfo> {
  subscriptionDeployed: boolean;
}

export interface NotificationRecipientInput {
  subjectId?: string;
  cronExpression: string;
  skipExistingRows: boolean;
  timeZone: string;
}

export interface NotificationPlaceholderSources {
  columns: string[];
  subjectTemplate: string | null;
  bodyTemplate: string | null;
}

export interface NotificationTemplateSubscription extends NotificationEntityRef {
  name: string;
  queryRtId: string | null;
  queryColumns: string[] | null;
}

export interface NotificationDeletionResult {
  deliveryStatesErased: boolean;
  error?: unknown;
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
  runningSince?: unknown;
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

function deliveryStateOf(subjectId: string, states: readonly (RawDeliveryState | null)[] | null | undefined): NotificationDeliveryStateInfo | null {
  const recorded = states?.find(state => state !== null);
  if (!recorded) return null;
  const otherUser = !!recorded.subjectId && recorded.subjectId !== subjectId;
  return {
    rtId: recorded.rtId,
    ckTypeId: recorded.ckTypeId,
    lastRunAt: otherUser ? null : recorded.lastRunAt ?? null,
    lastSentAt: otherUser ? null : recorded.lastSentAt ?? null,
    lastError: recorded.lastError ?? null,
    runningSince: recorded.runningSince ?? null
  };
}

function recipientOf(item: RecipientItem): NotificationRecipientInfo {
  return {
    rtId: item.rtId,
    ckTypeId: item.ckTypeId,
    subjectId: item.subjectId,
    cronExpression: item.cronExpression,
    skipExistingRows: item.skipExistingRows,
    timeZone: item.timeZone ?? null,
    deliveryState: deliveryStateOf(item.subjectId, item.deliveryState?.items as (RawDeliveryState | null)[] | null | undefined)
  };
}

function associationDiff(original: NotificationEntityRef | null, selected: NotificationEntityRef | null): RtAssociationInputDto[] | undefined {
  if (original?.rtId === selected?.rtId) return undefined;
  const entries: RtAssociationInputDto[] = [];
  if (original) {
    entries.push({ modOption: AssociationModOptionsDto.DeleteDto, target: { rtId: original.rtId, ckTypeId: original.ckTypeId } });
  }
  if (selected) {
    entries.push({ modOption: AssociationModOptionsDto.CreateDto, target: { rtId: selected.rtId, ckTypeId: selected.ckTypeId } });
  }
  return entries;
}

function nameFilter(searchText: string | null | undefined, attributePath: string): SearchFilterDto | undefined {
  const term = searchText?.trim();
  return term
    ? { type: SearchFilterTypesDto.AttributeFilterDto, searchTerm: nameSearchTerm(term), attributePaths: [attributePath] }
    : undefined;
}

function toEntityId(ref: NotificationEntityRef): RtEntityIdDto {
  return { rtId: ref.rtId, ckTypeId: ref.ckTypeId };
}

function namedRefs(items: readonly (RawRef | null)[] | null | undefined): NotificationNamedRef[] {
  return (items ?? []).map(namedRef).filter((item): item is NotificationNamedRef => item !== null);
}

@Injectable({ providedIn: 'root' })
export class NotificationSubscriptionService {
  private readonly getSubscriptionsGQL = inject(NotificationsGetSubscriptionsDtoGQL);
  private readonly getSubscriptionGQL = inject(NotificationsGetSubscriptionDtoGQL);
  private readonly getRecipientsGQL = inject(NotificationsGetRecipientsDtoGQL);
  private readonly getPreferenceGQL = inject(NotificationsGetPreferenceDtoGQL);
  private readonly createSubscriptionGQL = inject(NotificationsCreateSubscriptionDtoGQL);
  private readonly updateSubscriptionGQL = inject(NotificationsUpdateSubscriptionDtoGQL);
  private readonly createPreferenceGQL = inject(NotificationsCreatePreferenceDtoGQL);
  private readonly updatePreferenceGQL = inject(NotificationsUpdatePreferenceDtoGQL);
  private readonly deleteEntitiesGQL = inject(NotificationsDeleteEntitiesDtoGQL);
  private readonly getQueriesGQL = inject(NotificationsGetQueriesDtoGQL);
  private readonly getEmailTemplatesGQL = inject(NotificationsGetEmailTemplatesDtoGQL);
  private readonly getPlaceholderSourcesGQL = inject(NotificationsGetPlaceholderSourcesDtoGQL);
  private readonly getTemplateSubscriptionsGQL = inject(NotificationsGetTemplateSubscriptionsDtoGQL);
  private readonly getQuerySampleGQL = inject(NotificationsGetQuerySampleDtoGQL);

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

  async createSubscription(input: NotificationSubscriptionInput): Promise<string | null> {
    const result = await firstValueFrom(this.createSubscriptionGQL.mutate({
      variables: {
        entities: [{
          name: input.name,
          description: input.description || null,
          enabled: false,
          query: associationDiff(null, input.query),
          template: associationDiff(null, input.template)
        }]
      }
    }));
    return result.data?.runtime?.systemNotificationNotificationSubscriptions?.create?.[0]?.rtId ?? null;
  }

  async updateSubscription(rtId: string, input: NotificationSubscriptionInput,
    original: Pick<NotificationSubscriptionInput, 'query' | 'template'>): Promise<void> {
    await firstValueFrom(this.updateSubscriptionGQL.mutate({
      variables: {
        entities: [{
          rtId,
          item: {
            name: input.name,
            description: input.description || null,
            query: associationDiff(original.query, input.query),
            template: associationDiff(original.template, input.template)
          }
        }]
      }
    }));
  }

  async getRecipients(subscriptionRtId: string, request: NotificationPageRequest): Promise<NotificationRecipientPage> {
    const result = await firstValueFrom(this.getRecipientsGQL.fetch({
      variables: {
        rtId: subscriptionRtId,
        first: request.take,
        after: GraphQL.offsetToCursor(request.skip),
        sortOrder: request.sort ?? null,
        fieldFilter: request.fieldFilter?.length ? request.fieldFilter : null
      },
      fetchPolicy: 'network-only'
    }));
    const subscription = result.data?.runtime?.systemNotificationNotificationSubscription?.items?.find(item => item !== null);
    const connection = subscription?.preferences;
    const items = (connection?.items ?? []).filter((item): item is RecipientItem => item !== null && 'subjectId' in item);
    return {
      items: items.map(recipientOf),
      totalCount: connection?.totalCount ?? 0,
      subscriptionDeployed: subscription?.enabled ?? false
    };
  }

  async getRecipient(rtId: string): Promise<NotificationRecipientInfo | null> {
    const result = await firstValueFrom(this.getPreferenceGQL.fetch({ variables: { rtId }, fetchPolicy: 'network-only' }));
    const item = result.data?.runtime?.systemNotificationNotificationPreference?.items?.find(entry => entry !== null);
    return item ? recipientOf(item as RecipientItem) : null;
  }

  async findRecipient(subscriptionRtId: string, subjectId: string): Promise<string | null> {
    const page = await this.getRecipients(subscriptionRtId, {
      skip: 0,
      take: 1,
      fieldFilter: [{ attributePath: 'subjectId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: subjectId }]
    });
    return page.items[0]?.rtId ?? null;
  }

  async createRecipient(subscription: NotificationEntityRef, input: Required<NotificationRecipientInput>): Promise<string | null> {
    const result = await firstValueFrom(this.createPreferenceGQL.mutate({
      variables: {
        entities: [{
          subjectId: input.subjectId,
          cronExpression: input.cronExpression,
          skipExistingRows: input.skipExistingRows,
          timeZone: input.timeZone,
          subscription: [{
            modOption: AssociationModOptionsDto.CreateDto,
            target: { rtId: subscription.rtId, ckTypeId: subscription.ckTypeId }
          }]
        }]
      }
    }));
    return result.data?.runtime?.systemNotificationNotificationPreferences?.create?.[0]?.rtId ?? null;
  }

  async updateRecipient(rtId: string, input: NotificationRecipientInput): Promise<void> {
    await firstValueFrom(this.updatePreferenceGQL.mutate({
      variables: {
        entities: [{
          rtId,
          item: {
            cronExpression: input.cronExpression,
            skipExistingRows: input.skipExistingRows,
            timeZone: input.timeZone,
            ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {})
          }
        }]
      }
    }));
  }

  async deleteWithDeliveryStates(archived: readonly NotificationEntityRef[],
    deliveryStates: readonly NotificationEntityRef[]): Promise<NotificationDeletionResult> {
    await firstValueFrom(this.deleteEntitiesGQL.mutate({ variables: { rtEntityIds: archived.map(toEntityId) } }));
    if (deliveryStates.length === 0) return { deliveryStatesErased: true };
    try {
      await firstValueFrom(this.deleteEntitiesGQL.mutate({
        variables: { rtEntityIds: deliveryStates.map(toEntityId), options: DeleteStrategiesDto.EraseDto }
      }));
      return { deliveryStatesErased: true };
    } catch (error) {
      return { deliveryStatesErased: false, error };
    }
  }

  async searchQueries(skip: number, take: number, searchText?: string | null): Promise<NotificationPage<NotificationNamedRef>> {
    const result = await firstValueFrom(this.getQueriesGQL.fetch({
      variables: { first: take, after: GraphQL.offsetToCursor(skip), searchFilter: nameFilter(searchText, 'name') },
      fetchPolicy: 'network-only'
    }));
    const connection = result.data?.runtime?.systemSimpleRtQuery;
    return { items: namedRefs(connection?.items as (RawRef | null)[] | undefined), totalCount: connection?.totalCount ?? 0 };
  }

  async searchEmailTemplates(skip: number, take: number, searchText?: string | null): Promise<NotificationPage<NotificationNamedRef>> {
    const result = await firstValueFrom(this.getEmailTemplatesGQL.fetch({
      variables: { first: take, after: GraphQL.offsetToCursor(skip), searchFilter: nameFilter(searchText, 'rtWellKnownName') },
      fetchPolicy: 'network-only'
    }));
    const connection = result.data?.runtime?.systemNotificationNotificationTemplate;
    return { items: namedRefs(connection?.items as (RawRef | null)[] | undefined), totalCount: connection?.totalCount ?? 0 };
  }

  async getPlaceholderSources(queryRtId: string, templateRtId: string): Promise<NotificationPlaceholderSources | null> {
    const result = await firstValueFrom(this.getPlaceholderSourcesGQL.fetch({
      variables: { queryRtId, templateRtId },
      fetchPolicy: 'network-only'
    }));
    const columns = result.data?.runtime?.systemSimpleRtQuery?.items?.find(item => item !== null)?.columns;
    const template = result.data?.runtime?.systemNotificationNotificationTemplate?.items?.find(item => item !== null);
    if (!columns || !template) return null;
    return {
      columns: columns.filter((column): column is string => !!column),
      subjectTemplate: template.subjectTemplate ?? null,
      bodyTemplate: template.bodyTemplate ?? null
    };
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
