import { Injectable, inject } from "@angular/core";
import { Observable, map, catchError, of } from "rxjs";
import { AttributeMapperService } from "./attribute-mapper.service";
import { Attribute } from "../models/attribute";
import { CkAttributeMetadata } from "../models/attribute-metadata";
import { GetCkAttributesDetailedDtoGQL } from "../graphQL/getCkAttributesDetailed";
import { GetCkRecordDetailedDtoGQL } from "../graphQL/getCkRecordDetailed";
import { GetRuntimeEntityByIdDtoGQL } from "../graphQL/getRuntimeEntityById";
import { RtEntityValuesResponse } from "../components/attributes-group/attributes-group.component";

/**
 * Single responsibility: fetch attribute definitions (CK types/records) and runtime entity values for the repository browser.
 * Used by attributes-group (rxResource), create-editor and update-editor (firstValueFrom for mutations).
 */
@Injectable({
  providedIn: "root",
})
export class AttributeDataService {
  private mapper = inject(AttributeMapperService);
  private readonly getCkAttributesDetailedGQL = inject(GetCkAttributesDetailedDtoGQL);
  private readonly getCkRecordDetailedGQL = inject(GetCkRecordDetailedDtoGQL);
  private readonly getRtEntityAttributesGQL = inject(GetRuntimeEntityByIdDtoGQL);

  /** Observable of attribute list for a CK type or record. Sorted: required first, optional last. */
  getAttributesDefinition$(ckTypeId: string, isRecord = false): Observable<Attribute[]> {
    if (!ckTypeId) return of([]);

    const stream$ = isRecord
      ? this.fetchCkRecordAttributes(ckTypeId)
      : this.fetchCkAttributes(ckTypeId);

    return stream$.pipe(
      map((items) =>
        this.sortAttributesByOptional(
          items.map((meta) => this.mapper.mapToFormAttribute(meta, undefined)),
        ),
      ),
      catchError((err) => {
        console.error("Service error:", err);
        return of([]);
      }),
    );
  }

  /** Observable of initial attribute values for an existing entity (edit mode). */
  getRtEntityValues$(rtId: string, ckTypeId: string): Observable<RtEntityValuesResponse> {
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

  private fetchCkAttributes(ckTypeId: string): Observable<CkAttributeMetadata[]> {
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
              res.data?.constructionKit?.records?.items?.[0]?.attributes?.items ??
              []
            ).filter(
              (item): item is NonNullable<typeof item> => item != null,
            ) as CkAttributeMetadata[],
        ),
      );
  }

  /** Fetches runtime entity attribute items by rtId and ckTypeId; returns empty array when absent. */
  private fetchRtEntityAttributes(
    rtId: string,
    ckTypeId: string,
  ): Observable<RtEntityValuesResponse["initial"]> {
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
                item
              ): item is {
                attributeName?: string | null;
                value?: unknown | null;
              } =>
                !!item?.attributeName,
            )
            .map((item) => ({
              attributeName: item.attributeName ?? "",
              value: item.value ?? null,
            }));
        }),
      );
  }
}
