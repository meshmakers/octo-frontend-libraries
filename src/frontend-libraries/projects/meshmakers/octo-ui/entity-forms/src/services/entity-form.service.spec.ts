import { TestBed } from '@angular/core/testing';
import { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { of, throwError } from 'rxjs';
import { EntityFormTypeProbeDtoGQL } from '../graphQL/entityFormTypeProbe';
import { EntityFormGetCkRecordDtoGQL } from '../graphQL/getEntityFormCkRecord';
import { EntityFormGetCkTypeDtoGQL } from '../graphQL/getEntityFormCkType';
import { EntityFormGetEntityFormsDtoGQL } from '../graphQL/getEntityForms';
import {
  LIVE_ENTITY_FORM_CK_TYPE,
  LIVE_ENTITY_FORM_SECTION_RECORD,
  LIVE_FORM_DEFAULT_ROW,
  LIVE_FORM_SFTP_ROW,
  LIVE_SFTP_CK_TYPE,
} from '../core/testing/live-fixtures';
import { EntityFormService } from './entity-form.service';
import { attr, ckType as makeCkType } from '../core/testing/factories';
import { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';

describe('EntityFormService', () => {
  let service: EntityFormService;
  let tenant: string;
  let probe: { fetch: ReturnType<typeof vi.fn> };
  let forms: { fetch: ReturnType<typeof vi.fn> };
  let ckType: { fetch: ReturnType<typeof vi.fn> };
  let ckRecord: { fetch: ReturnType<typeof vi.fn> };
  let warn: ReturnType<typeof vi.spyOn>;

  const probeOk = () => of({ data: { constructionKit: { types: { items: [{ rtCkTypeId: 'System.UI/EntityForm' }] } } } });
  const formsOk = () => of({ data: { runtime: { runtimeEntities: { totalCount: 2, items: [LIVE_FORM_DEFAULT_ROW, LIVE_FORM_SFTP_ROW] } } } });

  beforeEach(() => {
    tenant = 'meshmakers';
    probe = { fetch: vi.fn().mockImplementation(probeOk) };
    forms = { fetch: vi.fn().mockImplementation(formsOk) };
    ckType = { fetch: vi.fn().mockImplementation(({ variables }: { variables: { rtCkTypeId: string } }) => {
      const item = variables.rtCkTypeId === 'System.Communication/SftpConfiguration' ? LIVE_SFTP_CK_TYPE
        : variables.rtCkTypeId === 'System.UI/EntityForm' ? LIVE_ENTITY_FORM_CK_TYPE : null;
      return of({ data: { constructionKit: { types: { items: item ? [item] : [] } } } });
    }) };
    ckRecord = { fetch: vi.fn().mockImplementation(({ variables }: { variables: { ckRecordId: string } }) =>
      of({ data: { constructionKit: { records: { items: variables.ckRecordId === 'System.UI-2.7.0/EntityFormSection-1' ? [LIVE_ENTITY_FORM_SECTION_RECORD] : [] } } } })) };
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: EntityFormTypeProbeDtoGQL, useValue: probe },
        { provide: EntityFormGetEntityFormsDtoGQL, useValue: forms },
        { provide: EntityFormGetCkTypeDtoGQL, useValue: ckType },
        { provide: EntityFormGetCkRecordDtoGQL, useValue: ckRecord },
        { provide: TENANT_ID_PROVIDER, useValue: () => Promise.resolve(tenant) },
      ],
    });
    service = TestBed.inject(EntityFormService);
  });

  it('resolves the seeded SFTP form', async () => {
    const model = await service.resolve('System.Communication/SftpConfiguration');
    expect(model.formWellKnownName).toBe('form-sftp-configuration');
    expect(model.source).toBe('seeded');
  });

  it('falls back to the built-in form when the probe finds no EntityForm type (forms query not run)', async () => {
    probe.fetch.mockReturnValue(of({ data: { constructionKit: { types: { items: [] } } } }));
    const model = await service.resolve('System.Communication/SftpConfiguration');
    expect(model.source).toBe('builtIn');
    expect(forms.fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to the built-in form when the probe fails, and retries on the next call', async () => {
    probe.fetch.mockReturnValueOnce(throwError(() => new Error('boom')));
    expect(await service.getForms()).toEqual([]);
    expect((await service.getForms()).length).toBe(2);
    expect(probe.fetch).toHaveBeenCalledTimes(2);
  });

  it('caches per tenant and type', async () => {
    await service.resolve('System.Communication/SftpConfiguration');
    await service.resolve('System.Communication/SftpConfiguration');
    expect(ckType.fetch).toHaveBeenCalledTimes(1);
    expect(forms.fetch).toHaveBeenCalledTimes(1);
  });

  it('a tenant switch re-fetches', async () => {
    await service.resolve('System.Communication/SftpConfiguration');
    tenant = 'other';
    await service.resolve('System.Communication/SftpConfiguration');
    expect(ckType.fetch).toHaveBeenCalledTimes(2);
    expect(forms.fetch).toHaveBeenCalledTimes(2);
  });

  it('invalidate() drops the cache', async () => {
    await service.getForms();
    service.invalidate();
    await service.getForms();
    expect(forms.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects for an unknown type (the failed resolution is not cached; the null type is)', async () => {
    await expect(service.resolve('Nope/Nope')).rejects.toThrow(/not found/);
    await expect(service.resolve('Nope/Nope')).rejects.toThrow(/not found/);
    expect(ckType.fetch).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed type query so the next call retries', async () => {
    ckType.fetch.mockReturnValueOnce(throwError(() => new Error('network')));
    await expect(service.getCkType('System.Communication/SftpConfiguration')).rejects.toThrow(/^network$/);
    expect((await service.getCkType('System.Communication/SftpConfiguration'))?.rtCkTypeId).toBe('System.Communication/SftpConfiguration');
    expect(ckType.fetch).toHaveBeenCalledTimes(2);
  });

  it('loads records reachable from the type for the resolver', async () => {
    const model = await service.resolve('System.UI/EntityForm');
    expect(ckRecord.fetch).toHaveBeenCalledWith(expect.objectContaining({ variables: { ckRecordId: 'System.UI-2.7.0/EntityFormSection-1' } }));
    expect(model.readAttributeNames).toEqual(expect.arrayContaining(['sections', 'key', 'columns']));
  });

  it('resolveByFormKey matches the well-known name, form-<key> and the kebab type key', async () => {
    expect((await service.resolveByFormKey('form-sftp-configuration'))?.rtCkTypeId).toBe('System.Communication/SftpConfiguration');
    expect((await service.resolveByFormKey('sftp-configuration'))?.rtCkTypeId).toBe('System.Communication/SftpConfiguration');
    expect(await service.resolveByFormKey('nothing-here')).toBeNull();
  });

  it('attaches the target metadata of reference display attributes and drops secret ones (AB#5547)', async () => {
    const target = makeCkType('System.Communication/HelmRepositoryConfiguration', {
      attributes: [
        attr('repositoryUrl'),
        attr('channel', 'ENUM', { enumOptions: [{ key: 0, name: 'Release' }, { key: 1, name: 'Preview' }] }),
        attr('password', 'STRING', { secret: true }),
      ],
    });
    vi.spyOn(service, 'getCkType').mockResolvedValue(target);
    const field = {
      key: 'helmRepository', label: 'Helm repository', kind: 'association', editor: 'reference',
      reference: { targetCkTypeId: target.rtCkTypeId, multiple: false, displayAttributes: ['repositoryUrl', 'Channel', 'password'] },
    } as unknown as ResolvedField;
    const resolved = { sections: [{ fields: [field] }], warnings: [] as string[] } as unknown as ResolvedEntityForm;
    await (service as unknown as { attachDisplayAttributeInfo(r: ResolvedEntityForm): Promise<void> }).attachDisplayAttributeInfo(resolved);
    expect(field.reference?.displayAttributes).toEqual(['repositoryUrl', 'Channel']);
    expect(field.reference?.displayAttributeInfo?.map((a) => a.attributeName)).toEqual(['repositoryUrl', 'channel']);
    expect(resolved.warnings.length).toBe(1);
  });
});
