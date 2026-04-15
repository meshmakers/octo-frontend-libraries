import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { GetRuntimeEntityByIdDtoGQL } from '../../graphQL/getRuntimeEntityById';
import { RtEntityValuesResponse } from '../components/attributes-group/attributes-group.component';
import { Attribute } from '../models/attribute';
import { AttributeMapperService } from './attribute-mapper.service';
import { AttributeMetadataResolverService } from './attribute-metadata-resolver.service';

/**
 * Fetches form-ready attribute definitions and runtime entity values for the repository browser.
 * Used by attributes-group (rxResource), create-editor and update-editor (firstValueFrom for mutations).
 *
 * Raw definition lookups are delegated to AttributeMetadataResolverService; this service
 * only adds the form-ready mapping (mapToFormAttribute) and required-first sort.
 */
@Injectable({
  providedIn: 'root',
})
export class AttributeDataService {
  private mapper = inject(AttributeMapperService);
  private readonly resolver = inject(AttributeMetadataResolverService);
  private readonly getRtEntityAttributesGQL = inject(
    GetRuntimeEntityByIdDtoGQL,
  );

  /** Observable of attribute list for a CK type or record. Sorted: required first, optional last. */
  getAttributesDefinition$(
    ckTypeId: string,
    isRecord = false,
  ): Observable<Attribute[]> {
    if (!ckTypeId) return of([]);

    return this.resolver.getRawAttributes$(ckTypeId, isRecord).pipe(
      map((items) =>
        this.sortAttributesByOptional(
          items.map((meta) => this.mapper.mapToFormAttribute(meta, undefined)),
        ),
      ),
    );
  }

  /** Observable of initial attribute values for an existing entity (edit mode). */
  getRtEntityValues$(
    rtId: string,
    ckTypeId: string,
  ): Observable<RtEntityValuesResponse> {
    if (!rtId || !ckTypeId) {
      return of({ initial: [] });
    }

    return this.fetchRtEntityAttributes(rtId, ckTypeId).pipe(
      map((attributes) => ({
        initial: attributes,
      })),
    );
  }

  private sortAttributesByOptional(attributes: Attribute[]): Attribute[] {
    return [...attributes].sort((a, b) => {
      if (a.isOptional === b.isOptional) return 0;
      return a.isOptional ? 1 : -1;
    });
  }

  /** Fetches runtime entity attribute items by rtId and ckTypeId; returns empty array when absent. */
  private fetchRtEntityAttributes(
    rtId: string,
    ckTypeId: string,
  ): Observable<RtEntityValuesResponse['initial']> {
    return this.getRtEntityAttributesGQL
      .fetch({ variables: { rtId: rtId, ckTypeId: ckTypeId } })
      .pipe(
        map((res) => {
          const items =
            res.data?.runtime?.runtimeEntities?.items?.[0]?.attributes?.items ??
            [];
          return items
            .filter(
              (
                item,
              ): item is {
                attributeName?: string | null;
                value?: unknown | null;
              } => !!item?.attributeName,
            )
            .map((item) => ({
              attributeName: item.attributeName ?? '',
              value: item.value ?? null,
            }));
        }),
      );
  }
}
