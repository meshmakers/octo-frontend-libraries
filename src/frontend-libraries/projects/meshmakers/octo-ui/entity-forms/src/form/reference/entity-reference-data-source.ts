import { firstValueFrom, from, map, Observable } from 'rxjs';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import {
  ColumnDefinition,
  DialogFetchOptions,
  DialogFetchResult,
  EntitySelectDialogDataSource
} from '@meshmakers/shared-ui';
import { SearchFilterDto, SearchFilterTypesDto } from '@meshmakers/octo-services';
import {
  EntityFormGetReferenceOptionsDtoGQL,
  EntityFormGetReferenceOptionsQueryDto,
  EntityFormGetReferenceOptionsQueryVariablesDto
} from '../../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetReferenceOptionsWithAttributesDtoGQL } from '../../graphQL/getEntityFormReferenceOptionsWithAttributes';

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

/**
 * `rtDisplayName` is resolved by the backend to a synthetic `"<ckTypeId>@<rtId>"` when the engine
 * computed none (see the octo-ui CLAUDE.md, "Runtime Browser node labels"). That form is treated as
 * absent: `rtWellKnownName` wins over it, the synthetic form is the last resort.
 */
export function referenceDisplayName(row: { rtId: string; ckTypeId: string; rtWellKnownName?: string | null; rtDisplayName?: string | null }): string {
  const display = row.rtDisplayName ?? '';
  const synthetic = !display || display === `${row.ckTypeId}@${row.rtId}` || display.endsWith(`@${row.rtId}`);
  if (!synthetic) {
    return display;
  }
  return row.rtWellKnownName || display || row.rtId;
}

/** A row of either options document; `attributes` only with display attributes. */
interface DisplayAttributeSource {
  attributes?: { items?: ({ attributeName?: string | null; value?: unknown } | null)[] | null } | null;
}
type AnyReferenceRow = ReferenceRow & DisplayAttributeSource;

/**
 * `name · value1 · value2` for configured display attributes (in the configured order, empty values
 * skipped); the plain display name otherwise.
 */
export function referenceLabel(base: string, row: DisplayAttributeSource, displayAttributes: readonly string[]): string {
  if (!displayAttributes.length) {
    return base;
  }
  const values = new Map((row.attributes?.items ?? [])
    .filter((i): i is { attributeName: string; value?: unknown } => !!i?.attributeName)
    .map(i => [i.attributeName.toLowerCase(), i.value]));
  const parts = displayAttributes
    .map(name => values.get(name.toLowerCase()))
    .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
    .map(v => String(v));
  return parts.length ? `${base} · ${parts.join(' · ')}` : base;
}

function toItem(row: AnyReferenceRow, displayAttributes: readonly string[]): EntityReferenceItem {
  const rtId = String(row.rtId);
  const ckTypeId = String(row.ckTypeId);
  const base = referenceDisplayName({ rtId, ckTypeId, rtWellKnownName: row.rtWellKnownName, rtDisplayName: row.rtDisplayName });
  return {
    rtId,
    ckTypeId,
    rtWellKnownName: row.rtWellKnownName ?? undefined,
    rtDisplayName: row.rtDisplayName ?? undefined,
    rtDisplayDescription: row.rtDisplayDescription ?? undefined,
    displayName: referenceLabel(base, row, displayAttributes)
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
   *   `entityFormGetReferenceOptionsWithAttributes` and exactly these `attributeNames`.
   */
  constructor(
    private readonly gql: EntityFormGetReferenceOptionsDtoGQL,
    readonly targetCkTypeId: string,
    columnLabels?: Partial<EntityReferenceColumnLabels>,
    readonly displayAttributes: readonly string[] = [],
    private readonly attributesGql?: EntityFormGetReferenceOptionsWithAttributesDtoGQL
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

  private fetchPage(searchTerm: string | null, first: number, skip: number): Observable<DialogFetchResult<EntityReferenceItem>> {
    const variables = this.buildVariables(searchTerm, first, skip);
    const names = [...this.displayAttributes];
    const request = names.length && this.attributesGql
      ? this.attributesGql.fetch({ variables: { ...variables, attributeNames: names }, fetchPolicy: 'network-only' })
      : this.gql.fetch({ variables, fetchPolicy: 'network-only' });
    return from(request).pipe(
      map(result => {
        const connection = (result.data as EntityFormGetReferenceOptionsQueryDto | undefined)?.runtime?.runtimeEntities;
        const data = (connection?.items ?? [])
          .filter((row): row is ReferenceRow => row !== null && row !== undefined)
          .map(row => toItem(row as AnyReferenceRow, names));
        return { data, totalCount: connection?.totalCount ?? data.length };
      })
    );
  }
}
