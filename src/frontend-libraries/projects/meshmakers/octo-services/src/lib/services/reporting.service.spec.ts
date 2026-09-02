import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReportingService } from './reporting.service';
import { CONFIGURATION_SERVICE, IConfigurationService } from './configuration.service';
import { AddInConfiguration } from '../shared/addInConfiguration';

describe('ReportingService', () => {
    let service: ReportingService;
    let httpMock: HttpTestingController;
    let mockConfigService: MockedObject<IConfigurationService>;

    const mockConfig: AddInConfiguration = {
        communicationServices: 'https://api.example.com/communication/',
        assetServices: 'https://api.example.com/asset/',
        botServices: 'https://api.example.com/bot/',
        meshAdapterUrl: '',
        aiServices: '',
        reportingServices: 'https://api.example.com/reporting/',
        crateDbAdminUrl: '',
        issuer: '',
        grafanaUrl: '',
        systemTenantId: 'system',
        clientId: 'test-client',
        redirectUri: '',
        postLogoutRedirectUri: ''
    };

    const tenantId = 'test-tenant';

    beforeEach(() => {
        mockConfigService = {
            config: mockConfig
        };

        TestBed.configureTestingModule({
            providers: [
                ReportingService,
                provideHttpClient(withXhr()),
                provideHttpClientTesting(),
                { provide: CONFIGURATION_SERVICE, useValue: mockConfigService }
            ]
        });

        service = TestBed.inject(ReportingService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    describe('enableReporting', () => {
        it('should POST the tenant-scoped enable endpoint', async () => {
            const promise = service.enableReporting(tenantId);

            const req = httpMock.expectOne(`${mockConfig.reportingServices}${tenantId}/v1/reporting/enable`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toBeNull();
            req.flush(null);

            await promise;
        });

        it('should propagate errors', async () => {
            const promise = service.enableReporting(tenantId);

            const req = httpMock.expectOne(`${mockConfig.reportingServices}${tenantId}/v1/reporting/enable`);
            req.flush({ errorMessage: 'boom' }, { status: 500, statusText: 'Server Error' });

            await expect(promise).rejects.toThrow();
        });
    });

    describe('disableReporting', () => {
        it('should POST the tenant-scoped disable endpoint', async () => {
            const promise = service.disableReporting(tenantId);

            const req = httpMock.expectOne(`${mockConfig.reportingServices}${tenantId}/v1/reporting/disable`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toBeNull();
            req.flush(null);

            await promise;
        });

        it('should propagate errors', async () => {
            const promise = service.disableReporting(tenantId);

            const req = httpMock.expectOne(`${mockConfig.reportingServices}${tenantId}/v1/reporting/disable`);
            req.flush({ errorMessage: 'boom' }, { status: 500, statusText: 'Server Error' });

            await expect(promise).rejects.toThrow();
        });
    });

    describe('when reportingServices is not configured', () => {
        beforeEach(() => {
            Object.defineProperty(mockConfigService, 'config', {
                get: () => ({ ...mockConfig, reportingServices: '' })
            });
        });

        it('enableReporting should throw and not make an HTTP call', async () => {
            await expect(service.enableReporting(tenantId)).rejects.toThrow();
            httpMock.expectNone(() => true);
        });

        it('disableReporting should throw and not make an HTTP call', async () => {
            await expect(service.disableReporting(tenantId)).rejects.toThrow();
            httpMock.expectNone(() => true);
        });
    });
});
