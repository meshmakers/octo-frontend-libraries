import { Directive, forwardRef, inject } from '@angular/core';
import { FieldFilterDto, FieldFilterOperatorsDto, GraphQL } from '@meshmakers/octo-services';
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';
import {
  DataSourceBase,
  FetchDataOptions,
  FetchResultTyped,
  ListViewComponent,
} from '@meshmakers/shared-ui';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { EntityFormGetListDtoGQL, EntityFormGetListQueryDto } from '../graphQL/getEntityFormList';
import { ResolvedEntityForm } from '../models/entity-form.models';

/**
 * One row of `<mm-entity-list>`. System properties keep their GraphQL names and every list
 * attribute is flattened onto the row under its camelCase CK attribute name, so a Kendo column
 * `field` equals the GraphQL `attributePath` and server-side sort / filter work unchanged.
 */
export interface EntityListRow {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName: string | null;
  rtDisplayName: string | null;
  rtCreationDateTime: string | null;
  rtChangedDateTime: string | null;
  [attributeName: string]: unknown;
}

type ListItem = NonNullable<
  NonNullable<NonNullable<NonNullable<EntityFormGetListQueryDto['runtime']>['runtimeEntities']>['items']>[number]
>;

/**
 * Attribute names the list may read for a resolved form: the `attribute` list columns, minus
 * anything flagged secret. The resolver already drops secret columns; the second filter is a
 * defensive guard so a resolver regression can never put a secret into the list query.
 */
export function entityListAttributeNames(model: ResolvedEntityForm): string[] {
  const secrets = new Set(model.secretFields.map((s) => s.toLowerCase()));
  const names = model.listColumns
    .filter((c) => c.kind === 'attribute')
    .map((c) => c.field)
    .filter((f) => !secrets.has(f.toLowerCase()));
  return Array.from(new Set(names));
}

/** Whether the list shows derived types too (`includeDerivedTypes` or an abstract target type). */
export function entityListIncludesDerivedTypes(model: ResolvedEntityForm): boolean {
  return model.includeDerivedTypes || model.isAbstract;
}

/** Flattens a GraphQL list item into an {@link EntityListRow}. */
export function toEntityListRow(item: ListItem, fallbackCkTypeId: string): EntityListRow {
  const row: EntityListRow = {
    rtId: String(item.rtId ?? ''),
    ckTypeId: String(item.ckTypeId ?? fallbackCkTypeId),
    rtWellKnownName: item.rtWellKnownName ?? null,
    rtDisplayName: item.rtDisplayName ?? null,
    rtCreationDateTime: (item.rtCreationDateTime as string | null | undefined) ?? null,
    rtChangedDateTime: (item.rtChangedDateTime as string | null | undefined) ?? null,
  };
  for (const attr of item.attributes?.items ?? []) {
    if (attr?.attributeName && !isSystemKey(attr.attributeName)) {
      row[attr.attributeName] = attr.value;
    }
  }
  return row;
}

const SYSTEM_KEYS = new Set(['rtId', 'ckTypeId', 'rtWellKnownName', 'rtDisplayName', 'rtCreationDateTime', 'rtChangedDateTime']);
function isSystemKey(key: string): boolean {
  return SYSTEM_KEYS.has(key);
}

/**
 * Secret-safe `mm-list-view` data source of `<mm-entity-list>`.
 *
 * - Uses the package's own `entityFormGetList` document, whose `$attributeNames` is
 *   `[String]!` — it always sends the explicit list of non-secret list-column attributes
 *   (an omitted variable would make the server return every attribute, secrets included).
 * - Restricts the query to the exact type with a `ckTypeId EQUALS` field filter unless the
 *   form includes derived types or the type is abstract (`runtimeEntities(ckId)` returns
 *   derived types by default).
 */
@Directive({
  selector: '[mmEntityListDataSource]',
  exportAs: 'mmEntityListDataSource',
  standalone: true,
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => EntityListDataSourceDirective),
    },
  ],
})
export class EntityListDataSourceDirective extends OctoGraphQlDataSource<EntityListRow> {
  private readonly listGQL = inject(EntityFormGetListDtoGQL);
  private model: ResolvedEntityForm | null = null;

  constructor() {
    super(inject(ListViewComponent));
  }

  /** Sets the resolved form and refetches from the first page. */
  public setModel(model: ResolvedEntityForm | null): void {
    this.model = model;
    this.searchFilterAttributePaths = model
      ? model.listColumns.filter((c) => c.display !== 'date').map((c) => c.field)
      : [];
    this.fetchAgain({ resetSkip: true });
  }

  /** The variables of the next list query (exposed for tests). */
  public buildVariables(options: FetchDataOptions): Record<string, unknown> | null {
    const model = this.model;
    if (!model) {
      return null;
    }
    const fieldFilters: FieldFilterDto[] = [...(this.getFieldFilterDefinitions(options.state) ?? [])];
    if (!entityListIncludesDerivedTypes(model)) {
      fieldFilters.push({
        attributePath: 'ckTypeId',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: model.rtCkTypeId,
      });
    }
    return {
      ckTypeId: model.rtCkTypeId,
      first: options.state.take,
      after: GraphQL.offsetToCursor(options.state.skip ?? 0),
      sort: this.getSortDefinitions(options.state),
      fieldFilters: fieldFilters.length > 0 ? fieldFilters : null,
      searchFilter: this.getSearchFilterDefinitions(options.textSearch),
      attributeNames: entityListAttributeNames(model),
    };
  }

  public fetchData(options: FetchDataOptions): Observable<FetchResultTyped<EntityListRow> | null> {
    const model = this.model;
    const variables = this.buildVariables(options);
    if (!model || !variables) {
      return of(new FetchResultTyped<EntityListRow>([], 0));
    }
    return this.listGQL
      .fetch({
        variables: variables as never,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          const connection = result.data?.runtime?.runtimeEntities;
          const rows = (connection?.items ?? [])
            .filter((i): i is ListItem => i != null)
            .map((i) => toEntityListRow(i, model.rtCkTypeId));
          return new FetchResultTyped<EntityListRow>(rows, connection?.totalCount ?? 0);
        }),
      );
  }
}
