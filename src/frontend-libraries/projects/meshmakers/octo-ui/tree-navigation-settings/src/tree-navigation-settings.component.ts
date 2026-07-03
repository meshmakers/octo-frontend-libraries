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
import { ActivatedRoute } from '@angular/router';
import {
  PerspectiveDefinition,
  TreeNavigationConfigService,
  TreeNavigationRoleConfig,
  TREE_NAVIGATION_CONFIG_CONSTANTS,
} from '@meshmakers/octo-ui';
import {
  AssetRepoService,
  CkTypeSelectorService,
  ImportStrategyDto,
  JobManagementService,
} from '@meshmakers/octo-services';
import { ImportStrategyDialogService } from '@meshmakers/shared-ui';
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
  private readonly assetRepo = inject(AssetRepoService);
  private readonly jobs = inject(JobManagementService);
  private readonly importStrategyDialog = inject(ImportStrategyDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly typePresent = signal(true);
  private rtId: string | null = null;

  protected readonly rules = this.fb.array<FormGroup>([]);
  protected readonly perspectiveRows = this.fb.array<FormGroup>([]);

  protected readonly rootModeOptions = computed(() => [
    { text: this.messages().rootModeSpatial, value: 'Spatial' },
    { text: this.messages().rootModeType, value: 'Type' },
  ]);

  protected readonly directionOptions = computed(() => [
    { text: this.messages().directionInbound, value: 'Inbound' },
    { text: this.messages().directionOutbound, value: 'Outbound' },
  ]);

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
      this.perspectiveRows.clear();
      for (const perspective of config.perspectives) {
        this.perspectiveRows.push(this.createPerspectiveRow(perspective));
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

  protected addPerspective(): void {
    this.perspectiveRows.push(this.createPerspectiveRow());
    this.perspectiveRows.markAsDirty();
  }

  protected removePerspective(index: number): void {
    this.perspectiveRows.removeAt(index);
    this.perspectiveRows.markAsDirty();
  }

  protected async onSave(): Promise<void> {
    if (this.rules.invalid || this.perspectiveRows.invalid) {
      this.rules.markAllAsTouched();
      this.perspectiveRows.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      this.rtId = await this.config.saveConfig(
        this.rtId,
        this.collectRoles(),
        this.collectPerspectives(),
      );
      this.messageService.showInformation(this.messages().saveSuccess);
      this.rules.markAsPristine();
      this.perspectiveRows.markAsPristine();
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

  /** Loads role suggestions for the root CK type of a perspective row. */
  protected async loadRoleSuggestionsForType(row: FormGroup): Promise<void> {
    const ckTypeId = (row.get('rootCkTypeId')?.value as string) ?? '';
    this.roleSuggestions.set(await this.config.getRoleSuggestions(ckTypeId));
  }

  /**
   * Exports the saved configuration singleton as a deep-graph runtime model ZIP,
   * via the standard asset-repo export job (same mechanism as pools / adapters /
   * data flows). Requires the config to have been saved first.
   */
  protected async export(): Promise<void> {
    if (!this.rtId) {
      this.messageService.showInformation(this.messages().exportNothing);
      return;
    }
    const tenantId = this.getTenantId();
    if (!tenantId) {
      this.messageService.showError(this.messages().exportError);
      return;
    }
    try {
      const jobId = await this.assetRepo.exportRtModelDeepGraph(
        tenantId,
        [this.rtId],
        TREE_NAVIGATION_CONFIG_CONSTANTS.CONFIG_CK_TYPE_ID,
      );
      if (!jobId) {
        throw new Error('export job not started');
      }
      const ok = await this.jobs.waitForJob(
        jobId,
        this.messages().export,
        this.messages().title,
      );
      if (ok) {
        await this.jobs.downloadJobResult(
          tenantId,
          jobId,
          'tree-navigation-config.zip',
        );
      }
    } catch (error) {
      console.error('[TreeNavigationSettingsComponent] Export failed', error);
      this.messageService.showError(this.messages().exportError);
    }
  }

  /**
   * Imports a configuration from a deep-graph runtime model ZIP via the standard
   * import-strategy dialog + asset-repo import job, then reloads the editor.
   */
  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const tenantId = this.getTenantId();
    if (!tenantId) {
      this.messageService.showError(this.messages().importError);
      return;
    }
    const strategy = await this.importStrategyDialog.showImportStrategyDialog(
      this.messages().import,
    );
    if (strategy === null) {
      return;
    }
    try {
      const jobId = await this.assetRepo.importRtModel(
        tenantId,
        file,
        strategy as ImportStrategyDto,
      );
      if (!jobId) {
        throw new Error('import job not started');
      }
      const ok = await this.jobs.waitForJob(
        jobId,
        this.messages().import,
        file.name,
      );
      if (ok) {
        this.messageService.showInformation(this.messages().importSuccess);
        await this.reload();
      }
    } catch (error) {
      console.error('[TreeNavigationSettingsComponent] Import failed', error);
      this.messageService.showError(this.messages().importError);
    }
  }

  /** Resolves the tenant id from the route hierarchy (route is /:tenantId/...). */
  private getTenantId(): string | null {
    let route: ActivatedRoute | null = this.route;
    while (route) {
      const tenantId = route.snapshot.paramMap.get('tenantId');
      if (tenantId) {
        return tenantId;
      }
      route = route.parent;
    }
    return null;
  }

  private collectRoles(): TreeNavigationRoleConfig[] {
    return this.rules.controls
      .map((group) => this.toRoleConfig(group as FormGroup))
      .filter((r) => r.sourceCkTypeId && r.roleId);
  }

  private collectPerspectives(): PerspectiveDefinition[] {
    return this.perspectiveRows.controls
      .map((group) => this.toPerspectiveConfig(group as FormGroup))
      .filter((p) => p.key);
  }

  private createPerspectiveRow(p?: PerspectiveDefinition): FormGroup {
    return this.fb.group({
      key: [p?.key ?? '', [Validators.required]],
      displayName: [p?.displayName ?? ''],
      rootMode: [p?.rootMode ?? 'Type'],
      rootCkTypeId: [p?.rootCkTypeId ?? ''],
      primaryRoleId: [p?.primaryRoleId ?? ''],
      primaryDirection: [p?.primaryDirection ?? 'Inbound'],
      secondaryRoleIds: [(p?.secondaryRoleIds ?? []).join(', ')],
      sortIndex: [p?.sortIndex ?? null],
      icon: [p?.icon ?? ''],
    });
  }

  private toPerspectiveConfig(group: FormGroup): PerspectiveDefinition {
    const value = group.getRawValue() as {
      key: string;
      displayName: string;
      rootMode: 'Spatial' | 'Type';
      rootCkTypeId: string;
      primaryRoleId: string;
      primaryDirection: 'Inbound' | 'Outbound';
      secondaryRoleIds: string;
      sortIndex: number | null;
      icon: string;
    };
    const secondary = (value.secondaryRoleIds ?? '')
      .split(/[\n,]/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const key = (value.key ?? '').trim();
    return {
      key,
      displayName: value.displayName?.trim() || key,
      rootMode: value.rootMode === 'Spatial' ? 'Spatial' : 'Type',
      rootCkTypeId: value.rootCkTypeId?.trim() || undefined,
      primaryRoleId: value.primaryRoleId?.trim() || undefined,
      primaryDirection:
        value.primaryDirection === 'Outbound' ? 'Outbound' : undefined,
      secondaryRoleIds: secondary.length > 0 ? secondary : undefined,
      sortIndex: value.sortIndex ?? undefined,
      icon: value.icon?.trim() || undefined,
    };
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
