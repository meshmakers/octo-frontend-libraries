import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetCkTypeAvailableQueryColumnsDtoGQL } from '../graphQL/getCkTypeAvailableQueryColumns';

export interface AttributeItem {
  attributePath: string;
  attributeValueType: string;
}

export interface AttributeSelectorResult {
  items: AttributeItem[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AttributeSelectorService {
  private readonly getCkTypeAvailableQueryColumnsGQL = inject(GetCkTypeAvailableQueryColumnsDtoGQL);

  public getAvailableAttributes(
    ckTypeId: string,
    filter?: string,
    first = 1000,
    after?: string
  ): Observable<AttributeSelectorResult> {
    return this.getCkTypeAvailableQueryColumnsGQL.fetch({
      variables: {
        rtCkId: ckTypeId,
        filter: filter,
        first: first,
        after: after
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const type = result.data?.constructionKit?.types?.items?.[0];
        if (!type) {
          return { items: [], totalCount: 0 };
        }

        const items = (type.availableQueryColumns?.items || [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            attributePath: item.attributePath,
            attributeValueType: item.attributeValueType
          }));

        return {
          items,
          totalCount: type.availableQueryColumns?.totalCount || 0
        };
      })
    );
  }
}
