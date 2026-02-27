import { Directive, forwardRef, inject } from '@angular/core';
import { GraphDirectionDto, GraphQL } from '@meshmakers/octo-services';
import {
  DataSourceBase,
  FetchDataOptions,
  FetchResultTyped,
  ListViewComponent,
} from '@meshmakers/shared-ui';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { OctoGraphQlDataSource } from '../../data-sources/octo-graph-ql-data-source';
import { GetRuntimeEntityAssociationsByIdDtoGQL } from '../graphQL/getRuntimeEntityAssociationsById';

export interface AssociationDisplayItem {
  targetRtId: string;
  targetCkTypeId: string;
  originRtId: string;
  originCkTypeId: string;
  ckAssociationRoleId: string;
  direction: 'Inbound' | 'Outbound';
  relatedRtId: string;
  relatedCkTypeId: string;
}

@Directive({
  selector: '[mmEntityAssociationsDataSource]',
  exportAs: 'mmEntityAssociationsDataSource',
  standalone: true,
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => EntityAssociationsDataSourceDirective),
    },
  ],
})
export class EntityAssociationsDataSourceDirective extends OctoGraphQlDataSource<AssociationDisplayItem> {
  private readonly getAssociationsGQL = inject(
    GetRuntimeEntityAssociationsByIdDtoGQL,
  );

  private rtId: string | null = null;
  private ckTypeId: string | null = null;
  private direction: GraphDirectionDto = GraphDirectionDto.AnyDto;
  private roleId: string | null = null;
  private relatedRtCkId: string | null = null;
  private relatedRtId: string | null = null;

  constructor() {
    const listViewComponent = inject(ListViewComponent);
    super(listViewComponent);
  }

  public setEntityId(rtId: string, ckTypeId: string): void {
    this.rtId = rtId;
    this.ckTypeId = ckTypeId;
  }

  public setDirection(direction: GraphDirectionDto): void {
    this.direction = direction;
    this.fetchAgain();
  }

  public setRoleId(roleId: string | null): void {
    this.roleId = roleId;
    this.fetchAgain();
  }

  public setRelatedRtCkId(relatedRtCkId: string | null): void {
    this.relatedRtCkId = relatedRtCkId;
    this.fetchAgain();
  }

  public setRelatedRtId(relatedRtId: string | null): void {
    this.relatedRtId = relatedRtId;
    this.fetchAgain();
  }

  public refresh(): void {
    this.fetchAgain();
  }

  public fetchData(
    queryOptions: FetchDataOptions,
  ): Observable<FetchResultTyped<AssociationDisplayItem> | null> {
    if (!this.rtId || !this.ckTypeId) {
      return of(new FetchResultTyped<AssociationDisplayItem>([], 0));
    }

    const variables = {
      rtId: this.rtId,
      ckTypeId: this.ckTypeId,
      direction: this.direction,
      roleId: this.roleId,
      relatedRtCkId: this.relatedRtCkId,
      relatedRtId: this.relatedRtId,
      first: queryOptions.state.take,
      after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
    };

    return this.getAssociationsGQL
      .fetch({
        variables: variables,
        fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first',
      })
      .pipe(
        map((result) => {
          const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
          const items = entity?.associations?.definitions?.items ?? [];
          const totalCount = entity?.associations?.definitions?.totalCount ?? 0;

          const transformedItems = items
            .filter((item): item is NonNullable<typeof item> => item != null)
            .map((item) => {
              const isOutbound = item.originRtId === this.rtId;
              return {
                targetRtId: item.targetRtId,
                targetCkTypeId: item.targetCkTypeId,
                originRtId: item.originRtId,
                originCkTypeId: item.originCkTypeId,
                ckAssociationRoleId: item.ckAssociationRoleId,
                direction: isOutbound ? 'Outbound' : 'Inbound',
                relatedRtId: isOutbound ? item.targetRtId : item.originRtId,
                relatedCkTypeId: isOutbound
                  ? item.targetCkTypeId
                  : item.originCkTypeId,
              } as AssociationDisplayItem;
            });

          return new FetchResultTyped<AssociationDisplayItem>(
            transformedItems,
            totalCount,
          );
        }),
      );
  }
}
