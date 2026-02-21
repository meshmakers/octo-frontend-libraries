import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { GetDashboardEntityDtoGQL } from '../graphQL/getDashboardEntity';
import { GetCkModelsWithStateDtoGQL, GetCkModelsWithStateQueryDto } from '../graphQL/getCkModelsWithState';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import {
  DataSource,
  RuntimeEntityData,
  EntityAttribute,
  EntityAssociation,
  RuntimeEntityDataSource,
  AggregationQuery,
  ConstructionKitQueryDataSource,
  WidgetFilterConfig,
  RepeaterQueryDataSource
} from '../models/meshboard.models';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MeshBoardStateService } from './meshboard-state.service';
import { MeshBoardVariableService } from './meshboard-variable.service';

/**
 * Grouped data item for chart visualization
 */
export interface GroupedDataItem {
  category: string;
  value: number;
}

/**
 * Result of a CK query for charts
 */
export interface CkQueryResult {
  items: GroupedDataItem[];
  totalCount: number;
}

/**
 * A single data item from a repeater query.
 * Used by Widget Group to render child widgets.
 */
export interface RepeaterDataItem {
  /** Runtime ID of the entity/row */
  rtId: string;
  /** CK Type ID */
  ckTypeId: string;
  /** Well-known name of the entity */
  rtWellKnownName?: string;
  /** All attributes as a Map for easy access */
  attributes: Map<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class MeshBoardDataService {
  private readonly getDashboardEntityGQL = inject(GetDashboardEntityDtoGQL);
  private readonly getCkModelsWithStateGQL = inject(GetCkModelsWithStateDtoGQL);
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly apollo = inject(Apollo);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  /**
   * Fetches data based on the data source configuration
   */
  fetchData(dataSource: DataSource): Observable<RuntimeEntityData | RuntimeEntityData[] | null> {
    switch (dataSource.type) {
      case 'runtimeEntity':
        return this.fetchRuntimeEntity(dataSource);
      case 'static':
        return of(dataSource.data as RuntimeEntityData | RuntimeEntityData[]);
      default:
        return of(null);
    }
  }

  /**
   * Fetches a single runtime entity by rtId and ckTypeId
   */
  fetchRuntimeEntity(dataSource: RuntimeEntityDataSource): Observable<RuntimeEntityData | null> {
    if (!dataSource.rtId || !dataSource.ckTypeId) {
      return of(null);
    }

    return this.getDashboardEntityGQL.fetch({ variables: { rtId: dataSource.rtId, ckTypeId: dataSource.ckTypeId } }).pipe(
      map(result => {
        const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
        if (!entity) return null;

        return this.mapToRuntimeEntityData(entity);
      })
    );
  }

  /**
   * Fetches a single entity with associations by rtId and ckTypeId (using generic query)
   */
  fetchEntityWithAssociations(rtId: string, ckTypeId: string): Observable<RuntimeEntityData | null> {
    return this.getDashboardEntityGQL.fetch({ variables: { rtId, ckTypeId } }).pipe(
      map(result => {
        const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
        if (!entity) return null;

        return this.mapToRuntimeEntityData(entity);
      })
    );
  }

  /**
   * Maps GraphQL entity response to RuntimeEntityData
   */
  private mapToRuntimeEntityData(entity: {
    rtId: string;
    ckTypeId: string;
    rtWellKnownName?: string | null;
    rtCreationDateTime?: string | null;
    rtChangedDateTime?: string | null;
    attributes?: { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null } | null;
    associations?: {
      definitions?: {
        totalCount?: number | null;
        items?: ({
          targetRtId: string;
          targetCkTypeId: string;
          originRtId: string;
          originCkTypeId: string;
          ckAssociationRoleId: string;
        } | null)[] | null;
      } | null;
    } | null;
  }): RuntimeEntityData {
    const attributes: EntityAttribute[] = (entity.attributes?.items ?? [])
      .filter((attr): attr is NonNullable<typeof attr> => attr !== null && attr.attributeName !== null)
      .map(attr => ({
        attributeName: attr.attributeName!,
        value: attr.value
      }));

    const associations: EntityAssociation[] = (entity.associations?.definitions?.items ?? [])
      .filter((assoc): assoc is NonNullable<typeof assoc> => assoc !== null)
      .map(assoc => ({
        targetRtId: assoc.targetRtId,
        targetCkTypeId: assoc.targetCkTypeId,
        originRtId: assoc.originRtId,
        originCkTypeId: assoc.originCkTypeId,
        ckAssociationRoleId: assoc.ckAssociationRoleId
      }));

    return {
      rtId: entity.rtId,
      ckTypeId: entity.ckTypeId,
      rtWellKnownName: entity.rtWellKnownName ?? undefined,
      rtCreationDateTime: entity.rtCreationDateTime ?? undefined,
      rtChangedDateTime: entity.rtChangedDateTime ?? undefined,
      attributes,
      associations
    };
  }

  // ============================================================================
  // Aggregation Queries
  // ============================================================================

  // Pre-defined GraphQL queries for count aggregations
  private readonly CK_COUNTS_QUERY = gql`
    query getCkCounts {
      constructionKit {
        models { totalCount }
        types { totalCount }
        attributes { totalCount }
        associationRoles { totalCount }
        enums { totalCount }
        records { totalCount }
      }
    }
  `;

  /**
   * Fetches aggregation results for multiple queries.
   * Returns a Map of query ID to aggregated value.
   *
   * Supports:
   * - Construction Kit count queries (ConstructionKit/* types)
   * - Runtime entity count queries (any CK type)
   */
  async fetchAggregations(queries: AggregationQuery[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    // Check if all queries are CK count queries - if so, use optimized batch query
    const ckQueries = queries.filter(q =>
      q.aggregation === 'count' && q.ckTypeId.startsWith('ConstructionKit/')
    );

    if (ckQueries.length > 0) {
      try {
        const ckCounts = await this.fetchCkCounts();

        for (const query of ckQueries) {
          const count = this.getCkCountFromResult(query.ckTypeId, ckCounts);
          results.set(query.id, count);
        }
      } catch (error) {
        console.error('Failed to fetch CK counts:', error);
        // Set all CK queries to 0 on error
        for (const query of ckQueries) {
          results.set(query.id, 0);
        }
      }
    }

    // Handle non-CK queries - count runtime entities
    const runtimeQueries = queries.filter(q =>
      q.aggregation === 'count' && !q.ckTypeId.startsWith('ConstructionKit/')
    );

    for (const query of runtimeQueries) {
      try {
        const count = await this.fetchRuntimeEntityCount(query.ckTypeId, query.filters);
        results.set(query.id, count);
      } catch (error) {
        console.error(`Failed to fetch count for ${query.ckTypeId}:`, error);
        results.set(query.id, 0);
      }
    }

    return results;
  }

  /**
   * Fetches the count of runtime entities for a given CK type.
   * Optionally applies field filters to narrow down the count.
   * Resolves MeshBoard variables in filter values.
   */
  private async fetchRuntimeEntityCount(ckTypeId: string, filters?: WidgetFilterConfig[]): Promise<number> {
    // Convert widget filters to GraphQL format with variable resolution
    const variables = this.stateService.getVariables();
    const fieldFilters: FieldFilterDto[] | undefined = this.variableService.convertToFieldFilterDto(filters, variables);

    const result = await firstValueFrom(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId,
          first: 1, // We only need the count, not the entities
          fieldFilters
        }
      })
    );

    return result.data?.runtime?.runtimeEntities?.totalCount ?? 0;
  }

  /**
   * Fetches all Construction Kit counts in a single query.
   */
  private async fetchCkCounts(): Promise<CkCountsResult> {
    const result = await firstValueFrom(
      this.apollo.query<{ constructionKit: CkCountsResult }>({
        query: this.CK_COUNTS_QUERY,
        fetchPolicy: 'network-only'
      })
    );

    return result.data?.constructionKit ?? {
      models: { totalCount: 0 },
      types: { totalCount: 0 },
      attributes: { totalCount: 0 },
      associationRoles: { totalCount: 0 },
      enums: { totalCount: 0 },
      records: { totalCount: 0 }
    };
  }

  /**
   * Extracts the count for a specific CK type from the query result.
   */
  private getCkCountFromResult(ckTypeId: string, counts: CkCountsResult): number {
    switch (ckTypeId) {
      case 'ConstructionKit/CkModel': return counts.models?.totalCount ?? 0;
      case 'ConstructionKit/CkType': return counts.types?.totalCount ?? 0;
      case 'ConstructionKit/CkAttribute': return counts.attributes?.totalCount ?? 0;
      case 'ConstructionKit/CkAssociationRole': return counts.associationRoles?.totalCount ?? 0;
      case 'ConstructionKit/CkEnum': return counts.enums?.totalCount ?? 0;
      case 'ConstructionKit/CkRecord': return counts.records?.totalCount ?? 0;
      default: return 0;
    }
  }

  // ============================================================================
  // Construction Kit Queries
  // ============================================================================

  /**
   * Fetches data from Construction Kit and groups it for chart visualization.
   * Supports grouping by fields like modelState for pie/bar charts.
   */
  async fetchCkQueryData(dataSource: ConstructionKitQueryDataSource): Promise<CkQueryResult> {
    switch (dataSource.queryTarget) {
      case 'models':
        return this.fetchCkModelsGrouped(dataSource.groupBy);
      default:
        console.warn(`CK query target not yet implemented: ${dataSource.queryTarget}`);
        return { items: [], totalCount: 0 };
    }
  }

  // ============================================================================
  // Repeater Queries (Widget Group)
  // ============================================================================

  /**
   * Fetches data for Widget Group repeater.
   * Supports two modes:
   * 1. Query Mode: Execute a persistent query and map rows to items
   * 2. Entity Mode: Load entities by CK type with optional filters
   *
   * @param dataSource The repeater query data source configuration
   * @returns Array of RepeaterDataItem objects for rendering child widgets
   */
  async fetchRepeaterData(dataSource: RepeaterQueryDataSource): Promise<RepeaterDataItem[]> {
    const maxItems = dataSource.maxItems ?? 50;

    if (dataSource.queryRtId) {
      // Query Mode: Execute persistent query
      return this.fetchRepeaterFromQuery(dataSource.queryRtId, maxItems);
    } else if (dataSource.ckTypeId) {
      // Entity Mode: Load entities by CK type
      return this.fetchRepeaterFromEntities(dataSource.ckTypeId, dataSource.filters, maxItems);
    }

    console.warn('RepeaterQueryDataSource has neither queryRtId nor ckTypeId configured');
    return [];
  }

  /**
   * Fetches repeater data from a persistent query.
   * Maps query rows to RepeaterDataItem objects.
   */
  private async fetchRepeaterFromQuery(queryRtId: string, maxItems: number): Promise<RepeaterDataItem[]> {
    try {
      const result = await firstValueFrom(
        this.executeRuntimeQueryGQL.fetch({
          variables: {
            rtId: queryRtId,
            first: maxItems
          }
        })
      );

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length === 0) {
        return [];
      }

      const queryResult = queryItems[0];
      if (!queryResult) {
        return [];
      }

      const rows = queryResult.rows?.items ?? [];
      const items: RepeaterDataItem[] = [];

      for (const row of rows) {
        if (!row) continue;

        // Extract rtId from RtSimpleQueryRow if available
        const rtId = (row as { rtId?: string }).rtId ?? `row-${items.length}`;
        const ckTypeId = row.ckTypeId ?? queryResult.associatedCkTypeId ?? '';

        // Build attributes map from cells
        const attributes = new Map<string, unknown>();
        const cells = row.cells?.items ?? [];

        for (const cell of cells) {
          if (!cell?.attributePath) continue;
          // Sanitize the attribute path (replace dots with underscores)
          const sanitizedPath = cell.attributePath.replace(/\./g, '_');
          attributes.set(sanitizedPath, cell.value);
          // Also store with original path for flexibility
          attributes.set(cell.attributePath, cell.value);
        }

        items.push({
          rtId,
          ckTypeId,
          rtWellKnownName: attributes.get('rtWellKnownName') as string | undefined,
          attributes
        });
      }

      return items;
    } catch (error) {
      console.error('Failed to fetch repeater data from query:', error);
      return [];
    }
  }

  /**
   * Fetches repeater data from entities by CK type.
   * Maps entities to RepeaterDataItem objects.
   */
  private async fetchRepeaterFromEntities(
    ckTypeId: string,
    filters?: WidgetFilterConfig[],
    maxItems?: number
  ): Promise<RepeaterDataItem[]> {
    try {
      // Convert widget filters to GraphQL format with variable resolution
      const variables = this.stateService.getVariables();
      const fieldFilters = this.variableService.convertToFieldFilterDto(filters, variables);

      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId,
            first: maxItems ?? 50,
            fieldFilters
          }
        })
      );

      const entities = result.data?.runtime?.runtimeEntities?.items ?? [];
      const items: RepeaterDataItem[] = [];

      for (const entity of entities) {
        if (!entity) continue;

        // Build attributes map
        const attributes = new Map<string, unknown>();
        const entityAttrs = entity.attributes?.items ?? [];

        for (const attr of entityAttrs) {
          if (!attr?.attributeName) continue;
          attributes.set(attr.attributeName, attr.value);
        }

        items.push({
          rtId: entity.rtId,
          ckTypeId: entity.ckTypeId,
          rtWellKnownName: entity.rtWellKnownName ?? undefined,
          attributes
        });
      }

      return items;
    } catch (error) {
      console.error('Failed to fetch repeater data from entities:', error);
      return [];
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Fetches CK models and groups them by a specified field.
   * Default groupBy is 'modelState'.
   */
  private async fetchCkModelsGrouped(groupBy = 'modelState'): Promise<CkQueryResult> {
    try {
      const result = await firstValueFrom(
        this.getCkModelsWithStateGQL.fetch()
      );

      const models = result.data?.constructionKit?.models;
      const items = models?.items ?? [];
      const totalCount = models?.totalCount ?? 0;

      // Group by the specified field
      const grouped = this.groupCkModels(items, groupBy);

      return {
        items: grouped,
        totalCount
      };
    } catch (error) {
      console.error('Failed to fetch CK models:', error);
      return { items: [], totalCount: 0 };
    }
  }

  /**
   * Groups CK model items by a specified field.
   */
  private groupCkModels(
    items: NonNullable<NonNullable<GetCkModelsWithStateQueryDto['constructionKit']>['models']>['items'],
    groupBy: string
  ): GroupedDataItem[] {
    const counts = new Map<string, number>();

    for (const item of items ?? []) {
      if (!item) continue;

      let categoryValue: string;

      if (groupBy === 'modelState') {
        categoryValue = item.modelState ?? 'Unknown';
      } else {
        // For other fields, try to access them dynamically
        categoryValue = String((item as Record<string, unknown>)[groupBy] ?? 'Unknown');
      }

      counts.set(categoryValue, (counts.get(categoryValue) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([category, value]) => ({
      category,
      value
    }));
  }
}

interface CkCountsResult {
  models?: { totalCount?: number | null } | null;
  types?: { totalCount?: number | null } | null;
  attributes?: { totalCount?: number | null } | null;
  associationRoles?: { totalCount?: number | null } | null;
  enums?: { totalCount?: number | null } | null;
  records?: { totalCount?: number | null } | null;
}

/** @deprecated Use MeshBoardDataService instead */
export const DashboardDataService = MeshBoardDataService;
