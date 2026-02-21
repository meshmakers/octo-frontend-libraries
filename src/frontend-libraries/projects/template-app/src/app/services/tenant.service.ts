import { Injectable, inject } from '@angular/core';
import {GetCkModelByIdDtoGQL} from '../graphQL/getCkModelById';
import {firstValueFrom} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private getCkModelByIdDtoGQL = inject(GetCkModelByIdDtoGQL);

  public async isModelAvailable(modelId: string): Promise<boolean> {
    const result = await firstValueFrom(this.getCkModelByIdDtoGQL.fetch({variables: {model: modelId}}));

    if (result?.data?.constructionKit?.models?.items) {
      return result.data.constructionKit.models.items.length > 0;
    }

    return false;
  }
}
