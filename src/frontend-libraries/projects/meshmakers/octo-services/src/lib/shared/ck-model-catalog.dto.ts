export interface CkModelCatalogDto {
  name: string;
  description: string;
}

export interface CkModelCatalogItemDto {
  id: string;
  name: string;
  version: string;
  description?: string;
  catalogName: string;
}

export interface CkModelCatalogListResponseDto {
  items: CkModelCatalogItemDto[];
  totalCount: number;
  skip: number;
  take: number;
}

export interface ImportFromCatalogRequestDto {
  catalogName: string;
  modelId: string;
}

export interface DependencyResolutionItemDto {
  modelId: string;
  name: string;
  requiredVersion: string;
  installedVersion?: string;
  action: 'install' | 'update' | 'none' | 'incompatible';
  dependencies: DependencyResolutionItemDto[];
}

export interface DependencyResolutionResponseDto {
  rootModel: DependencyResolutionItemDto;
  /**
   * Tenant upgrade guard (AB#6870, CK v2 F2.5): true when the import set of the tree would break an installed
   * model. Optional: an older asset repository does not send it.
   */
  isBlocked?: boolean;
  /** The installed models the import set would break; absent or empty when not blocked. */
  blockers?: CkUpgradeBlockerDto[];
}

/**
 * One reason why an installed model would break if an offered CK model update were imported (tenant upgrade guard,
 * CK v2 F2.5, AB#6867 / AB#6868 / AB#6870). Language neutral data plus an English {@link message}. Every member is
 * optional on the wire in the sense that an older asset repository sends no blockers at all; clients must tolerate
 * new {@link kind} values.
 */
export interface CkUpgradeBlockerDto {
  /** The installed model that would break, full id (for example `EnergyCommunity.Registration-2.8.0`). */
  dependent: string;
  /** The model of the update that causes it, full id (for example `Basic-2.5.0`). */
  update: string;
  /**
   * Blocker kind: `ExactPin`, `FloorNotMet`, `RangeNotSatisfied`, `ElementRemoved`, `ElementChanged`,
   * `ElementBecameInternal` or `NameCollision`. Open set.
   */
  kind: string;
  /** The pin (`Basic-2.4.0`), range or element / member (`Basic@2/Asset-1.Name`) the blocker is about. */
  subject: string;
  /** Stable code per kind, for example `CK_UPGRADE_EXACT_PIN`. */
  code: string;
  /** English explanation naming the dependent. */
  message: string;
  /** True when the dependent is itself a model of the evaluated update set. */
  dependentIsInUpdateSet?: boolean;
  /** A newer catalog version of the dependent that was proven to resolve this blocker, or null. */
  suggestedDependentUpdate?: string | null;
  /** Human-readable next step when {@link suggestedDependentUpdate} is set, or null. */
  resolveHint?: string | null;
}

/**
 * The `409 Conflict` problem details (`application/problem+json`) of an import refused by the tenant upgrade guard
 * (AB#6870): `code` is {@link CK_UPGRADE_BLOCKED_CODE}.
 */
export interface CkUpgradeBlockedProblemDto {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code: string;
  /** Full ids of the models of the refused request. */
  updateSet?: string[];
  blockers?: CkUpgradeBlockerDto[];
}

/** The stable error code of an import refused by the tenant upgrade guard. */
export const CK_UPGRADE_BLOCKED_CODE = 'CK_UPGRADE_BLOCKED';

export interface UpgradeCheckResponseDto {
  modelName: string;
  installedVersion?: string;
  targetVersion: string;
  upgradeNeeded: boolean;
  migrationPathAvailable: boolean;
  hasBreakingChanges: boolean;
  errorMessage?: string;
  /** AB#6868: true when importing the target version would break an installed model. Optional (older asset repositories). */
  isBlocked?: boolean;
  /** AB#6868: the installed models the target version would break. Optional (older asset repositories). */
  blockers?: CkUpgradeBlockerDto[];
}

export interface CkModelLibraryStatusItemDto {
  name: string;
  installedVersion?: string;
  modelState?: string;
  dependencies: string[];
  catalogVersion?: string;
  hasUpdate: boolean;
  needsAction: boolean;
  catalogName?: string;
  fullModelId?: string;
  isServiceManaged: boolean;
  isCompatible: boolean;
  incompatibilityReason?: string;
  unresolvedDependencies: string[];
  hasCatalogInconsistency: boolean;
  /**
   * Tenant upgrade guard (AB#6868): the offered update would break an installed model. The row keeps `hasUpdate`
   * and gets `needsAction = false`. Optional: an older asset repository does not send it.
   */
  isBlocked?: boolean;
  /** AB#6868: why the offered update is blocked; absent or empty when not blocked. */
  blockers?: CkUpgradeBlockerDto[];
  /** AB#6868: the installed model uses CK language 2 range retention. Optional. */
  isRangeRetaining?: boolean;
}

export interface CkModelLibraryStatusResponseDto {
  items: CkModelLibraryStatusItemDto[];
  modelsNeedingActionCount: number;
  modelsWithCatalogInconsistencyCount: number;
}

export interface ImportFromCatalogBatchRequestDto {
  catalogName: string;
  modelIds: string[];
}

export interface BatchImportResponseDto {
  jobId: string;
}

export interface BatchDependencyResolutionResponseDto {
  modelsToImport: string[];
  dependencyTrees: DependencyResolutionResponseDto[];
  /** AB#6870: the whole import set would break an installed model. Optional (older asset repositories). */
  isBlocked?: boolean;
  /** AB#6870: the installed models the import set would break. Optional (older asset repositories). */
  blockers?: CkUpgradeBlockerDto[];
}

export interface MigrationHistoryEntryDto {
  ckModelName: string;
  fromVersion: string;
  toVersion: string;
  executedAt: string;
  success: boolean;
  entitiesAffected: number;
  entitiesAdded: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  durationMs: number;
  errors?: string[];
  warnings?: string[];
  backupId?: string;
}

export interface MigrationHistoryResponseDto {
  items: MigrationHistoryEntryDto[];
  totalCount: number;
}
