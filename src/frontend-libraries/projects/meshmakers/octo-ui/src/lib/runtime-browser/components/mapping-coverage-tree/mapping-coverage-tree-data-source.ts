import { Injectable, inject } from '@angular/core';
import { GraphDirectionDto } from '@meshmakers/octo-services';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import {
  checkCircleIcon,
  exclamationCircleIcon,
  fileIcon,
  folderIcon,
  folderMoreIcon,
  gearIcon,
  gridIcon,
  infoCircleIcon,
  warningCircleIcon,
} from '@progress/kendo-svg-icons';
import { SVGIcon } from '@progress/kendo-svg-icons/dist/svg-icon.interface';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetCkTypeAssociationRolesDtoGQL } from '../../../graphQL/getCkTypeAssociationRoles';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../../../graphQL/getRuntimeEntityAssociationsById';
import { HierarchyDataSourceBase } from '@meshmakers/shared-ui';
import { code, storage } from '../../icons/custom-svg-icons';
import { TreeNavigationConfigService } from '../../services/tree-navigation-config.service';
import {
  CoverageEntityRef,
  CoverageGroupNodeInfo,
  CoverageNodePayload,
  CoverageNodeStatus,
  CoverageTreeItem,
  CoverageValidationDetail,
  MappingCoverageTreeConfig,
} from './mapping-coverage-tree.models';

/**
 * Navigation override applied at the ROOT level when a `Type` tree perspective
 * (AB#4263) is active: the root's direct children are resolved through the
 * perspective's primary role/direction (e.g. `EnergyIQ/SystemMembers`,
 * OUTBOUND) instead of the spatial `childRoleId`. Deeper levels always fall
 * back to the spatial hierarchy (whitelist-at-root-only, mirroring the
 * runtime browser). The child CK type filter stays `config.childCkTypeId`
 * (polymorphic), so perspective members must derive from it.
 */
export interface CoveragePerspectiveNav {
  childRoleId: string;
  childDirection: GraphDirectionDto;
}

/**
 * Target CK types that cannot be navigated in the tree. `System/Entity` is the
 * universal abstract base type and has no defining collection root, so the
 * generic `System/Related` association (target `System/Entity`, present as an
 * inbound role on every type) makes `targets(ckId: "System/Entity")` throw
 * server-side ("has no defining collection root"). Skipping it here keeps the
 * tree from firing a guaranteed-failing query for every entity.
 */
const NON_NAVIGABLE_TARGET_CK_TYPES = new Set<string>(['System/Entity']);

/** Inbound association role of a CK type, discovered from the CK schema. */
interface InboundAssociationRole {
  roleId: string;
  navigationPropertyName: string;
  /** Runtime CK type of the ORIGIN side (the entities the role navigates to). */
  targetCkTypeId: string;
}

/**
 * A navigable inbound role discovered from an entity's ACTUAL edges
 * (associations.definitions), keyed by roleId. `targetCkTypeId` is the CK type
 * used as the ckId to load the targets — the schema origin BASE type when the
 * role is declared on the type (aggregates all concrete subtypes into one
 * group), otherwise a concrete edge origin (orphan roles); `count` is the
 * exact number of edges.
 */
interface DiscoveredRoleGroup {
  roleId: string;
  targetCkTypeId: string;
  navigationPropertyName: string;
  count: number;
}

/** A discovered role annotated with its TreeNavigationConfiguration override. */
interface AnnotatedRoleGroup {
  group: DiscoveredRoleGroup;
  visible: boolean;
  grouped: boolean;
  displayName?: string;
  sortIndex?: number;
  icon?: string;
}

/**
 * Generic hierarchy data source for the Mapping Coverage Tree.
 *
 * Configure with `setRoot(...)` and `setConfig(...)` before passing to a
 * `<mm-tree-view>` instance. The data source resolves child nodes through the
 * configured `childRoleId` / `childCkTypeId` and decorates each item with the
 * number of inbound mappings (via `mappingRoleId`).
 *
 * On top of the spatial hierarchy, every entity node auto-discovers its OTHER
 * inbound association roles from its actual edges (AB#4262 port from the
 * runtime browser): each such role becomes an expandable group node (e.g.
 * `Sensors (5)` via `EnergyIQ/SpaceSensors`) whose targets — with their own
 * mapping counts — load lazily on expand. The mapping roles themselves
 * (MapsTo/MapsFrom) and the spatial child role are excluded from discovery,
 * and the optional per-tenant `TreeNavigationConfiguration` overrides
 * (visible/displayName/sortIndex/grouped/icon) apply exactly as in the
 * runtime browser.
 */
@Injectable()
export class MappingCoverageTreeDataSource extends HierarchyDataSourceBase<CoverageNodePayload> {
  private readonly getCoverageNodeGQL = inject(GetMappingCoverageNodeDtoGQL);
  private readonly getEntityAssociationsGQL = inject(GetRuntimeEntityAssociationsByIdDtoGQL);
  private readonly getCkTypeAssociationRolesGQL = inject(GetCkTypeAssociationRolesDtoGQL);
  private readonly treeNavConfig = inject(TreeNavigationConfigService);

  private _root: CoverageEntityRef | null = null;
  private _config: MappingCoverageTreeConfig | null = null;
  private _rootMappingCount = 0;
  private _validationMap: ReadonlyMap<string, CoverageValidationDetail> = new Map();
  private _rootPerspectiveNav: CoveragePerspectiveNav | null = null;

  /**
   * Cache of navigable inbound association roles per CK type id, discovered
   * lazily from the CK schema. Used to enrich discovered role groups with the
   * friendly navigation-property label + origin BASE type, and to decide
   * whether a child entity node is expandable beyond its spatial children.
   */
  private readonly inboundRolesCache = new Map<string, Promise<InboundAssociationRole[]>>();

  /**
   * The rtId of the entity tree node each entity payload was loaded under
   * (group nodes are transparent — they record the entity that owns the
   * group via `CoverageGroupNodeInfo.excludeRtId`). Used to suppress the
   * direct parent's back-edge on expand: the edge traversed downwards at a
   * `Type` perspective root (outbound) is the very same edge the child's
   * inbound auto-discovery finds again, which would render the parent as its
   * own child's child. Keyed by payload object identity (every fetch builds
   * fresh payloads), so entries are collected together with their tree nodes.
   */
  private readonly parentEntityRtIds = new WeakMap<object, string>();

  public setRoot(root: CoverageEntityRef | null): void {
    this._root = root;
  }

  public setConfig(config: MappingCoverageTreeConfig): void {
    this._config = config;
  }

  /**
   * Sets (or clears with null) the root-level navigation override of the
   * active `Type` perspective. The caller must reload the tree afterwards.
   */
  public setRootPerspectiveNav(nav: CoveragePerspectiveNav | null): void {
    this._rootPerspectiveNav = nav;
  }

  public getRootPerspectiveNav(): CoveragePerspectiveNav | null {
    return this._rootPerspectiveNav;
  }

  /**
   * Inject the validation report (rtId → status detail) loaded from the
   * latest PipelineExecution. Pass an empty map to clear the overlay.
   * The caller must trigger a tree refresh after updating the map.
   */
  public setValidationMap(map: ReadonlyMap<string, CoverageValidationDetail>): void {
    this._validationMap = map;
  }

  public getValidationMap(): ReadonlyMap<string, CoverageValidationDetail> {
    return this._validationMap;
  }

  public getRoot(): CoverageEntityRef | null {
    return this._root;
  }

  public getRootMappingCount(): number {
    return this._rootMappingCount;
  }

  public override async fetchRootNodes(): Promise<CoverageTreeItem[]> {
    if (!this._root || !this._config) {
      return [];
    }

    const result = await this.queryNode(this._root.rtId, this._root.ckTypeId, true);
    if (!result) {
      // Fall back: show the root even if we could not load its children counts.
      return [this.buildItem(this._root, true, 0, true)];
    }

    this._rootMappingCount = result.ownMappingCount;
    let hasChildren = result.children.length > 0;
    if (!hasChildren && !this._rootPerspectiveNav) {
      // The root may have no spatial children but still carry discoverable
      // association edges (group nodes).
      hasChildren =
        (await this.discoverRoleGroups(this._root.rtId, this._root.ckTypeId)).length > 0;
    }
    return [this.buildItem(result.entity, true, result.ownMappingCount, hasChildren)];
  }

  public override async fetchChildren(item: TreeItemDataTyped<CoverageNodePayload>): Promise<CoverageTreeItem[]> {
    if (!this._config) {
      return [];
    }

    // Association group node → lazily load its target entities (with mapping
    // counts + spatial look-ahead) by navigating the group's role instead of
    // the spatial hierarchy.
    const group = item.item.associationGroup;
    if (group) {
      const result = await this.queryNode(group.parentRtId, group.parentCkTypeId, false, {
        childRoleId: group.roleId,
        childCkTypeId: group.targetCkTypeId,
        childDirection: GraphDirectionDto.InboundDto,
      });
      if (!result) {
        return [];
      }
      return this.buildEntityItems(result.children, group.parentRtId, group.excludeRtId);
    }

    const atRootLevel = item.item.isRoot;
    const excludeRtId = this.parentEntityRtIds.get(item.item);
    const result = await this.queryNode(item.item.rtId, item.item.ckTypeId, atRootLevel);
    const items = result
      ? await this.buildEntityItems(result.children, item.item.rtId, excludeRtId)
      : [];

    // Whitelist-at-root-only: a `Type` perspective root shows exactly its
    // primary role's members; auto-discovery applies from the next level down.
    if (atRootLevel && this._rootPerspectiveNav) {
      return items;
    }

    items.push(
      ...(await this.buildDiscoveredNodes(item.item.rtId, item.item.ckTypeId, excludeRtId)),
    );
    return items;
  }

  /**
   * Reloads the coverage payload (mapping count / hasChildren flag) for a single
   * entity. Used after CRUD operations on mappings so the badge updates without
   * collapsing the surrounding subtree.
   */
  public async refreshNode(rtId: string, ckTypeId: string): Promise<CoverageNodePayload | null> {
    const result = await this.queryNode(rtId, ckTypeId, this._root?.rtId === rtId);
    if (!result) {
      return null;
    }
    const detail = this._validationMap.get(rtId) ?? null;
    return {
      ...result.entity,
      mappingCount: result.ownMappingCount,
      hasChildren: result.children.length > 0,
      isRoot: this._root?.rtId === rtId,
      validationStatus: detail?.status ?? null,
      validationDetail: detail,
    };
  }

  /**
   * Builds the auto-discovered (non-spatial) part of an entity's child level:
   * one group node per inbound role found on its actual edges, plus the
   * flattened targets of roles a TreeNavigationConfiguration override marks as
   * `grouped: false`. Roles hidden by an override are dropped.
   */
  private async buildDiscoveredNodes(
    rtId: string,
    ckTypeId: string,
    excludeRtId?: string,
  ): Promise<CoverageTreeItem[]> {
    const groups = await this.discoverRoleGroups(rtId, ckTypeId, excludeRtId);
    if (groups.length === 0) {
      return [];
    }

    const annotated: AnnotatedRoleGroup[] = await Promise.all(
      groups.map(async group => {
        const override = await this.treeNavConfig.resolve(ckTypeId, group.roleId);
        return {
          group,
          visible: override?.visible !== false,
          // Unlike the spatial child role (always flattened), discovered roles
          // default to a group node — that keeps device fan-out (sensors,
          // actuators, …) from flooding the structural level.
          grouped: override?.grouped ?? true,
          displayName: override?.displayName,
          sortIndex: override?.sortIndex,
          icon: override?.icon,
        };
      }),
    );
    const visibleRoles = annotated.filter(a => a.visible);

    const result: CoverageTreeItem[] = [];

    // Flattened roles (override `grouped: false`) — their targets appear
    // directly under the node, mapping counts included (same query as a group
    // node expansion).
    for (const a of visibleRoles.filter(x => !x.grouped)) {
      const targets = await this.queryNode(rtId, ckTypeId, false, {
        childRoleId: a.group.roleId,
        childCkTypeId: a.group.targetCkTypeId,
        childDirection: GraphDirectionDto.InboundDto,
      });
      if (targets) {
        result.push(...(await this.buildEntityItems(targets.children, rtId, excludeRtId)));
      }
    }

    // Grouped roles become expandable group nodes (counts already known from
    // the discovered edges). Ordered by configured sortIndex.
    const groupNodes = visibleRoles
      .filter(a => a.grouped)
      .sort((x, y) => compareGroupOrder(x, y));
    for (const a of groupNodes) {
      result.push(this.buildGroupItem(rtId, ckTypeId, a, excludeRtId));
    }
    return result;
  }

  /**
   * Discovers the navigable inbound role groups of an entity from its ACTUAL
   * edges (associations.definitions), grouped by roleId with exact counts.
   * This mirrors the runtime browser's AB#4262 discovery: real edges also
   * surface orphan roles (edge exists but the role is no longer declared on
   * the type in the installed CK model). Labels + the origin BASE type come
   * from the CK type schema when available; orphan roles fall back to the
   * concrete edge origin and a label derived from the role id.
   *
   * The spatial child role and the mapping roles (MapsTo/MapsFrom — rendered
   * in the detail panel, not the tree) are excluded, as are edges from the
   * direct tree parent (`excludeRtId`, back-edge suppression).
   */
  private async discoverRoleGroups(
    rtId: string,
    ckTypeId: string,
    excludeRtId?: string,
  ): Promise<DiscoveredRoleGroup[]> {
    let definitions: ({
      ckAssociationRoleId?: string | null;
      originCkTypeId?: string | null;
      originRtId?: string | null;
    } | null)[] = [];
    try {
      const response = await firstValueFrom(
        this.getEntityAssociationsGQL.fetch({
          variables: {
            rtId,
            ckTypeId,
            direction: GraphDirectionDto.InboundDto,
            first: 2000,
          },
          fetchPolicy: 'network-only',
        }),
      );
      definitions =
        response.data?.runtime?.runtimeEntities?.items?.[0]?.associations?.definitions?.items ?? [];
    } catch (error) {
      console.error('Error discovering association edges', { ckTypeId, rtId }, error);
      return [];
    }

    const excludedRoles = this.excludedNavigationRoleIds();
    const edgeCount = new Map<string, number>();
    const edgeOrigin = new Map<string, string>();
    for (const def of definitions) {
      const roleId = String(def?.ckAssociationRoleId ?? '');
      const origin = String(def?.originCkTypeId ?? '');
      if (
        !roleId ||
        !origin ||
        excludedRoles.has(roleId) ||
        NON_NAVIGABLE_TARGET_CK_TYPES.has(origin)
      ) {
        continue;
      }
      // Direct-parent back-edge: the edge we traversed to reach this entity,
      // seen from its other side. Never show the parent as its own child's child.
      if (excludeRtId && def?.originRtId === excludeRtId) {
        continue;
      }
      edgeCount.set(roleId, (edgeCount.get(roleId) ?? 0) + 1);
      if (!edgeOrigin.has(roleId)) {
        edgeOrigin.set(roleId, origin);
      }
    }
    if (edgeCount.size === 0) {
      return [];
    }

    // Declared roles from the CK type schema give the friendly navigation name
    // and, crucially, the origin BASE type — using it as the ckId aggregates
    // all concrete subtypes into a single group (e.g. one "Sensors (5)"
    // instead of one group per concrete sensor type).
    const schemaRoles = await this.getInboundRoles(ckTypeId);
    const schemaByRole = new Map<string, { origin: string; nav: string }>();
    for (const r of schemaRoles) {
      if (!schemaByRole.has(r.roleId)) {
        schemaByRole.set(r.roleId, { origin: r.targetCkTypeId, nav: r.navigationPropertyName });
      }
    }

    const groups: DiscoveredRoleGroup[] = [];
    for (const [roleId, count] of edgeCount) {
      const schema = schemaByRole.get(roleId);
      groups.push({
        roleId,
        targetCkTypeId: schema?.origin ?? edgeOrigin.get(roleId) ?? '',
        navigationPropertyName: schema?.nav ?? deriveRoleLabel(roleId),
        count,
      });
    }
    return groups;
  }

  /**
   * Association role ids never offered as tree navigation: the spatial child
   * role (already flattened into the hierarchy), the mapping roles (their
   * edges ARE the mapping counts / detail panel content) and the
   * pipeline-execution role.
   */
  private excludedNavigationRoleIds(): Set<string> {
    const config = this._config;
    return new Set(
      config
        ? [
            config.childRoleId,
            config.mappingRoleId,
            config.mappingSourceRoleId,
            config.validationExecutesRoleId,
          ]
        : [],
    );
  }

  /**
   * Returns the navigable inbound association roles of a CK type, discovered
   * from the CK schema and cached per type id for the lifetime of this data
   * source. Uses the RUNTIME ids from the backend (`rtRoleId`,
   * `rtOriginCkTypeId`), never the versioned fullName — for an INBOUND role
   * this entity is the association's TARGET side, so the related entities are
   * on the ORIGIN side.
   */
  private getInboundRoles(ckTypeId: string): Promise<InboundAssociationRole[]> {
    const cached = this.inboundRolesCache.get(ckTypeId);
    if (cached) {
      return cached;
    }
    const promise = firstValueFrom(
      this.getCkTypeAssociationRolesGQL.fetch({ variables: { ckTypeId } }),
    )
      .then(response => {
        const all =
          response.data?.constructionKit?.types?.items?.[0]?.associations?.in?.all ?? [];
        const roles: InboundAssociationRole[] = [];
        for (const role of all) {
          if (!role) {
            continue;
          }
          const targetCkTypeId = String(role.rtOriginCkTypeId ?? '');
          if (!targetCkTypeId || NON_NAVIGABLE_TARGET_CK_TYPES.has(targetCkTypeId)) {
            continue;
          }
          roles.push({
            roleId: String(role.rtRoleId ?? ''),
            navigationPropertyName: role.navigationPropertyName,
            targetCkTypeId,
          });
        }
        return roles;
      })
      .catch(error => {
        console.error('Error fetching association roles for type', ckTypeId, error);
        // Drop the failed promise from the cache so a later expand can retry.
        this.inboundRolesCache.delete(ckTypeId);
        return [];
      });
    this.inboundRolesCache.set(ckTypeId, promise);
    return promise;
  }

  /**
   * Whether entities of the given type can have discoverable children beyond
   * the spatial hierarchy — i.e. the type declares at least one non-excluded
   * inbound role. Schema-based, so an expand arrow may open to an empty set
   * for an instance without edges (acceptable; mirrors the runtime browser).
   */
  private async typeHasNavigableInboundRoles(ckTypeId: string): Promise<boolean> {
    const excluded = this.excludedNavigationRoleIds();
    const roles = await this.getInboundRoles(ckTypeId);
    return roles.some(r => !excluded.has(r.roleId));
  }

  /**
   * Builds tree items for entity children, de-duplicating by rtId and dropping
   * the direct parent's back-edge target (`excludeRtId`). An entity is marked
   * expandable when it has spatial grandchildren OR its CK type declares a
   * navigable inbound role. `parentRtId` registers each item's tree parent so
   * its own expansion can exclude it in turn.
   */
  private async buildEntityItems(
    children: QueryNodeChild[],
    parentRtId: string,
    excludeRtId?: string,
  ): Promise<CoverageTreeItem[]> {
    const unique = new Map<string, QueryNodeChild>();
    for (const child of children) {
      if (child.rtId !== excludeRtId && !unique.has(child.rtId)) {
        unique.set(child.rtId, child);
      }
    }

    // Warm the role cache for every distinct child type in parallel so the
    // expandable flag can be resolved without a per-entity round trip.
    const distinctTypes = [...new Set([...unique.values()].map(c => c.ckTypeId))];
    await Promise.all(distinctTypes.map(t => this.getInboundRoles(t)));

    const result: CoverageTreeItem[] = [];
    for (const child of unique.values()) {
      const expandable =
        child.hasGrandChildren || (await this.typeHasNavigableInboundRoles(child.ckTypeId));
      const item = this.buildItem(
        { rtId: child.rtId, ckTypeId: child.ckTypeId, name: child.name, description: child.description },
        false,
        child.mappingCount,
        expandable,
      );
      this.parentEntityRtIds.set(item.item, parentRtId);
      result.push(item);
    }
    return result;
  }

  /** Builds the synthetic tree item for one discovered association role group. */
  private buildGroupItem(
    parentRtId: string,
    parentCkTypeId: string,
    annotated: AnnotatedRoleGroup,
    excludeRtId?: string,
  ): CoverageTreeItem {
    const group = annotated.group;
    const id = `assoc:${parentCkTypeId}@${parentRtId}:${group.roleId}:${group.targetCkTypeId}`;
    const label = `${annotated.displayName ?? group.navigationPropertyName} (${group.count})`;
    const info: CoverageGroupNodeInfo = {
      parentRtId,
      parentCkTypeId,
      roleId: group.roleId,
      targetCkTypeId: group.targetCkTypeId,
      excludeRtId,
    };
    const payload: CoverageNodePayload = {
      rtId: id,
      ckTypeId: '',
      name: label,
      mappingCount: 0,
      hasChildren: true,
      isRoot: false,
      validationStatus: null,
      validationDetail: null,
      associationGroup: info,
    };
    return new TreeItemDataTyped<CoverageNodePayload>(
      id,
      label,
      `${group.roleId} → ${group.targetCkTypeId}`,
      payload,
      resolveGroupIcon(annotated.icon),
      true,
      false,
    );
  }

  private buildItem(
    entity: CoverageEntityRef,
    isRoot: boolean,
    mappingCount: number,
    hasChildren: boolean,
  ): CoverageTreeItem {
    const detail = this._validationMap.get(entity.rtId) ?? null;
    const payload: CoverageNodePayload = {
      ...entity,
      mappingCount,
      hasChildren,
      isRoot,
      validationStatus: detail?.status ?? null,
      validationDetail: detail,
    };
    const text = formatNodeLabel(entity, mappingCount, detail);
    const tooltip = buildTooltip(entity, detail);
    // Use the subtree rollup status so info/ok parents reveal hidden warnings
    // or errors below them. Falls back to own status when subtree info isn't
    // in the report (older backend) or no detail at all.
    const iconStatus = detail?.subtreeStatus ?? detail?.status ?? null;
    const icon = resolveIcon(iconStatus, isRoot);
    return new TreeItemDataTyped<CoverageNodePayload>(
      entity.rtId,
      text,
      tooltip,
      payload,
      icon,
      hasChildren,
      false,
    );
  }

  private async queryNode(
    rtId: string,
    ckTypeId: string,
    atRootLevel: boolean,
    navOverride?: {
      childRoleId: string;
      childCkTypeId: string;
      childDirection: GraphDirectionDto;
    },
  ): Promise<QueryNodeResult | null> {
    if (!this._config) return null;

    // Child navigation precedence: an explicit override (group-node expansion /
    // flattened discovered role) > the `Type` perspective's primary role at the
    // ROOT level only > the spatial hierarchy from the config.
    const nav = atRootLevel ? this._rootPerspectiveNav : null;
    const childRoleId = navOverride?.childRoleId ?? nav?.childRoleId ?? this._config.childRoleId;
    const childCkTypeId = navOverride?.childCkTypeId ?? this._config.childCkTypeId;
    const childDirection =
      navOverride?.childDirection ?? nav?.childDirection ?? GraphDirectionDto.InboundDto;

    try {
      const data = await firstValueFrom(
        this.getCoverageNodeGQL
          .fetch({
            variables: {
              rtId,
              ckTypeId,
              childRoleId,
              childCkTypeId,
              childDirection,
              grandChildRoleId: this._config.childRoleId,
              grandChildCkTypeId: this._config.childCkTypeId,
              grandChildDirection: GraphDirectionDto.InboundDto,
              mappingRoleId: this._config.mappingRoleId,
              mappingCkTypeId: this._config.mappingCkTypeId,
            },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0])),
      );

      if (!data?.rtId || !data.ckTypeId) {
        return null;
      }

      const entity: CoverageEntityRef = {
        rtId: data.rtId,
        ckTypeId: data.ckTypeId,
        name: readAttr(data.attributes?.items, 'name') ?? data.rtWellKnownName ?? data.rtId,
        description: readAttr(data.attributes?.items, 'description') ?? undefined,
      };

      const ownMappingCount = data.associations?.ownMappings?.totalCount ?? 0;
      const childItems = data.associations?.children?.items ?? [];
      const children = childItems
        .filter((c): c is NonNullable<typeof c> => !!c && !!c.rtId && !!c.ckTypeId)
        .map(c => ({
          rtId: c.rtId as string,
          ckTypeId: c.ckTypeId as string,
          name: readAttr(c.attributes?.items, 'name') ?? (c.rtId as string),
          description: readAttr(c.attributes?.items, 'description') ?? undefined,
          mappingCount: c.associations?.mappings?.totalCount ?? 0,
          hasGrandChildren: (c.associations?.grandChildren?.totalCount ?? 0) > 0,
        }));

      return { entity, ownMappingCount, children };
    } catch (error) {
      console.error('Failed to load coverage node', error);
      return null;
    }
  }
}

interface QueryNodeChild {
  rtId: string;
  ckTypeId: string;
  name: string;
  description?: string;
  mappingCount: number;
  hasGrandChildren: boolean;
}

interface QueryNodeResult {
  entity: CoverageEntityRef;
  ownMappingCount: number;
  children: QueryNodeChild[];
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

/** Readable fallback label for a role id without a schema navigation name. */
function deriveRoleLabel(roleId: string): string {
  const slash = roleId.lastIndexOf('/');
  return slash >= 0 ? roleId.slice(slash + 1) : roleId;
}

/**
 * Orders group nodes by configured sortIndex (ascending, unconfigured last),
 * then by navigation property name for a stable, readable order.
 */
function compareGroupOrder(x: AnnotatedRoleGroup, y: AnnotatedRoleGroup): number {
  const xi = x.sortIndex ?? Number.MAX_SAFE_INTEGER;
  const yi = y.sortIndex ?? Number.MAX_SAFE_INTEGER;
  if (xi !== yi) {
    return xi - yi;
  }
  return x.group.navigationPropertyName.localeCompare(y.group.navigationPropertyName);
}

/** Resolves a configured group icon name to an SVG icon (folder by default). */
function resolveGroupIcon(name: string | undefined): SVGIcon {
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

function formatNodeLabel(
  entity: CoverageEntityRef,
  mappingCount: number,
  detail: CoverageValidationDetail | null,
): string {
  const base = entity.name || entity.rtId;
  const countSuffix = mappingCount > 0 ? `  [${mappingCount}]` : '';
  if (detail && (detail.missingRequired.length > 0 || detail.missingRecommended.length > 0)) {
    const missing = [...detail.missingRequired, ...detail.missingRecommended].join(', ');
    return `${base}${countSuffix} — missing: ${missing}`;
  }
  return `${base}${countSuffix}`;
}

function buildTooltip(
  entity: CoverageEntityRef,
  detail: CoverageValidationDetail | null,
): string {
  const head = entity.description ?? `${entity.ckTypeId}@${entity.rtId}`;
  if (!detail) return head;
  const lines: string[] = [head, `Status: ${detail.status}`];
  // Flag subtree problems on `info` / `ok` parents so the user knows to drill
  // in. Only show when the subtree is strictly worse than the node itself.
  const counts = detail.subtreeCounts;
  if (counts) {
    const errBelow = counts.error - (detail.status === 'error' ? 1 : 0);
    const warnBelow = counts.warning - (detail.status === 'warning' ? 1 : 0);
    if (errBelow > 0 || warnBelow > 0) {
      const parts: string[] = [];
      if (errBelow > 0) parts.push(`${errBelow} error${errBelow === 1 ? '' : 's'}`);
      if (warnBelow > 0) parts.push(`${warnBelow} warning${warnBelow === 1 ? '' : 's'}`);
      lines.push(`Below: ${parts.join(', ')}`);
    }
  }
  if (detail.missingRequired.length > 0) {
    lines.push(`Missing required: ${detail.missingRequired.join(', ')}`);
  }
  if (detail.missingRecommended.length > 0) {
    lines.push(`Missing recommended: ${detail.missingRecommended.join(', ')}`);
  }
  if (detail.present.length > 0) {
    lines.push(`Present: ${detail.present.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Wraps a Kendo SVG icon's <path> markup in a coloured group so the rendered
 * icon picks up a semantic colour at the SVG layer — no CSS hooks needed.
 *
 * Kendo's `kendo-svgicon` writes the icon content as-is inside an outer
 * `<svg>`, and the path has no fill of its own (so it inherits currentColor).
 * Wrapping in `<g fill="…">` forces a literal colour and survives the
 * surrounding `color: inherit` in the tree template.
 *
 * We embed the hex value rather than a CSS variable because SVG attributes
 * inside the content string aren't resolved by CSS — they're literal.
 */
function colorize(icon: SVGIcon, color: string): SVGIcon {
  return {
    name: `${icon.name}-${color.replace('#', '')}`,
    viewBox: icon.viewBox,
    content: `<g fill="${color}">${icon.content}</g>`,
  };
}

// Semantic palette — matches the badge colours used in the toolbar summary
// (badge-error/-warning/-ok/-info) so the legend and the tree agree.
const STATUS_COLORS: Record<CoverageNodeStatus, string> = {
  ok: '#28a745',       // success green
  warning: '#ffc107',  // amber
  error: '#dc3545',    // red
  info: '#0dcaf0',     // info cyan
};

const COLORED_STATUS_ICONS: Record<CoverageNodeStatus, SVGIcon> = {
  ok: colorize(checkCircleIcon, STATUS_COLORS.ok),
  warning: colorize(warningCircleIcon, STATUS_COLORS.warning),
  error: colorize(exclamationCircleIcon, STATUS_COLORS.error),
  info: colorize(infoCircleIcon, STATUS_COLORS.info),
};

function resolveIcon(status: CoverageNodeStatus | null, isRoot: boolean): SVGIcon {
  if (status && COLORED_STATUS_ICONS[status]) {
    return COLORED_STATUS_ICONS[status];
  }
  return isRoot ? folderIcon : gridIcon;
}
