import type { ProcessDiagramConfig, PropertyBinding, BindingEffectType } from '@meshmakers/octo-process-diagrams';
import type { WidgetFilterConfig } from '../../models/meshboard.models';
import type { QueryFamily } from '../../utils/query-family';
import {
  DEFAULT_PROCESS_BINDING_NAME,
  DiagramPropertyMapping,
  ProcessConnectionDirection,
  ProcessDataBindingMode,
  ProcessValueAggregate,
  ProcessWidgetBinding
} from './process-widget-config.model';
import { mappingBindingName, processBindingConfigError } from './process-widget-bindings';

/**
 * Pure helpers of the Process Widget binding editor (AB#8025): the binding
 * cards of the Data Binding tab, the Binding / Aggregate columns of the
 * Mappings tab and the per-connection direction pick. No Angular, no I/O, so
 * every rule is unit-tested on its own.
 */

/** The two sources a binding card offers. */
export type ProcessBindingSource = Exclude<ProcessDataBindingMode, 'none'>;

/**
 * One binding card while the dialog is open. Data fields mirror
 * {@link ProcessWidgetBinding}; `uid` and `expanded` are editor state only.
 */
export interface ProcessBindingDraft {
  /** Stable identity of the card (survives renames). */
  uid: number;
  name: string;
  mode: ProcessBindingSource;
  ckTypeId?: string;
  rtId?: string;
  /** Display name of the picked entity (label only). */
  rtDisplayName?: string;
  queryRtId?: string;
  queryName?: string;
  /** CK type the query queries against (attribute lists, filters). */
  queryCkTypeId?: string;
  queryFamily?: QueryFamily;
  ignoreTimeFilter?: boolean;
  entitySelectorId?: string;
  filters?: WidgetFilterConfig[];
  /** Card body shown. */
  expanded: boolean;
  /**
   * Name the mappings currently refer to (editor state). Follows `name` only while
   * the name is valid; absent = `name` as the card was created.
   */
  committedName?: string;
}

/** The legacy single-binding fields plus `bindings`, as the dialog hands them to the registration. */
export interface ProcessBindingResultFields {
  dataBindingMode?: ProcessDataBindingMode;
  bindingCkTypeId?: string;
  bindingRtId?: string;
  bindingQueryRtId?: string;
  bindingQueryName?: string;
  bindingQueryFamily?: QueryFamily;
  bindingIgnoreTimeFilter?: boolean;
  bindingEntitySelectorId?: string;
  bindingFilters?: WidgetFilterConfig[];
  bindings?: ProcessWidgetBinding[];
}

/** Label of a card header: the implicit legacy binding reads "Default". */
export function bindingDisplayName(name: string): string {
  return name === DEFAULT_PROCESS_BINDING_NAME ? 'Default' : name;
}

/** Creates the cards from the bindings the widget loads (named bindings or the implicit legacy one). */
export function draftsFromBindings(bindings: readonly ProcessWidgetBinding[], nextUid: () => number): ProcessBindingDraft[] {
  return bindings.map(b => ({
    uid: nextUid(),
    name: b.name,
    mode: b.mode,
    ckTypeId: b.ckTypeId,
    rtId: b.rtId,
    queryRtId: b.queryRtId,
    queryName: b.queryName,
    queryFamily: b.queryFamily,
    ignoreTimeFilter: b.ignoreTimeFilter,
    entitySelectorId: b.entitySelectorId,
    filters: b.filters,
    // A single card opens expanded; with several, the author opens the one to edit.
    expanded: bindings.length === 1,
    committedName: b.name
  }));
}

/** The binding a card stands for (only set keys, `ignoreTimeFilter` only when `true`). */
export function bindingFromDraft(draft: ProcessBindingDraft): ProcessWidgetBinding {
  const isEntity = draft.mode === 'runtimeEntity';
  return {
    name: draft.name.trim(),
    mode: draft.mode,
    ...(isEntity && draft.ckTypeId && { ckTypeId: draft.ckTypeId }),
    ...(isEntity && draft.rtId && { rtId: draft.rtId }),
    ...(!isEntity && draft.queryRtId && { queryRtId: draft.queryRtId }),
    ...(!isEntity && draft.queryName && { queryName: draft.queryName }),
    ...(!isEntity && draft.queryFamily && { queryFamily: draft.queryFamily }),
    ...(!isEntity && draft.ignoreTimeFilter === true && { ignoreTimeFilter: true }),
    ...(draft.entitySelectorId && { entitySelectorId: draft.entitySelectorId }),
    ...(draft.filters && draft.filters.length > 0 && { filters: draft.filters })
  };
}

/** Inline error of a card's name: required, unique within the widget. */
export function bindingNameError(drafts: readonly ProcessBindingDraft[], draft: ProcessBindingDraft): string | undefined {
  const name = draft.name.trim();
  if (!name) {
    return 'Enter a binding name.';
  }
  if (drafts.some(d => d.uid !== draft.uid && d.name.trim() === name)) {
    return `The name "${name}" is used by another binding.`;
  }
  return undefined;
}

/** What a card still needs before it can load (e.g. a query), or `undefined`. */
export function bindingDraftConfigError(draft: ProcessBindingDraft): string | undefined {
  return processBindingConfigError(bindingFromDraft(draft));
}

/** `true` when the card follows a selector that is not on the board. */
export function hasMissingSelector(draft: ProcessBindingDraft, selectorIds: readonly string[]): boolean {
  return !!draft.entitySelectorId && !selectorIds.includes(draft.entitySelectorId);
}

/** The message that blocks Save for a card whose selector is not on the board. */
export function missingSelectorMessage(draft: ProcessBindingDraft): string {
  return `Binding "${bindingDisplayName(draft.name.trim())}": selector "${draft.entitySelectorId}" does not exist on this board — ` +
    'choose another selector or "None".';
}

/**
 * Every message that blocks Save, one per problem: missing or duplicate names,
 * selectors that are not on the board, and cards that cannot load yet.
 */
export function bindingDraftIssues(drafts: readonly ProcessBindingDraft[], selectorIds: readonly string[]): string[] {
  const issues: string[] = [];
  drafts.forEach((draft, index) => {
    const label = draft.name.trim() ? `Binding "${bindingDisplayName(draft.name.trim())}"` : `Binding ${index + 1}`;
    const nameError = bindingNameError(drafts, draft);
    if (nameError) {
      issues.push(`${label}: ${nameError}`);
    }
    if (hasMissingSelector(draft, selectorIds)) {
      issues.push(missingSelectorMessage(draft));
    }
    const configError = bindingDraftConfigError(draft);
    if (configError) {
      issues.push(`${label}: ${configError}.`);
    }
  });
  return issues;
}

/**
 * A free name for a new or duplicated card: `base`, else `base 2`, `base 3`, …
 * (a duplicate of `pv` is `pv copy`, then `pv copy 2`).
 */
export function uniqueBindingName(base: string, drafts: readonly ProcessBindingDraft[]): string {
  const taken = new Set(drafts.map(d => d.name.trim()));
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

/** Property ids whose mapping reads from the binding `name` (only mappings with a field). */
export function mappingsUsingBinding(mappings: readonly DiagramPropertyMapping[], name: string): string[] {
  return mappings
    .filter(m => mappingBindingName(m) === name && !!m.sourcePath?.trim())
    .map(m => m.propertyId);
}

/**
 * Mappings after a binding was renamed: every mapping of the old name now
 * refers to the new one (a mapping of the implicit `default` keeps no
 * `bindingName` when the new name is `default` again).
 */
export function renameBindingInMappings(
  mappings: readonly DiagramPropertyMapping[],
  oldName: string,
  newName: string
): DiagramPropertyMapping[] {
  if (oldName === newName) {
    return [...mappings];
  }
  return mappings.map(m => mappingBindingName(m) === oldName ? withBindingName(m, newName) : m);
}

/** Mappings after the binding `name` was deleted: its mappings are cleared (removed). */
export function clearMappingsOfBinding(mappings: readonly DiagramPropertyMapping[], name: string): DiagramPropertyMapping[] {
  return mappings.filter(m => mappingBindingName(m) !== name);
}

/** The mapping with another binding; `default` is written as no `bindingName` (legacy shape). */
export function withBindingName(mapping: DiagramPropertyMapping, name: string): DiagramPropertyMapping {
  const { bindingName: _old, ...rest } = mapping;
  return name === DEFAULT_PROCESS_BINDING_NAME ? rest : { ...rest, bindingName: name };
}

/** The mapping with another aggregate; `first` is written as no `aggregate` unless it was stored so. */
export function withAggregate(mapping: DiagramPropertyMapping, aggregate: ProcessValueAggregate): DiagramPropertyMapping {
  const { aggregate: _old, ...rest } = mapping;
  return aggregate === 'first' ? rest : { ...rest, aggregate };
}

/** Options of the Aggregate column, in wireframe order. */
export const PROCESS_AGGREGATE_OPTIONS: readonly { value: ProcessValueAggregate; label: string }[] = [
  { value: 'first', label: 'First row' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' }
];

/**
 * `true` when the Aggregate column is fixed to "First row": a non-`number`
 * property, or a runtime-entity binding (one entity — nothing to reduce).
 */
export function isAggregateFixed(propertyType: string | undefined, bindingMode: ProcessBindingSource | undefined): boolean {
  return propertyType !== 'number' || bindingMode === 'runtimeEntity';
}

/** The source type a binding's mappings use: entity attribute or query column. */
export function sourceTypeForMode(mode: ProcessBindingSource): DiagramPropertyMapping['sourceType'] {
  return mode === 'runtimeEntity' ? 'attribute' : 'column';
}

/**
 * The binding fields of the dialog result (AB#8025):
 * - no card → no binding (`dataBindingMode` stays absent when it was absent, else `'none'`);
 * - exactly one card named `default` → the legacy single-binding fields (no silent migration);
 * - otherwise → `bindings`, legacy fields absent.
 */
export function bindingResultFields(
  drafts: readonly ProcessBindingDraft[],
  initialMode: ProcessDataBindingMode | undefined
): ProcessBindingResultFields {
  if (drafts.length === 0) {
    return initialMode === undefined ? {} : { dataBindingMode: 'none' };
  }
  const bindings = drafts.map(bindingFromDraft);
  if (bindings.length === 1 && bindings[0].name === DEFAULT_PROCESS_BINDING_NAME) {
    const b = bindings[0];
    return {
      dataBindingMode: b.mode,
      ...(b.ckTypeId && { bindingCkTypeId: b.ckTypeId }),
      ...(b.rtId && { bindingRtId: b.rtId }),
      ...(b.queryRtId && { bindingQueryRtId: b.queryRtId }),
      ...(b.queryName && { bindingQueryName: b.queryName }),
      ...(b.queryFamily && { bindingQueryFamily: b.queryFamily }),
      ...(b.ignoreTimeFilter && { bindingIgnoreTimeFilter: true }),
      ...(b.entitySelectorId && { bindingEntitySelectorId: b.entitySelectorId }),
      ...(b.filters && { bindingFilters: b.filters })
    };
  }
  return { bindings };
}

// ============================================================================
// Connections (AB#8025 — wireframe approval condition on AB#7954)
// ============================================================================

/** Effects on a connection line that carry its direction (sign of the value). */
export const CONNECTION_DIRECTION_EFFECTS: readonly BindingEffectType[] = [
  'animation.enabled',
  'visible',
  'style.stroke.color',
  'style.stroke.opacity',
  'style.opacity'
];

const CONNECTION_PRIMITIVE_TYPES = ['line', 'polyline', 'path'];

/** A connection line of the diagram, as listed in the editor. */
export interface ProcessDiagramConnection {
  /** Primitive id. */
  id: string;
  /** Primitive name, else its id. */
  label: string;
  /** Property the diagram binds the direction effects to; `undefined` when they use several. */
  diagramPropertyId?: string;
  /** Effects on the line that follow the direction property. */
  effects: BindingEffectType[];
}

function isDirectionBinding(binding: PropertyBinding, connectionId: string): boolean {
  return binding.targetType === 'primitive' &&
    binding.targetId === connectionId &&
    CONNECTION_DIRECTION_EFFECTS.includes(binding.effectType);
}

/**
 * The connection lines of a diagram: top-level line / polyline / path
 * primitives with at least one direction effect (see
 * {@link CONNECTION_DIRECTION_EFFECTS}) bound to a property.
 */
export function findDiagramConnections(diagram: ProcessDiagramConfig | null | undefined): ProcessDiagramConnection[] {
  if (!diagram?.primitives || !diagram.propertyBindings) {
    return [];
  }
  const connections: ProcessDiagramConnection[] = [];
  for (const primitive of diagram.primitives) {
    // A stored diagram can hold a malformed entry (AB#8151): skip it instead of throwing.
    if (!primitive || typeof primitive !== 'object' || !CONNECTION_PRIMITIVE_TYPES.includes(primitive.type)) {
      continue;
    }
    const bindings = diagram.propertyBindings.filter(b => isDirectionBinding(b, primitive.id));
    if (bindings.length === 0) {
      continue;
    }
    const propertyIds = new Set(bindings.map(b => b.propertyId));
    connections.push({
      id: primitive.id,
      label: primitive.name || primitive.id,
      diagramPropertyId: propertyIds.size === 1 ? bindings[0].propertyId : undefined,
      effects: [...new Set(bindings.map(b => b.effectType))]
    });
  }
  return connections;
}

/**
 * The diagram with each connection's direction effects bound to the property
 * the widget picked (AB#8025). Returns the same object when there is nothing
 * to change; never mutates the input. Overrides for unknown connections or
 * properties are skipped (see {@link connectionDirectionIssues}).
 */
export function applyConnectionDirections(
  diagram: ProcessDiagramConfig,
  directions: readonly ProcessConnectionDirection[] | undefined
): ProcessDiagramConfig {
  if (!directions || directions.length === 0 || !diagram.propertyBindings) {
    return diagram;
  }
  const propertyIds = new Set((diagram.transformProperties ?? []).map(p => p.id));
  // Only lines the editor lists as connections (same rule as connectionDirectionIssues).
  const connectionIds = new Set(findDiagramConnections(diagram).map(c => c.id));
  const byConnection = new Map<string, string>();
  for (const d of directions) {
    if (connectionIds.has(d.connectionId) && propertyIds.has(d.propertyId)) {
      byConnection.set(d.connectionId, d.propertyId);
    }
  }
  if (byConnection.size === 0) {
    return diagram;
  }
  let changed = false;
  const propertyBindings = diagram.propertyBindings.map(b => {
    const propertyId = byConnection.get(b.targetId);
    if (propertyId && propertyId !== b.propertyId && isDirectionBinding(b, b.targetId)) {
      changed = true;
      return { ...b, propertyId };
    }
    return b;
  });
  return changed ? { ...diagram, propertyBindings } : diagram;
}

/** Problems of `connectionDirections` against the diagram (unknown connection or property). */
export function connectionDirectionIssues(
  diagram: ProcessDiagramConfig,
  directions: readonly ProcessConnectionDirection[] | undefined
): string[] {
  if (!directions || directions.length === 0) {
    return [];
  }
  const connectionIds = new Set(findDiagramConnections(diagram).map(c => c.id));
  const propertyIds = new Set((diagram.transformProperties ?? []).map(p => p.id));
  const issues: string[] = [];
  for (const d of directions) {
    if (!connectionIds.has(d.connectionId)) {
      issues.push(`Connection direction refers to unknown connection '${d.connectionId}'`);
    } else if (!propertyIds.has(d.propertyId)) {
      issues.push(`Direction of connection '${d.connectionId}' refers to unknown property '${d.propertyId}'`);
    }
  }
  return issues;
}
