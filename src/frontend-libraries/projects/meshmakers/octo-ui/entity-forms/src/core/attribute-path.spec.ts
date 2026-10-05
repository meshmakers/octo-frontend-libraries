import { canonicalisePath, isForcedReadOnly, toKebabTypeKey } from './attribute-path';
import { attr } from './testing/factories';

describe('canonicalisePath', () => {
  const attrs = [attr('host'), attr('rtBlueprintSource')];

  it('matches attributes case-insensitively and returns the CK name', () => {
    expect(canonicalisePath('Host', attrs)).toEqual(expect.objectContaining({ kind: 'attribute', name: 'host' }));
    expect(canonicalisePath('RtBlueprintSource', attrs)).toEqual(expect.objectContaining({ kind: 'attribute', name: 'rtBlueprintSource' }));
  });

  it('recognises system properties, rtId, dotted and unknown paths', () => {
    expect(canonicalisePath('RtWellKnownName', attrs)).toEqual({ kind: 'system', name: 'rtWellKnownName' });
    expect(canonicalisePath('rtChangedDateTime', attrs)).toEqual({ kind: 'system', name: 'rtChangedDateTime' });
    expect(canonicalisePath('RtId', attrs)).toEqual({ kind: 'rtId' });
    expect(canonicalisePath('Address.City', attrs)).toEqual({ kind: 'dotted', path: 'Address.City' });
    expect(canonicalisePath('Nope', attrs)).toEqual({ kind: 'unknown', path: 'Nope' });
    expect(canonicalisePath(null, attrs)).toEqual({ kind: 'unknown', path: '' });
  });
});

describe('helpers', () => {
  it('isForcedReadOnly', () => {
    expect(isForcedReadOnly('rtBlueprintLocked')).toBe(true);
    expect(isForcedReadOnly('rtCreationDateTime')).toBe(true);
    expect(isForcedReadOnly('host')).toBe(false);
  });

  it('toKebabTypeKey', () => {
    expect(toKebabTypeKey('System.Communication/SftpConfiguration')).toBe('sftp-configuration');
    expect(toKebabTypeKey('System.Communication/EMailSenderConfiguration')).toBe('e-mail-sender-configuration');
    expect(toKebabTypeKey('HTTPClient')).toBe('http-client');
  });
});
