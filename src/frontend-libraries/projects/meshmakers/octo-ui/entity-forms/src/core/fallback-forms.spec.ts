import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EntityFormTypeProbeDtoGQL } from '../graphQL/entityFormTypeProbe';
import { EntityFormGetCkRecordDtoGQL } from '../graphQL/getEntityFormCkRecord';
import { EntityFormGetCkTypeDtoGQL } from '../graphQL/getEntityFormCkType';
import { EntityFormGetEntityFormsDtoGQL } from '../graphQL/getEntityForms';
import { EntityFormDefinition } from '../models/entity-form.models';
import { EntityFormService, provideEntityFormFallbacks } from '../services/entity-form.service';
import { toCkTypeInfo, RawCkType } from './ck-metadata';
import { entityFormCatalog } from './entity-form-catalog';
import { ENTITY_FORM_FALLBACK_FORMS, isChainEndForm, selectFallbackForms, withFallbackForms } from './fallback-forms';
import { LIVE_FORM_DEFAULT_ROW, LIVE_FORM_SFTP_ROW, LIVE_SFTP_CK_TYPE } from './testing/live-fixtures';

const LIVE_SFTP_CK_TYPE_INFO = () => toCkTypeInfo(LIVE_SFTP_CK_TYPE as unknown as RawCkType);

function form(target: string, extra: Partial<EntityFormDefinition> = {}): EntityFormDefinition {
  return {
    rtId: '',
    isTenantForm: false,
    targetCkTypeId: target,
    includeDerivedTypes: false,
    priority: 0,
    sections: [],
    fields: [],
    listColumns: [],
    ...extra,
  };
}

describe('withFallbackForms', () => {
  it('appends fallbacks only for target types without a loaded form (case-insensitive)', () => {
    const loaded = [form('System.Communication/SftpConfiguration', { rtId: 'a', rtWellKnownName: 'form-sftp-configuration' })];
    const result = withFallbackForms(loaded, [
      form('system.communication/sftpconfiguration', { rtWellKnownName: 'fallback-sftp' }),
      form('System/TenantModeConfiguration', { rtWellKnownName: 'form-tenant-mode-configuration' }),
    ]);
    expect(result.map((f) => f.rtWellKnownName)).toEqual(['form-sftp-configuration', 'form-tenant-mode-configuration']);
  });

  it('keeps the first fallback per type, forces isTenantForm false and ignores empty targets', () => {
    const result = withFallbackForms([], [
      form('X/A', { rtWellKnownName: 'first', isTenantForm: true }),
      form('X/A', { rtWellKnownName: 'second' }),
      form('  ', { rtWellKnownName: 'blank' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rtWellKnownName: 'first', isTenantForm: false });
  });

  it('returns a copy of the loaded forms without fallbacks', () => {
    const loaded = [form('X/A')];
    expect(withFallbackForms(loaded, null)).toEqual(loaded);
    expect(withFallbackForms(loaded, null)).not.toBe(loaded);
  });

  it('a tenant form without Category hides the fallback entry from the catalog', () => {
    const tenantForm = form('X/A', { rtId: 't', isTenantForm: true });
    const fallback = form('X/A', { rtWellKnownName: 'form-a', category: 'connections' });
    expect(entityFormCatalog(withFallbackForms([tenantForm], [fallback]))).toEqual([]);
    expect(entityFormCatalog(withFallbackForms([], [fallback])).map((e) => e.key)).toEqual(['a']);
  });
});

describe('EntityFormService with ENTITY_FORM_FALLBACK_FORMS', () => {
  const sftpFallback = form('System.Communication/SftpConfiguration', {
    rtWellKnownName: 'form-sftp-configuration',
    name: 'Fallback SFTP',
    category: 'connections',
    singleton: true,
    singletonWellKnownName: 'Sftp',
  });
  let probe: { fetch: ReturnType<typeof vi.fn> };
  let forms: { fetch: ReturnType<typeof vi.fn> };

  function setup(): EntityFormService {
    TestBed.configureTestingModule({
      providers: [
        { provide: EntityFormTypeProbeDtoGQL, useValue: probe },
        { provide: EntityFormGetEntityFormsDtoGQL, useValue: forms },
        { provide: EntityFormGetCkTypeDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { types: { items: [LIVE_SFTP_CK_TYPE] } } } })) } },
        { provide: EntityFormGetCkRecordDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { records: { items: [] } } } })) } },
        { provide: ENTITY_FORM_FALLBACK_FORMS, useValue: [sftpFallback] },
      ],
    });
    return TestBed.inject(EntityFormService);
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    probe = { fetch: vi.fn(() => of({ data: { constructionKit: { types: { items: [{ rtCkTypeId: 'System.UI/EntityForm' }] } } } })) };
    forms = { fetch: vi.fn(() => of({ data: { runtime: { runtimeEntities: { totalCount: 1, items: [LIVE_FORM_DEFAULT_ROW] } } } })) };
  });

  it('resolves the fallback while the tenant has no form for the type (singleton included)', async () => {
    const service = setup();
    const model = await service.resolve('System.Communication/SftpConfiguration');
    expect(model.title).toBe('Fallback SFTP');
    expect(model.singleton).toEqual({ wellKnownName: 'Sftp' });
    expect((await service.resolveByFormKey('sftp-configuration'))?.title).toBe('Fallback SFTP');
  });

  it('ignores the fallback once a seeded form for the type is loaded', async () => {
    forms.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 2, items: [LIVE_FORM_DEFAULT_ROW, LIVE_FORM_SFTP_ROW] } } } }));
    const service = setup();
    const model = await service.resolve('System.Communication/SftpConfiguration');
    expect(model.title).not.toBe('Fallback SFTP');
    expect(model.singleton).toBeUndefined();
    expect((await service.getForms()).filter((f) => f.targetCkTypeId === 'System.Communication/SftpConfiguration')).toHaveLength(1);
  });

  it('still offers the fallbacks when the forms cannot be loaded', async () => {
    probe.fetch.mockReturnValue(throwError(() => new Error('down')));
    const service = setup();
    expect((await service.getForms()).map((f) => f.rtWellKnownName)).toEqual(['form-sftp-configuration']);
  });
});

describe('selectFallbackForms (ancestor rule, AB#5524)', () => {
  const sftpType = LIVE_SFTP_CK_TYPE_INFO();
  const fallback = form('System.Communication/SftpConfiguration', { rtWellKnownName: 'form-sftp-configuration', category: 'connections' });
  const formDefault = form('System/Entity', { rtId: 'd', rtWellKnownName: 'form-default', includeDerivedTypes: true });

  it('applies where the resolution would end at form-default or at nothing', () => {
    expect(selectFallbackForms([formDefault], [fallback], () => sftpType)).toEqual([fallback]);
    expect(selectFallbackForms([], [fallback], () => sftpType)).toEqual([fallback]);
    expect(isChainEndForm(formDefault)).toBe(true);
  });

  it('yields to a tenant or seeded ancestor form with IncludeDerivedTypes', () => {
    const ancestor = sftpType.ancestors.find((a) => a !== 'System/Entity')!;
    for (const isTenantForm of [true, false]) {
      const ancestorForm = form(ancestor, { rtId: 'a', isTenantForm, includeDerivedTypes: true });
      expect(selectFallbackForms([formDefault, ancestorForm], [fallback], () => sftpType)).toEqual([]);
    }
    // Without IncludeDerivedTypes the ancestor form does not apply to the subtype.
    const notDerived = form(ancestor, { rtId: 'a', includeDerivedTypes: false });
    expect(selectFallbackForms([formDefault, notDerived], [fallback], () => sftpType)).toEqual([fallback]);
  });

  it('drops fallbacks for types the tenant does not have', () => {
    expect(selectFallbackForms([formDefault], [fallback], () => null)).toEqual([]);
  });
});

describe('EntityFormService.registerFallbackForms / provideEntityFormFallbacks', () => {
  it('registers fallbacks from a lazy environment injector into the root service (one cache)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const forms = { fetch: vi.fn(() => of({ data: { runtime: { runtimeEntities: { totalCount: 1, items: [LIVE_FORM_DEFAULT_ROW] } } } })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: EntityFormTypeProbeDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { types: { items: [{ rtCkTypeId: 'System.UI/EntityForm' }] } } } })) } },
        { provide: EntityFormGetEntityFormsDtoGQL, useValue: forms },
        { provide: EntityFormGetCkTypeDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { types: { items: [LIVE_SFTP_CK_TYPE] } } } })) } },
        { provide: EntityFormGetCkRecordDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { constructionKit: { records: { items: [] } } } })) } },
      ],
    });
    const service = TestBed.inject(EntityFormService);
    expect((await service.getForms()).map((f) => f.rtWellKnownName)).toEqual(['form-default']);

    const fallbacks = [form('System.Communication/SftpConfiguration', { rtWellKnownName: 'form-sftp-configuration' })];
    const root = TestBed.inject(EnvironmentInjector);
    createEnvironmentInjector([provideEntityFormFallbacks(fallbacks)], root);
    createEnvironmentInjector([provideEntityFormFallbacks(fallbacks)], root); // second route: no-op
    expect((await service.getForms()).map((f) => f.rtWellKnownName)).toEqual(['form-default', 'form-sftp-configuration']);
    expect(forms.fetch).toHaveBeenCalledTimes(2); // one reload after the (single) registration
  });
});
