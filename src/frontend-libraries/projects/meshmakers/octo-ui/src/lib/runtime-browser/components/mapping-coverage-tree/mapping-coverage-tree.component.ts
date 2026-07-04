import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { LayoutModule } from '@progress/kendo-angular-layout';
import {
  arrowRotateCwIcon,
  folderOpenIcon,
  linkIcon,
  pencilIcon,
  plusIcon,
  trashIcon,
} from '@progress/kendo-svg-icons';
import { TreeItemData, TreeItemDataTyped } from '@meshmakers/shared-services';
import { ConfirmationService, TreeComponent } from '@meshmakers/shared-ui';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateEntitiesDtoGQL } from '../../../graphQL/createEntities';
import { DeleteEntitiesDtoGQL } from '../../../graphQL/deleteEntities';
import {
  AssociationModOptionsDto,
  CommunicationService,
  DeleteStrategiesDto,
  GetEntitiesByCkTypeDtoGQL,
  GraphDirectionDto,
  GraphQL,
} from '@meshmakers/octo-services';
import { GetLatestValidationExecutionDtoGQL } from '../../../graphQL/getLatestValidationExecution';
import { GetNodeMappingsDtoGQL } from '../../../graphQL/getNodeMappings';
import { GetOrphanCandidatesDtoGQL, GetOrphanCandidatesQueryDto } from '../../../graphQL/getOrphanCandidates';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
import {
  PerspectiveDefinition,
  TreeNavigationConfigService,
} from '../../services/tree-navigation-config.service';
import { PerspectiveSwitcherComponent } from '../perspective-switcher/perspective-switcher.component';
import { BulkMappingDialogService } from './bulk-mapping-dialog.service';
import { MappingCoverageTreeDataSource } from './mapping-coverage-tree-data-source';
import { MappingExpressionEvaluatorFn } from './mapping-expression-preview';
import { MappingEditDialogService, MappingEditValue } from './mapping-edit-dialog.service';
import {
  CoverageEntityRef,
  CoverageMappingItem,
  CoverageNodePayload,
  CoverageNodeStatus,
  CoverageReportSummary,
  CoverageValidationDetail,
  DEFAULT_MAPPING_COVERAGE_TREE_CONFIG,
  MappingCoverageTreeConfig,
  OrphanCandidate,
  OrphanCandidateParent,
} from './mapping-coverage-tree.models';

type OrphanCandidatesConnection = NonNullable<
  NonNullable<GetOrphanCandidatesQueryDto['runtime']>['runtimeEntities']
>;
type OrphanCandidateQueryItem = NonNullable<OrphanCandidatesConnection['items']>[number];

/** Page size for the orphan-candidate catalogue walk. */
const ORPHAN_PAGE_SIZE = 500;
/**
 * Safety valve against a backend paging bug (endCursor not advancing):
 * 200 pages × 500 rows = 100k candidates, far beyond any real source catalogue.
 */
const ORPHAN_MAX_PAGES = 200;

interface RootCandidate {
  rtId: string;
  ckTypeId: string;
  name: string;
  description: string;
}

interface PipelineCandidate {
  rtId: string;
  ckTypeId: string;
  name: string;
}

/**
 * A bucket of orphan candidates sharing the same immediate parent. Produced
 * by `orphanGroupedList` when the "group by parent" toggle is on.
 */
interface OrphanGroup {
  /** Stable key — parent's CkTypeId@RtId, or `__no_parent__` for the catch-all bucket. */
  key: string;
  /** Human-readable label rendered as the section heading. */
  label: string;
  items: OrphanCandidate[];
}

/**
 * Statistics object emitted by the GenerateDataPointMappings@1 node (its
 * `statisticsTargetPath` output, stored into PipelineExecution.OutputData via
 * SetPipelineExecutionResult). All fields optional — the UI shows whatever the
 * pipeline provided and falls back to a plain "completed" note otherwise.
 */
interface GenerationStatistics {
  totalContainers?: number;
  matchedContainers?: number;
  unmatchedContainers?: number;
  unmatchedContainerNames?: string[];
  totalSuggestions?: number;
  ruleHits?: Record<string, number>;
  definedRuleIds?: string[];
}

/** Key of the built-in spatial perspective (the pre-perspective default tree). */
const SPATIAL_PERSPECTIVE_KEY = 'Spatial';

/**
 * The always-available built-in perspective: roots and hierarchy exactly as
 * configured in {@link MappingCoverageTreeConfig} (Basic/Tree + ParentChild by
 * default). Synthesized rather than stored, mirroring the runtime browser
 * (AB#4263), so a zero-config tenant has exactly one perspective and the
 * switcher hides itself.
 */
const BUILT_IN_SPATIAL_PERSPECTIVE: PerspectiveDefinition = {
  key: SPATIAL_PERSPECTIVE_KEY,
  displayName: 'Spatial',
  rootMode: 'Spatial',
  sortIndex: 0,
};

/**
 * Master-detail component that visualises mapping coverage on a generic entity
 * hierarchy (defaults: Basic/Tree + Basic/TreeNode, mappings via
 * System.Communication/MapsTo). The user picks a root, browses the hierarchy on
 * the left and inspects / edits DataPointMappings on the right.
 *
 * Phase 1: tree + counts + read-only mapping list + CRUD (add new mapping,
 * relink source via {@link EntitySelectorDialogService}, delete).
 */
@Component({
  selector: 'mm-mapping-coverage-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    LayoutModule,
    SVGIconModule,
    TreeComponent,
    PerspectiveSwitcherComponent,
  ],
  providers: [MappingCoverageTreeDataSource],
  templateUrl: './mapping-coverage-tree.component.html',
  styleUrls: ['./mapping-coverage-tree.component.scss'],
})
export class MappingCoverageTreeComponent implements OnInit, OnChanges {
  private readonly entitySelector = inject(EntitySelectorDialogService);
  private readonly treeNavConfig = inject(TreeNavigationConfigService);
  private readonly editDialog = inject(MappingEditDialogService);
  private readonly bulkDialog = inject(BulkMappingDialogService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly communicationService = inject(CommunicationService);
  private readonly getEntitiesByCkType = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly getNodeMappingsGQL = inject(GetNodeMappingsDtoGQL);
  private readonly getRuntimeEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly getLatestValidationGQL = inject(GetLatestValidationExecutionDtoGQL);
  private readonly getOrphanCandidatesGQL = inject(GetOrphanCandidatesDtoGQL);
  private readonly createEntitiesGQL = inject(CreateEntitiesDtoGQL);
  private readonly deleteEntitiesGQL = inject(DeleteEntitiesDtoGQL);
  private readonly updateEntitiesGQL = inject(UpdateRuntimeEntitiesDtoGQL);

  protected readonly dataSource = inject(MappingCoverageTreeDataSource);

  @ViewChild(TreeComponent, { static: false })
  protected treeView!: TreeComponent;

  /** Optional override for non-default hierarchies / mapping roles. */
  @Input() config: MappingCoverageTreeConfig = DEFAULT_MAPPING_COVERAGE_TREE_CONFIG;

  /** Pre-select a root on first show (e.g. via route param). */
  @Input() initialRoot: CoverageEntityRef | null = null;

  /**
   * Current tenant ID. Required for the "Run Validation" pipeline trigger
   * which calls a tenant-scoped REST endpoint on the Communication Controller.
   * When not provided, the Run button is hidden and the user has to trigger
   * the pipeline externally.
   */
  @Input() tenantId: string | null = null;

  /**
   * Optional host-provided expression evaluator (e.g. expr-eval via
   * `@meshmakers/octo-process-diagrams`' ExpressionEvaluatorService). When
   * set, the mapping edit dialogs show a live preview of the expression
   * applied to the source data point's current value.
   */
  @Input() expressionEvaluator: MappingExpressionEvaluatorFn | null = null;

  @Output() readonly entitySelected = new EventEmitter<CoverageEntityRef>();

  protected readonly icons = {
    refresh: arrowRotateCwIcon,
    folderOpen: folderOpenIcon,
    plus: plusIcon,
    pencil: pencilIcon,
    trash: trashIcon,
    link: linkIcon,
  };

  /** Selectable tree perspectives (built-in Spatial + per-tenant configured). */
  protected readonly perspectives = signal<PerspectiveDefinition[]>([
    BUILT_IN_SPATIAL_PERSPECTIVE,
  ]);
  protected readonly activePerspectiveKey = signal<string>(SPATIAL_PERSPECTIVE_KEY);

  /**
   * CK type whose instances populate the root dropdown: the active `Type`
   * perspective's rootCkTypeId, or the config default for Spatial.
   */
  protected readonly activeRootCkTypeId = computed<string>(() => {
    const active = this.perspectives().find(p => p.key === this.activePerspectiveKey());
    return active?.rootMode === 'Type' && active.rootCkTypeId
      ? active.rootCkTypeId
      : this.config.rootCkTypeId;
  });

  protected readonly rootCandidates = signal<RootCandidate[]>([]);
  protected readonly selectedRoot = signal<RootCandidate | null>(null);
  protected readonly selectedNode = signal<CoverageNodePayload | null>(null);
  protected readonly mappings = signal<CoverageMappingItem[]>([]);
  protected readonly mappingsLoading = signal<boolean>(false);
  protected readonly mappingsError = signal<string | null>(null);

  protected readonly validationPipelines = signal<PipelineCandidate[]>([]);
  protected readonly selectedPipeline = signal<PipelineCandidate | null>(null);
  protected readonly validationSummary = signal<CoverageReportSummary | null>(null);
  protected readonly validationExecutedAt = signal<string | null>(null);
  protected readonly validationLoading = signal<boolean>(false);
  protected readonly validationError = signal<string | null>(null);
  protected readonly validationRunning = signal<boolean>(false);

  /** Generation: run a GenerateDataPointMappings-based pipeline from the UI. */
  protected readonly selectedGenerationPipeline = signal<PipelineCandidate | null>(null);
  protected readonly generationRunning = signal<boolean>(false);
  protected readonly generationError = signal<string | null>(null);
  protected readonly generationStats = signal<GenerationStatistics | null>(null);
  protected readonly generationCompletedAt = signal<string | null>(null);

  /** Active tab: 'coverage' shows the tree, 'orphans' shows the unmapped sources. */
  protected readonly activeTab = signal<'coverage' | 'orphans'>('coverage');

  /** Source CK type currently inspected for orphans. */
  protected readonly orphanCkType = signal<string | null>(null);
  protected readonly orphanCandidates = signal<OrphanCandidate[]>([]);
  protected readonly orphanLoading = signal<boolean>(false);
  protected readonly orphanError = signal<string | null>(null);
  protected readonly orphanHideMapped = signal<boolean>(true);

  protected readonly orphanFilteredList = computed(() => {
    const all = this.orphanCandidates();
    return this.orphanHideMapped() ? all.filter(c => c.mappingCount === 0) : all;
  });

  /** rtIds of the orphan rows selected for the bulk "Map selected…" action. */
  protected readonly orphanSelectedIds = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly orphanSelectedCount = computed(() => this.orphanSelectedIds().size);
  protected readonly orphanStats = computed(() => {
    const all = this.orphanCandidates();
    const unmapped = all.filter(c => c.mappingCount === 0).length;
    return { total: all.length, unmapped, mapped: all.length - unmapped };
  });

  /**
   * Which parent CK type to group by, or null for a flat list. We let the user
   * pick the type instead of just "immediate parent" because Loxone-style trees
   * include intermediate buckets (Loxone/Category) where each parent rtId is
   * unique per room — grouping by Category produces dozens of look-alike
   * sections ("Stellantrieb" appears N times, once per room). The user almost
   * always wants Loxone/Room or whichever level genuinely partitions the data,
   * so we expose all parent types seen in the loaded data and let them choose.
   */
  protected readonly orphanGroupParentType = signal<string | null>(null);

  /**
   * Distinct parent CK type ids found in the loaded candidates, sorted so the
   * deepest type (root-most ancestor) comes first. For Loxone-Controls this is
   * Loxone/Room first, then Loxone/Category — usually the deeper one is also
   * the more meaningful grouping context.
   */
  protected readonly orphanAvailableParentTypes = computed<string[]>(() => {
    const maxDepthByType = new Map<string, number>();
    for (const item of this.orphanCandidates()) {
      item.parentPath.forEach((p, idx) => {
        const prev = maxDepthByType.get(p.ckTypeId) ?? -1;
        if (idx > prev) maxDepthByType.set(p.ckTypeId, idx);
      });
    }
    return Array.from(maxDepthByType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ckTypeId]) => ckTypeId);
  });

  protected readonly orphanGroupedList = computed<OrphanGroup[]>(() => {
    const groupBy = this.orphanGroupParentType();
    if (!groupBy) return [];
    const groups = new Map<string, OrphanGroup>();
    for (const item of this.orphanFilteredList()) {
      // First ancestor of the chosen type (closest to leaf wins). Falls back to
      // the catch-all bucket when no ancestor of that type is in the chain.
      const ancestor = item.parentPath.find(p => p.ckTypeId === groupBy);
      const key = ancestor ? `${ancestor.ckTypeId}@${ancestor.rtId}` : '__no_parent__';
      const label = ancestor?.name ?? '(no parent of this type)';
      let group = groups.get(key);
      if (!group) {
        group = { key, label, items: [] };
        groups.set(key, group);
      }
      group.items.push(item);
    }
    // Sort groups by their (locale-aware) label; "(no parent…)" lands last.
    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === '__no_parent__') return 1;
      if (b.key === '__no_parent__') return -1;
      return a.label.localeCompare(b.label);
    });
  });

  protected readonly summaryLine = computed(() => {
    const node = this.selectedNode();
    if (!node) return null;
    const items = this.mappings();
    const enabled = items.filter(m => m.enabled).length;
    return `${items.length} mapping(s), ${enabled} enabled`;
  });

  public async ngOnInit(): Promise<void> {
    this.dataSource.setConfig(this.config);
    if (this.config.sourceCandidateCkTypeIds.length > 0) {
      this.orphanCkType.set(this.config.sourceCandidateCkTypeIds[0]);
    }
    await Promise.all([
      this.loadRootCandidates(),
      this.loadValidationPipelines(),
      this.loadPerspectives(),
    ]);

    if (this.initialRoot) {
      const match = this.rootCandidates().find(r => r.rtId === this.initialRoot?.rtId);
      if (match) {
        await this.selectRoot(match);
      }
    }
  }

  /**
   * The Studio loads the per-tenant source-candidate CK types ASYNCHRONOUSLY
   * (System.UI singleton) and re-emits the `config` input when they arrive —
   * after this component's ngOnInit already ran with an empty list. Pick up
   * the late config here: refresh the data source and initialise the orphan
   * tab's type selection once, loading the catalogue immediately when the
   * tab is already active (otherwise it silently stays empty).
   */
  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['config'] || changes['config'].isFirstChange()) {
      return;
    }
    this.dataSource.setConfig(this.config);

    const sourceTypes = this.config.sourceCandidateCkTypeIds;
    const current = this.orphanCkType();
    if (current && !sourceTypes.includes(current)) {
      // The selected type was removed from the configuration.
      this.orphanCkType.set(null);
      this.orphanCandidates.set([]);
      this.clearOrphanSelection();
    }
    if (!this.orphanCkType() && sourceTypes.length > 0) {
      this.orphanCkType.set(sourceTypes[0]);
      if (this.activeTab() === 'orphans') {
        void this.loadOrphanCandidates();
      }
    }
  }

  /**
   * Loads the per-tenant tree perspectives (AB#4263) shared with the runtime
   * browser via {@link TreeNavigationConfigService} and prepends the built-in
   * Spatial one, de-duplicated by key (a configured `Spatial` overrides the
   * built-in). Failures degrade to the built-in perspective only.
   */
  private async loadPerspectives(): Promise<void> {
    try {
      const configured = await this.treeNavConfig.perspectives();
      const byKey = new Map<string, PerspectiveDefinition>();
      byKey.set(BUILT_IN_SPATIAL_PERSPECTIVE.key, BUILT_IN_SPATIAL_PERSPECTIVE);
      for (const p of configured) {
        byKey.set(p.key, p);
      }
      this.perspectives.set(
        [...byKey.values()].sort(
          (a, b) =>
            (a.sortIndex ?? Number.MAX_SAFE_INTEGER) -
              (b.sortIndex ?? Number.MAX_SAFE_INTEGER) ||
            a.displayName.localeCompare(b.displayName),
        ),
      );
    } catch (error) {
      console.error('Failed to load tree perspectives:', error);
    }
  }

  /**
   * Switches the active perspective: applies the root-level navigation
   * override on the data source (primary role + direction for `Type`
   * perspectives), clears the current selection and reloads the root
   * candidates from the perspective's root CK type.
   */
  protected async onPerspectiveChange(key: string): Promise<void> {
    if (key === this.activePerspectiveKey()) return;
    this.activePerspectiveKey.set(key);

    const active = this.perspectives().find(p => p.key === key);
    if (active?.rootMode === 'Type' && active.primaryRoleId) {
      this.dataSource.setRootPerspectiveNav({
        childRoleId: active.primaryRoleId,
        childDirection:
          active.primaryDirection === 'Outbound'
            ? GraphDirectionDto.OutboundDto
            : GraphDirectionDto.InboundDto,
      });
    } else {
      this.dataSource.setRootPerspectiveNav(null);
    }

    // The root list changes with the perspective — reset the selection.
    this.selectedRoot.set(null);
    this.selectedNode.set(null);
    this.mappings.set([]);
    this.dataSource.setRoot(null);
    await this.loadRootCandidates();
  }

  protected onPipelineSelectChange(rtId: string): void {
    const match = this.validationPipelines().find(p => p.rtId === rtId);
    this.selectedPipeline.set(match ?? null);
  }

  protected async refreshValidation(): Promise<void> {
    const pipeline = this.selectedPipeline();
    if (!pipeline) {
      this.validationError.set('Pick a validation pipeline first.');
      return;
    }

    this.validationLoading.set(true);
    this.validationError.set(null);
    try {
      const data = await firstValueFrom(
        this.getLatestValidationGQL
          .fetch({
            variables: {
              pipelineRtId: pipeline.rtId,
              pipelineCkTypeId: pipeline.ckTypeId,
              executesRoleId: this.config.validationExecutesRoleId,
              executionCkTypeId: this.config.validationExecutionCkTypeId,
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0])),
      );

      const execution = data?.associations?.executions?.items?.[0];
      const attrs = execution?.attributes?.items;
      // Case-insensitive lookup: the engine normalises attribute names to
      // camelCase in the response (`outputData`, `completedAt`) even though
      // the CK YAML declares them as PascalCase. The Strict reader was a
      // mistake — it matched nothing in practice and the user always saw
      // "no validation output yet" no matter how often they ran the pipeline.
      const outputData = readAttr(attrs, 'OutputData');
      const completedAt = readAttr(attrs, 'CompletedAt');

      if (!outputData) {
        this.dataSource.setValidationMap(new Map());
        this.validationSummary.set(null);
        this.validationExecutedAt.set(null);
        this.validationError.set('Pipeline has no validation output yet — run the pipeline first.');
        await this.refreshTreeOverlay();
        return;
      }

      const { map: detailMap, summary } = parseValidationReport(outputData);
      this.dataSource.setValidationMap(detailMap);
      this.validationSummary.set(summary);
      this.validationExecutedAt.set(completedAt);
      await this.refreshTreeOverlay();
    } catch (error) {
      console.error('Failed to load validation report:', error);
      this.validationError.set('Failed to load validation report.');
    } finally {
      this.validationLoading.set(false);
    }
  }

  protected clearValidation(): void {
    this.dataSource.setValidationMap(new Map());
    this.validationSummary.set(null);
    this.validationExecutedAt.set(null);
    this.validationError.set(null);
    void this.refreshTreeOverlay();
  }

  // ─── Orphan-Sources Tab ────────────────────────────────────────────────────

  protected selectTab(tab: 'coverage' | 'orphans'): void {
    this.activeTab.set(tab);
    if (tab === 'orphans' && this.orphanCkType() && this.orphanCandidates().length === 0) {
      void this.loadOrphanCandidates();
    }
  }

  protected onOrphanCkTypeChange(ckTypeId: string): void {
    this.orphanCkType.set(ckTypeId || null);
    this.orphanCandidates.set([]);
    this.clearOrphanSelection();
    if (ckTypeId) void this.loadOrphanCandidates();
  }

  protected async refreshOrphans(): Promise<void> {
    await this.loadOrphanCandidates();
  }

  protected toggleOrphanHideMapped(): void {
    this.orphanHideMapped.update(v => !v);
  }

  protected onOrphanGroupParentTypeChange(value: string): void {
    this.orphanGroupParentType.set(value ? value : null);
  }

  /**
   * Returns the parent chain ordered for breadcrumb display: root-most ancestor
   * first, immediate parent last. `parentPath` itself is stored immediate-first
   * (so `parentPath[0]` cheaply reports the grouping key), but humans read
   * breadcrumbs from outside in.
   */
  protected breadcrumbFor(item: OrphanCandidate): OrphanCandidateParent[] {
    return [...item.parentPath].reverse();
  }

  /**
   * Fetches all entities of the selected source CK type and tags each with
   * its inbound MapsFrom DataPointMapping count. The view filters the list
   * down to mappingCount === 0 by default, but the user can flip the toggle
   * to see all candidates (mapped + unmapped) for verification.
   *
   * Pages through the connection cursor until `hasNextPage` is false so
   * catalogues larger than one page are loaded completely (an earlier
   * version fetched a single 1000-row page and silently truncated).
   */
  private async loadOrphanCandidates(): Promise<void> {
    const ckTypeId = this.orphanCkType();
    if (!ckTypeId) return;

    this.orphanLoading.set(true);
    this.orphanError.set(null);
    try {
      const result: OrphanCandidateQueryItem[] = [];
      // offsetToCursor(0) is null by contract ("start at the beginning"), so
      // the loop is guarded by hasNextPage, not by the cursor value.
      let after: string | null = GraphQL.offsetToCursor(0);
      let hasNextPage = true;
      for (let page = 0; page < ORPHAN_MAX_PAGES && hasNextPage; page++) {
        const connection: OrphanCandidatesConnection | null | undefined = await firstValueFrom(
          this.getOrphanCandidatesGQL
            .fetch({
              variables: {
                ckTypeId,
                mapsFromRoleId: this.config.mappingSourceRoleId,
                mappingCkTypeId: this.config.mappingCkTypeId,
                childRoleId: this.config.childRoleId,
                childCkTypeId: this.config.childCkTypeId,
                first: ORPHAN_PAGE_SIZE,
                after,
              },
              fetchPolicy: 'network-only',
            })
            .pipe(map(r => r.data?.runtime?.runtimeEntities)),
        );
        result.push(...(connection?.items ?? []));
        const pageInfo = connection?.pageInfo;
        const nextCursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
        hasNextPage = nextCursor != null;
        if (nextCursor != null) {
          after = String(nextCursor);
        }
      }
      if (hasNextPage) {
        console.warn(
          `Orphan candidate load stopped after ${ORPHAN_MAX_PAGES} pages (${result.length} rows) — increase ORPHAN_MAX_PAGES if this catalogue is legitimately that large.`,
        );
      }

      const candidates: OrphanCandidate[] = (result ?? [])
        .filter((e): e is NonNullable<typeof e> => !!e && !!e.rtId && !!e.ckTypeId)
        .map(e => ({
          rtId: e.rtId as string,
          ckTypeId: e.ckTypeId as string,
          name: readAttr(e.attributes?.items, 'name') ?? e.rtWellKnownName ?? (e.rtId as string),
          description: readAttr(e.attributes?.items, 'description') ?? undefined,
          mappingCount: e.associations?.mappings?.totalCount ?? 0,
          parentPath: extractParentPath(e.associations?.parent?.items?.[0]),
        }));
      candidates.sort((a, b) => {
        // Show unmapped first, then alphabetical.
        if (a.mappingCount === 0 && b.mappingCount > 0) return -1;
        if (a.mappingCount > 0 && b.mappingCount === 0) return 1;
        return a.name.localeCompare(b.name);
      });
      this.orphanCandidates.set(candidates);
      // Prune the bulk selection to rows that still exist after the reload.
      this.orphanSelectedIds.update(current => {
        const valid = new Set(candidates.map(c => c.rtId));
        return new Set([...current].filter(id => valid.has(id)));
      });
    } catch (error) {
      console.error('Failed to load orphan candidates:', error);
      this.orphanError.set('Failed to load source candidates.');
      this.orphanCandidates.set([]);
    } finally {
      this.orphanLoading.set(false);
    }
  }

  /**
   * Opens the mapping editor pre-populated with the orphan as source and lets
   * the user pick the target + attribute paths. Creates the DataPointMapping
   * entity atomically on save (both MapsFrom and MapsTo wired up in one
   * mutation). Cancel leaves nothing behind.
   */
  protected async createMappingFromOrphan(orphan: OrphanCandidate): Promise<void> {
    const skeleton: MappingEditValue = {
      // Empty rtId flags this as a not-yet-persisted mapping; saveEditedMapping
      // routes it through CreateEntities instead of UpdateRuntimeEntities.
      rtId: '',
      ckTypeId: this.config.mappingCkTypeId,
      name: `${orphan.name} mapping`,
      enabled: true,
      sourceRtId: orphan.rtId,
      sourceCkTypeId: orphan.ckTypeId,
      sourceName: orphan.name,
      sourceAttributePath: '',
      mappingExpression: '',
      targetAttributePath: '',
    };
    const result = await this.editDialog.open({
      mapping: skeleton,
      expressionEvaluator: this.expressionEvaluator ?? undefined,
    });
    if (!result.confirmed) return;
    try {
      await this.saveEditedMapping(result.mapping);
      await this.loadOrphanCandidates();
    } catch (error) {
      console.error('Failed to create mapping for orphan:', error);
      this.orphanError.set('Failed to create mapping.');
    }
  }

  protected trackOrphanByRtId(_index: number, item: OrphanCandidate): string {
    return item.rtId;
  }

  // ─── Orphan multi-select + bulk mapping ────────────────────────────────────

  protected isOrphanSelected(rtId: string): boolean {
    return this.orphanSelectedIds().has(rtId);
  }

  protected toggleOrphanSelected(rtId: string): void {
    this.orphanSelectedIds.update(current => {
      const next = new Set(current);
      if (next.has(rtId)) next.delete(rtId);
      else next.add(rtId);
      return next;
    });
  }

  /** Selects every row currently visible under the active filter. */
  protected selectAllVisibleOrphans(): void {
    this.orphanSelectedIds.set(new Set(this.orphanFilteredList().map(c => c.rtId)));
  }

  protected clearOrphanSelection(): void {
    this.orphanSelectedIds.set(new Set<string>());
  }

  /**
   * Opens the bulk mapping dialog for all selected orphan rows and, on
   * confirm, creates one DataPointMapping per source in a single atomic
   * CreateEntities mutation (shared target entity + paths + expression,
   * per-source MapsFrom association and generated name).
   */
  protected async bulkMapSelected(): Promise<void> {
    const selectedIds = this.orphanSelectedIds();
    const sources = this.orphanCandidates().filter(c => selectedIds.has(c.rtId));
    if (sources.length === 0) return;

    const result = await this.bulkDialog.open({
      expressionEvaluator: this.expressionEvaluator ?? undefined,
      sources: sources.map(s => ({
        rtId: s.rtId,
        ckTypeId: s.ckTypeId,
        name: s.name,
        description: s.description,
      })),
    });
    if (!result.confirmed) return;
    const value = result.value;

    const targetLabel = value.targetName || value.targetRtId;
    const entities = sources.map(source => ({
      ckTypeId: this.config.mappingCkTypeId,
      attributes: [
        {
          attributeName: 'Name',
          value: `${source.name} ${value.sourceAttributePath} → ${targetLabel} ${value.targetAttributePath}`,
        },
        { attributeName: 'Enabled', value: value.enabled },
        { attributeName: 'SourceAttributePath', value: value.sourceAttributePath },
        { attributeName: 'MappingExpression', value: value.mappingExpression },
        { attributeName: 'TargetAttributePath', value: value.targetAttributePath },
      ],
      associations: [
        {
          roleName: this.config.mappingSourceOutboundRoleName,
          targets: [
            {
              modOption: AssociationModOptionsDto.CreateDto,
              target: { rtId: source.rtId, ckTypeId: source.ckTypeId },
            },
          ],
        },
        {
          roleName: this.config.mappingTargetOutboundRoleName,
          targets: [
            {
              modOption: AssociationModOptionsDto.CreateDto,
              target: { rtId: value.targetRtId, ckTypeId: value.targetCkTypeId },
            },
          ],
        },
      ],
    }));

    try {
      await firstValueFrom(this.createEntitiesGQL.mutate({ variables: { entities } }));
      this.clearOrphanSelection();
      await this.loadOrphanCandidates();
    } catch (error) {
      console.error('Failed to bulk-create mappings:', error);
      this.orphanError.set('Failed to create mappings for the selection.');
    }
  }

  /**
   * Triggers the selected validation pipeline on the Communication Controller
   * and, when it completes, automatically refreshes the coverage report so the
   * tree colour-codes update. Requires {@link tenantId} to be set.
   */
  protected async runValidation(): Promise<void> {
    const pipeline = this.selectedPipeline();
    const tenant = this.tenantId;
    if (!pipeline || !tenant) {
      this.validationError.set(
        !pipeline ? 'Pick a validation pipeline first.' : 'Tenant context missing — Run is unavailable.',
      );
      return;
    }

    this.validationRunning.set(true);
    this.validationError.set(null);

    const outcome = await this.executePipelineAndAwaitCompletion(pipeline, tenant);
    this.validationRunning.set(false);
    if (outcome === 'start-failed') {
      this.validationError.set('Failed to start validation pipeline.');
      return;
    }
    if (outcome === 'timeout') {
      // Leave the button usable again; the user can hit Load Report manually
      // if the pipeline is just slow.
      this.validationError.set('Validation is still running — use Load Report to refresh later.');
      return;
    }
    await this.refreshValidation();
  }

  /**
   * Triggers the selected mapping-generation pipeline (GenerateDataPointMappings-
   * based auto-mapping) and, on completion, loads its statistics from the
   * execution's OutputData and refreshes the tree, the selected node's mapping
   * list and the orphan catalogue — all of which change when mappings are
   * created in bulk. Requires {@link tenantId} to be set.
   */
  protected async runGeneration(): Promise<void> {
    const pipeline = this.selectedGenerationPipeline();
    const tenant = this.tenantId;
    if (!pipeline || !tenant) {
      this.generationError.set(
        !pipeline ? 'Pick a generation pipeline first.' : 'Tenant context missing — Run is unavailable.',
      );
      return;
    }

    this.generationRunning.set(true);
    this.generationError.set(null);
    this.generationStats.set(null);
    this.generationCompletedAt.set(null);

    const outcome = await this.executePipelineAndAwaitCompletion(pipeline, tenant);
    this.generationRunning.set(false);
    if (outcome === 'start-failed') {
      this.generationError.set('Failed to start generation pipeline.');
      return;
    }
    if (outcome === 'timeout') {
      this.generationError.set('Generation is still running — reload the page state manually later.');
      return;
    }

    await this.loadGenerationResult(pipeline);
    await this.refreshTreeOverlay();
    if (this.selectedNode()) {
      await this.loadMappingsForSelected();
    }
    if (this.orphanCkType()) {
      await this.loadOrphanCandidates();
    }
  }

  protected onGenerationSelectChange(rtId: string): void {
    const match = this.validationPipelines().find(p => p.rtId === rtId);
    this.selectedGenerationPipeline.set(match ?? null);
  }

  /**
   * Loads the latest execution's OutputData for the generation pipeline and
   * parses the GenerateDataPointMappings statistics from it (the pipeline is
   * expected to end with SetPipelineExecutionResult on its statisticsTargetPath).
   * Missing/foreign OutputData degrades to "completed without statistics".
   */
  private async loadGenerationResult(pipeline: PipelineCandidate): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.getLatestValidationGQL
          .fetch({
            variables: {
              pipelineRtId: pipeline.rtId,
              pipelineCkTypeId: pipeline.ckTypeId,
              executesRoleId: this.config.validationExecutesRoleId,
              executionCkTypeId: this.config.validationExecutionCkTypeId,
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0])),
      );
      const execution = data?.associations?.executions?.items?.[0];
      const attrs = execution?.attributes?.items;
      this.generationCompletedAt.set(readAttr(attrs, 'CompletedAt'));
      this.generationStats.set(parseGenerationStatistics(readAttr(attrs, 'OutputData')));
    } catch (error) {
      console.error('Failed to load generation result:', error);
      this.generationError.set('Generation finished but loading its result failed.');
    }
  }

  /**
   * Executes a pipeline on the Communication Controller and polls until a NEW
   * execution leaves the Running state.
   *
   * Polling strategy: snapshot the latest execution's id first; then every
   * 1.5 s fetch the latest execution metadata. When the id differs from the
   * snapshot AND the status is not Running, the run finished. Treats absent
   * status as "done": the in-memory debug-cache branch of
   * GET /pipelineDebug/.../latest doesn't populate Status (only the MongoDB
   * fallback does), so a sub-second pipeline that hits the cache path before
   * the DB row is visible would never satisfy a strict `status === 'Completed'`
   * check and the button would freeze. We only keep polling while the
   * controller *explicitly* reports "Running" (case-insensitive). Aborts after
   * 60 s ('timeout').
   */
  private async executePipelineAndAwaitCompletion(
    pipeline: PipelineCandidate,
    tenant: string,
  ): Promise<'completed' | 'timeout' | 'start-failed'> {
    // Snapshot the latest execution's id so we can detect the new one finishing.
    let previousExecutionId: string | null = null;
    try {
      const previous = await this.communicationService.getLatestPipelineExecution(
        tenant, pipeline.rtId, pipeline.ckTypeId,
      );
      previousExecutionId = previous?.id ?? null;
    } catch {
      // Non-fatal: we'll still detect completion by polling and falling back
      // to "any latest execution" being non-Running.
    }

    try {
      await this.communicationService.executePipeline(tenant, pipeline.rtId);
    } catch (error) {
      console.error('Failed to start pipeline:', error);
      return 'start-failed';
    }

    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const pollIntervalMs = 1500;

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollIntervalMs);
      try {
        const latest = await this.communicationService.getLatestPipelineExecution(
          tenant, pipeline.rtId, pipeline.ckTypeId,
        );
        if (!latest) continue;
        const idChanged = latest.id !== previousExecutionId;
        const stillRunning =
          typeof latest.status === 'string' && latest.status.toLowerCase() === 'running';
        if (idChanged && !stillRunning) {
          return 'completed';
        }
      } catch (error) {
        console.warn('Polling pipeline execution failed:', error);
      }
    }
    return 'timeout';
  }

  private async refreshTreeOverlay(): Promise<void> {
    if (this.treeView?.isReady) {
      const expanded = this.treeView.getExpandedKeys();
      await this.treeView.refreshTree();
      this.treeView.setExpandedKeys(expanded);
    }
    // Re-evaluate the currently selected node's payload so the detail panel
    // shows the new validation status.
    const current = this.selectedNode();
    if (current) {
      const refreshed = await this.dataSource.refreshNode(current.rtId, current.ckTypeId);
      if (refreshed) this.selectedNode.set(refreshed);
    }
  }

  private async loadValidationPipelines(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.getEntitiesByCkType
          .fetch({
            variables: {
              ckTypeId: this.config.validationPipelineCkTypeId,
              first: 200,
              after: GraphQL.offsetToCursor(0),
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items ?? [])),
      );

      const candidates: PipelineCandidate[] = (result ?? [])
        .filter((e): e is NonNullable<typeof e> => !!e && !!e.rtId && !!e.ckTypeId)
        .map(e => ({
          rtId: e.rtId as string,
          ckTypeId: e.ckTypeId as string,
          name: readAttr(e.attributes?.items, 'name') ?? e.rtWellKnownName ?? (e.rtId as string),
        }));
      candidates.sort((a, b) => a.name.localeCompare(b.name));
      this.validationPipelines.set(candidates);
    } catch (error) {
      console.error('Failed to load validation pipelines:', error);
      this.validationPipelines.set([]);
    }
  }

  protected async refreshRoots(): Promise<void> {
    await this.loadRootCandidates();
  }

  protected async pickRoot(): Promise<void> {
    const result = await this.entitySelector.openEntitySelector({
      title: `Select ${this.activeRootCkTypeId()}`,
    });
    if (!result.confirmed || !result.entity) return;

    const candidate: RootCandidate = {
      rtId: result.entity.rtId,
      ckTypeId: result.entity.ckTypeId,
      name: result.entity.name ?? result.entity.rtId,
      description: '',
    };

    const known = this.rootCandidates().find(r => r.rtId === candidate.rtId);
    if (!known) {
      this.rootCandidates.update(list => [...list, candidate]);
    }
    await this.selectRoot(candidate);
  }

  protected async selectRoot(root: RootCandidate): Promise<void> {
    this.selectedRoot.set(root);
    this.selectedNode.set(null);
    this.mappings.set([]);
    this.dataSource.setRoot({
      rtId: root.rtId,
      ckTypeId: root.ckTypeId,
      name: root.name,
      description: root.description,
    });
    if (this.treeView?.isReady) {
      await this.treeView.refreshTree();
    }
  }

  protected onRootSelectChange(rtId: string): void {
    const match = this.rootCandidates().find(r => r.rtId === rtId);
    if (match) {
      void this.selectRoot(match);
    }
  }

  protected async onNodeSelected(item: TreeItemData): Promise<void> {
    const payload = (item as TreeItemDataTyped<CoverageNodePayload>).item;
    this.selectedNode.set(payload);
    this.entitySelected.emit({
      rtId: payload.rtId,
      ckTypeId: payload.ckTypeId,
      name: payload.name,
      description: payload.description,
    });
    await this.loadMappingsForSelected();
  }

  protected async refreshSelected(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    const updated = await this.dataSource.refreshNode(node.rtId, node.ckTypeId);
    if (updated) {
      this.selectedNode.set(updated);
    }
    await this.loadMappingsForSelected();
  }

  protected async addMapping(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;

    try {
      await firstValueFrom(
        this.createEntitiesGQL.mutate({
          variables: {
            entities: [
              {
                ckTypeId: this.config.mappingCkTypeId,
                attributes: [
                  { attributeName: 'Name', value: `Mapping ${this.mappings().length + 1}` },
                  { attributeName: 'Enabled', value: true },
                ],
                associations: [
                  {
                    roleName: this.config.mappingTargetOutboundRoleName,
                    targets: [
                      {
                        modOption: AssociationModOptionsDto.CreateDto,
                        target: { rtId: node.rtId, ckTypeId: node.ckTypeId },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      );
      await this.refreshSelected();
    } catch (error) {
      console.error('Failed to create mapping:', error);
      this.mappingsError.set('Failed to create mapping.');
    }
  }

  /**
   * Opens the focused edit dialog for one mapping and, on save, persists
   * attribute and (if changed) MapsFrom- / MapsTo-association updates in a
   * single UpdateRuntimeEntities mutation.
   */
  protected async editMapping(mapping: CoverageMappingItem): Promise<void> {
    // In the coverage-tree context the mapping's MapsTo target IS the selected
    // node — we pre-fill the dialog with that so the user sees it immediately
    // and can retarget if needed via the new Target Entity picker.
    const node = this.selectedNode();
    const initial: MappingEditValue = {
      rtId: mapping.rtId,
      ckTypeId: mapping.ckTypeId,
      name: mapping.name,
      enabled: mapping.enabled,
      sourceRtId: mapping.sourceRtId,
      sourceCkTypeId: mapping.sourceCkTypeId,
      sourceName: mapping.sourceName,
      sourceAttributePath: mapping.sourceAttributePath,
      mappingExpression: mapping.mappingExpression,
      targetRtId: node?.rtId,
      targetCkTypeId: node?.ckTypeId,
      targetName: node?.name,
      targetAttributePath: mapping.targetAttributePath,
    };
    const result = await this.editDialog.open({
      mapping: initial,
      expressionEvaluator: this.expressionEvaluator ?? undefined,
    });
    if (!result.confirmed) return;
    await this.saveEditedMapping(result.mapping);
  }

  private async saveEditedMapping(edited: MappingEditValue): Promise<void> {
    const attributeUpdates: { attributeName: string; value: unknown }[] = [
      { attributeName: 'Name', value: edited.name ?? '' },
      { attributeName: 'Enabled', value: edited.enabled },
      { attributeName: 'SourceAttributePath', value: edited.sourceAttributePath ?? '' },
      { attributeName: 'MappingExpression', value: edited.mappingExpression ?? '' },
      { attributeName: 'TargetAttributePath', value: edited.targetAttributePath ?? '' },
    ];

    const associations: {
      roleName: string;
      targets: { modOption: AssociationModOptionsDto; target: { rtId: string; ckTypeId: string } }[];
    }[] = [];

    const buildAssocChange = (
      originalRtId: string | undefined,
      originalCkTypeId: string | undefined,
      newRtId: string | undefined,
      newCkTypeId: string | undefined,
      roleName: string,
    ) => {
      if (newRtId === originalRtId && newCkTypeId === originalCkTypeId) return;
      const targets: { modOption: AssociationModOptionsDto; target: { rtId: string; ckTypeId: string } }[] = [];
      if (originalRtId && originalCkTypeId) {
        targets.push({
          modOption: AssociationModOptionsDto.DeleteDto,
          target: { rtId: originalRtId, ckTypeId: originalCkTypeId },
        });
      }
      if (newRtId && newCkTypeId) {
        targets.push({
          modOption: AssociationModOptionsDto.CreateDto,
          target: { rtId: newRtId, ckTypeId: newCkTypeId },
        });
      }
      if (targets.length > 0) {
        associations.push({ roleName, targets });
      }
    };

    buildAssocChange(
      edited._originalSourceRtId,
      edited._originalSourceCkTypeId,
      edited.sourceRtId,
      edited.sourceCkTypeId,
      this.config.mappingSourceOutboundRoleName,
    );
    buildAssocChange(
      edited._originalTargetRtId,
      edited._originalTargetCkTypeId,
      edited.targetRtId,
      edited.targetCkTypeId,
      this.config.mappingTargetOutboundRoleName,
    );

    try {
      if (!edited.rtId) {
        // New mapping (orphan-flow): atomic create with both MapsFrom and
        // MapsTo associations. We translate the assoc-change list (built for
        // the update path's modOptions) into a create-only assoc list — the
        // entity doesn't exist yet, so any deletes are no-ops.
        const createAssociations = associations
          .map(a => ({
            roleName: a.roleName,
            targets: a.targets
              .filter(t => t.modOption !== AssociationModOptionsDto.DeleteDto)
              .map(t => ({ modOption: AssociationModOptionsDto.CreateDto, target: t.target })),
          }))
          .filter(a => a.targets.length > 0);
        await firstValueFrom(
          this.createEntitiesGQL.mutate({
            variables: {
              entities: [
                {
                  ckTypeId: edited.ckTypeId,
                  attributes: attributeUpdates,
                  associations: createAssociations,
                },
              ],
            },
          }),
        );
      } else {
        await firstValueFrom(
          this.updateEntitiesGQL.mutate({
            variables: {
              entities: [
                {
                  rtId: edited.rtId,
                  item: {
                    ckTypeId: edited.ckTypeId,
                    attributes: attributeUpdates,
                    associations,
                  },
                },
              ],
            },
          }),
        );
      }
      await this.refreshSelected();
    } catch (error) {
      console.error('Failed to save mapping:', error);
      this.mappingsError.set('Failed to save mapping changes.');
    }
  }

  protected async deleteMapping(mapping: CoverageMappingItem): Promise<void> {
    const confirmed = await this.confirmation.showYesNoConfirmationDialog(
      'Delete Mapping',
      `Delete mapping '${mapping.name || mapping.rtId}'? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await firstValueFrom(
        this.deleteEntitiesGQL.mutate({
          variables: {
            rtEntityIds: [{ rtId: mapping.rtId, ckTypeId: mapping.ckTypeId }],
            deleteStrategy: DeleteStrategiesDto.EraseDto,
          },
        }),
      );
      await this.refreshSelected();
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      this.mappingsError.set('Failed to delete mapping.');
    }
  }

  protected trackByRtId(_index: number, item: { rtId: string }): string {
    return item.rtId;
  }

  private async loadRootCandidates(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.getEntitiesByCkType
          .fetch({
            variables: {
              ckTypeId: this.activeRootCkTypeId(),
              first: 200,
              after: GraphQL.offsetToCursor(0),
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items ?? [])),
      );

      const candidates: RootCandidate[] = (result ?? [])
        .filter((e): e is NonNullable<typeof e> => !!e && !!e.rtId && !!e.ckTypeId)
        .map(e => {
          const name = readAttr(e.attributes?.items, 'name') ?? e.rtWellKnownName ?? e.rtId;
          const description = readAttr(e.attributes?.items, 'description') ?? '';
          return {
            rtId: e.rtId as string,
            ckTypeId: e.ckTypeId as string,
            name,
            description,
          };
        });
      candidates.sort((a, b) => a.name.localeCompare(b.name));
      this.rootCandidates.set(candidates);
    } catch (error) {
      console.error('Failed to load root candidates:', error);
      this.rootCandidates.set([]);
    }
  }

  private async loadMappingsForSelected(): Promise<void> {
    const node = this.selectedNode();
    if (!node) {
      this.mappings.set([]);
      return;
    }

    this.mappingsLoading.set(true);
    this.mappingsError.set(null);
    try {
      const data = await firstValueFrom(
        this.getNodeMappingsGQL
          .fetch({
            variables: {
              rtId: node.rtId,
              ckTypeId: node.ckTypeId,
              mapsToRoleId: this.config.mappingRoleId,
              mapsFromRoleId: this.config.mappingSourceRoleId,
              mappingCkTypeId: this.config.mappingCkTypeId,
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0])),
      );

      const items = data?.associations?.mappings?.items ?? [];
      // First pass: map mapping attributes + source rtId/ckTypeId from association
      // definitions. Source NAMES are resolved in a second pass below because the
      // generic `targets(ckId: ...)` projection requires a concrete CK type with
      // its own MongoDB collection — `System/Entity` is abstract and would error.
      const mapped: CoverageMappingItem[] = items
        .filter((m): m is NonNullable<typeof m> => !!m && !!m.rtId && !!m.ckTypeId)
        .map(m => {
          const attrs = m.attributes?.items ?? [];
          const sourceDef = m.associations?.sources?.items?.[0] ?? null;
          return {
            rtId: m.rtId as string,
            ckTypeId: m.ckTypeId as string,
            name: readAttr(attrs, 'name') ?? '',
            enabled: readAttr(attrs, 'enabled') !== 'false',
            sourceAttributePath: readAttr(attrs, 'sourceAttributePath') ?? '',
            targetAttributePath: readAttr(attrs, 'targetAttributePath') ?? '',
            mappingExpression: readAttr(attrs, 'mappingExpression') ?? '',
            sourceRtId: sourceDef?.targetRtId ? String(sourceDef.targetRtId) : undefined,
            sourceCkTypeId: sourceDef?.targetCkTypeId ? String(sourceDef.targetCkTypeId) : undefined,
            sourceName: undefined,
          };
        });
      this.mappings.set(mapped);
      // Fire-and-forget the source-name resolution in parallel; the list renders
      // immediately and names patch in as they arrive.
      void this.resolveSourceNames(mapped);
    } catch (error) {
      console.error('Failed to load mappings:', error);
      this.mappingsError.set('Failed to load mappings.');
      this.mappings.set([]);
    } finally {
      this.mappingsLoading.set(false);
    }
  }

  /**
   * Resolves source entity names by issuing a parallel `getRuntimeEntityById`
   * per unique (rtId, ckTypeId) pair. Updates the mappings signal in-place so
   * the detail panel re-renders with names. Failures are silent — the row
   * still falls back to displaying the source rtId.
   */
  private async resolveSourceNames(mappings: CoverageMappingItem[]): Promise<void> {
    const byKey = new Map<string, { rtId: string; ckTypeId: string }>();
    for (const m of mappings) {
      if (m.sourceRtId && m.sourceCkTypeId) {
        byKey.set(`${m.sourceCkTypeId}@${m.sourceRtId}`, {
          rtId: m.sourceRtId,
          ckTypeId: m.sourceCkTypeId,
        });
      }
    }
    if (byKey.size === 0) return;

    const lookups = await Promise.all(
      Array.from(byKey.values()).map(async ref => {
        try {
          const data = await firstValueFrom(
            this.getRuntimeEntityByIdGQL
              .fetch({
                variables: { rtId: ref.rtId, ckTypeId: ref.ckTypeId },
                fetchPolicy: 'cache-first',
              })
              .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0])),
          );
          const name = readAttr(data?.attributes?.items, 'name') ?? data?.rtWellKnownName ?? null;
          return { key: `${ref.ckTypeId}@${ref.rtId}`, name };
        } catch {
          return { key: `${ref.ckTypeId}@${ref.rtId}`, name: null };
        }
      }),
    );

    const nameByKey = new Map<string, string | null>(lookups.map(l => [l.key, l.name]));
    const node = this.selectedNode();
    if (!node) return; // user changed selection meanwhile

    const next = this.mappings().map(m => {
      if (!m.sourceRtId || !m.sourceCkTypeId) return m;
      const key = `${m.sourceCkTypeId}@${m.sourceRtId}`;
      const name = nameByKey.get(key);
      return name ? { ...m, sourceName: name } : m;
    });
    this.mappings.set(next);
  }
}

function readAttr(items: readonly ({ attributeName?: string | null; value?: unknown } | null)[] | null | undefined, name: string): string | null {
  if (!items) return null;
  const target = name.toLowerCase();
  for (const item of items) {
    if (item?.attributeName != null && item.attributeName.toLowerCase() === target && item.value != null) {
      return String(item.value);
    }
  }
  return null;
}

interface CoverageReportNode {
  rtId?: string;
  status?: string;
  parentRtId?: string | null;
  required?: string[];
  recommended?: string[];
  present?: string[];
  missingRequired?: string[];
  missingRecommended?: string[];
}

/**
 * Parses the JSON report emitted by ValidateDataPointCoverage@1 into a lookup
 * map keyed by entity rtId, plus aggregate summary counters and a per-node
 * subtree rollup (worst status + aggregate counts) so the tree can colour
 * `info` ancestors red when there's an error somewhere below them.
 *
 * Tolerant of partial/malformed payloads: unknown statuses fall back to "info"
 * and missing arrays default to empty. Reports from an older backend that
 * doesn't emit `parentRtId` degrade gracefully — every node's subtreeStatus
 * collapses to its own status.
 */
function parseValidationReport(serialised: string): {
  map: Map<string, CoverageValidationDetail>;
  summary: CoverageReportSummary;
} {
  const result = new Map<string, CoverageValidationDetail>();
  const empty: CoverageReportSummary = { ok: 0, warning: 0, error: 0, info: 0, total: 0 };
  try {
    const parsed = JSON.parse(serialised) as { summary?: CoverageReportSummary; nodes?: CoverageReportNode[] };
    const summary = parsed?.summary ?? empty;
    const nodes = (parsed?.nodes ?? []).filter((n): n is CoverageReportNode & { rtId: string } => !!n?.rtId);

    // Index by rtId + build parent → children map for the rollup pass.
    const childrenByParent = new Map<string, string[]>();
    const ownStatus = new Map<string, CoverageNodeStatus>();
    for (const n of nodes) {
      ownStatus.set(n.rtId, normaliseStatus(n.status));
      if (n.parentRtId) {
        const bucket = childrenByParent.get(n.parentRtId);
        if (bucket) bucket.push(n.rtId);
        else childrenByParent.set(n.parentRtId, [n.rtId]);
      }
    }

    // Memoised post-order walk: each node's subtree rollup includes itself
    // plus the recursive rollup of all descendants.
    const memo = new Map<string, { worst: CoverageNodeStatus; counts: { ok: number; warning: number; error: number; info: number } }>();
    const rollup = (rtId: string): { worst: CoverageNodeStatus; counts: { ok: number; warning: number; error: number; info: number } } => {
      const cached = memo.get(rtId);
      if (cached) return cached;
      const self = ownStatus.get(rtId) ?? 'info';
      const counts = { ok: 0, warning: 0, error: 0, info: 0 };
      counts[self] += 1;
      let worst: CoverageNodeStatus = self;
      for (const childId of childrenByParent.get(rtId) ?? []) {
        const sub = rollup(childId);
        counts.ok += sub.counts.ok;
        counts.warning += sub.counts.warning;
        counts.error += sub.counts.error;
        counts.info += sub.counts.info;
        if (statusSeverity(sub.worst) > statusSeverity(worst)) worst = sub.worst;
      }
      const out = { worst, counts };
      memo.set(rtId, out);
      return out;
    };

    for (const n of nodes) {
      const status = ownStatus.get(n.rtId) ?? 'info';
      const sub = rollup(n.rtId);
      result.set(n.rtId, {
        status,
        subtreeStatus: sub.worst,
        subtreeCounts: sub.counts,
        required: n.required ?? [],
        recommended: n.recommended ?? [],
        present: n.present ?? [],
        missingRequired: n.missingRequired ?? [],
        missingRecommended: n.missingRecommended ?? [],
      });
    }
    return { map: result, summary };
  } catch (err) {
    console.warn('Failed to parse validation report:', err);
    return { map: result, summary: empty };
  }
}

/**
 * Ordering used to compute "worst status" in a subtree rollup. Higher number
 * = more severe; ties are broken by the first occurrence in the traversal.
 */
function statusSeverity(s: CoverageNodeStatus): number {
  switch (s) {
    case 'error': return 3;
    case 'warning': return 2;
    case 'ok': return 1;
    case 'info': default: return 0;
  }
}

function normaliseStatus(value: string | undefined): CoverageNodeStatus {
  switch (value) {
    case 'ok':
    case 'warning':
    case 'error':
    case 'info':
      return value;
    default:
      return 'info';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses the OutputData of a generation-pipeline execution into the
 * GenerateDataPointMappings statistics shape. Returns null when the payload is
 * missing, not JSON, or clearly something else (e.g. a validation report) —
 * the UI then shows a plain "completed" note instead of numbers.
 */
function parseGenerationStatistics(serialised: string | null): GenerationStatistics | null {
  if (!serialised) return null;
  try {
    const parsed = JSON.parse(serialised) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('totalSuggestions' in parsed) && !('ruleHits' in parsed) && !('matchedContainers' in parsed)) {
      return null;
    }
    const stats = parsed as GenerationStatistics;
    return {
      totalContainers: stats.totalContainers,
      matchedContainers: stats.matchedContainers,
      unmatchedContainers: stats.unmatchedContainers,
      unmatchedContainerNames: stats.unmatchedContainerNames ?? [],
      totalSuggestions: stats.totalSuggestions,
      ruleHits: stats.ruleHits ?? {},
      definedRuleIds: stats.definedRuleIds ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Loose structural type matching the shape of one parent hop in the
 * `getOrphanCandidates` query. Each hop has the same fields (`rtId`,
 * `ckTypeId`, attributes, `associations.parent.items[0]` for the next hop),
 * so a single recursive helper walks the chain without depending on the
 * codegen-generated anonymous types.
 */
interface OrphanParentHop {
  rtId?: unknown;
  ckTypeId?: unknown;
  rtWellKnownName?: string | null;
  attributes?: {
    items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null;
  } | null;
  associations?: {
    parent?: { items?: (OrphanParentHop | null)[] | null } | null;
  } | null;
}

/**
 * Walks the up-to-3-hop parent chain produced by `getOrphanCandidates` and
 * flattens it into an array ordered from immediate parent (index 0) to
 * root-most known ancestor. Stops at the first hop with no parent items —
 * a Loxone Control whose Category is the topmost reachable ancestor in 3
 * hops yields a 1-item path; an OPC-UA node deep in a tree yields 3.
 */
function extractParentPath(first: OrphanParentHop | null | undefined): OrphanCandidateParent[] {
  const path: OrphanCandidateParent[] = [];
  let cursor: OrphanParentHop | null | undefined = first;
  while (cursor) {
    if (cursor.rtId == null || cursor.ckTypeId == null) break;
    path.push({
      rtId: String(cursor.rtId),
      ckTypeId: String(cursor.ckTypeId),
      name:
        readAttr(cursor.attributes?.items, 'name')
        ?? cursor.rtWellKnownName
        ?? String(cursor.rtId),
    });
    const next = cursor.associations?.parent?.items?.[0];
    cursor = next ?? null;
  }
  return path;
}
