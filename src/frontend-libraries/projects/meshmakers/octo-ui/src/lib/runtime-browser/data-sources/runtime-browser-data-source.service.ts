import { Injectable, inject } from '@angular/core';
import {
  AssociationModOptionsDto,
  BasicTreeNodeInputUpdateDto,
  CkModelDto,
  CkTypeDto,
  CkTypeMetaData,
  GetCkModelByIdDtoGQL,
  GetCkTypesDtoGQL,
  GraphDirectionDto,
  MultiplicitiesDto,
  RtAssociationDto,
  RtEntityDto,
} from '@meshmakers/octo-services';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import {
  fileIcon,
  folderMoreIcon,
  folderOpenIcon,
  gearIcon,
} from '@progress/kendo-svg-icons';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { OctoGraphQlHierarchyDataSource } from '../../data-sources/octo-graph-ql-hierarchy-data-source';
import { DeleteEntitiesDtoGQL } from '../../graphQL/deleteEntities';
import { GetCkModelsDtoGQL } from '../../graphQL/getCkModels';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';
import {
  GetRuntimeEntityAssociationsByIdDtoGQL,
  GetRuntimeEntityAssociationsByIdQueryDto,
} from '../../graphQL/getRuntimeEntityAssociationsById';
import { GetTreeAssociationTargetsDtoGQL } from '../../graphQL/getTreeAssociationTargets';
import { GetTreesDtoGQL } from '../../graphQL/getTrees';
import { UpdateRuntimeEntitiesDtoGQL } from '../../graphQL/updateRuntimeEntities';
import { UpdateTreeNodesDtoGQL } from '../../graphQL/updateTreeNodes';
import { code, storage } from '../icons/custom-svg-icons';
import { TreeNavigationConfigService } from '../services/tree-navigation-config.service';
import { TypeHelperService } from '../services/type-helper.service';

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string }
  | AssociationGroupNode;

/**
 * Synthetic tree node that groups all entities reachable from a parent entity
 * through a single association role (e.g. "ContainedSensors"). Its children are
 * loaded lazily on expand. It is intentionally not a runtime entity, so the
 * toolbar create/edit/delete actions and the entity picker stay disabled for it.
 */
interface AssociationGroupNode {
  isAssociationGroup: true;
  parentRtId: string;
  parentCkTypeId: string;
  roleId: string;
  targetCkTypeId: string;
  direction: GraphDirectionDto;
}

/** Inbound association role of a CK type, discovered from the CK schema. */
interface InboundAssociationRole {
  roleId: string;
  navigationPropertyName: string;
  targetCkTypeId: string;
  multiplicity: MultiplicitiesDto;
}

/** Well-known role id of the hierarchical parent-child association. */
const PARENT_CHILD_ROLE_ID = 'System/ParentChild';

/**
 * Target CK types that cannot be navigated in the tree. `System/Entity` is the
 * universal abstract base type and has no defining collection root, so the
 * generic `System/Related` association (target `System/Entity`, present as an
 * inbound role on every type) makes `targets(ckId: "System/Entity")` throw
 * server-side ("has no defining collection root"). Skipping it here keeps the
 * tree from firing a guaranteed-failing query for every entity.
 */
const NON_NAVIGABLE_TARGET_CK_TYPES = new Set<string>(['System/Entity']);

@Injectable({
  providedIn: 'root',
})
export class RuntimeBrowserDataSource extends OctoGraphQlHierarchyDataSource<BrowserItem> {
  private readonly getTreesDtoGQL = inject(GetTreesDtoGQL);
  private readonly getCkTypeAssociationRolesDtoGQL = inject(
    GetCkTypeAssociationRolesDtoGQL,
  );
  private readonly getTreeAssociationTargetsDtoGQL = inject(
    GetTreeAssociationTargetsDtoGQL,
  );
  private readonly getCkModelsGQL = inject(GetCkModelsDtoGQL);
  private readonly getCkTypesGQL = inject(GetCkTypesDtoGQL);
  private readonly getCkModelByIdDtoGQL = inject(GetCkModelByIdDtoGQL);
  private readonly deleteEntitiesDtoGQL = inject(DeleteEntitiesDtoGQL);
  private readonly getRuntimeEntityAssociationsByIdDtoGQL = inject(
    GetRuntimeEntityAssociationsByIdDtoGQL,
  );
  private readonly updateRuntimeEntitiesDtoGQL = inject(UpdateRuntimeEntitiesDtoGQL);
  private readonly updateTreeNodesDtoGQL = inject(UpdateTreeNodesDtoGQL);
  private readonly typeHelperService = inject(TypeHelperService);
  private readonly treeNavConfig = inject(TreeNavigationConfigService);
  private isCkModelsRoot(
    item: BrowserItem,
  ): item is { isCkModelsRoot?: boolean; ckModelId?: string } {
    return !!item && 'isCkModelsRoot' in item;
  }

  private isCkModel(item: BrowserItem): item is CkModelDto {
    return !!item && 'id' in item && !('rtId' in item) && !('ckTypeId' in item);
  }

  private isCkType(item: BrowserItem): item is CkTypeDto {
    return !!item && 'ckTypeId' in item && !('rtId' in item) && !('id' in item);
  }

  private isAssociationGroup(
    item: BrowserItem,
  ): item is AssociationGroupNode {
    return !!item && 'isAssociationGroup' in item;
  }

  /**
   * Cache of inbound association roles per CK type id. Discovered lazily from
   * the CK schema and reused across tree expansions (and to decide whether a
   * child entity node is expandable). Lives on the instance because the tree is
   * created fresh per browser/picker mount.
   */
  private readonly inboundRolesCache = new Map<
    string,
    Promise<InboundAssociationRole[]>
  >();

  // Define visual metadata for different entity types
  private static readonly ckTypeMetaData: CkTypeMetaData[] = [
    new CkTypeMetaData('Basic/Tree', 'Tree', 'Tree Structure', folderMoreIcon),
    new CkTypeMetaData('Basic/TreeNode', 'Node', 'Tree Node', fileIcon),
    new CkTypeMetaData('Basic/Asset', 'Asset', 'Asset Entity', code),
    new CkTypeMetaData('System/Database', 'Database', 'Database', storage),
  ];

  public override async fetchChildren(
    item: TreeItemDataTyped<BrowserItem>,
  ): Promise<TreeItemDataTyped<BrowserItem>[]> {
    // Handle CK Models root node
    if (this.isCkModelsRoot(item.item)) {
      return this.fetchCkModels();
    }

    // Handle CK Model node - fetch its types
    if (this.isCkModel(item.item)) {
      const modelId = item.item.id.fullName;
      return this.fetchCkTypes(modelId);
    }

    // Handle CK Type node - no children
    if (this.isCkType(item.item)) {
      return [];
    }

    // Handle association group node - lazily load its target entities
    if (this.isAssociationGroup(item.item)) {
      const group = item.item;
      const targets = await this.fetchAssociationTargets(
        group.parentRtId,
        group.parentCkTypeId,
        group.roleId,
        group.targetCkTypeId,
        group.direction,
      );
      return this.buildEntityTreeItems(targets);
    }

    // Handle regular runtime entity
    const rtEntity = item.item as RtEntityDto;
    if (!rtEntity.rtId || !rtEntity.ckTypeId) {
      return [];
    }

    // Discover the inbound association roles of this entity's type from the CK
    // schema. Inbound roles are the "contained / children" direction (the same
    // direction the tree historically used for System/ParentChild), so they
    // generalize the old hard-coded behavior to every association.
    const roles = await this.getInboundRoles(rtEntity.ckTypeId);

    // Apply the optional per-tenant TreeNavigationConfiguration overrides on top
    // of auto-discovery: hide (visible), relabel (displayName), reorder
    // (sortIndex), flatten vs group (grouped), icon. Defaults reproduce Phase 1:
    // System/ParentChild flat, every other role grouped.
    const annotated = await Promise.all(
      roles.map(async (role) => {
        const override = await this.treeNavConfig.resolve(
          rtEntity.ckTypeId,
          role.roleId,
        );
        return {
          role,
          visible: override?.visible !== false,
          grouped: override?.grouped ?? role.roleId !== PARENT_CHILD_ROLE_ID,
          displayName: override?.displayName,
          sortIndex: override?.sortIndex,
          icon: override?.icon,
        };
      }),
    );
    const visibleRoles = annotated.filter((a) => a.visible);

    const result: TreeItemDataTyped<BrowserItem>[] = [];

    // 1. Flattened roles (default: System/ParentChild) — their targets appear
    //    directly under the node to preserve the familiar hierarchy navigation.
    const flattenedRoles = visibleRoles.filter((a) => !a.grouped);
    const flattenedTargetLists = await Promise.all(
      flattenedRoles.map((a) =>
        this.fetchAssociationTargets(
          rtEntity.rtId,
          rtEntity.ckTypeId,
          a.role.roleId,
          a.role.targetCkTypeId,
          GraphDirectionDto.InboundDto,
        ),
      ),
    );
    result.push(
      ...(await this.buildEntityTreeItems(flattenedTargetLists.flat())),
    );

    // 2. Grouped roles become expandable group nodes, but only when they have
    //    targets (avoids empty, noisy groups). Ordered by configured sortIndex.
    const groupedRoles = visibleRoles.filter((a) => a.grouped);
    const counts = await Promise.all(
      groupedRoles.map((a) =>
        this.fetchAssociationCount(
          rtEntity.rtId,
          rtEntity.ckTypeId,
          a.role.roleId,
          a.role.targetCkTypeId,
          GraphDirectionDto.InboundDto,
        ),
      ),
    );
    const groupNodes = groupedRoles
      .map((a, index) => ({ a, count: counts[index] }))
      .filter((x) => x.count > 0)
      .sort((x, y) => this.compareGroupOrder(x.a, y.a));
    for (const { a, count } of groupNodes) {
      const role = a.role;
      const groupNode: AssociationGroupNode = {
        isAssociationGroup: true,
        parentRtId: rtEntity.rtId,
        parentCkTypeId: rtEntity.ckTypeId,
        roleId: role.roleId,
        targetCkTypeId: role.targetCkTypeId,
        direction: GraphDirectionDto.InboundDto,
      };
      const label = `${a.displayName ?? role.navigationPropertyName} (${count})`;
      result.push(
        new TreeItemDataTyped<BrowserItem>(
          this.buildGroupNodeId(rtEntity.rtId, rtEntity.ckTypeId, role),
          label,
          `${role.roleId} → ${role.targetCkTypeId}`,
          groupNode,
          this.resolveGroupIcon(a.icon),
          true,
        ),
      );
    }

    return result;
  }

  /**
   * Orders group nodes by configured sortIndex (ascending, unconfigured last),
   * then by navigation property name for a stable, readable order.
   */
  private compareGroupOrder(
    x: { sortIndex?: number; role: InboundAssociationRole },
    y: { sortIndex?: number; role: InboundAssociationRole },
  ): number {
    const xi = x.sortIndex ?? Number.MAX_SAFE_INTEGER;
    const yi = y.sortIndex ?? Number.MAX_SAFE_INTEGER;
    if (xi !== yi) {
      return xi - yi;
    }
    return x.role.navigationPropertyName.localeCompare(
      y.role.navigationPropertyName,
    );
  }

  /** Resolves a configured group icon name to an SVG icon (folder by default). */
  private resolveGroupIcon(name: string | undefined) {
    switch (name) {
      case 'file':
        return fileIcon;
      case 'gear':
        return gearIcon;
      case 'database':
        return storage;
      case 'code':
        return code;
      case 'folder':
      default:
        return folderMoreIcon;
    }
  }

  /**
   * Returns the inbound association roles of a CK type, discovered from the CK
   * schema and cached per type id for the lifetime of this data source.
   */
  private getInboundRoles(
    ckTypeId: string,
  ): Promise<InboundAssociationRole[]> {
    const cached = this.inboundRolesCache.get(ckTypeId);
    if (cached) {
      return cached;
    }
    const promise = firstValueFrom(
      this.getCkTypeAssociationRolesDtoGQL.fetch({ variables: { ckTypeId } }),
    )
      .then((response) => {
        const all =
          response.data?.constructionKit?.types?.items?.[0]?.associations?.in
            ?.all ?? [];
        const roles: InboundAssociationRole[] = [];
        for (const role of all) {
          if (!role) {
            continue;
          }
          // Use the RUNTIME ids from the backend, never the versioned fullName.
          // For an INBOUND role this entity is the association's TARGET side, so the
          // related entities to navigate to are on the ORIGIN side: query
          // targets(direction: INBOUND, ckId: rtOriginCkTypeId). rtTargetCkTypeId
          // here is this entity's own (target) type and would return nothing.
          // The runtime form must come from the backend (rtOriginCkTypeId) — it
          // follows a resolution logic that simply stripping the version does not.
          const targetCkTypeId = String(role.rtOriginCkTypeId ?? '');
          if (!targetCkTypeId || NON_NAVIGABLE_TARGET_CK_TYPES.has(targetCkTypeId)) {
            continue;
          }
          roles.push({
            roleId: String(role.rtRoleId ?? ''),
            navigationPropertyName: role.navigationPropertyName,
            targetCkTypeId,
            multiplicity: role.multiplicity,
          });
        }
        return roles;
      })
      .catch((error) => {
        console.error(
          'Error fetching association roles for type',
          ckTypeId,
          error,
        );
        // Drop the failed promise from the cache so a later expand can retry.
        this.inboundRolesCache.delete(ckTypeId);
        return [];
      });
    this.inboundRolesCache.set(ckTypeId, promise);
    return promise;
  }

  /** Loads the target entities reachable from an entity through one role. */
  private async fetchAssociationTargets(
    rtId: string,
    ckTypeId: string,
    roleId: string,
    targetCkTypeId: string,
    direction: GraphDirectionDto,
  ): Promise<RtEntityDto[]> {
    try {
      const response = await firstValueFrom(
        this.getTreeAssociationTargetsDtoGQL.fetch({
          variables: { rtId, ckTypeId, roleId, targetCkTypeId, direction },
        }),
      );
      const items =
        response.data?.runtime?.runtimeEntities?.items?.[0]?.associations
          ?.targets?.items ?? [];
      return items.filter((i): i is RtEntityDto => !!i);
    } catch (error) {
      console.error(
        'Error fetching association targets',
        { ckTypeId, roleId, targetCkTypeId },
        error,
      );
      return [];
    }
  }

  /** Counts the target entities reachable through one role (without loading them). */
  private async fetchAssociationCount(
    rtId: string,
    ckTypeId: string,
    roleId: string,
    targetCkTypeId: string,
    direction: GraphDirectionDto,
  ): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.getTreeAssociationTargetsDtoGQL.fetch({
          variables: { rtId, ckTypeId, roleId, targetCkTypeId, direction, first: 1 },
        }),
      );
      return (
        response.data?.runtime?.runtimeEntities?.items?.[0]?.associations
          ?.targets?.totalCount ?? 0
      );
    } catch (error) {
      console.error(
        'Error counting association targets',
        { ckTypeId, roleId, targetCkTypeId },
        error,
      );
      return 0;
    }
  }

  /**
   * Builds tree items for runtime entities, de-duplicating by rtId and marking
   * an entity expandable when its CK type defines at least one inbound
   * association role.
   */
  private async buildEntityTreeItems(
    entities: RtEntityDto[],
  ): Promise<TreeItemDataTyped<BrowserItem>[]> {
    const unique = new Map<string, RtEntityDto>();
    for (const entity of entities) {
      if (entity?.rtId && entity?.ckTypeId && !unique.has(entity.rtId)) {
        unique.set(entity.rtId, entity);
      }
    }

    // Warm the role cache for every distinct child type in parallel so the
    // expandable flag can be resolved without a per-entity round trip.
    const distinctTypes = [
      ...new Set([...unique.values()].map((e) => e.ckTypeId)),
    ];
    await Promise.all(distinctTypes.map((t) => this.getInboundRoles(t)));

    const result: TreeItemDataTyped<BrowserItem>[] = [];
    for (const entity of unique.values()) {
      const roles = await this.getInboundRoles(entity.ckTypeId);
      result.push(
        new TreeItemDataTyped<BrowserItem>(
          entity.rtId,
          this.extractDisplayName(entity),
          this.extractTooltip(entity),
          entity,
          this.resolveIcon(entity.ckTypeId),
          roles.length > 0,
        ),
      );
    }
    return result;
  }

  /** Stable tree-node id for an association group node. */
  private buildGroupNodeId(
    parentRtId: string,
    parentCkTypeId: string,
    role: InboundAssociationRole,
  ): string {
    return `assoc:${parentCkTypeId}@${parentRtId}:${role.roleId}:${role.targetCkTypeId}`;
  }

  /** Resolves the display label of an entity from its name/displayName attributes. */
  private extractDisplayName(entity: RtEntityDto): string {
    const nameValue = entity.attributes?.items?.find(
      (x) => x?.attributeName === 'name',
    )?.value;
    const displayNameValue = entity.attributes?.items?.find(
      (x) => x?.attributeName === 'displayName',
    )?.value;
    return (
      (typeof nameValue === 'string'
        ? nameValue
        : typeof nameValue === 'object' && nameValue !== null
          ? JSON.stringify(nameValue)
          : null) ||
      (typeof displayNameValue === 'string' ? displayNameValue : null) ||
      entity.rtWellKnownName ||
      entity.ckTypeId ||
      'Unknown'
    );
  }

  /** Resolves the tooltip of an entity from its description attribute. */
  private extractTooltip(entity: RtEntityDto): string {
    const descValue = entity.attributes?.items?.find(
      (x) => x?.attributeName === 'description',
    )?.value;
    return (
      (typeof descValue === 'string' ? descValue : null) ||
      `${entity.ckTypeId} - ${entity.rtId}`
    );
  }

  /** Resolves the icon for a CK type, falling back to a generic entity icon. */
  private resolveIcon(ckTypeId: string) {
    return (
      RuntimeBrowserDataSource.ckTypeMetaData.find(
        (x) => x.ckTypeId === ckTypeId,
      )?.svgIcon ?? code
    );
  }

  public override async fetchRootNodes(): Promise<
    TreeItemDataTyped<BrowserItem>[]
  > {
    try {
      const result = new Array<TreeItemDataTyped<BrowserItem>>();

      // Add CK Models root node
      const ckModelsRoot: BrowserItem = { isCkModelsRoot: true };
      result.push(
        new TreeItemDataTyped<BrowserItem>(
          'ck-models-root',
          'CK Models',
          'Construction Kit Models',
          ckModelsRoot,
          folderOpenIcon,
          true, // expandable
        ),
      );

      // Check if Basic construction kit is available before trying to fetch Tree entities
      const isBasicCkAvailable =
        await this.checkBasicConstructionKitAvailable();

      if (isBasicCkAvailable) {
        // Fetch all Tree entities as root nodes
        const r = await firstValueFrom(
          this.getTreesDtoGQL.fetch({
            variables: { ckTypeId: 'Basic/Tree' },
            fetchPolicy: 'network-only',
          }),
        );

        for (const item of (r.data?.runtime?.runtimeEntities
          ?.items as RtEntityDto[]) ?? []) {
          // Find or create metadata for this item type
          let metaData = RuntimeBrowserDataSource.ckTypeMetaData.find(
            (x) => x.ckTypeId === item?.ckTypeId,
          );
          if (!metaData) {
            metaData = new CkTypeMetaData(
              item?.ckTypeId || 'Unknown',
              item?.ckTypeId || 'Unknown',
              item?.ckTypeId || 'Unknown',
              code,
            );
          }

          // Extract display information
          const nameValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'name',
          )?.value;
          const displayNameValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'displayName',
          )?.value;

          // Debug logging
          if (typeof nameValue === 'object') {
            console.warn('Name value is an object:', nameValue);
          }

          const text =
            (typeof nameValue === 'string'
              ? nameValue
              : typeof nameValue === 'object' && nameValue !== null
                ? JSON.stringify(nameValue)
                : null) ||
            (typeof displayNameValue === 'string' ? displayNameValue : null) ||
            item.ckTypeId ||
            'Unknown';
          const descValue = item.attributes?.items?.find(
            (x) => x?.attributeName === 'description',
          )?.value;
          const tooltip =
            (typeof descValue === 'string' ? descValue : null) ||
            `${item.ckTypeId} - ${item.rtId}`;

          result.push(
            new TreeItemDataTyped<BrowserItem>(
              `${item.ckTypeId}@${item.rtId}`,
              text,
              tooltip,
              item,
              metaData.svgIcon,
              (item?.associations?.targets?.totalCount ?? 0) > 0,
            ),
          );
        }
      } else {
        console.debug(
          '⚠️ Basic construction kit not available, skipping Tree entities',
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching root nodes:', error);
      return [];
    }
  }

  /**
   * Gets ParentChild association of given Runtime Entity.
   *
   * @param ckTypeId Ck Type Id.
   * @param rtId Runtime Id.
   * @param isParentAssoc if true, fetches only parent, otherwise children.
   *
   * @returns Fetches configured association.
   */
  public async getParentChildAssociation(
    ckTypeId: string,
    rtId: string,
    isParentAssoc: boolean,
  ): Promise<RtAssociationDto[] | undefined> {
    let response: Apollo.QueryResult<GetRuntimeEntityAssociationsByIdQueryDto>;

    try {
      response = await firstValueFrom(
        this.getRuntimeEntityAssociationsByIdDtoGQL.fetch({
          variables: {
            ckTypeId,
            rtId,
            direction: isParentAssoc
              ? GraphDirectionDto.OutboundDto
              : GraphDirectionDto.InboundDto,
            roleId: 'System/ParentChild',
          },
          fetchPolicy: 'network-only',
        }),
      );
    } catch (error) {
      console.error('Error on attempt to get association', error);
      return undefined;
    }

    const assocs = response?.data?.runtime?.runtimeEntities?.items?.[0]
      ?.associations?.definitions?.items as RtAssociationDto[];

    return assocs;
  }

  /**
   * Swaps parent of the given object.
   *
   * @param srcObjRtId Runtime Entity Id of the object that is supposed to have its association changed.
   * @param oldParentCkTypeId CkTypeId of the current parent.
   * @param oldParentRtId Runtime Entity Id of the current parent.
   * @param newParentCkTypeId CkTypeId of the target parent.
   * @param newParentRtId Runtime Entity Id of the target parent.
   *
   * @returns true if association was successfully swapped.
   */
  public async updateParentChildAssociation(
    srcObjRtId: string,
    oldParentCkTypeId: string,
    oldParentRtId: string,
    newParentCkTypeId: string,
    newParentRtId: string,
  ) {
    const entitiesToUpdate: BasicTreeNodeInputUpdateDto[] = [
      // source
      {
        rtId: srcObjRtId,
        item: {
          parent: [
            {
              target: {
                rtId: oldParentRtId,
                ckTypeId: oldParentCkTypeId,
              },
              modOption: AssociationModOptionsDto.DeleteDto,
            },
          ],
        },
      },
      // target
      {
        rtId: srcObjRtId,
        item: {
          parent: [
            {
              target: {
                rtId: newParentRtId,
                ckTypeId: newParentCkTypeId,
              },
              modOption: AssociationModOptionsDto.CreateDto,
            },
          ],
        },
      },
    ];

    try {
      const response = await firstValueFrom(
        this.updateTreeNodesDtoGQL.mutate({
          variables: {
            entities: entitiesToUpdate,
          },
          fetchPolicy: 'network-only',
        }),
      );

      if (response.error) {
        throw response.error;
      }
    } catch (error) {
      console.error(
        'Error on attempt to switch object parents by changing ParentChild association',
        srcObjRtId,
        error,
      );
      return false;
    }

    return true;
  }

  /**
   * Moves an entity to a new parent using the generic `runtimeEntities.update` mutation.
   * Works for any entity type (not just Basic/TreeNode).
   *
   * Uses the `associations` field on `RtEntityInputDto` with `roleName` set to
   * the navigation property name (e.g. "parent") and modOption CREATE/DELETE.
   *
   * @param srcObjRtId Runtime ID of the entity being moved.
   * @param srcObjCkTypeId CK type of the entity being moved.
   * @param navigationPropertyName Navigation property for the parent association (e.g. "parent").
   * @param oldParentCkTypeId CK type of the current parent.
   * @param oldParentRtId Runtime ID of the current parent.
   * @param newParentCkTypeId CK type of the new parent.
   * @param newParentRtId Runtime ID of the new parent.
   * @returns true if the move succeeded.
   */
  public async updateEntityAssociation(
    srcObjRtId: string,
    srcObjCkTypeId: string,
    navigationPropertyName: string,
    oldParentCkTypeId: string,
    oldParentRtId: string,
    newParentCkTypeId: string,
    newParentRtId: string,
  ): Promise<boolean> {
    const entitiesToUpdate = [
      {
        rtId: srcObjRtId,
        item: {
          ckTypeId: srcObjCkTypeId,
          attributes: [],
          associations: [
            {
              roleName: navigationPropertyName,
              targets: [
                {
                  target: {
                    rtId: oldParentRtId,
                    ckTypeId: oldParentCkTypeId,
                  },
                  modOption: AssociationModOptionsDto.DeleteDto,
                },
                {
                  target: {
                    rtId: newParentRtId,
                    ckTypeId: newParentCkTypeId,
                  },
                  modOption: AssociationModOptionsDto.CreateDto,
                },
              ],
            },
          ],
        },
      },
    ];

    try {
      const response = await firstValueFrom(
        this.updateRuntimeEntitiesDtoGQL.mutate({
          variables: {
            entities: entitiesToUpdate,
          },
          fetchPolicy: 'network-only',
        }),
      );

      if (response.error) {
        throw response.error;
      }

      return true;
    } catch (error) {
      console.error(
        'Error on attempt to move entity by changing association',
        srcObjRtId,
        error,
      );
      return false;
    }
  }

  /**
   * Returns ckTypeId and rtId of a parent of given runtime entity.
   *
   * @param ckTypeId Runtime entity's ck type
   * @param rtId Runtime entity's runtime id
   * @returns object with parent's ckTypeId and rtId, or undefined when not found or on error.
   */
  public async getRuntimeEntityParentData(
    ckTypeId: string,
    rtId: string,
  ): Promise<
    | {
        ckTypeId: string;
        rtId: string;
      }
    | undefined
  > {
    const isParentAssoc = true;
    const parentAssocs = await this.getParentChildAssociation(
      ckTypeId,
      rtId,
      isParentAssoc,
    );

    if (!parentAssocs || parentAssocs.length === 0) {
      return undefined;
    }

    // the non-null assertion operator can be used because we've checked array length before
    const parentAssoc = parentAssocs[0]!;

    return {
      ckTypeId: parentAssoc.targetCkTypeId,
      rtId: parentAssoc.targetRtId,
    };
  }

  /**
   * Performs cascade delete operation on given runtime entity.
   *
   * @param itemToDelete Potential runtime entity.
   * @returns true on successful delete, false on database error or if object is not a runtime entity.
   */
  public async deleteRtEntityAndChildren(
    itemToDelete: TreeItemDataTyped<unknown>,
  ): Promise<boolean> {
    const runtimeEntity = itemToDelete.item;

    if (!this.typeHelperService.isRuntimeEntity(runtimeEntity)) {
      console.error(
        'The item given for deletion is not a runtime entity',
        itemToDelete,
      );
      return false;
    }

    try {
      const result = await firstValueFrom(
        this.deleteEntitiesDtoGQL.mutate({
          variables: {
            rtEntityIds: [
              {
                ckTypeId: runtimeEntity.ckTypeId,
                rtId: runtimeEntity.rtId,
              },
            ],
          },
        }),
      );

      if (result.error) {
        throw result.error;
      }

      return result.data?.runtime?.runtimeEntities?.delete ?? false;
    } catch (error) {
      console.error(
        'Error on attempt to cascade delete nodes during Delete Node operation',
        error,
      );
      return false;
    }
  }

  /**
   * Check if the Basic construction kit is available in the system
   */
  private async checkBasicConstructionKitAvailable(): Promise<boolean> {
    try {
      // Check if any types exist in the Basic model
      const response = await firstValueFrom(
        this.getCkModelByIdDtoGQL.fetch({
          variables: {
            model: 'Basic',
          },
          fetchPolicy: 'network-only',
        }),
      );

      const hasBasicTypes =
        (response.data?.constructionKit?.models?.items?.length ?? 0) > 0;

      if (hasBasicTypes) {
        console.debug('✅ Basic construction kit is available');
      } else {
        console.debug(
          '⚠️ Basic construction kit not found - no types in Basic model',
        );
      }

      return hasBasicTypes;
    } catch (error) {
      console.warn(
        '⚠️ Error checking Basic construction kit availability:',
        error,
      );
      return false; // Assume not available on error
    }
  }

  private async fetchCkModels(): Promise<TreeItemDataTyped<BrowserItem>[]> {
    try {
      const response = await firstValueFrom(
        this.getCkModelsGQL.fetch({
          variables: {},
          fetchPolicy: 'network-only',
        }),
      );

      const result: TreeItemDataTyped<BrowserItem>[] = [];
      const models = response.data?.constructionKit?.models?.items || [];

      for (const model of models) {
        if (!model) {
          continue;
        }
        const modelItem = model as unknown as CkModelDto;

        result.push(
          new TreeItemDataTyped<BrowserItem>(
            `model:${model.id.fullName}`,
            model.id.fullName || 'Unknown Model',
            `Model: ${model.id.fullName} (${model.modelState || 'Unknown State'})`,
            modelItem,
            folderMoreIcon,
            true, // Models have types as children
          ),
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching CK models:', error);
      return [];
    }
  }

  private async fetchCkTypes(
    modelId: string,
  ): Promise<TreeItemDataTyped<BrowserItem>[]> {
    try {
      const response = await firstValueFrom(
        this.getCkTypesGQL.fetch({
          variables: {
            ckModelIds: [modelId],
          },
          fetchPolicy: 'network-only',
        }),
      );

      const result: TreeItemDataTyped<BrowserItem>[] = [];
      const types = response.data?.constructionKit?.types?.items || [];

      for (const type of types) {
        if (!type) continue;
        const typeItem = type as unknown as CkTypeDto;

        const isAbstract = type.isAbstract ? ' (Abstract)' : '';
        const isFinal = type.isFinal ? ' (Final)' : '';

        result.push(
          new TreeItemDataTyped<BrowserItem>(
            `type:${type.ckTypeId.fullName}`,
            type.ckTypeId.fullName || 'Unknown Type',
            `Type: ${type.ckTypeId.fullName}${isAbstract}${isFinal}`,
            typeItem,
            gearIcon,
            false, // Types don't have children in this view
          ),
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching CK types:', error);
      return [];
    }
  }
}
