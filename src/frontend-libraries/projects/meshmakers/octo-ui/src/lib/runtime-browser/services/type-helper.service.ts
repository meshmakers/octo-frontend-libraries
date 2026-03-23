import { Injectable } from '@angular/core';
import { RtEntityDto } from '@meshmakers/octo-services';

/**
 * Performs helpful Octomesh Types operations, like checks, comparisons etc.
 */
@Injectable({
  providedIn: 'root',
})
export class TypeHelperService {
  /**
   * Checks if given item is runtime entity.
   *
   * @param item Item to check.
   * @returns True for runtime entity, false otherwise.
   */
  public isRuntimeEntity(item: unknown): item is RtEntityDto {
    return !!(item
      && (item as RtEntityDto).rtId
      && (item as RtEntityDto).ckTypeId);
  }
}
