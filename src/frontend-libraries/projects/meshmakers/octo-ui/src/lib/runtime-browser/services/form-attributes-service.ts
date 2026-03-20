import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GetCkAttributesDetailedDtoGQL } from '../../graphQL/getCkAttributesDetailed';
import { GetCkRecordDetailedDtoGQL } from '../../graphQL/getCkRecordDetailed';
import { AttributeField } from '../models/attribute-field';
import { CkAttributeMetadata } from '../models/attribute-metadata';
import { FormAttributesServiceMapper } from './form-attributes-mapper';

@Injectable({
  providedIn: 'root',
})
export class FormAttributesService {
  private mapper = inject(FormAttributesServiceMapper);
  private readonly getCkAttributesDetailedGQL = inject(
    GetCkAttributesDetailedDtoGQL,
  );
  private readonly getCkRecordDetailedGQL = inject(GetCkRecordDetailedDtoGQL);

  /**
   * Fetches and maps Construction Kit (CK) attributes for the given type or record.
   * Returns a sorted array of form attributes with required attributes first, followed by optional ones.
   *
   * @param ckTypeId - The full name identifier of the CK type or record (e.g., "OctoSdkDemo/Customer")
   * @param _rtId - Runtime entity ID (currently unused, reserved for future use in edit mode).
   *               When provided, data will be fetched from an existing runtime entity instead of the type definition,
   *               allowing pre-population of form fields with current entity values.
   * @param isRecord - If true, fetches attributes for a CK record; if false, fetches attributes for a CK type.
   *                  Determines which GraphQL query to use (getCkRecordAttributesGQL vs getCkAttributesGQL).
   * @returns Promise resolving to an array of AttributeField objects, sorted with required attributes first
   */
  async getFormAttributes(
    ckTypeId: string,
    _rtId?: string,
    isRecord = false,
  ): Promise<AttributeField[]> {
    if (!ckTypeId) {
      return [];
    }

    const result = isRecord
      ? await this.getCkRecordAttributesGQL(ckTypeId)
      : await this.getCkAttributesGQL(ckTypeId);

    const mappedAttributes = result.map((meta) =>
      this.mapper.mapToFormAttribute(meta, undefined),
    );

    return this.sortAttributesByOptional(mappedAttributes);
  }

  /**
   * Sorts attributes by optional status: required attributes (isOptional == false) first,
   * then optional attributes (isOptional == true).
   *
   * @param attributes - Array of form attributes to sort
   * @returns Sorted array with required attributes before optional ones
   */
  private sortAttributesByOptional(
    attributes: AttributeField[],
  ): AttributeField[] {
    return attributes.sort((a, b) => {
      if (a.isOptional === b.isOptional) {
        return 0; // Same category - maintain order
      }
      // If a is optional, it goes after b (return 1)
      // If a is required, it goes before b (return -1)
      return a.isOptional ? 1 : -1;
    });
  }

  /**
   * Loads attributes for a CK type.
   */
  private async getCkAttributesGQL(
    ckTypeId: string,
  ): Promise<CkAttributeMetadata[]> {
    try {
      const raw = await firstValueFrom(
        this.getCkAttributesDetailedGQL.fetch({
          variables: { ckId: ckTypeId },
        }),
      );
      return (
        raw.data?.constructionKit?.types?.items?.[0]?.attributes?.items ?? []
      );
    } catch (error) {
      console.error('Failed to load CK attributes.', error);
      return [];
    }
  }

  /**
   * Loads attributes for a CK record.
   */
  private async getCkRecordAttributesGQL(
    ckRecordId: string,
  ): Promise<CkAttributeMetadata[]> {
    try {
      const raw = await firstValueFrom(
        this.getCkRecordDetailedGQL.fetch({ variables: { ckId: ckRecordId } }),
      );
      return (
        raw.data?.constructionKit?.records?.items?.[0]?.attributes?.items ?? []
      );
    } catch (error) {
      console.error('Failed to load CK record attributes.', error);
      return [];
    }
  }
}
