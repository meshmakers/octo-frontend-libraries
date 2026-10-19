import { ChangeDetectionStrategy, Component, computed, Directive, forwardRef, inject, input, output, ViewChild } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';
import {
  BadgeMappingTable,
  DataSourceBase,
  FetchDataOptions,
  FetchResultTyped,
  injectMmLanguage,
  injectMmT,
  ListViewComponent,
  MM_ACTION_ICONS,
  TableColumn
} from '@meshmakers/shared-ui';
import { CommandItem, CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import {
  NotificationSubscriptionHealth,
  NotificationSubscriptionService,
  SearchFilterTypesDto,
  nameSearchTerm
} from '@meshmakers/octo-services';
import { NotificationDeploymentService } from './notification-deployment.service';
import { DEFAULT_NOTIFICATIONS_MESSAGES, NOTIFICATIONS_KEY } from './notifications.messages';

export interface NotificationSubscriptionRow {
  rtId: string;
  ckTypeId: string;
  name: string;
  deployed: boolean;
  deployment: 'DEPLOYED' | 'UNDEPLOYED';
  recipientCount: number;
  health: NotificationSubscriptionHealth;
  templateName: string;
}

@Directive({
  selector: '[mmNotificationSubscriptionsDataSource]',
  exportAs: 'mmNotificationSubscriptionsDataSource',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => NotificationSubscriptionsDataSourceDirective) }]
})
export class NotificationSubscriptionsDataSourceDirective extends OctoGraphQlDataSource<NotificationSubscriptionRow> {
  private readonly subscriptions = inject(NotificationSubscriptionService);

  constructor() {
    super(inject(ListViewComponent));
  }

  override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<NotificationSubscriptionRow> | null> {
    const term = queryOptions.textSearch?.trim();
    return from(this.subscriptions.getSubscriptions({
      skip: queryOptions.state.skip ?? 0,
      take: queryOptions.state.take ?? 20,
      sort: this.getSortDefinitions(queryOptions.state),
      searchFilter: term
        ? { type: SearchFilterTypesDto.AttributeFilterDto, searchTerm: nameSearchTerm(term), attributePaths: ['name'] }
        : null
    })).pipe(map(page => new FetchResultTyped<NotificationSubscriptionRow>(page.items.map(item => ({
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      name: item.name,
      deployed: item.enabled,
      deployment: item.enabled ? 'DEPLOYED' : 'UNDEPLOYED',
      recipientCount: item.recipientCount,
      health: item.health,
      templateName: item.template?.name ?? '-'
    })), page.totalCount)));
  }
}

@Component({
  selector: 'mm-notification-subscriptions',
  standalone: true,
  imports: [ListViewComponent, NotificationSubscriptionsDataSourceDirective],
  template: `
    <mm-list-view
      mmNotificationSubscriptionsDataSource
      #dataSource="mmNotificationSubscriptionsDataSource"
      [pageSize]="20"
      [sortable]="true"
      [rowFilterEnabled]="false"
      [searchTextBoxEnabled]="true"
      rowLabelField="name"
      [columns]="columns()"
      [actionCommandItems]="actionItems()"
      [contextMenuCommandItems]="contextMenuItems()">
    </mm-list-view>
  `,
  changeDetection: ChangeDetectionStrategy.Eager
})
export class NotificationSubscriptionsComponent {
  private readonly deployment = inject(NotificationDeploymentService);
  private readonly language = injectMmLanguage();
  protected readonly t = injectMmT(DEFAULT_NOTIFICATIONS_MESSAGES);
  private readonly k = NOTIFICATIONS_KEY;

  readonly tenantId = input.required<string>();
  readonly canWrite = input(true);
  readonly openSubscription = output<NotificationSubscriptionRow>();

  @ViewChild('dataSource') private dataSource?: NotificationSubscriptionsDataSourceDirective;

  protected readonly columns = computed<TableColumn[]>(() => {
    this.language();
    return [
      { field: 'name', displayName: this.t(`${this.k}.columnName`), dataType: 'text', minWidth: 240 },
      {
        field: 'deployment', displayName: this.t(`${this.k}.columnDeployment`), dataType: 'badge', width: 150, sortable: false,
        badgeMapping: {
          DEPLOYED: { label: this.t(`${this.k}.deployed`), color: 'var(--kendo-color-success)' },
          UNDEPLOYED: { label: this.t(`${this.k}.undeployed`) }
        }
      },
      { field: 'recipientCount', displayName: this.t(`${this.k}.columnRecipients`), dataType: 'numeric', width: 130, sortable: false },
      { field: 'health', displayName: this.t(`${this.k}.columnHealth`), dataType: 'badge', width: 140, sortable: false, badgeMapping: this.healthBadges() },
      { field: 'templateName', displayName: this.t(`${this.k}.columnTemplate`), dataType: 'text', width: 220, sortable: false }
    ];
  });

  protected readonly actionItems = computed<CommandItem[]>(() => [{
    id: 'open', type: 'link', text: this.t(`${this.k}.open`), svgIcon: MM_ACTION_ICONS.edit,
    onClick: async (args: CommandItemExecuteEventArgs) => this.emitOpen(args.data)
  }]);

  protected readonly contextMenuItems = computed<CommandItem[]>(() => this.canWrite()
    ? [
      {
        id: 'deploy', type: 'link', text: this.t(`${this.k}.deploy`),
        isDisabled: data => (data as NotificationSubscriptionRow | undefined)?.deployed === true,
        onClick: args => this.setDeployed(args, true)
      },
      {
        id: 'undeploy', type: 'link', text: this.t(`${this.k}.undeploy`),
        isDisabled: data => (data as NotificationSubscriptionRow | undefined)?.deployed === false,
        onClick: args => this.setDeployed(args, false)
      }
    ]
    : []);

  refresh(): void {
    this.dataSource?.fetchAgain();
  }

  private emitOpen(row: unknown): void {
    const subscription = row as NotificationSubscriptionRow | undefined;
    if (subscription?.rtId) this.openSubscription.emit(subscription);
  }

  private async setDeployed(args: CommandItemExecuteEventArgs, deployed: boolean): Promise<void> {
    const row = args.data as NotificationSubscriptionRow | undefined;
    if (!row?.rtId || row.deployed === deployed) return;
    const done = deployed
      ? await this.deployment.deploy(this.tenantId(), row)
      : await this.deployment.undeploy(this.tenantId(), row);
    if (done) this.refresh();
  }

  private healthBadges(): BadgeMappingTable {
    const badge = (key: string, color?: string) => ({
      label: this.t(`${this.k}.health${key}`),
      tooltip: this.t(`${this.k}.health${key}Hint`),
      ...(color ? { color } : {})
    });
    return {
      HEALTHY: badge('Healthy', 'var(--kendo-color-success)'),
      WAITING: badge('Waiting'),
      FAILING: badge('Failing', 'var(--kendo-color-error)'),
      'N/A': badge('None')
    };
  }
}
