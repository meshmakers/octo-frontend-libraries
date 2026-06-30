import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  TreeNavigationConfigService,
  TreeNavigationRoleConfig,
} from '@meshmakers/octo-ui';
import { MessageService } from '@meshmakers/shared-services';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { plusIcon, saveIcon, arrowRotateCwIcon, xIcon } from '@progress/kendo-svg-icons';
import {
  DEFAULT_TREE_NAVIGATION_SETTINGS_MESSAGES,
  TreeNavigationSettingsMessages,
} from './tree-navigation-settings.messages';

/** Tri-state form value for the visibility/grouping dropdowns. */
type TriState = 'auto' | string;

/**
 * Admin editor for the per-tenant `System.UI/TreeNavigationConfiguration`.
 * Each row is one override rule matched by (source type, role id); `*` as the
 * source type matches every type. Empty value = auto (default behavior).
 */
@Component({
  selector: 'mm-tree-navigation-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonsModule,
    InputsModule,
    LabelModule,
    DropDownsModule,
  ],
  templateUrl: './tree-navigation-settings.component.html',
  styleUrl: './tree-navigation-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TreeNavigationSettingsComponent implements OnInit {
  readonly messages = input<TreeNavigationSettingsMessages>(
    DEFAULT_TREE_NAVIGATION_SETTINGS_MESSAGES,
  );

  private readonly fb = inject(FormBuilder);
  private readonly config = inject(TreeNavigationConfigService);
  private readonly messageService = inject(MessageService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly typePresent = signal(true);
  private rtId: string | null = null;

  protected readonly rules = this.fb.array<FormGroup>([]);

  protected readonly saveIcon = saveIcon;
  protected readonly plusIcon = plusIcon;
  protected readonly reloadIcon = arrowRotateCwIcon;
  protected readonly removeIcon = xIcon;

  protected readonly visibleOptions = computed(() => [
    { text: this.messages().visibleAuto, value: 'auto' },
    { text: this.messages().visibleShow, value: 'show' },
    { text: this.messages().visibleHide, value: 'hide' },
  ]);
  protected readonly groupedOptions = computed(() => [
    { text: this.messages().groupedAuto, value: 'auto' },
    { text: this.messages().groupedGroup, value: 'group' },
    { text: this.messages().groupedFlatten, value: 'flatten' },
  ]);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const config = await this.config.loadConfig();
      this.typePresent.set(config.typePresent);
      this.rtId = config.rtId;
      this.rules.clear();
      for (const role of config.roles) {
        this.rules.push(this.createRow(role));
      }
    } catch (error) {
      console.error(
        '[TreeNavigationSettingsComponent] Failed to load config',
        error,
      );
      this.messageService.showError(this.messages().loadError);
    } finally {
      this.loading.set(false);
    }
  }

  protected addRule(): void {
    this.rules.push(this.createRow());
  }

  protected removeRule(index: number): void {
    this.rules.removeAt(index);
    this.rules.markAsDirty();
  }

  protected async onSave(): Promise<void> {
    if (this.rules.invalid) {
      this.rules.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const roles = this.rules.controls
        .map((group) => this.toRoleConfig(group as FormGroup))
        .filter((r) => r.sourceCkTypeId && r.roleId);
      this.rtId = await this.config.saveConfig(this.rtId, roles);
      this.messageService.showInformation(this.messages().saveSuccess);
      this.rules.markAsPristine();
    } catch (error) {
      console.error(
        '[TreeNavigationSettingsComponent] Failed to save config',
        error,
      );
      this.messageService.showError(this.messages().saveError);
    } finally {
      this.saving.set(false);
    }
  }

  private createRow(role?: TreeNavigationRoleConfig): FormGroup {
    return this.fb.group({
      sourceCkTypeId: [
        role?.sourceCkTypeId ?? '*',
        [Validators.required],
      ],
      roleId: [role?.roleId ?? '', [Validators.required]],
      displayName: [role?.displayName ?? ''],
      sortIndex: [role?.sortIndex ?? null],
      visible: [this.toVisibleValue(role?.visible)],
      grouped: [this.toGroupedValue(role?.grouped)],
      icon: [role?.icon ?? ''],
    });
  }

  private toRoleConfig(group: FormGroup): TreeNavigationRoleConfig {
    const value = group.getRawValue() as {
      sourceCkTypeId: string;
      roleId: string;
      displayName: string;
      sortIndex: number | null;
      visible: TriState;
      grouped: TriState;
      icon: string;
    };
    return {
      sourceCkTypeId: (value.sourceCkTypeId ?? '').trim(),
      roleId: (value.roleId ?? '').trim(),
      displayName: value.displayName?.trim() || undefined,
      sortIndex: value.sortIndex ?? undefined,
      visible: value.visible === 'auto' ? undefined : value.visible === 'show',
      grouped: value.grouped === 'auto' ? undefined : value.grouped === 'group',
      icon: value.icon?.trim() || undefined,
    };
  }

  private toVisibleValue(visible: boolean | undefined): TriState {
    if (visible === undefined) return 'auto';
    return visible ? 'show' : 'hide';
  }

  private toGroupedValue(grouped: boolean | undefined): TriState {
    if (grouped === undefined) return 'auto';
    return grouped ? 'group' : 'flatten';
  }
}
