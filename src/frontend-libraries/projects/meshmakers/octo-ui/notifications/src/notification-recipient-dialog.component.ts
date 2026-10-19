import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DialogActionsComponent, DialogContentBase, DialogRef } from '@progress/kendo-angular-dialog';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { ComboBoxComponent, DropDownListComponent } from '@progress/kendo-angular-dropdowns';
import { RadioButtonDirective } from '@progress/kendo-angular-inputs';
import { LabelComponent } from '@progress/kendo-angular-label';
import { LoaderComponent } from '@progress/kendo-angular-indicators';
import {
  CronBuilderComponent,
  CronBuilderConfig,
  CronHumanizerService,
  CronParserService,
  injectMmLanguage,
  injectMmT,
  MmDialogActionsDirective,
  NotificationDisplayService
} from '@meshmakers/shared-ui';
import {
  browserTimeZone,
  CommunicationService,
  firesMoreThanOncePerMinute,
  NOTIFICATION_RECIPIENT_CANDIDATES,
  notificationErrorText,
  NotificationRecipientCandidate,
  NotificationSubscriptionService,
  notificationTimeZones,
  withScheduleTimeZone
} from '@meshmakers/octo-services';
import { MmHttpErrorInterceptor } from '@meshmakers/shared-services';
import { DEFAULT_NOTIFICATIONS_MESSAGES, NOTIFICATIONS_KEY } from './notifications.messages';

export interface NotificationRecipientSubscription {
  rtId: string;
  ckTypeId: string;
  name: string;
  deployed: boolean;
}

export interface NotificationRecipientDialogData {
  tenantId: string;
  subscription: NotificationRecipientSubscription;
  recipientRtId?: string | null;
}

export interface NotificationRecipientDialogResult {
  recipientRtId: string;
}

const DEFAULT_CRON = '0 */5 * * * *';

function minimumInterval(parser: CronParserService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    firesMoreThanOncePerMinute((cron, count) => parser.getNextExecutions(cron, count), control.value ?? '')
      ? { tooFrequent: true } : null;
}

@Component({
  selector: 'mm-notification-recipient-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogActionsComponent,
    MmDialogActionsDirective,
    ButtonComponent,
    ComboBoxComponent,
    DropDownListComponent,
    RadioButtonDirective,
    LabelComponent,
    LoaderComponent,
    CronBuilderComponent
  ],
  templateUrl: './notification-recipient-dialog.component.html',
  styleUrl: './notification-recipient-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class NotificationRecipientDialogComponent extends DialogContentBase implements OnInit {
  private readonly ref = inject(DialogRef);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly subscriptions = inject(NotificationSubscriptionService);
  private readonly candidates = inject(NOTIFICATION_RECIPIENT_CANDIDATES);
  private readonly communication = inject(CommunicationService);
  private readonly notifications = inject(NotificationDisplayService);
  private readonly humanizer = inject(CronHumanizerService);
  private readonly parser = inject(CronParserService);
  private readonly language = injectMmLanguage();
  protected readonly t = injectMmT(DEFAULT_NOTIFICATIONS_MESSAGES);
  protected readonly k = NOTIFICATIONS_KEY;

  data!: NotificationRecipientDialogData;

  protected readonly timeZones = notificationTimeZones();
  protected readonly users = signal<NotificationRecipientCandidate[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly scheduleExpanded = signal(false);
  protected readonly duplicateOf = signal<string | null>(null);
  protected readonly userMissing = signal(false);
  protected readonly lastError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    subjectId: this.fb.control<string | null>(null, Validators.required),
    cronExpression: this.fb.control<string>(DEFAULT_CRON, [Validators.required, minimumInterval(this.parser)]),
    skipExistingRows: this.fb.control<boolean>(true),
    timeZone: this.fb.control<string>(browserTimeZone(), Validators.required)
  });

  private readonly value = signal(this.form.getRawValue());
  private originalSubjectId: string | null = null;
  private originalSkipExistingRows: boolean | null = null;
  private duplicateCheck = 0;

  protected readonly cronConfig = computed<CronBuilderConfig>(() => ({
    showPresets: true,
    showHumanReadable: true,
    showNextExecutions: true,
    maxNextExecutions: 3,
    allowCustom: true,
    defaultScheduleType: 'minutes',
    locale: this.cronLocale()
  }));

  protected readonly scheduleText = computed(() => {
    const value = this.value();
    const cron = value.cronExpression ?? '';
    if (!cron.trim()) return '';
    return withScheduleTimeZone(this.humanizer.toHumanReadable(cron, this.cronLocale()), cron, value.timeZone);
  });

  protected readonly startHint = computed(() => {
    const value = this.value();
    if (!this.data?.subscription.deployed) return this.t(`${this.k}.startNotDeployed`);
    if (!this.data.recipientRtId) return this.t(`${this.k}.startOnSave`);
    if (value.subjectId !== this.originalSubjectId) return this.t(`${this.k}.startAgain`);
    if (value.skipExistingRows !== this.originalSkipExistingRows) return this.t(`${this.k}.startOptionChanged`);
    return this.t(`${this.k}.running`);
  });

  constructor() {
    const ref = inject(DialogRef);
    super(ref);
  }

  async ngOnInit(): Promise<void> {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.value.set(this.form.getRawValue()));
    this.form.controls.subjectId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.checkDuplicate());
    try {
      await this.loadUsers();
      if (this.data.recipientRtId) {
        await this.loadRecipient(this.data.recipientRtId);
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleSchedule(): void {
    this.scheduleExpanded.update(expanded => !expanded);
  }

  protected hasError(control: 'subjectId' | 'cronExpression' | 'timeZone', error?: string): boolean {
    const c = this.form.controls[control];
    return (c.dirty || c.touched) && (error ? c.hasError(error) : c.invalid);
  }

  protected onCancel(): void {
    this.ref.close();
  }

  protected async onSave(): Promise<void> {
    if (this.form.invalid || this.duplicateOf()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const subjectId = value.subjectId!;
      const existing = await this.subscriptions.findRecipient(this.data.subscription.rtId, subjectId);
      if (existing && existing !== this.data.recipientRtId) {
        this.duplicateOf.set(this.userLabel(subjectId));
        return;
      }
      const input = {
        cronExpression: value.cronExpression!,
        skipExistingRows: value.skipExistingRows ?? true,
        timeZone: value.timeZone!
      };
      let recipientRtId = this.data.recipientRtId ?? null;
      if (recipientRtId) {
        await this.subscriptions.updateRecipient(recipientRtId, {
          ...input,
          ...(subjectId !== this.originalSubjectId ? { subjectId } : {})
        });
        this.notifications.showSuccess(this.t(`${this.k}.updated`), 3000);
      } else {
        recipientRtId = await this.subscriptions.createRecipient(this.data.subscription, { ...input, subjectId });
        this.notifications.showSuccess(this.t(`${this.k}.added`), 3000);
      }
      if (recipientRtId) {
        await this.syncSchedule(recipientRtId);
        this.ref.close({ recipientRtId } satisfies NotificationRecipientDialogResult);
      } else {
        this.ref.close();
      }
    } catch (error) {
      console.error('Error saving recipient:', error);
      this.notifications.showError(this.t(`${this.k}.saveFailed`));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      this.users.set(await this.candidates.load());
    } catch (error) {
      console.error('Error loading users:', error);
      this.notifications.showError(this.t(`${this.k}.loadUsersFailed`));
    }
  }

  private async loadRecipient(rtId: string): Promise<void> {
    const recipient = await this.subscriptions.getRecipient(rtId);
    if (!recipient) return;
    if (!this.users().some(user => user.id === recipient.subjectId)) {
      this.userMissing.set(this.users().length > 0);
      this.users.update(users => [...users, { id: recipient.subjectId, name: recipient.subjectId, email: null, label: recipient.subjectId }]);
    }
    this.originalSubjectId = recipient.subjectId;
    this.originalSkipExistingRows = recipient.skipExistingRows;
    this.lastError.set(notificationErrorText(recipient.deliveryState?.lastError));
    this.form.reset({
      subjectId: recipient.subjectId,
      cronExpression: recipient.cronExpression,
      skipExistingRows: recipient.skipExistingRows,
      timeZone: recipient.timeZone ?? 'UTC'
    });
  }

  private async checkDuplicate(): Promise<void> {
    const check = ++this.duplicateCheck;
    const subjectId = this.form.controls.subjectId.value;
    this.duplicateOf.set(null);
    if (!subjectId || subjectId === this.originalSubjectId) return;
    try {
      const existing = await this.subscriptions.findRecipient(this.data.subscription.rtId, subjectId);
      if (check === this.duplicateCheck && existing && existing !== this.data.recipientRtId) {
        this.duplicateOf.set(this.userLabel(subjectId));
      }
    } catch (error) {
      console.error('Error checking for an existing recipient:', error);
    }
  }

  private async syncSchedule(recipientRtId: string): Promise<void> {
    try {
      await this.communication.syncNotificationSchedule(this.data.tenantId, recipientRtId);
    } catch (error) {
      console.error('Error syncing the notification schedule:', error);
      if (!MmHttpErrorInterceptor.reportsToUser(error)) {
        this.notifications.showError(this.t(`${this.k}.syncFailed`));
      }
    }
  }

  private userLabel(subjectId: string): string {
    return this.users().find(user => user.id === subjectId)?.label ?? subjectId;
  }

  private cronLocale(): string {
    const language = this.language();
    return this.humanizer.isLocaleSupported(language) ? language : 'en';
  }
}
