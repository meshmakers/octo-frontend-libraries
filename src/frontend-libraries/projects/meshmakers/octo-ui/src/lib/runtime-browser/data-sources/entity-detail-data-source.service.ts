import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetRuntimeEntityByIdDtoGQL } from '../../graphQL/getRuntimeEntityById';
import { RtEntityDto } from '../../graphQL/globalTypes';

@Injectable({
  providedIn: 'root',
})
export class EntityDetailDataSource {
  private readonly getRuntimeEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);

  /**
   * Fetches detailed entity information including attributes and associations
   */
  async fetchEntityDetails(
    rtId: string,
    ckTypeId: string,
  ): Promise<RtEntityDto | null> {
    try {
      const result = await firstValueFrom(
        this.getRuntimeEntityByIdGQL
          .fetch({
            variables: {
              rtId,
              ckTypeId,
            },
          })
          .pipe(
            map(
              (response) => response.data?.runtime?.runtimeEntities?.items?.[0],
            ),
          ),
      );

      return (result as RtEntityDto) || null;
    } catch (error) {
      console.error('Failed to fetch entity details:', error);
      throw error;
    }
  }

  /**
   * Fetches entity with expanded associations for deeper navigation
   */
  async fetchEntityWithAssociations(
    rtId: string,
    ckTypeId: string,
  ): Promise<RtEntityDto | null> {
    try {
      // For now, use the same query - can be extended later for more detailed association data
      return this.fetchEntityDetails(rtId, ckTypeId);
    } catch (error) {
      console.error('Failed to fetch entity with associations:', error);
      throw error;
    }
  }
}
