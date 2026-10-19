import { ChangeDetectionStrategy, Component, computed, inject, input, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@progress/kendo-angular-dialog';
import {
  BadgeMappingTable,
  ConfirmationService,
  CronHumanizerService,
  injectMmLanguage,
  injectMmT,
  ListViewComponent,
  MM_ACTION_ICONS,
  NotificationDisplayService,
  TableColumn
} from '@meshmakers/shared-ui';
import { CommandItem, CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import { CommunicationService, NotificationSubscriptionService, withScheduleTimeZone } from '@meshmakers/octo-services';
import { NotificationRecipientRow, NotificationRecipientsDataSourceDirective } from './notification-recipients-data-source.directive';
import {
  NotificationRecipientDialogComponent,
  NotificationRecipientDialogResult,
  NotificationRecipientSubscription
} from './notification-recipient-dialog.component';
import { DEFAULT_NOTIFICATIONS_MESSAGES, NOTIFICATIONS_KEY } from './notifications.messages';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

@Component({
  selector: 'mm-notification-recipients',
  standalone: true,
  imports: [ListViewComponent, NotificationRecipientsDataSourceDirective],
  template: `
    <mm-list-view
      [mmNotificationRecipientsDataSource]="subscription().rtId"
      #dataSource="mmNotificationRecipientsDataSource"
      [pageSize]="10"
      [persistListState]="false"
      [sortable]="false"
      [rowFilterEnabled]="false"
      [searchTextBoxEnabled]="true"
      [selectable]="{ mode: 'multiple', enabled: canWrite() }"
      [actionsColumnWidth]="110"
      rowLabelField="userLabel"
      [leftToolbarActions]="toolbarActions()"
      [columns]="columns()"
      [actionCommandItems]="actionItems()"
      [contextMenuCommandItems]="contextMenuItems()">
    </mm-list-view>
  `,
  changeDetection: ChangeDetectionStrategy.Eager
})
export class NotificationRecipientsComponent {
  private readonly dialogs = inject(DialogService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(NotificationDisplayService);
  private readonly subscriptions = inject(NotificationSubscriptionService);
  private readonly communication = inject(CommunicationService);
  private readonly humanizer = inject(CronHumanizerService);
  private readonly language = injectMmLanguage();
  protected readonly t = injectMmT(DEFAULT_NOTIFICATIONS_MESSAGES);
  private readonly k = NOTIFICATIONS_KEY;

  readonly tenantId = input.required<string>();
  readonly subscription = input.required<NotificationRecipientSubscription>();
  readonly canWrite = input(true);

  @ViewChild('dataSource') private dataSource?: NotificationRecipientsDataSourceDirective;

  protected readonly toolbarActions = computed<CommandItem[]>(() => this.canWrite()
    ? [{ id: 'add', type: 'link', primary: true, text: this.t(`${this.k}.addRecipient`), svgIcon: MM_ACTION_ICONS.add, onClick: () => this.openDialog(null) }]
    : []);

  protected readonly actionItems = computed<CommandItem[]>(() => this.canWrite()
    ? [{
      id: 'edit', type: 'link', text: this.t(`${this.k}.edit`), svgIcon: MM_ACTION_ICONS.edit,
      onClick: (args: CommandItemExecuteEventArgs) => this.openDialog((args.data as NotificationRecipientRow | undefined)?.rtId ?? null)
    }]
    : []);

  protected readonly contextMenuItems = computed<CommandItem[]>(() => this.canWrite()
    ? [{ id: 'delete', type: 'link', text: this.t(`${this.k}.delete`), svgIcon: MM_ACTION_ICONS.delete, danger: true, onClick: this.onDelete }]
    : []);

  protected readonly columns = computed<TableColumn[]>(() => {
    this.language();
    return [
      { field: 'userLabel', displayName: this.t(`${this.k}.columnUser`), dataType: 'text', minWidth: 220, sortable: false, filterable: false },
      {
        field: 'cronExpression',
        displayName: this.t(`${this.k}.columnSchedule`),
        dataType: 'text',
        width: 260,
        sortable: false,
        filterable: false,
        formatter: (value, item) => this.describeSchedule(String(value ?? ''), (item as NotificationRecipientRow | undefined)?.timeZone)
      },
      {
        field: 'skipExistingRows',
        displayName: this.t(`${this.k}.columnSends`),
        dataType: 'text',
        width: 170,
        sortable: false,
        filterable: false,
        formatter: value => value ? this.t(`${this.k}.onwards`) : this.t(`${this.k}.catchUp`)
      },
      { field: 'status', displayName: this.t(`${this.k}.columnStatus`), dataType: 'badge', width: 140, sortable: false, filterable: false, badgeMapping: this.statusBadges() },
      { field: 'lastSentAt', displayName: this.t(`${this.k}.columnLastMail`), dataType: 'iso8601', format: 'short', width: 160, sortable: false, filterable: false }
    ];
  });

  refresh(): void {
    this.dataSource?.fetchAgain();
  }

  private describeSchedule(cron: string, timeZone: string | null | undefined): string {
    if (!cron.trim()) return '';
    const language = this.language();
    const locale = this.humanizer.isLocaleSupported(language) ? language : 'en';
    return withScheduleTimeZone(this.humanizer.toHumanReadable(cron, locale), cron, timeZone);
  }

  private statusBadges(): BadgeMappingTable {
    const badge = (key: string, tone: Tone) => ({
      label: this.t(`${this.k}.status${key}`),
      tooltip: this.t(`${this.k}.status${key}Hint`),
      ...(tone === 'neutral' ? {} : { color: `var(--kendo-color-${tone})` })
    });
    return {
      HEALTHY: badge('Healthy', 'success'),
      WATCHING: badge('Watching', 'success'),
      WAITING: badge('Waiting', 'neutral'),
      RUNNING: badge('Running', 'info'),
      FAILING: badge('Failing', 'error'),
      PAUSED: badge('Paused', 'neutral'),
      USER_DELETED: badge('UserDeleted', 'warning'),
      NOT_SCHEDULED: badge('NotScheduled', 'warning')
    };
  }

  private async openDialog(recipientRtId: string | null): Promise<void> {
    const subscription = this.subscription();
    const title = this.t(`${this.k}.${recipientRtId ? 'dialogTitleEdit' : 'dialogTitleNew'}`, { subscription: subscription.name });
    const ref = this.dialogs.open({ title, content: NotificationRecipientDialogComponent, width: 640, maxHeight: '90vh' });
    (ref.content.instance as NotificationRecipientDialogComponent).data = { tenantId: this.tenantId(), subscription, recipientRtId };
    const result = await firstValueFrom(ref.result);
    if ((result as NotificationRecipientDialogResult | undefined)?.recipientRtId) {
      this.refresh();
    }
  }

  private readonly onDelete = async (args: CommandItemExecuteEventArgs): Promise<void> => {
    const rows = (Array.isArray(args.data) ? args.data : [args.data]).filter((row): row is NotificationRecipientRow => !!row?.rtId);
    if (rows.length === 0) return;
    const one = rows.length === 1;
    const user = rows[0].userEmail;
    const confirmed = await this.confirmation.showDangerConfirm({
      title: one
        ? this.t(`${this.k}.deleteTitleOne`, { subscription: this.subscription().name, user })
        : this.t(`${this.k}.deleteTitleMany`, { count: rows.length }),
      targetName: one ? user : this.t(`${this.k}.deleteTargetMany`, { count: rows.length }),
      consequence: one ? this.t(`${this.k}.deleteConsequenceOne`, { user }) : this.t(`${this.k}.deleteConsequenceMany`),
      confirmText: one ? this.t(`${this.k}.deleteConfirmOne`) : this.t(`${this.k}.deleteConfirmMany`)
    });
    if (!confirmed) return;

    try {
      const result = await this.subscriptions.deleteWithDeliveryStates(
        rows.map(row => ({ rtId: row.rtId, ckTypeId: row.ckTypeId })),
        rows.flatMap(row => row.deliveryState ? [row.deliveryState] : []));
      this.notifications.showSuccess(one ? this.t(`${this.k}.deleted`) : this.t(`${this.k}.deletedMany`, { count: rows.length }), 3000);
      if (!result.deliveryStatesErased) {
        this.notifications.showError(this.t(`${this.k}.deliveryStateNotErased`));
      }
    } catch (error) {
      console.error('Error deleting recipients:', error);
      this.notifications.showError(this.t(`${this.k}.deleteFailed`));
      return;
    } finally {
      this.refresh();
    }

    let syncError: unknown = null;
    for (const row of rows) {
      try {
        await this.communication.syncNotificationSchedule(this.tenantId(), row.rtId);
      } catch (error) {
        syncError ??= error;
      }
    }
    if (syncError) {
      console.error('Error syncing the notification schedule:', syncError);
      this.notifications.showError(this.t(`${this.k}.syncFailed`));
    }
  };
}
