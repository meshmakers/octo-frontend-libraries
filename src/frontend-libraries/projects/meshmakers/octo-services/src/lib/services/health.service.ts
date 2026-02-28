import { Injectable, inject } from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {CONFIGURATION_SERVICE} from './configuration.service';
import {HealthCheck} from '../shared/health';
import {firstValueFrom} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);


  private async getStatusAsync(uri: string): Promise<HealthCheck | null> {

    try {
      const r = await firstValueFrom(this.httpClient.get<HealthCheck>(uri + 'health', {
        observe: 'response'
      }));

      if (r.status === 200) {
        return r.body;
      }
    }
    catch (error: unknown){
      if (error instanceof HttpErrorResponse) {
        if (error.status == 503){
          return error.error;
        }
      }
      console.error("error", error);
    }
    return null;

  }

  public async getAssetRepoServiceHealthAsync(): Promise<HealthCheck | null> {
    return this.getStatusAsync(this.configurationService.config.assetServices);
  }

  public async getIdentityServiceAsync(): Promise<HealthCheck | null> {
    return this.getStatusAsync(this.configurationService.config.issuer);
  }

  public async getBotServiceAsync(): Promise<HealthCheck | null> {
    return this.getStatusAsync(this.configurationService.config.botServices);
  }

  public async getCommunicationControllerServiceAsync(): Promise<HealthCheck | null> {
    return this.getStatusAsync(this.configurationService.config.communicationServices);
  }

  public async getMeshAdapterAsync(): Promise<HealthCheck | null> {
    return this.getStatusAsync(this.configurationService.config.meshAdapterUrl);
  }
}
