import { SVGIcon } from '@progress/kendo-svg-icons';
import { TreeItemDataTyped } from '@meshmakers/shared-services';

/**
 * Generic configuration that drives the Mapping Coverage Tree.
 *
 * The tree displays any entity hierarchy reachable via a single association role
 * (defaults to `System/ParentChild` between `Basic/Tree` and `Basic/TreeNode`).
 * Mapping counts are computed from the number of inbound associations with
 * `mappingRoleId` (defaults to `System.Communication/MapsTo`).
 */
export interface MappingCoverageTreeConfig {
  /** CK type of root entities the user can pick (e.g. `Basic/Tree`). */
  rootCkTypeId: string;

  /** CK type of child nodes in the hierarchy (e.g. `Basic/TreeNode`). */
  childCkTypeId: string;

  /** Association role connecting parent to child (e.g. `System/ParentChild`). Inbound direction is used. */
  childRoleId: string;

  /** Association role connecting target entities to their DataPointMappings. */
  mappingRoleId: string;

  /** Association role connecting DataPointMappings back to their source entities. */
  mappingSourceRoleId: string;

  /** CK type of the mapping entity (e.g. `System.Communication/DataPointMapping`). */
  mappingCkTypeId: string;

  /** Outbound role name used when creating a new mapping with a MapsTo association. */
  mappingTargetOutboundRoleName: string;

  /** Outbound role name used when creating/updating a new mapping with a MapsFrom association. */
  mappingSourceOutboundRoleName: string;

  /** CK type of the pipeline used to drive validation (defaults to System.Communication/Pipeline). */
  validationPipelineCkTypeId: string;

  /** CK type of pipeline executions whose OutputData carries the validation report. */
  validationExecutionCkTypeId: string;

  /** Association role linking a PipelineExecution to its Pipeline (defaults to System.Communication/ExecutedPipeline). */
  validationExecutesRoleId: string;

  /**
   * CK types whose entities can act as mapping sources. Used by the Orphan
   * Sources tab to list unmapped candidates (e.g. `Loxone/Control`,
   * `MQTT/Topic`, `OpcUa/Node`). Empty list hides the tab.
   */
  sourceCandidateCkTypeIds: string[];
}

/**
 * Default configuration: Basic/Tree + Basic/TreeNode driven by System/ParentChild,
 * mappings via System.Communication/MapsTo.
 */
export const DEFAULT_MAPPING_COVERAGE_TREE_CONFIG: MappingCoverageTreeConfig = {
  rootCkTypeId: 'Basic/Tree',
  childCkTypeId: 'Basic/TreeNode',
  childRoleId: 'System/ParentChild',
  mappingRoleId: 'System.Communication/MapsTo',
  mappingSourceRoleId: 'System.Communication/MapsFrom',
  mappingCkTypeId: 'System.Communication/DataPointMapping',
  mappingTargetOutboundRoleName: 'mappedAsTarget',
  mappingSourceOutboundRoleName: 'mappedAsSource',
  validationPipelineCkTypeId: 'System.Communication/Pipeline',
  validationExecutionCkTypeId: 'System.Communication/PipelineExecution',
  validationExecutesRoleId: 'System.Communication/ExecutedPipeline',
  sourceCandidateCkTypeIds: [],
};

/**
 * Reference to a runtime entity used in the coverage tree (root, node, source, target).
 */
export interface CoverageEntityRef {
  rtId: string;
  ckTypeId: string;
  name: string;
  description?: string;
}

/**
 * Coverage validation status calculated by the ValidateDataPointCoverage pipeline
 * node. Maps to the JSON `status` field in its emitted report.
 */
export type CoverageNodeStatus = 'ok' | 'warning' | 'error' | 'info';

/**
 * Per-node detail loaded from the latest validation execution's OutputData. Held
 * in a `Map<rtId, …>` by the component and consulted by the data source when
 * decorating tree items.
 */
export interface CoverageValidationDetail {
  status: CoverageNodeStatus;
  /**
   * Worst status found in the node's subtree (including the node itself).
   * Used to colour the tree icon so an `info` node with red descendants is
   * still visually flagged as red — the user sees where to drill in without
   * expanding every branch.
   */
  subtreeStatus: CoverageNodeStatus;
  /** Aggregate counts of each status in the subtree (including this node). */
  subtreeCounts: { ok: number; warning: number; error: number; info: number };
  required: string[];
  recommended: string[];
  present: string[];
  missingRequired: string[];
  missingRecommended: string[];
}

/**
 * Payload attached to every tree item in the coverage tree. Stored as the `item`
 * of a `TreeItemDataTyped<CoverageNodePayload>` so the host can render and react.
 */
export interface CoverageNodePayload extends CoverageEntityRef {
  /** Number of inbound mappings (DataPointMappings pointing to this node). */
  mappingCount: number;
  /** Whether this node has structural children (drives expand chevron). */
  hasChildren: boolean;
  /** True for the synthetic root entity (the picked Tree). */
  isRoot: boolean;
  /** Validation status from the latest validation report (when loaded). */
  validationStatus: CoverageNodeStatus | null;
  /** Full validation detail (missing/present lists) when loaded. */
  validationDetail: CoverageValidationDetail | null;
}

export type CoverageTreeItem = TreeItemDataTyped<CoverageNodePayload>;

/**
 * Flat view-model for a DataPointMapping shown in the detail panel.
 */
export interface CoverageMappingItem {
  rtId: string;
  ckTypeId: string;
  name: string;
  enabled: boolean;
  sourceAttributePath: string;
  targetAttributePath: string;
  mappingExpression: string;
  sourceRtId?: string;
  sourceCkTypeId?: string;
  sourceName?: string;
}

export interface CoverageTreeIcons {
  rootIcon: SVGIcon;
  nodeIcon: SVGIcon;
  nodeWithMappingsIcon?: SVGIcon;
}

/**
 * Counts emitted by the ValidateDataPointCoverage pipeline node in the
 * <c>summary</c> object of its JSON report. Mirrors the C# `SummaryCounters`
 * record so the UI can render the totals without recomputing.
 */
export interface CoverageReportSummary {
  ok: number;
  warning: number;
  error: number;
  info: number;
  total: number;
}

/**
 * One step in the parent chain of an OrphanCandidate (closest parent first).
 * Loaded via 3 nested `targets(direction: OUTBOUND, role: $childRoleId)` hops
 * in `getOrphanCandidates.graphql` so the orphan tab can show where each
 * source sits in the structural tree without a follow-up query.
 */
export interface OrphanCandidateParent {
  rtId: string;
  ckTypeId: string;
  name: string;
}

/**
 * Source candidate listed in the Orphan Sources tab. Carries the inbound
 * MapsFrom mapping count so the tab can split the catalogue into mapped vs
 * unmapped entries without an extra round trip.
 */
export interface OrphanCandidate {
  rtId: string;
  ckTypeId: string;
  name: string;
  description?: string;
  mappingCount: number;
  /**
   * Ancestors via the configured `childRoleId` (default System/ParentChild),
   * ordered from immediate parent (index 0) to root-most known ancestor.
   * Empty when the source has no parents reachable within 3 hops or when
   * the parent walk failed (e.g. `childCkTypeId` did not match the parent's
   * concrete type). The UI displays this as a breadcrumb under the entity
   * name; absence is silent (no parent → no breadcrumb).
   */
  parentPath: OrphanCandidateParent[];
}
