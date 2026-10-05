import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { toCkTypeInfo } from '../core/ck-metadata';
import { parseEntityForm } from '../core/entity-form-parser';
import { resolveEntityForm } from '../core/entity-form-resolver';
import { ckType, form } from '../core/testing/factories';
import { LIVE_FORM_DEFAULT_ROW, LIVE_FORM_SFTP_ROW, LIVE_SFTP_CK_TYPE } from '../core/testing/live-fixtures';
import { EntityFormCreateEntitiesDtoGQL } from '../graphQL/createEntityFormEntities';
import { EntityFormDeleteEntitiesDtoGQL } from '../graphQL/deleteEntityFormEntities';
import { EntityFormGetAttributePresenceDtoGQL } from '../graphQL/getEntityAttributePresence';
import { EntityFormGetAssociationDefinitionsDtoGQL } from '../graphQL/getEntityFormAssociationDefinitions';
import { EntityFormGetAssociationTargetsDtoGQL } from '../graphQL/getEntityFormAssociationTargets';
import { EntityFormGetListDtoGQL } from '../graphQL/getEntityFormList';
import { EntityFormGetReferenceOptionsDtoGQL } from '../graphQL/getEntityFormReferenceOptions';
import { EntityFormGetValuesDtoGQL } from '../graphQL/getEntityFormValues';
import { EntityFormUpdateEntitiesDtoGQL } from '../graphQL/updateEntityFormEntities';
import { EntityFormDataService } from './entity-form-data.service';
import { EntityFormService } from './entity-form.service';

const SFTP = 'System.Communication/SftpConfiguration';
const RT_ID = '6ac41210de1ac5b9fc3e7f99';

describe('EntityFormDataService', () => {
  let service: EntityFormDataService;
  const fn = () => ({ fetch: vi.fn(), mutate: vi.fn() });
  let values: ReturnType<typeof fn>;
  let presence: ReturnType<typeof fn>;
  let targets: ReturnType<typeof fn>;
  let definitions: ReturnType<typeof fn>;
  let options: ReturnType<typeof fn>;
  let create: ReturnType<typeof fn>;
  let update: ReturnType<typeof fn>;
  let del: ReturnType<typeof fn>;
  let list: ReturnType<typeof fn>;

  const sftpModel = resolveEntityForm(toCkTypeInfo(LIVE_SFTP_CK_TYPE), [parseEntityForm(LIVE_FORM_SFTP_ROW)!]);
  const sftpDefaultModel = resolveEntityForm(toCkTypeInfo(LIVE_SFTP_CK_TYPE), [parseEntityForm(LIVE_FORM_DEFAULT_ROW)!]);

  const entity = {
    rtId: RT_ID, ckTypeId: SFTP, rtWellKnownName: 'cfg', rtDisplayName: `${SFTP}@${RT_ID}`,
    rtCreationDateTime: '2026-10-05T21:09:36.997Z', rtChangedDateTime: '2026-10-05T21:09:37.026Z',
    attributes: { items: [{ attributeName: 'host', value: 'new.example.com' }, { attributeName: 'port', value: 22 }, { attributeName: 'username', value: 'u1' }, { attributeName: 'maxConcurrentConnections', value: 3 }] },
  };

  beforeEach(() => {
    values = fn();
    presence = fn();
    targets = fn();
    definitions = fn();
    options = fn();
    create = fn();
    update = fn();
    del = fn();
    list = fn();
    list.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 2, items: [] } } } }));
    values.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 1, items: [entity] } } } }));
    presence.fetch.mockImplementation(({ variables }: { variables: { fieldFilters: { attributePath: string }[] } }) =>
      of({ data: { runtime: { runtimeEntities: { totalCount: variables.fieldFilters[0].attributePath === 'password' ? 1 : 0 } } } }));
    TestBed.configureTestingModule({
      providers: [
        { provide: EntityFormGetValuesDtoGQL, useValue: values },
        { provide: EntityFormGetListDtoGQL, useValue: list },
        { provide: EntityFormGetAttributePresenceDtoGQL, useValue: presence },
        { provide: EntityFormGetAssociationTargetsDtoGQL, useValue: targets },
        { provide: EntityFormGetAssociationDefinitionsDtoGQL, useValue: definitions },
        { provide: EntityFormGetReferenceOptionsDtoGQL, useValue: options },
        { provide: EntityFormCreateEntitiesDtoGQL, useValue: create },
        { provide: EntityFormUpdateEntitiesDtoGQL, useValue: update },
        { provide: EntityFormDeleteEntitiesDtoGQL, useValue: del },
        { provide: EntityFormService, useValue: { getCkRecord: vi.fn().mockResolvedValue(null) } },
      ],
    });
    service = TestBed.inject(EntityFormDataService);
  });

  function sentAttributeNames(): unknown[] {
    return values.fetch.mock.calls.map((c) => (c[0] as { variables: { attributeNames: unknown } }).variables.attributeNames);
  }

  it('reads with an attributeNames array that never contains a secret', async () => {
    await service.load(sftpModel, { rtId: RT_ID });
    await service.load(sftpDefaultModel, { rtId: RT_ID });
    for (const names of sentAttributeNames()) {
      expect(Array.isArray(names)).toBe(true);
      for (const secret of ['password', 'privateKey', 'privateKeyPassphrase']) {
        expect(names as string[]).not.toContain(secret);
      }
    }
    expect(sentAttributeNames()[0]).toEqual(expect.arrayContaining(['host', 'port', 'username', 'maxConcurrentConnections']));
  });

  it('defensively strips secrets even if readAttributeNames were tampered with', () => {
    const tampered = { ...sftpModel, readAttributeNames: [...sftpModel.readAttributeNames, 'password', 'PrivateKey'] };
    expect(EntityFormDataService.readAttributeNamesFor(tampered)).not.toContain('password');
    expect(EntityFormDataService.readAttributeNamesFor(tampered)).not.toContain('PrivateKey');
    expect(EntityFormDataService.readAttributeNamesFor({ ...sftpModel, readAttributeNames: [] })).toEqual([]);
  });

  it('maps values, never prefills secrets, and checks presence once per secret', async () => {
    const result = await service.load(sftpModel, { rtId: RT_ID });
    expect(result?.rtId).toBe(RT_ID);
    expect(result?.state.values).toEqual(expect.objectContaining({ rtWellKnownName: 'cfg', host: 'new.example.com', port: 22, maxConcurrentConnections: 3 }));
    expect(result?.state.values['password']).toBeUndefined();
    expect(result?.state.secretPresence).toEqual({ password: true, privateKey: false, privateKeyPassphrase: false });
    expect(presence.fetch).toHaveBeenCalledTimes(3);
    expect(presence.fetch).toHaveBeenCalledWith(expect.objectContaining({
      variables: { ckTypeId: SFTP, rtId: RT_ID, fieldFilters: [{ attributePath: 'password', operator: 'IS_NOT_NULL' }] },
      fetchPolicy: 'network-only',
    }));
  });

  it('loads by well-known name via a field filter', async () => {
    await service.load(sftpModel, { wellKnownName: 'cfg' });
    expect(values.fetch).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({
      rtId: undefined, fieldFilters: [{ attributePath: 'rtWellKnownName', operator: 'EQUALS', comparisonValue: 'cfg' }],
    }) }));
  });

  it('returns null when the entity does not exist', async () => {
    values.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { totalCount: 0, items: [] } } } }));
    expect(await service.load(sftpModel, { rtId: RT_ID })).toBeNull();
  });

  it('update sends exactly the change set (no unchanged attributes, no rtWellKnownName)', async () => {
    update.mutate.mockReturnValue(of({ data: { runtime: { runtimeEntities: { update: [{ rtId: RT_ID }] } } } }));
    await service.update(RT_ID, SFTP, { rtWellKnownName: 'ignored', attributes: [{ attributeName: 'host', value: 'x' }], associations: [], isEmpty: false });
    expect(update.mutate).toHaveBeenCalledWith({ variables: { entities: [{ rtId: RT_ID, item: { ckTypeId: SFTP, attributes: [{ attributeName: 'host', value: 'x' }] } }] }, fetchPolicy: 'no-cache' });
  });

  it('create sends rtWellKnownName and associations and returns the rtId', async () => {
    create.mutate.mockReturnValue(of({ data: { runtime: { runtimeEntities: { create: [{ rtId: 'new', ckTypeId: SFTP }] } } } }));
    const rtId = await service.create(sftpModel, SFTP, {
      rtWellKnownName: 'w', attributes: [{ attributeName: 'host', value: 'h' }],
      associations: [{ roleName: 'relatesTo', targets: [{ modOption: 'CREATE', target: { ckTypeId: SFTP, rtId: 'b' } }] }], isEmpty: false,
    });
    expect(rtId).toBe('new');
    expect(create.mutate).toHaveBeenCalledWith({ variables: { entities: [{
      ckTypeId: SFTP, rtWellKnownName: 'w', attributes: [{ attributeName: 'host', value: 'h' }],
      associations: [{ roleName: 'relatesTo', targets: [{ modOption: 'CREATE', target: { ckTypeId: SFTP, rtId: 'b' } }] }],
    }] }, fetchPolicy: 'no-cache' });
  });

  it('delete maps the strategy', async () => {
    del.mutate.mockReturnValue(of({ data: { runtime: { runtimeEntities: { delete: true } } } }));
    expect(await service.delete([{ rtId: RT_ID, ckTypeId: SFTP }], 'ERASE')).toBe(true);
    expect(del.mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { rtEntityIds: [{ rtId: RT_ID, ckTypeId: SFTP }], deleteStrategy: 'ERASE' } }));
  });

  describe('associations', () => {
    const type = ckType('T/S', { associations: [
      { rtRoleId: 'T/Owner', navigationPropertyName: 'Owner', direction: 'out', multiplicity: 'ZERO_OR_ONE', otherRtCkTypeId: 'T/P' },
      { rtRoleId: 'System/Related', navigationPropertyName: 'RelatesTo', direction: 'out', multiplicity: 'N', otherRtCkTypeId: 'System/Entity' },
    ] });
    const model = resolveEntityForm(type, [form('T/S', { fields: [
      { attributePath: 'Owner', editor: 'reference', associationRoleId: 'T/Owner' },
      { attributePath: 'Related', editor: 'reference', associationRoleId: 'System/Related' },
    ] })]);

    beforeEach(() => {
      values.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [{ rtId: 'src', ckTypeId: 'T/S', rtWellKnownName: null, rtDisplayName: 'Src', attributes: { items: [] } }] } } } }));
      targets.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [{ rtId: 'src', associations: { targets: { items: [
        { rtId: 'p1', ckTypeId: 'T/P', rtWellKnownName: 'alice', rtDisplayName: 'T/P@0123456789abcdef01234567' },
      ] } } }] } } } }));
      definitions.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [{ rtId: 'src', associations: { definitions: { items: [
        { originRtId: 'src', originCkTypeId: 'T/S', targetRtId: 'x1', targetCkTypeId: 'T/X', ckAssociationRoleId: 'System/Related' },
      ] } } }] } } } }));
      options.fetch.mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [{ rtId: 'x1', ckTypeId: 'T/X', rtWellKnownName: null, rtDisplayName: 'Xavier' }] } } } }));
    });

    it('uses targets for concrete roles and definitions (+ name lookup) for System/Entity roles', async () => {
      const result = await service.load(model, { rtId: 'src' });
      expect(targets.fetch).toHaveBeenCalledTimes(1);
      expect(targets.fetch).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({ roleId: 'T/Owner', targetCkTypeId: 'T/P', direction: 'OUTBOUND' }) }));
      expect(definitions.fetch).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({ roleId: 'System/Related', direction: 'OUTBOUND' }) }));
      expect(options.fetch).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({ ckTypeId: 'T/X', fieldFilters: [{ attributePath: 'rtId', operator: 'IN', comparisonValue: ['x1'] }] }) }));
      expect(result?.state.associations).toEqual({
        'assoc:T/Owner': [{ rtId: 'p1', ckTypeId: 'T/P', displayName: 'alice' }],
        'assoc:System/Related': [{ rtId: 'x1', ckTypeId: 'T/X', displayName: 'Xavier' }],
      });
      expect(result?.state.values['assoc:T/Owner']).toEqual(result?.state.associations['assoc:T/Owner']);
    });

    it('falls back to definitions when the targets query fails', async () => {
      targets.fetch.mockReturnValue(throwError(() => new Error('no defining collection root')));
      const result = await service.load(model, { rtId: 'src' });
      expect(definitions.fetch).toHaveBeenCalledTimes(2);
      expect(result?.state.associations['assoc:T/Owner']).toEqual([{ rtId: 'x1', ckTypeId: 'T/X', displayName: 'Xavier' }]);
    });
  });

  describe('count', () => {
    it('counts the exact type with no attributes read', async () => {
      await expect(service.count(SFTP)).resolves.toBe(2);
      expect(list.fetch).toHaveBeenCalledWith(expect.objectContaining({
        variables: expect.objectContaining({
          ckTypeId: SFTP,
          attributeNames: [],
          fieldFilters: [{ attributePath: 'ckTypeId', operator: 'EQUALS', comparisonValue: SFTP }],
        }),
      }));
    });

    it('includes derived types without a type filter', async () => {
      await service.count('System/Configuration', true);
      expect(list.fetch).toHaveBeenCalledWith(expect.objectContaining({
        variables: expect.objectContaining({ ckTypeId: 'System/Configuration', fieldFilters: null, attributeNames: [] }),
      }));
    });
  });
});
