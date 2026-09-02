import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {CONFIGURATION_SERVICE} from './configuration.service';

/**
 * Service for the tenant AI Services feature toggle (AB#4884).
 *
 * Backed by the AI service base URL (`config.aiServices`), it enables/disables
 * the AI Services feature per tenant via the tenant-scoped REST endpoints
 * `POST {aiServices}{tenantId}/v1/aiservice/{enable,disable}`. An empty
 * `aiServices` URL means the AI service is not part of this installation —
 * both methods throw before any HTTP call then.
 */
@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);

  /**
   * Gets the base URL for the AI service.
   */
  private get aiServicesUrl(): string | undefined {
    return this.configurationService.config?.aiServices;
  }

  /**
   * Enables the AI Services feature for a tenant. Provisions the `System.Ai`
   * CK model and the default AI configuration. Refused with HTTP 409 while
   * Communication is disabled for the tenant (the AI worker is deployed
   * through Communication). Errors propagate to the caller.
   */
  async enableAi(tenantId: string): Promise<void> {
    if (!this.aiServicesUrl) {
      throw new Error('AI services URL is not configured');
    }
    const uri = `${this.aiServicesUrl}${tenantId}/v1/aiservice/enable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }

  /**
   * Disables the AI Services feature for a tenant. Reversible flag flip: AI
   * configuration and session data stay in the tenant and are accessible again
   * after `enableAi`. Precondition for tenant delete/detach (AB#4255). The UI
   * must confirm before calling. Errors propagate to the caller.
   */
  async disableAi(tenantId: string): Promise<void> {
    if (!this.aiServicesUrl) {
      throw new Error('AI services URL is not configured');
    }
    const uri = `${this.aiServicesUrl}${tenantId}/v1/aiservice/disable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }
}
