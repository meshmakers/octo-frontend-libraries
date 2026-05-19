import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
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
  GraphQL,
} from '@meshmakers/octo-services';
import { GetLatestValidationExecutionDtoGQL } from '../../../graphQL/getLatestValidationExecution';
import { GetNodeMappingsDtoGQL } from '../../../graphQL/getNodeMappings';
import { GetOrphanCandidatesDtoGQL } from '../../../graphQL/getOrphanCandidates';
import { GetRuntimeEntityByIdDtoGQL } from '../../../graphQL/getRuntimeEntityById';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { EntitySelectorDialogService } from '../../../entity-selector-dialog/entity-selector-dialog.service';
import { MappingCoverageTreeDataSource } from './mapping-coverage-tree-data-source';
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
} from './mapping-coverage-tree.models';

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
  ],
  providers: [MappingCoverageTreeDataSource],
  templateUrl: './mapping-coverage-tree.component.html',
  styleUrls: ['./mapping-coverage-tree.component.scss'],
})
export class MappingCoverageTreeComponent implements OnInit {
  private readonly entitySelector = inject(EntitySelectorDialogService);
  private readonly editDialog = inject(MappingEditDialogService);
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

  @Output() readonly entitySelected = new EventEmitter<CoverageEntityRef>();

  protected readonly icons = {
    refresh: arrowRotateCwIcon,
    folderOpen: folderOpenIcon,
    plus: plusIcon,
    pencil: pencilIcon,
    trash: trashIcon,
    link: linkIcon,
  };

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
  protected readonly orphanStats = computed(() => {
    const all = this.orphanCandidates();
    const unmapped = all.filter(c => c.mappingCount === 0).length;
    return { total: all.length, unmapped, mapped: all.length - unmapped };
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
    await Promise.all([this.loadRootCandidates(), this.loadValidationPipelines()]);

    if (this.initialRoot) {
      const match = this.rootCandidates().find(r => r.rtId === this.initialRoot?.rtId);
      if (match) {
        await this.selectRoot(match);
      }
    }
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
      const outputData = readAttrStrict(attrs, 'OutputData');
      const completedAt = readAttrStrict(attrs, 'CompletedAt');

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
    if (ckTypeId) void this.loadOrphanCandidates();
  }

  protected async refreshOrphans(): Promise<void> {
    await this.loadOrphanCandidates();
  }

  protected toggleOrphanHideMapped(): void {
    this.orphanHideMapped.update(v => !v);
  }

  /**
   * Fetches all entities of the selected source CK type and tags each with
   * its inbound MapsFrom DataPointMapping count. The view filters the list
   * down to mappingCount === 0 by default, but the user can flip the toggle
   * to see all candidates (mapped + unmapped) for verification.
   */
  private async loadOrphanCandidates(): Promise<void> {
    const ckTypeId = this.orphanCkType();
    if (!ckTypeId) return;

    this.orphanLoading.set(true);
    this.orphanError.set(null);
    try {
      const result = await firstValueFrom(
        this.getOrphanCandidatesGQL
          .fetch({
            variables: {
              ckTypeId,
              mapsFromRoleId: this.config.mappingSourceRoleId,
              mappingCkTypeId: this.config.mappingCkTypeId,
              first: 1000,
              after: GraphQL.offsetToCursor(0),
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items ?? [])),
      );

      const candidates: OrphanCandidate[] = (result ?? [])
        .filter((e): e is NonNullable<typeof e> => !!e && !!e.rtId && !!e.ckTypeId)
        .map(e => ({
          rtId: e.rtId as string,
          ckTypeId: e.ckTypeId as string,
          name: readAttr(e.attributes?.items, 'name') ?? e.rtWellKnownName ?? (e.rtId as string),
          description: readAttr(e.attributes?.items, 'description') ?? undefined,
          mappingCount: e.associations?.mappings?.totalCount ?? 0,
        }));
      candidates.sort((a, b) => {
        // Show unmapped first, then alphabetical.
        if (a.mappingCount === 0 && b.mappingCount > 0) return -1;
        if (a.mappingCount > 0 && b.mappingCount === 0) return 1;
        return a.name.localeCompare(b.name);
      });
      this.orphanCandidates.set(candidates);
    } catch (error) {
      console.error('Failed to load orphan candidates:', error);
      this.orphanError.set('Failed to load source candidates.');
      this.orphanCandidates.set([]);
    } finally {
      this.orphanLoading.set(false);
    }
  }

  /**
   * Bootstrap a new DataPointMapping pre-linked to an orphan source. The
   * MapsTo side is left empty — the user finishes the wiring in the edit
   * dialog (pick target node + target attribute).
   */
  protected async createMappingFromOrphan(orphan: OrphanCandidate): Promise<void> {
    try {
      const created = await firstValueFrom(
        this.createEntitiesGQL.mutate({
          variables: {
            entities: [
              {
                ckTypeId: this.config.mappingCkTypeId,
                attributes: [
                  { attributeName: 'Name', value: `${orphan.name} mapping` },
                  { attributeName: 'Enabled', value: true },
                ],
                associations: [
                  {
                    roleName: this.config.mappingSourceOutboundRoleName,
                    targets: [
                      {
                        modOption: AssociationModOptionsDto.CreateDto,
                        target: { rtId: orphan.rtId, ckTypeId: orphan.ckTypeId },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      );
      const newRtId = created.data?.runtime?.runtimeEntities?.create?.[0]?.rtId;
      if (newRtId) {
        await this.loadOrphanCandidates();
        // Open the edit dialog so the user can immediately pick the MapsTo
        // target + target attribute path.
        const skeleton: CoverageMappingItem = {
          rtId: String(newRtId),
          ckTypeId: this.config.mappingCkTypeId,
          name: `${orphan.name} mapping`,
          enabled: true,
          sourceAttributePath: '',
          targetAttributePath: '',
          mappingExpression: '',
          sourceRtId: orphan.rtId,
          sourceCkTypeId: orphan.ckTypeId,
          sourceName: orphan.name,
        };
        await this.editMapping(skeleton);
      }
    } catch (error) {
      console.error('Failed to create mapping for orphan:', error);
      this.orphanError.set('Failed to create mapping.');
    }
  }

  protected trackOrphanByRtId(_index: number, item: OrphanCandidate): string {
    return item.rtId;
  }

  /**
   * Triggers the selected validation pipeline on the Communication Controller
   * and, when it completes, automatically refreshes the coverage report so the
   * tree colour-codes update. Requires {@link tenantId} to be set.
   *
   * Polling strategy: every 1.5 s, fetch the latest execution metadata for the
   * pipeline. When `dateTime` differs from the snapshot taken before the run,
   * we know a new execution finished — refresh and stop. Aborts after 60 s.
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
      console.error('Failed to start validation pipeline:', error);
      this.validationError.set('Failed to start validation pipeline.');
      this.validationRunning.set(false);
      return;
    }

    // Poll for completion. We accept that the new execution id may equal
    // previousExecutionId for a brief moment until the controller flushes it
    // — that's why we also accept any latest execution whose status leaves
    // Running (Completed / Failed / Interrupted / Cancelled).
    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const pollIntervalMs = 1500;

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollIntervalMs);
      try {
        const latest = await this.communicationService.getLatestPipelineExecution(
          tenant, pipeline.rtId, pipeline.ckTypeId,
        );
        const isNew = latest && latest.id !== previousExecutionId;
        const isFinished = latest && latest.status && latest.status !== 'Running';
        if (isNew && isFinished) {
          this.validationRunning.set(false);
          await this.refreshValidation();
          return;
        }
      } catch (error) {
        console.warn('Polling validation execution failed:', error);
      }
    }

    // Timeout: leave running flag off so the button is usable again; user can
    // hit Load Report manually if the pipeline is just slow.
    this.validationRunning.set(false);
    this.validationError.set('Validation is still running — use Load Report to refresh later.');
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
      title: `Select ${this.config.rootCkTypeId}`,
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
   * attribute and (if changed) MapsFrom-association updates in a single
   * UpdateRuntimeEntities mutation.
   */
  protected async editMapping(mapping: CoverageMappingItem): Promise<void> {
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
      targetAttributePath: mapping.targetAttributePath,
    };
    const result = await this.editDialog.open({
      mapping: initial,
      targetCkTypeId: this.selectedNode()?.ckTypeId,
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

    const sourceChanged =
      edited.sourceRtId !== edited._originalSourceRtId ||
      edited.sourceCkTypeId !== edited._originalSourceCkTypeId;

    const associations: {
      roleName: string;
      targets: { modOption: AssociationModOptionsDto; target: { rtId: string; ckTypeId: string } }[];
    }[] = [];

    if (sourceChanged) {
      const targets: { modOption: AssociationModOptionsDto; target: { rtId: string; ckTypeId: string } }[] = [];
      if (edited._originalSourceRtId && edited._originalSourceCkTypeId) {
        targets.push({
          modOption: AssociationModOptionsDto.DeleteDto,
          target: { rtId: edited._originalSourceRtId, ckTypeId: edited._originalSourceCkTypeId },
        });
      }
      if (edited.sourceRtId && edited.sourceCkTypeId) {
        targets.push({
          modOption: AssociationModOptionsDto.CreateDto,
          target: { rtId: edited.sourceRtId, ckTypeId: edited.sourceCkTypeId },
        });
      }
      if (targets.length > 0) {
        associations.push({
          roleName: this.config.mappingSourceOutboundRoleName,
          targets,
        });
      }
    }

    try {
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
              ckTypeId: this.config.rootCkTypeId,
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

/** Exact-case attribute lookup used for attributes whose canonical name is
 *  capitalised in the CK model (`OutputData`, `CompletedAt`, …). */
function readAttrStrict(items: readonly ({ attributeName?: string | null; value?: unknown } | null)[] | null | undefined, name: string): string | null {
  if (!items) return null;
  for (const item of items) {
    if (item?.attributeName === name && item.value != null) {
      return String(item.value);
    }
  }
  return null;
}

interface CoverageReportNode {
  rtId?: string;
  status?: string;
  required?: string[];
  recommended?: string[];
  present?: string[];
  missingRequired?: string[];
  missingRecommended?: string[];
}

/**
 * Parses the JSON report emitted by ValidateDataPointCoverage@1 into a lookup
 * map keyed by entity rtId, plus aggregate summary counters.
 *
 * Tolerant of partial/malformed payloads: unknown statuses fall back to "info"
 * and missing arrays default to empty.
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
    const nodes = parsed?.nodes ?? [];
    for (const n of nodes) {
      if (!n?.rtId) continue;
      const status = normaliseStatus(n.status);
      result.set(n.rtId, {
        status,
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
