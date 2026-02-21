import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GetCkTypeAttributesDtoGQL } from '../graphQL/getCkTypeAttributes';
import { GetCkRecordAttributesDtoGQL } from '../graphQL/getCkRecordAttributes';

export interface CkTypeAttributeInfo {
  attributeName: string;
  attributeValueType: string;
}

@Injectable({
  providedIn: 'root'
})
export class CkTypeAttributeService {
  private readonly getCkTypeAttributesGQL = inject(GetCkTypeAttributesDtoGQL);
  private readonly getCkRecordAttributesGQL = inject(GetCkRecordAttributesDtoGQL);

  /**
   * Load CK type attributes for a given ckTypeId
   * @param ckTypeId The fullName of the CK type
   * @returns Observable of CkTypeAttributeInfo array
   */
  public getCkTypeAttributes(ckTypeId: string): Observable<CkTypeAttributeInfo[]> {
    return this.getCkTypeAttributesGQL.fetch({
      variables: {
        ckTypeId: ckTypeId,
        first: 1000
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const type = result.data?.constructionKit?.types?.items?.[0];
        if (!type?.attributes?.items) {
          console.warn(`CK Type '${ckTypeId}' not found or has no attributes`);
          return [];
        }
        return type.attributes.items
          .filter((attr): attr is NonNullable<typeof attr> => attr !== null)
          .map(attr => ({
            attributeName: attr.attributeName,
            attributeValueType: attr.attributeValueType
          }));
      }),
      catchError(err => {
        console.error(`Error fetching CK type attributes for '${ckTypeId}':`, err);
        return of([]);
      })
    );
  }

  /**
   * Load CK record attributes for a given ckRecordId
   * @param ckRecordId The fullName of the CK record
   * @returns Observable of CkTypeAttributeInfo array
   */
  public getCkRecordAttributes(ckRecordId: string): Observable<CkTypeAttributeInfo[]> {
    return this.getCkRecordAttributesGQL.fetch({
      variables: {
        ckRecordId: ckRecordId,
        first: 1000
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const record = result.data?.constructionKit?.records?.items?.[0];
        if (!record?.attributes?.items) {
          console.warn(`CK Record '${ckRecordId}' not found or has no attributes`);
          return [];
        }
        return record.attributes.items
          .filter((attr): attr is NonNullable<typeof attr> => attr !== null)
          .map(attr => ({
            attributeName: attr.attributeName,
            attributeValueType: attr.attributeValueType
          }));
      }),
      catchError(err => {
        console.error(`Error fetching CK record attributes for '${ckRecordId}':`, err);
        return of([]);
      })
    );
  }
}
