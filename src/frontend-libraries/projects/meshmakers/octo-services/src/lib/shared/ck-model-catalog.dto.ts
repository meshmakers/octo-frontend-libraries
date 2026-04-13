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
}

export interface UpgradeCheckResponseDto {
  modelName: string;
  installedVersion?: string;
  targetVersion: string;
  upgradeNeeded: boolean;
  migrationPathAvailable: boolean;
  hasBreakingChanges: boolean;
  errorMessage?: string;
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
}

export interface CkModelLibraryStatusResponseDto {
  items: CkModelLibraryStatusItemDto[];
  modelsNeedingActionCount: number;
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
