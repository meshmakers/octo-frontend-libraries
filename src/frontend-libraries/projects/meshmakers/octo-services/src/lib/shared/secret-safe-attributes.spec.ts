import {
  isCredentialLikeAttributeName,
  isSecretAttributeCandidate,
  toAttributeNameFilter,
  toCamelCaseAttributeName,
} from './secret-safe-attributes';

describe('secret-safe attributes (AB#5542)', () => {
  describe('isCredentialLikeAttributeName', () => {
    it.each([
      'password', 'Password', 'adminPassword', 'privateKey', 'privateKeyPassphrase', 'clientSecret',
      'ClientSecret', 'apiKey', 'botToken', 'accessToken', 'refreshToken', 'trustedDeviceToken',
      'registrationCaptchaSecret', 'connectionString', 'ticketSecret', 'secretKey', 'encryptedValue',
      'credentials', 'api_key',
    ])('flags %s', (name) => {
      expect(isCredentialLikeAttributeName(name)).toBe(true);
    });

    it.each([
      'name', 'user', 'userName', 'clientId', 'tenantId', 'issuerUri', 'maxTokens', 'tokensPerDay',
      'tokenEndpoint', 'receivesClusterSecrets', 'description', 'keyName',
    ])('does not flag %s', (name) => {
      expect(isCredentialLikeAttributeName(name)).toBe(false);
    });

    it('treats empty input as not credential-like', () => {
      expect(isCredentialLikeAttributeName(null)).toBe(false);
      expect(isCredentialLikeAttributeName(undefined)).toBe(false);
      expect(isCredentialLikeAttributeName('')).toBe(false);
    });
  });

  describe('isSecretAttributeCandidate', () => {
    it('flags textual credential-like attributes', () => {
      expect(isSecretAttributeCandidate({ attributeName: 'Password', attributeValueType: 'STRING' })).toBe(true);
      expect(isSecretAttributeCandidate({ attributeName: 'clientSecret' })).toBe(true);
    });

    it('never flags non-textual attributes by name', () => {
      expect(isSecretAttributeCandidate({ attributeName: 'isSecret', attributeValueType: 'BOOLEAN' })).toBe(false);
      expect(isSecretAttributeCandidate({ attributeName: 'lastToken', attributeValueType: 'INT' })).toBe(false);
    });

    it('flags attributes marked secret in the CK metadata regardless of name and type', () => {
      expect(isSecretAttributeCandidate({
        attributeName: 'value',
        attributeValueType: 'STRING',
        metaData: [{ key: 'Secret', value: ' TRUE ' }],
      })).toBe(true);
      expect(isSecretAttributeCandidate({
        attributeName: 'value',
        attributeValueType: 'STRING',
        metaData: [{ key: 'secret', value: 'false' }, null],
      })).toBe(false);
    });
  });

  describe('toAttributeNameFilter', () => {
    it('camelCases, de-duplicates and drops empty and credential-like names', () => {
      expect(toAttributeNameFilter(['Name', 'name', 'Password', null, '', undefined, 'ClientId', 'apiKey', 'States']))
        .toEqual(['name', 'clientId', 'states']);
    });

    it('always returns an array', () => {
      expect(toAttributeNameFilter([])).toEqual([]);
    });
  });

  it('toCamelCaseAttributeName lower-cases only the first character (server ToCamelCase)', () => {
    expect(toCamelCaseAttributeName('RtWellKnownName')).toBe('rtWellKnownName');
    expect(toCamelCaseAttributeName('URL')).toBe('uRL');
    expect(toCamelCaseAttributeName('')).toBe('');
  });
});
