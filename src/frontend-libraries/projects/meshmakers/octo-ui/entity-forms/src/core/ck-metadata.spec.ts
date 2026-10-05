import { isSecretMetaData, toCkAttributeInfo, toCkTypeInfo } from './ck-metadata';
import { LIVE_SFTP_CK_TYPE } from './testing/live-fixtures';

describe('ck-metadata', () => {
  it('maps live association roles with the other end per direction', () => {
    const type = toCkTypeInfo(LIVE_SFTP_CK_TYPE);
    expect(type.associations).toContainEqual({ rtRoleId: 'System/Related', navigationPropertyName: 'RelatesTo', direction: 'out', multiplicity: 'N', otherRtCkTypeId: 'System/Entity' });
    expect(type.associations).toContainEqual({ rtRoleId: 'System.Communication/Uses', navigationPropertyName: 'UsedBy', direction: 'in', multiplicity: 'N', otherRtCkTypeId: 'System.Communication/Pipeline' });
  });

  it('reads the secret marker from metaData', () => {
    expect(isSecretMetaData([{ key: 'Secret', value: 'True' }])).toBe(true);
    expect(isSecretMetaData([{ key: 'secret', value: 'false' }, null])).toBe(false);
    expect(isSecretMetaData(null)).toBe(false);
  });

  it('maps enum options, record id and defaults', () => {
    const info = toCkAttributeInfo({
      attributeName: 'channel', attributeValueType: 'ENUM', isOptional: false,
      attribute: { defaultValues: [null, 1], ckEnum: { values: [{ key: 0, name: 'Dev' }, null, { key: 1, name: 'Release' }] }, ckRecord: null, metaData: [{ key: 'secret', value: 'true' }] },
    });
    expect(info).toEqual({
      attributeName: 'channel', valueType: 'ENUM', isOptional: false, description: null, defaultValues: [1], ckRecordId: null, secret: true,
      enumOptions: [{ key: 0, name: 'Dev' }, { key: 1, name: 'Release' }],
    });
  });
});
