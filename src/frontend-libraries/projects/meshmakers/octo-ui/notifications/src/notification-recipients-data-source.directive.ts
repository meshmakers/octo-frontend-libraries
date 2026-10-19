import { Directive, forwardRef, inject, Input } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';
import { CronParserService, DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent } from '@meshmakers/shared-ui';
import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  isNotificationSchedulable,
  NOTIFICATION_RECIPIENT_CANDIDATES,
  NotificationEntityRef,
  NotificationPreferenceStatus,
  notificationPreferenceStatus,
  NotificationRecipientCandidate,
  NotificationRecipientInfo,
  NotificationSubscriptionService
} from '@meshmakers/octo-services';

export interface NotificationRecipientRow {
  rtId: string;
  ckTypeId: string;
  subjectId: string;
  userLabel: string;
  userEmail: string;
  cronExpression: string;
  skipExistingRows: boolean;
  timeZone: string | null;
  lastSentAt: unknown;
  lastError: string | null;
  deliveryState: NotificationEntityRef | null;
  status: NotificationPreferenceStatus;
}

@Directive({
  selector: '[mmNotificationRecipientsDataSource]',
  exportAs: 'mmNotificationRecipientsDataSource',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => NotificationRecipientsDataSourceDirective) }]
})
export class NotificationRecipientsDataSourceDirective extends OctoGraphQlDataSource<NotificationRecipientRow> {
  private readonly subscriptions = inject(NotificationSubscriptionService);
  private readonly candidates = inject(NOTIFICATION_RECIPIENT_CANDIDATES);
  private readonly cronParser = inject(CronParserService);
  private users?: Promise<Map<string, NotificationRecipientCandidate>>;

  @Input({ alias: 'mmNotificationRecipientsDataSource', required: true }) subscriptionRtId!: string;

  constructor() {
    super(inject(ListViewComponent));
  }

  override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<NotificationRecipientRow> | null> {
    return from(this.loadUsers()).pipe(switchMap(users => {
      const fieldFilter: FieldFilterDto[] = [...this.getFieldFilterDefinitions(queryOptions.state) ?? []];
      const term = queryOptions.textSearch?.trim().toLowerCase();
      if (term) {
        const matching = [...users].filter(([, user]) => user.label.toLowerCase().includes(term)).map(([id]) => id);
        if (matching.length === 0) {
          return of(new FetchResultTyped<NotificationRecipientRow>([], 0));
        }
        fieldFilter.push({ attributePath: 'subjectId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: matching });
      }
      return from(this.subscriptions.getRecipients(this.subscriptionRtId, {
        skip: queryOptions.state.skip ?? 0,
        take: queryOptions.state.take ?? 10,
        sort: this.getSortDefinitions(queryOptions.state),
        fieldFilter
      })).pipe(map(page => new FetchResultTyped<NotificationRecipientRow>(
        page.items.map(item => this.toRow(item, users, page.subscriptionDeployed)), page.totalCount)));
    }));
  }

  usersChanged(): void {
    this.users = undefined;
  }

  private loadUsers(): Promise<Map<string, NotificationRecipientCandidate>> {
    this.users ??= this.candidates.load()
      .then(list => new Map(list.map(user => [user.id, user])))
      .catch(error => {
        console.error('Error loading users:', error);
        this.users = undefined;
        return new Map<string, NotificationRecipientCandidate>();
      });
    return this.users;
  }

  private toRow(item: NotificationRecipientInfo, users: Map<string, NotificationRecipientCandidate>,
    deployed: boolean): NotificationRecipientRow {
    const user = users.get(item.subjectId);
    const schedulable = isNotificationSchedulable((cron, count) => this.cronParser.getNextExecutions(cron, count), item.cronExpression);
    return {
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      subjectId: item.subjectId,
      userLabel: user?.label ?? item.subjectId,
      userEmail: user?.email || user?.name || item.subjectId,
      cronExpression: item.cronExpression,
      skipExistingRows: item.skipExistingRows,
      timeZone: item.timeZone,
      lastSentAt: item.deliveryState?.lastSentAt ?? null,
      lastError: item.deliveryState?.lastError ?? null,
      deliveryState: item.deliveryState ? { rtId: item.deliveryState.rtId, ckTypeId: item.deliveryState.ckTypeId } : null,
      status: notificationPreferenceStatus(item.deliveryState, deployed, users.size === 0 || users.has(item.subjectId), schedulable)
    };
  }
}
