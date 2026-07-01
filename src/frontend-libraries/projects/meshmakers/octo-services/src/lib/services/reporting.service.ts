import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {CONFIGURATION_SERVICE} from './configuration.service';

/**
 * Service for the tenant Reporting feature toggle.
 *
 * Backed by the reporting service base URL (`config.reportingServices`), it
 * enables/disables the `System.Reporting` feature per tenant via the
 * tenant-scoped REST endpoints
 * `POST {reportingServices}{tenantId}/v1/reporting/{enable,disable}`.
 */
@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private readonly httpClient = inject(HttpClient);
  private readonly configurationService = inject(CONFIGURATION_SERVICE);

  /**
   * Gets the base URL for reporting services.
   */
  private get reportingServicesUrl(): string | undefined {
    return this.configurationService.config?.reportingServices;
  }

  /**
   * Enables the Reporting feature for a tenant. Installs the
   * `System.Reporting` CK model and provisions the required storage. Errors
   * propagate to the caller.
   */
  async enableReporting(tenantId: string): Promise<void> {
    if (!this.reportingServicesUrl) {
      throw new Error('Reporting services URL is not configured');
    }
    const uri = `${this.reportingServicesUrl}${tenantId}/v1/reporting/enable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }

  /**
   * Disables the Reporting feature for a tenant. Drops the backing storage and
   * removes the `System.Reporting` model. Destructive — the UI must confirm
   * before calling. Errors propagate to the caller.
   */
  async disableReporting(tenantId: string): Promise<void> {
    if (!this.reportingServicesUrl) {
      throw new Error('Reporting services URL is not configured');
    }
    const uri = `${this.reportingServicesUrl}${tenantId}/v1/reporting/disable`;
    await firstValueFrom(
      this.httpClient.post<void>(uri, null, {observe: 'response'})
    );
  }
}
