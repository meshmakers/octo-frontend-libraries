import { firstValueFrom, from, map, Observable } from 'rxjs';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import {
  ColumnDefinition,
  DialogFetchOptions,
  DialogFetchResult,
  EntitySelectDialogDataSource
} from '@meshmakers/shared-ui';
import { FieldFilterOperatorsDto, SearchFilterDto, SearchFilterTypesDto } from '@meshmakers/octo-services';
import {
  EntityFormGetReferenceOptionsDtoGQL,
  EntityFormGetReferenceOptionsQueryDto,
  EntityFormGetReferenceOptionsQueryVariablesDto
} from '../../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetReferenceOptionsWithAttributesDtoGQL } from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';
import { formatReferenceDisplayValue, ReferenceDisplayFormat } from './reference-display-format';

/** One candidate target of a reference field. Carries system properties only, never attributes. */
export interface EntityReferenceItem {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string;
  rtDisplayName?: string;
  rtDisplayDescription?: string;
  /** Label shown in the picker and stored as `displayName` in the field value. */
  displayName: string;
}

/** System properties the typeahead and the dialog search match against. */
export const ENTITY_REFERENCE_SEARCH_PATHS: readonly string[] = ['rtWellKnownName', 'rtDisplayName'];

/** Column labels of the reference picker dialog. */
export interface EntityReferenceColumnLabels {
  name: string;
  wellKnownName: string;
  type: string;
  rtId: string;
}

const DEFAULT_COLUMN_LABELS: EntityReferenceColumnLabels = {
  name: 'Name',
  wellKnownName: 'Well-known name',
  type: 'Type',
  rtId: 'RtId'
};

type ReferenceRow = NonNullable<NonNullable<NonNullable<NonNullable<EntityFormGetReferenceOptionsQueryDto['runtime']>['runtimeEntities']>['items']>[number]>;

/** Shape of the backend's synthetic display name (`System.Communication/Pool@<24 hex>`). */
const SYNTHETIC_DISPLAY_NAME = /^[^@\s]+\/[^@\s]+@[0-9a-f]{24}$/i;

/**
 * `rtDisplayName` is resolved by the backend to a synthetic `"<ckTypeId>@<rtId>"` when the engine
 * computed none (see the octo-ui CLAUDE.md, "Runtime Browser node labels"). That form is treated as
 * absent. Precedence: a real `rtDisplayName` > the target's `name` attribute (read by the
 * reference documents with `attributeNames: ["name"]`) > `rtWellKnownName` > the synthetic form >
 * the rtId. Without the `name` step a pool showed its well-known name `CommunicationPool` instead
 * of "Default Cloud" (AB#5547).
 */
export function referenceDisplayName(row: { rtId: string; ckTypeId: string; rtWellKnownName?: string | null; rtDisplayName?: string | null; name?: string | null }): string {
  const display = row.rtDisplayName ?? '';
  const synthetic = !display || display === `${row.ckTypeId}@${row.rtId}` || display.endsWith(`@${row.rtId}`)
    || SYNTHETIC_DISPLAY_NAME.test(display);
  if (!synthetic) {
    return display;
  }
  return row.name?.trim() || row.rtWellKnownName || display || row.rtId;
}

/** The `name` attribute of a row that selected `attributes(attributeNames: ["name"])`, else null. */
export function nameAttributeOf(row: DisplayAttributeSource): string | null {
  const item = (row.attributes?.items ?? []).find((i) => i?.attributeName?.toLowerCase() === 'name');
  const value = item?.value;
  return value === null || value === undefined || String(value).trim() === '' ? null : String(value);
}

/** A row of either options document; `attributes` only with display attributes. */
export interface DisplayAttributeSource {
  attributes?: { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null } | null;
}
type AnyReferenceRow = ReferenceRow & DisplayAttributeSource;

/**
 * `name · value1 · value2` for configured display attributes (in the configured order, empty values
 * skipped); the plain display name otherwise. Values are formatted by their CK value type when
 * `format.attributes` carries the target's metadata (enum key → name, booleans yes/no, dates).
 */
export function referenceLabel(base: string, row: DisplayAttributeSource, displayAttributes: readonly string[], format: ReferenceDisplayFormat = {}): string {
  if (!displayAttributes.length) {
    return base;
  }
  const values = new Map((row.attributes?.items ?? [])
    .filter((i): i is { attributeName: string; value?: unknown } => !!i?.attributeName)
    .map(i => [i.attributeName.toLowerCase(), i.value]));
  const infos = new Map((format.attributes ?? []).map(a => [a.attributeName.toLowerCase(), a]));
  const parts = displayAttributes
    .map(name => formatReferenceDisplayValue(values.get(name.toLowerCase()), infos.get(name.toLowerCase()), format))
    .filter((v): v is string => v !== null && v.trim() !== '');
  return parts.length ? `${base} · ${parts.join(' · ')}` : base;
}

function toItem(row: AnyReferenceRow, displayAttributes: readonly string[], format: ReferenceDisplayFormat): EntityReferenceItem {
  const rtId = String(row.rtId);
  const ckTypeId = String(row.ckTypeId);
  const base = referenceDisplayName({ rtId, ckTypeId, rtWellKnownName: row.rtWellKnownName, rtDisplayName: row.rtDisplayName, name: nameAttributeOf(row) });
  return {
    rtId,
    ckTypeId,
    rtWellKnownName: row.rtWellKnownName ?? undefined,
    rtDisplayName: row.rtDisplayName ?? undefined,
    rtDisplayDescription: row.rtDisplayDescription ?? undefined,
    displayName: referenceLabel(base, row, displayAttributes, format)
  };
}

/**
 * Secret-safe data source of `mm-entity-form-reference-field`, used both for the typeahead
 * (`EntitySelectDataSource`) and for the grid dialog (`EntitySelectDialogDataSource`) of shared-ui
 * `mm-entity-select-input`.
 *
 * It queries `entityFormGetReferenceOptions`, a document that selects **no `attributes` field at
 * all**: only `rtId`, `ckTypeId`, `rtWellKnownName`, `rtDisplayName` and `rtDisplayDescription`.
 * The target type's secrets therefore never reach the browser, unlike the octo-services
 * `RuntimeEntitySelectDataSource` (its `getEntitiesByCkType` selects every attribute).
 *
 * Derived types of `targetCkTypeId` are included (`runtimeEntities(ckId)` is polymorphic), which is
 * what a reference to a base type expects. Search matches `rtWellKnownName` and `rtDisplayName`.
 */
export class EntityReferenceDataSource
implements EntitySelectDataSource<EntityReferenceItem>, EntitySelectDialogDataSource<EntityReferenceItem> {
  private readonly columnLabels: EntityReferenceColumnLabels;

  /**
   * @param displayAttributes Non-secret target attributes shown next to the name (field
   *   `referenceDisplayAttributes`). Non-empty → the options are read with
   *   `entityFormGetReferenceOptionsWithAttributes` and exactly these `attributeNames` (plus the
   *   non-secret `name`, which the plain document reads for the label as well).
   * @param format CK metadata and labels used to format the display attribute values.
   */
  constructor(
    private readonly gql: EntityFormGetReferenceOptionsDtoGQL,
    readonly targetCkTypeId: string,
    columnLabels?: Partial<EntityReferenceColumnLabels>,
    readonly displayAttributes: readonly string[] = [],
    private readonly attributesGql?: EntityFormGetReferenceOptionsWithAttributesDtoGQL,
    private readonly format: ReferenceDisplayFormat = {}
  ) {
    this.columnLabels = { ...DEFAULT_COLUMN_LABELS, ...(columnLabels ?? {}) };
  }

  /** Variables of one page; exposed for tests (it is the complete request apart from the document). */
  buildVariables(searchTerm: string | null, first: number, skip = 0): EntityFormGetReferenceOptionsQueryVariablesDto {
    const term = searchTerm?.trim();
    const searchFilter: SearchFilterDto | undefined = term
      ? { type: SearchFilterTypesDto.AttributeFilterDto, attributePaths: [...ENTITY_REFERENCE_SEARCH_PATHS], searchTerm: term }
      : undefined;
    return {
      ckTypeId: this.targetCkTypeId,
      first,
      after: skip > 0 ? btoa(`arrayconnection:${skip - 1}`) : undefined,
      searchFilter
    };
  }

  async onFilter(filter: string, take?: number): Promise<EntitySelectResult<EntityReferenceItem>> {
    const page = await firstValueFrom(this.fetchPage(filter, take ?? 20, 0));
    return { totalCount: page.totalCount, items: page.data.filter((i): i is EntityReferenceItem => i !== null) };
  }

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'displayName', displayName: this.columnLabels.name },
      { field: 'rtWellKnownName', displayName: this.columnLabels.wellKnownName },
      { field: 'ckTypeId', displayName: this.columnLabels.type },
      { field: 'rtId', displayName: this.columnLabels.rtId }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<EntityReferenceItem>> {
    return this.fetchPage(options.textSearch, options.take, options.skip);
  }

  onDisplayEntity(entity: EntityReferenceItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: EntityReferenceItem): string {
    return entity.rtId;
  }

  /**
   * The targets with the given rtIds, labelled like the picker rows (display attributes included).
   * Used for the label of the current value; ids that cannot be read are missing from the map.
   */
  async lookup(rtIds: readonly string[]): Promise<Map<string, EntityReferenceItem>> {
    const ids = [...new Set(rtIds.filter(id => !!id))];
    const found = new Map<string, EntityReferenceItem>();
    if (!ids.length) {
      return found;
    }
    const variables: EntityFormGetReferenceOptionsQueryVariablesDto = {
      ckTypeId: this.targetCkTypeId,
      first: ids.length,
      fieldFilters: [{ attributePath: 'rtId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: ids }]
    };
    const page = await firstValueFrom(this.request(variables));
    for (const item of page.data) {
      if (item) {
        found.set(item.rtId, item);
      }
    }
    return found;
  }

  private fetchPage(searchTerm: string | null, first: number, skip: number): Observable<DialogFetchResult<EntityReferenceItem>> {
    return this.request(this.buildVariables(searchTerm, first, skip));
  }

  private request(variables: EntityFormGetReferenceOptionsQueryVariablesDto): Observable<DialogFetchResult<EntityReferenceItem>> {
    const names = [...this.displayAttributes];
    // `name` keeps the label rule of the plain document (real display name > name > well-known name).
    const attributeNames = [...new Set(['name', ...names])];
    const request = names.length && this.attributesGql
      ? this.attributesGql.fetch({ variables: { ...variables, attributeNames }, fetchPolicy: 'network-only' })
      : this.gql.fetch({ variables, fetchPolicy: 'network-only' });
    return from(request).pipe(
      map(result => {
        const connection = (result.data as EntityFormGetReferenceOptionsQueryDto | undefined)?.runtime?.runtimeEntities;
        const data = (connection?.items ?? [])
          .filter((row): row is ReferenceRow => row !== null && row !== undefined)
          .map(row => toItem(row as AnyReferenceRow, names, this.format));
        return { data, totalCount: connection?.totalCount ?? data.length };
      })
    );
  }
}
