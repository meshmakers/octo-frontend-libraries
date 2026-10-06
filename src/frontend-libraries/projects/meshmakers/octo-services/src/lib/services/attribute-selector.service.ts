import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetCkTypeAvailableQueryColumnsDtoGQL } from '../graphQL/getCkTypeAvailableQueryColumns';
import { AttributeValueTypeDto } from '../graphQL/globalTypes';
import { isSecretQueryColumn } from '../shared/secret-safe-attributes';

export interface AttributeItem {
  attributePath: string;
  attributeValueType: string;
  description?: string | null;
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
    after?: string,
    attributeValueType?: string,
    searchTerm?: string,
    includeNavigationProperties?: boolean,
    maxDepth?: number,
    attributePaths?: string[],
    includeManyNavigations?: boolean
  ): Observable<AttributeSelectorResult> {
    return this.getCkTypeAvailableQueryColumnsGQL.fetch({
      variables: {
        rtCkId: ckTypeId,
        filter: filter,
        first: first,
        after: after,
        attributeValueType: attributeValueType as AttributeValueTypeDto,
        searchTerm: searchTerm,
        includeNavigationProperties: includeNavigationProperties,
        maxDepth: maxDepth,
        attributePaths: attributePaths,
        includeManyNavigations: includeManyNavigations
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const type = result.data?.constructionKit?.types?.items?.[0];
        if (!type) {
          return { items: [], totalCount: 0 };
        }

        const all = (type.availableQueryColumns?.items || [])
          .filter((item): item is NonNullable<typeof item> => item !== null);
        // Credential columns are never offered (SECRET-safe, AB#5542): a runtime query row would
        // project their value in clear text.
        const items = all
          .filter(item => !isSecretQueryColumn(item.attributePath, item.attributeValueType))
          .map(item => ({
            attributePath: item.attributePath,
            attributeValueType: item.attributeValueType,
            description: item.description
          }));

        return {
          items,
          totalCount: Math.max(0, (type.availableQueryColumns?.totalCount || 0) - (all.length - items.length))
        };
      })
    );
  }
}
