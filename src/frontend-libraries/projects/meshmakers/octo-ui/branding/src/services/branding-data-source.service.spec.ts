import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Apollo } from 'apollo-angular';

import { BrandingDataSource } from './branding-data-source.service';
import { GetBrandingDtoGQL } from '../graphQL/getBranding';
import { CreateBrandingDtoGQL } from '../graphQL/createBranding';
import { UpdateBrandingDtoGQL } from '../graphQL/updateBranding';
import {
  OCTO_BRANDING_DEFAULTS,
  NEUTRAL_BRANDING_DEFAULTS,
} from '../branding.tokens';

describe('BrandingDataSource', () => {
  let service: BrandingDataSource;
  let getStub: jasmine.SpyObj<GetBrandingDtoGQL>;
  let createStub: jasmine.SpyObj<CreateBrandingDtoGQL>;
  let updateStub: jasmine.SpyObj<UpdateBrandingDtoGQL>;

  function setupTestBed(getReturnValue: unknown): void {
    getStub = jasmine.createSpyObj('GetBrandingDtoGQL', ['fetch']);
    createStub = jasmine.createSpyObj('CreateBrandingDtoGQL', ['mutate']);
    updateStub = jasmine.createSpyObj('UpdateBrandingDtoGQL', ['mutate']);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getStub.fetch.and.returnValue(of(getReturnValue as any));

    TestBed.configureTestingModule({
      providers: [
        BrandingDataSource,
        { provide: GetBrandingDtoGQL, useValue: getStub },
        { provide: CreateBrandingDtoGQL, useValue: createStub },
        { provide: UpdateBrandingDtoGQL, useValue: updateStub },
        { provide: OCTO_BRANDING_DEFAULTS, useValue: NEUTRAL_BRANDING_DEFAULTS },
        { provide: Apollo, useValue: {} },
      ],
    });

    service = TestBed.inject(BrandingDataSource);
  }

  describe('initial state', () => {
    beforeEach(() => {
      setupTestBed({
        data: { runtime: { systemUIBranding: { items: [] } } },
      });
    });

    it('should initialize branding signal with OCTO_BRANDING_DEFAULTS token value', () => {
      const branding = service.branding();
      expect(branding.appName).toBe(NEUTRAL_BRANDING_DEFAULTS.appName);
      expect(branding.appTitle).toBe(NEUTRAL_BRANDING_DEFAULTS.appTitle);
      expect(branding.rtId).toBeNull();
      expect(branding.lightTheme.primaryColor).toBe(
        NEUTRAL_BRANDING_DEFAULTS.lightTheme.primaryColor,
      );
    });
  });

  describe('load()', () => {
    it('should fall back to defaults when GraphQL returns an empty items array', async () => {
      setupTestBed({
        data: { runtime: { systemUIBranding: { items: [] } } },
      });

      await service.load();

      const branding = service.branding();
      expect(branding.appName).toBe(NEUTRAL_BRANDING_DEFAULTS.appName);
      expect(branding.rtId).toBeNull();
    });

    it('should fall back to defaults when items is null', async () => {
      setupTestBed({
        data: { runtime: { systemUIBranding: { items: null } } },
      });

      await service.load();

      const branding = service.branding();
      expect(branding.appName).toBe(NEUTRAL_BRANDING_DEFAULTS.appName);
      expect(branding.rtId).toBeNull();
    });

    it('should mirror a server record into the signal', async () => {
      const mockItem = {
        rtId: 'test-rt-id-123',
        rtWellKnownName: 'Branding',
        appName: 'MyTenantApp',
        appTitle: 'My Tenant App Title',
        headerLogo: null,
        footerLogo: null,
        favicon: null,
        lightTheme: {
          primaryColor: '#ff0000',
          secondaryColor: '#00ff00',
          tertiaryColor: '#0000ff',
          neutralColor: '#888888',
          backgroundColor: '#ffffff',
          headerGradient: { startColor: '#ffffff', endColor: '#f0f0f0' },
          footerGradient: { startColor: '#ff0000', endColor: '#00ff00' },
        },
        darkTheme: null,
      };

      setupTestBed({
        data: { runtime: { systemUIBranding: { items: [mockItem] } } },
      });

      await service.load();

      const branding = service.branding();
      expect(branding.rtId).toBe('test-rt-id-123');
      expect(branding.appName).toBe('MyTenantApp');
      expect(branding.appTitle).toBe('My Tenant App Title');
      expect(branding.headerLogoUrl).toBeNull();
      expect(branding.lightTheme.primaryColor).toBe('#ff0000');
      expect(branding.darkTheme).toBeNull();
    });
  });
});
