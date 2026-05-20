import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { GetRuntimeEntityByIdDtoGQL } from '../graphQL/getRuntimeEntityById';
import { RtEntityDto } from '../graphQL/globalTypes';
import { extractDataPointNames, AttributeItemLike, DEFAULT_DATA_POINT } from './data-point-picker.utils';

/**
 * Resolves the list of runtime data points available on a source entity.
 * Single source of truth shared by the runtime-browser detail pane (which
 * already has the entity loaded) and the mapping-edit dialog (which only
 * has rtId + ckTypeId and has to fetch). Picks the right path automatically:
 *
 * - {@link extractFromEntity} is sync — pass a pre-loaded entity.
 * - {@link load} is async — fetches via `getRuntimeEntityById` then extracts.
 *
 * Both paths share the same pure helper so a Loxone Control's state list
 * (`tempActual`, `co2`, …) is reported identically regardless of who's asking.
 */
@Injectable({ providedIn: 'root' })
export class DataPointResolverService {
  private readonly getRuntimeEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);

  extractFromEntity(entity: { attributes?: { items?: readonly (AttributeItemLike | null | undefined)[] | null } | null } | null | undefined): string[] {
    return extractDataPointNames(entity?.attributes?.items);
  }

  async load(rtId: string, ckTypeId: string): Promise<string[]> {
    if (!rtId || !ckTypeId) return [DEFAULT_DATA_POINT];

    try {
      const entity = await firstValueFrom(
        this.getRuntimeEntityByIdGQL
          .fetch({
            variables: { rtId, ckTypeId },
            fetchPolicy: 'network-only',
          })
          .pipe(map(r => r.data?.runtime?.runtimeEntities?.items?.[0] ?? null)),
      );
      return this.extractFromEntity(entity as RtEntityDto | null);
    } catch (error) {
      console.error(
        `DataPointResolverService.load failed for ${ckTypeId}@${rtId}:`,
        error,
      );
      return [DEFAULT_DATA_POINT];
    }
  }
}
