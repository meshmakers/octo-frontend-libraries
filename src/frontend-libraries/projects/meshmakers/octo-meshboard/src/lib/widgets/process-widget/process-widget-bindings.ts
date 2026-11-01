import type { WidgetFilterConfig } from '../../models/meshboard.models';
import type { QueryFamily } from '../../utils/query-family';
import {
  DEFAULT_PROCESS_BINDING_NAME,
  DiagramPropertyMapping,
  ProcessWidgetBinding,
  ProcessWidgetConfig
} from './process-widget-config.model';
import { processAggregateIssue } from './process-value-aggregation';

/**
 * Helpers for the named data bindings of the Process Widget (AB#8023):
 * reading the legacy single-binding fields as one implicit binding, choosing
 * the binding of a mapping, validating a config and (de)serializing bindings.
 */

/** A problem found by {@link validateProcessWidgetBindings}. */
export interface ProcessBindingIssue {
  /** Binding the issue belongs to, if any. */
  bindingName?: string;
  /** Property of a mapping the issue belongs to, if any. */
  propertyId?: string;
  /** English, user-readable description. */
  message: string;
}

/**
 * The legacy single-binding fields read as one binding named
 * {@link DEFAULT_PROCESS_BINDING_NAME}, or `undefined` when the legacy mode is
 * absent or `'none'`.
 */
export function legacyProcessBinding(config: ProcessWidgetConfig): ProcessWidgetBinding | undefined {
  const mode = config.dataBindingMode;
  if (!mode || mode === 'none') {
    return undefined;
  }
  return {
    name: DEFAULT_PROCESS_BINDING_NAME,
    mode,
    ckTypeId: config.bindingCkTypeId,
    rtId: config.bindingRtId,
    queryRtId: config.bindingQueryRtId,
    queryName: config.bindingQueryName,
    queryFamily: config.bindingQueryFamily,
    ignoreTimeFilter: config.bindingIgnoreTimeFilter,
    entitySelectorId: config.bindingEntitySelectorId,
    filters: config.bindingFilters
  };
}

/** `true` when the config uses the named `bindings` list instead of the legacy fields. */
export function hasNamedProcessBindings(config: ProcessWidgetConfig): boolean {
  return Array.isArray(config.bindings) && config.bindings.length > 0;
}

/**
 * The bindings the widget loads: the named `bindings` when present, otherwise
 * the implicit legacy binding (or none).
 */
export function resolveProcessBindings(config: ProcessWidgetConfig): ProcessWidgetBinding[] {
  if (hasNamedProcessBindings(config)) {
    return config.bindings!;
  }
  const legacy = legacyProcessBinding(config);
  return legacy ? [legacy] : [];
}

/** The binding name a mapping reads from (`default` when absent). */
export function mappingBindingName(mapping: DiagramPropertyMapping): string {
  return mapping.bindingName || DEFAULT_PROCESS_BINDING_NAME;
}

/**
 * The config problem of a single binding, or `undefined` when it can load.
 * A runtime-entity binding needs a CK type (or a selector to take it from) and
 * an rtId or an entity selector; a query binding needs a query rtId.
 */
export function processBindingConfigError(binding: ProcessWidgetBinding): string | undefined {
  if (binding.mode === 'runtimeEntity') {
    if (!binding.rtId && !binding.entitySelectorId) {
      return 'Runtime entity binding needs an rtId or an entity selector';
    }
    if (!binding.ckTypeId && !binding.entitySelectorId) {
      return 'Runtime entity binding needs a CK type';
    }
    return undefined;
  }
  if (binding.mode === 'persistentQuery') {
    return binding.queryRtId ? undefined : 'Persistent query binding needs a query rtId';
  }
  return `Unknown binding mode '${String((binding as { mode?: unknown }).mode)}'`;
}

/**
 * Validates the bindings and mappings of a Process Widget config (AB#8023):
 * empty or duplicate binding names, bindings that cannot load (see
 * {@link processBindingConfigError}), selectors that do not exist on the board
 * (only checked when `knownSelectorIds` is given), and mappings that refer to an
 * unknown binding. A legacy config is validated like its implicit binding; a
 * config without any binding has no issues.
 *
 * Aggregates (AB#8024): an unknown aggregate, or one other than `first` on a
 * runtime-entity binding, an `attribute` mapping or — when `propertyTypes` is
 * given — a non-`number` property, is reported; the widget then reads the
 * first row.
 *
 * @param propertyTypes Type per diagram property id (`transformProperties`), when the diagram is known.
 */
export function validateProcessWidgetBindings(
  config: ProcessWidgetConfig,
  knownSelectorIds?: readonly string[],
  propertyTypes?: ReadonlyMap<string, string>
): ProcessBindingIssue[] {
  const issues: ProcessBindingIssue[] = [];
  const bindings = resolveProcessBindings(config);
  const names = new Set<string>();

  for (const binding of bindings) {
    if (!binding.name || !binding.name.trim()) {
      issues.push({ message: 'A binding has no name' });
      continue;
    }
    if (names.has(binding.name)) {
      issues.push({ bindingName: binding.name, message: `Duplicate binding name '${binding.name}'` });
    }
    names.add(binding.name);

    const error = processBindingConfigError(binding);
    if (error) {
      issues.push({ bindingName: binding.name, message: error });
    }
    if (binding.entitySelectorId && knownSelectorIds && !knownSelectorIds.includes(binding.entitySelectorId)) {
      issues.push({
        bindingName: binding.name,
        message: `Entity selector '${binding.entitySelectorId}' does not exist on the board`
      });
    }
  }

  // Only report unknown names when the widget has bindings at all — a widget
  // without data binding keeps stale mappings silently, as before.
  if (bindings.length > 0) {
    for (const mapping of config.propertyMappings ?? []) {
      const name = mappingBindingName(mapping);
      if (!names.has(name)) {
        issues.push({
          bindingName: name,
          propertyId: mapping.propertyId,
          message: `Mapping of '${mapping.propertyId}' refers to unknown binding '${name}'`
        });
      }
      const aggregateIssue = mappingAggregateIssue(mapping, bindings.find(b => b.name === name), propertyTypes);
      if (aggregateIssue) {
        issues.push({
          bindingName: name,
          propertyId: mapping.propertyId,
          message: `Mapping of '${mapping.propertyId}': ${aggregateIssue}; the first row is used`
        });
      }
    }
  }

  return issues;
}

/**
 * Why a mapping's `aggregate` cannot apply (AB#8024), or `undefined`. Besides
 * {@link processAggregateIssue} an `attribute` mapping cannot aggregate: it
 * reads one entity.
 */
export function mappingAggregateIssue(
  mapping: DiagramPropertyMapping,
  binding: ProcessWidgetBinding | undefined,
  propertyTypes?: ReadonlyMap<string, string>
): string | undefined {
  const issue = processAggregateIssue(mapping.aggregate, propertyTypes?.get(mapping.propertyId), binding?.mode);
  if (issue) {
    return issue;
  }
  if (mapping.aggregate && mapping.aggregate !== 'first' && mapping.sourceType === 'attribute') {
    return `Aggregate '${mapping.aggregate}' needs a column mapping; an attribute mapping reads one entity`;
  }
  return undefined;
}

/**
 * Reads persisted `bindings` (JSON/YAML seed) into typed bindings. Entries that
 * are not objects or have an unknown mode are dropped; returns `undefined` when
 * nothing usable is left, so a config without bindings stays without the key.
 */
export function parsePersistedProcessBindings(raw: unknown): ProcessWidgetBinding[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const bindings: ProcessWidgetBinding[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (e['mode'] !== 'runtimeEntity' && e['mode'] !== 'persistentQuery') {
      console.warn('[ProcessWidget] Ignoring binding with unknown mode:', e['name'], e['mode']);
      continue;
    }
    bindings.push(compactBinding({
      name: typeof e['name'] === 'string' ? e['name'] : '',
      mode: e['mode'],
      ckTypeId: e['ckTypeId'] as string | undefined,
      rtId: e['rtId'] as string | undefined,
      queryRtId: e['queryRtId'] as string | undefined,
      queryName: e['queryName'] as string | undefined,
      queryFamily: e['queryFamily'] as QueryFamily | undefined,
      ignoreTimeFilter: e['ignoreTimeFilter'] as boolean | undefined,
      entitySelectorId: e['entitySelectorId'] as string | undefined,
      filters: e['filters'] as WidgetFilterConfig[] | undefined
    }));
  }
  return bindings.length > 0 ? bindings : undefined;
}

/**
 * Serializes bindings for persistence: only set keys are written
 * (`ignoreTimeFilter` only when `true`, `filters` only when non-empty).
 */
export function toPersistedProcessBindings(bindings: readonly ProcessWidgetBinding[]): ProcessWidgetBinding[] {
  return bindings.map(compactBinding);
}

function compactBinding(binding: ProcessWidgetBinding): ProcessWidgetBinding {
  return {
    name: binding.name,
    mode: binding.mode,
    ...(binding.ckTypeId && { ckTypeId: binding.ckTypeId }),
    ...(binding.rtId && { rtId: binding.rtId }),
    ...(binding.queryRtId && { queryRtId: binding.queryRtId }),
    ...(binding.queryName && { queryName: binding.queryName }),
    ...(binding.queryFamily && { queryFamily: binding.queryFamily }),
    ...(binding.ignoreTimeFilter === true && { ignoreTimeFilter: true }),
    ...(binding.entitySelectorId && { entitySelectorId: binding.entitySelectorId }),
    ...(binding.filters && binding.filters.length > 0 && { filters: binding.filters })
  };
}
