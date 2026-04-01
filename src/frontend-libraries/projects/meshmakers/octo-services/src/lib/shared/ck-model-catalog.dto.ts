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
  action: 'install' | 'update' | 'none';
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
