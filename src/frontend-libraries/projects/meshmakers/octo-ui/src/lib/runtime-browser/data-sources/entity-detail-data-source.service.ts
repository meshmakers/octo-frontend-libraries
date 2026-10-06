import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetRuntimeEntityByIdDtoGQL } from '../../graphQL/getRuntimeEntityById';
import { RtEntityDto } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '../services/secret-safe-attribute-names.service';

@Injectable({
  providedIn: 'root',
})
export class EntityDetailDataSource {
  private readonly getRuntimeEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly secretSafeNames = inject(SecretSafeAttributeNamesService);

  /**
   * Fetches detailed entity information including attributes and associations.
   * Attributes are restricted to the type's non-secret attributes (SECRET-safe, AB#5542):
   * credential-like attributes are never sent to the browser.
   */
  async fetchEntityDetails(
    rtId: string,
    ckTypeId: string,
  ): Promise<RtEntityDto | null> {
    try {
      const attributeNames = await this.secretSafeNames.forCkType(ckTypeId);
      const result = await firstValueFrom(
        this.getRuntimeEntityByIdGQL
          .fetch({
            variables: {
              rtId,
              ckTypeId,
              attributeNames,
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
