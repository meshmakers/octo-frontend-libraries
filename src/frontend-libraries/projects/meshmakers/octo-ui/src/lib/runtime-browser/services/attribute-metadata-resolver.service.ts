import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { GetCkAttributesDetailedDtoGQL } from '../../graphQL/getCkAttributesDetailed';
import { GetCkRecordDetailedDtoGQL } from '../../graphQL/getCkRecordDetailed';
import { CkAttributeMetadata } from '../models/attribute-metadata';

/**
 * Resolves raw CK attribute definitions for a CK type or CK record by id.
 *
 * Extracted from AttributeDataService to break a potential circular dependency:
 * AttributeMapperService needs to look up nested record attribute definitions when mapping
 * RECORD / RECORD_ARRAY values to GraphQL, while AttributeDataService already depends on
 * AttributeMapperService for mapping raw definitions into form-ready Attribute shapes.
 *
 * This resolver is intentionally minimal: it fetches and returns raw CkAttributeMetadata[]
 * with no mapping. Callers that need form-ready Attribute objects should map them via
 * AttributeMapperService.mapToFormAttribute.
 *
 * Apollo's default cache-first fetchPolicy deduplicates repeated lookups for the same ckId,
 * so callers do not need to memoize externally.
 */
@Injectable({
  providedIn: 'root',
})
export class AttributeMetadataResolverService {
  private readonly getCkAttributesDetailedGQL = inject(
    GetCkAttributesDetailedDtoGQL,
  );
  private readonly getCkRecordDetailedGQL = inject(GetCkRecordDetailedDtoGQL);

  /**
   * Fetches raw attribute metadata for a CK type or CK record.
   * Returns an empty array when the id is missing or the request fails.
   */
  getRawAttributes$(
    ckId: string,
    isRecord = false,
  ): Observable<CkAttributeMetadata[]> {
    if (!ckId) return of([]);

    const stream$ = isRecord
      ? this.fetchCkRecordAttributes(ckId)
      : this.fetchCkAttributes(ckId);

    return stream$.pipe(
      catchError((err) => {
        console.error('AttributeMetadataResolverService error:', err);
        return of([]);
      }),
    );
  }

  private fetchCkAttributes(
    ckTypeId: string,
  ): Observable<CkAttributeMetadata[]> {
    return this.getCkAttributesDetailedGQL
      .fetch({ variables: { ckId: ckTypeId } })
      .pipe(
        map(
          (res) =>
            (
              res.data?.constructionKit?.types?.items?.[0]?.attributes?.items ??
              []
            ).filter(
              (item): item is NonNullable<typeof item> => item != null,
            ) as CkAttributeMetadata[],
        ),
      );
  }

  private fetchCkRecordAttributes(
    ckRecordId: string,
  ): Observable<CkAttributeMetadata[]> {
    return this.getCkRecordDetailedGQL
      .fetch({ variables: { ckId: ckRecordId } })
      .pipe(
        map(
          (res) =>
            (
              res.data?.constructionKit?.records?.items?.[0]?.attributes
                ?.items ?? []
            ).filter(
              (item): item is NonNullable<typeof item> => item != null,
            ) as CkAttributeMetadata[],
        ),
      );
  }
}
