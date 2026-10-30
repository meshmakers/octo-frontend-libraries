import type { FieldFilterDto } from '@meshmakers/octo-services';
import type { EntitySelectorConfig, MeshBoardVariable } from '../models/meshboard.models';
import type { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { isFollowerSelector } from './entity-selector-follow';
import type { MeshBoardVariableService } from '../services/meshboard-variable.service';

/**
 * Picker filter of an entity selector (AB#7724).
 *
 * `EntitySelectorConfig.filters` narrows what the selector's pickers list. The
 * rows are converted exactly like widget filters (variables substituted, AND)
 * and sent as GraphQL `fieldFilter` of the `runtimeEntities` query, so the
 * server filters — the picker never loads all entities of the type. Pure
 * helpers, shared by the toolbar (runtime) and the selector editor.
 */

/** True when the selector carries at least one filter row that applies (never for followers). */
export function hasPickerFilter(selector: EntitySelectorConfig): boolean {
  return !isFollowerSelector(selector) && (selector.filters?.length ?? 0) > 0;
}

/**
 * The GraphQL field filters of the selector's picker, with board variables
 * substituted; `undefined` when the selector has no filter or is a follower
 * (a follower has no picker and ignores a filter).
 */
export function pickerFieldFilters(
  selector: EntitySelectorConfig,
  variables: MeshBoardVariable[],
  variableService: Pick<MeshBoardVariableService, 'convertToFieldFilterDto'>
): FieldFilterDto[] | undefined {
  if (!hasPickerFilter(selector)) {
    return undefined;
  }
  return variableService.convertToFieldFilterDto(selector.filters, variables);
}

/**
 * Wraps the picker query so every fetch carries `baseFilters` in front of the
 * fetch's own field filters (the text search of the dropdown and the dialog).
 * GraphQL combines field filters with AND, so the search works on top of the
 * selector filter. Without base filters the original query is returned
 * unchanged — an unfiltered picker sends exactly the query it sent before.
 *
 * The wrapper inherits from the original service object, so it is usable
 * wherever the picker data sources (octo-services) expect the query service.
 */
export function withPickerFilters(
  gql: GetEntitiesByCkTypeDtoGQL,
  baseFilters: FieldFilterDto[] | undefined
): GetEntitiesByCkTypeDtoGQL {
  if (!baseFilters?.length) {
    return gql;
  }
  type FetchOptions = Parameters<GetEntitiesByCkTypeDtoGQL['fetch']>[0];
  const wrapped = Object.create(gql) as GetEntitiesByCkTypeDtoGQL;
  wrapped.fetch = ((options: FetchOptions) => {
    const variables = options?.variables;
    const own = variables?.fieldFilters;
    const ownList = own === undefined || own === null ? [] : Array.isArray(own) ? own : [own];
    return gql.fetch({
      ...options,
      variables: { ...variables, fieldFilters: [...baseFilters, ...ownList] }
    } as FetchOptions);
  }) as GetEntitiesByCkTypeDtoGQL['fetch'];
  return wrapped;
}

/**
 * Variable names a filter row still references after substitution — a board
 * variable without a value. Such a value is sent literally, exactly like in
 * widget filters (`MeshBoardVariableService.resolveVariables` keeps the
 * placeholder), so it usually matches nothing; the picker names the variable
 * in its empty-list text instead of showing an unexplained empty list.
 */
export function unresolvedFilterVariables(filters: FieldFilterDto[] | undefined): string[] {
  const names = new Set<string>();
  for (const filter of filters ?? []) {
    const value = typeof filter?.comparisonValue === 'string' ? filter.comparisonValue : '';
    for (const match of value.matchAll(/\$\{([^}]+)\}|\$([a-zA-Z_]\w*)/g)) {
      names.add(match[1] ?? match[2]);
    }
  }
  return [...names];
}

/**
 * Empty-list text of a filtered picker (wording agreed with the Studio PO):
 * the search alone may have found nothing, so it names the filter as a
 * possible reason without claiming it is the reason.
 */
export function filteredNoEntitiesMessage(label: string, unresolvedVariables: string[] = []): string {
  const name = label || 'entity';
  const base = `No ${name} found. ${pickerFilterSentence(name)}`;
  if (unresolvedVariables.length === 0) {
    return base;
  }
  const vars = unresolvedVariables.map(v => `$${v}`).join(', ');
  return `${base} The filter uses ${vars}, which has no value yet.`;
}

/**
 * The sentence that names the filter as a possible reason for an empty list;
 * also appended to the empty text of a dependent picker (AB#7915).
 */
export function pickerFilterSentence(label: string): string {
  return `This board only lists ${label || 'entity'} that match its filter.`;
}

/** Title of the picker's search dialog when a filter is set. */
export function filteredDialogTitle(label: string): string {
  return `Select ${label} (filtered)`;
}
