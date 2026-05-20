import { Injectable, inject } from '@angular/core';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import {
  checkCircleIcon,
  exclamationCircleIcon,
  folderIcon,
  gridIcon,
  infoCircleIcon,
  warningCircleIcon,
} from '@progress/kendo-svg-icons';
import { SVGIcon } from '@progress/kendo-svg-icons/dist/svg-icon.interface';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetMappingCoverageNodeDtoGQL } from '../../../graphQL/getMappingCoverageNode';
import { HierarchyDataSourceBase } from '@meshmakers/shared-ui';
import {
  CoverageEntityRef,
  CoverageNodePayload,
  CoverageNodeStatus,
  CoverageTreeItem,
  CoverageValidationDetail,
  MappingCoverageTreeConfig,
} from './mapping-coverage-tree.models';

/**
 * Generic hierarchy data source for the Mapping Coverage Tree.
 *
 * Configure with `setRoot(...)` and `setConfig(...)` before passing to a
 * `<mm-tree-view>` instance. The data source resolves child nodes through the
 * configured `childRoleId` / `childCkTypeId` and decorates each item with the
 * number of inbound mappings (via `mappingRoleId`).
 */
@Injectable()
export class MappingCoverageTreeDataSource extends HierarchyDataSourceBase<CoverageNodePayload> {
  private readonly getCoverageNodeGQL = inject(GetMappingCoverageNodeDtoGQL);

  private _root: CoverageEntityRef | null = null;
  private _config: MappingCoverageTreeConfig | null = null;
  private _rootMappingCount = 0;
  private _validationMap: ReadonlyMap<string, CoverageValidationDetail> = new Map();

  public setRoot(root: CoverageEntityRef | null): void {
    this._root = root;
  }

  public setConfig(config: MappingCoverageTreeConfig): void {
    this._config = config;
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

    const result = await this.queryNode(this._root.rtId, this._root.ckTypeId);
    if (!result) {
      // Fall back: show the root even if we could not load its children counts.
      return [this.buildItem(this._root, true, 0, true)];
    }

    this._rootMappingCount = result.ownMappingCount;
    const hasChildren = result.children.length > 0;
    return [this.buildItem(result.entity, true, result.ownMappingCount, hasChildren)];
  }

  public override async fetchChildren(item: TreeItemDataTyped<CoverageNodePayload>): Promise<CoverageTreeItem[]> {
    if (!this._config) {
      return [];
    }

    const result = await this.queryNode(item.item.rtId, item.item.ckTypeId);
    if (!result) {
      return [];
    }

    return result.children.map(child =>
      this.buildItem(
        { rtId: child.rtId, ckTypeId: child.ckTypeId, name: child.name, description: child.description },
        false,
        child.mappingCount,
        child.hasGrandChildren,
      ),
    );
  }

  /**
   * Reloads the coverage payload (mapping count / hasChildren flag) for a single
   * entity. Used after CRUD operations on mappings so the badge updates without
   * collapsing the surrounding subtree.
   */
  public async refreshNode(rtId: string, ckTypeId: string): Promise<CoverageNodePayload | null> {
    const result = await this.queryNode(rtId, ckTypeId);
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
    const icon = resolveIcon(detail?.status ?? null, isRoot);
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

  private async queryNode(rtId: string, ckTypeId: string): Promise<QueryNodeResult | null> {
    if (!this._config) return null;

    try {
      const data = await firstValueFrom(
        this.getCoverageNodeGQL
          .fetch({
            variables: {
              rtId,
              ckTypeId,
              childRoleId: this._config.childRoleId,
              childCkTypeId: this._config.childCkTypeId,
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
