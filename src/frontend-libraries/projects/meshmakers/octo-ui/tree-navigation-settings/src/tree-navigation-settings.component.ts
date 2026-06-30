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
import { CkTypeSelectorService } from '@meshmakers/octo-services';
import { MessageService } from '@meshmakers/shared-services';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import {
  plusIcon,
  saveIcon,
  arrowRotateCwIcon,
  xIcon,
  downloadIcon,
  uploadIcon,
} from '@progress/kendo-svg-icons';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_TREE_NAVIGATION_SETTINGS_MESSAGES,
  TreeNavigationSettingsMessages,
} from './tree-navigation-settings.messages';

/** Tri-state form value for the visibility/grouping dropdowns. */
type TriState = 'auto' | string;

/** Matches every source CK type. */
const WILDCARD = '*';

/**
 * Admin editor for the per-tenant `System.UI/TreeNavigationConfiguration`.
 * Each row is one override rule matched by (source type, role id); `*` as the
 * source type matches every type. Empty dropdown value = auto (default
 * behavior). Source type and role id offer autocomplete suggestions but also
 * accept custom values (so orphan roles remain configurable).
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
  private readonly ckTypeSelector = inject(CkTypeSelectorService);
  private readonly messageService = inject(MessageService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly typePresent = signal(true);
  private rtId: string | null = null;

  protected readonly rules = this.fb.array<FormGroup>([]);

  // Shared suggestion pools — only one combobox dropdown is open at a time, so a
  // single signal per kind is enough (loaded on open / filter).
  protected readonly ckTypeSuggestions = signal<string[]>([WILDCARD]);
  protected readonly roleSuggestions = signal<{ roleId: string; label: string }[]>(
    [],
  );

  protected readonly saveIcon = saveIcon;
  protected readonly plusIcon = plusIcon;
  protected readonly reloadIcon = arrowRotateCwIcon;
  protected readonly removeIcon = xIcon;
  protected readonly exportIcon = downloadIcon;
  protected readonly importIcon = uploadIcon;

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
    this.rules.markAsDirty();
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
      this.rtId = await this.config.saveConfig(this.rtId, this.collectRoles());
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

  /** Loads CK type suggestions for the source-type combobox (server filter). */
  protected async searchCkTypes(term: string): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.ckTypeSelector.getCkTypes({
          searchText: term?.trim() || undefined,
          first: 30,
        }),
      );
      const ids = result.items
        .map((i) => i.rtCkTypeId)
        .filter((id): id is string => !!id && id !== WILDCARD);
      this.ckTypeSuggestions.set([WILDCARD, ...ids]);
    } catch (error) {
      console.error('Error loading CK type suggestions', error);
      this.ckTypeSuggestions.set([WILDCARD]);
    }
  }

  /** Loads role suggestions for the source type of the opened row's combobox. */
  protected async loadRoleSuggestions(row: FormGroup): Promise<void> {
    const ckTypeId = (row.get('sourceCkTypeId')?.value as string) ?? '';
    this.roleSuggestions.set(await this.config.getRoleSuggestions(ckTypeId));
  }

  /** Downloads the current rules as a JSON file. */
  protected export(): void {
    const data = JSON.stringify({ roles: this.collectRoles() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tree-navigation-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Loads rules from a JSON file into the form (user reviews, then saves). */
  protected async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const roles = this.extractImportedRoles(parsed);
      if (!roles) {
        throw new Error('invalid configuration file');
      }
      this.rules.clear();
      for (const role of roles) {
        this.rules.push(this.createRow(role));
      }
      this.rules.markAsDirty();
      this.messageService.showInformation(this.messages().importSuccess);
    } catch (error) {
      console.error('[TreeNavigationSettingsComponent] Import failed', error);
      this.messageService.showError(this.messages().importError);
    }
  }

  private extractImportedRoles(
    parsed: unknown,
  ): TreeNavigationRoleConfig[] | null {
    const raw = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { roles?: unknown })?.roles)
        ? (parsed as { roles: unknown[] }).roles
        : null;
    if (!raw) {
      return null;
    }
    const roles: TreeNavigationRoleConfig[] = [];
    for (const entry of raw) {
      const r = entry as Partial<TreeNavigationRoleConfig>;
      if (typeof r?.sourceCkTypeId !== 'string' || typeof r?.roleId !== 'string') {
        continue;
      }
      roles.push({
        sourceCkTypeId: r.sourceCkTypeId,
        roleId: r.roleId,
        visible: typeof r.visible === 'boolean' ? r.visible : undefined,
        displayName: typeof r.displayName === 'string' ? r.displayName : undefined,
        sortIndex: typeof r.sortIndex === 'number' ? r.sortIndex : undefined,
        grouped: typeof r.grouped === 'boolean' ? r.grouped : undefined,
        icon: typeof r.icon === 'string' ? r.icon : undefined,
      });
    }
    return roles;
  }

  private collectRoles(): TreeNavigationRoleConfig[] {
    return this.rules.controls
      .map((group) => this.toRoleConfig(group as FormGroup))
      .filter((r) => r.sourceCkTypeId && r.roleId);
  }

  private createRow(role?: TreeNavigationRoleConfig): FormGroup {
    return this.fb.group({
      sourceCkTypeId: [role?.sourceCkTypeId ?? '*', [Validators.required]],
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
