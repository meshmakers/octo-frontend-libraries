import {
  isCredentialLikeAttributeName,
  isSecretAttributeCandidate,
  toAttributeNameFilter,
  toCamelCaseAttributeName,
  toUniqueCamelCaseNames,
  isSecretQueryColumn,
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
      expect(isSecretAttributeCandidate({ attributeName: 'value', attributeValueType: 'STRING', metaData: [null] })).toBe(false);
    });
  });

  describe('isSecretAttributeCandidate — one rule, text types only, opt-out (AB#5542 review)', () => {
    it('never treats non-textual attributes as secrets by name', () => {
      expect(isSecretAttributeCandidate({ attributeName: 'credentials', attributeValueType: 'RECORD' })).toBe(false);
      expect(isSecretAttributeCandidate({ attributeName: 'tokens', attributeValueType: 'RECORD_ARRAY' })).toBe(false);
      expect(isSecretAttributeCandidate({ attributeName: 'apiKey', attributeValueType: 'STRING_ARRAY' })).toBe(true);
    });

    it('honours an explicit decision before metadata and the name rule', () => {
      expect(isSecretAttributeCandidate({ attributeName: 'password', attributeValueType: 'STRING', secret: false })).toBe(false);
      expect(isSecretAttributeCandidate({ attributeName: 'label', attributeValueType: 'STRING', secret: true })).toBe(true);
    });

    it('lets `secret: false` metadata opt out of the name rule', () => {
      expect(isSecretAttributeCandidate({
        attributeName: 'tokenSecret', attributeValueType: 'STRING', metaData: [{ key: 'secret', value: 'false' }],
      })).toBe(false);
    });
  });

  it('toUniqueCamelCaseNames keeps credential-like names (type-aware callers filter themselves)', () => {
    expect(toUniqueCamelCaseNames(['IsSecret', 'isSecret', 'Credentials', null])).toEqual(['isSecret', 'credentials']);
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

  it('isSecretQueryColumn judges the last path segment by the shared rule', () => {
    expect(isSecretQueryColumn('password', 'STRING')).toBe(true);
    expect(isSecretQueryColumn('endpoint.apiKey', 'STRING')).toBe(true);
    expect(isSecretQueryColumn('parent->clientSecret', 'STRING')).toBe(true);
    expect(isSecretQueryColumn('isSecret', 'BOOLEAN')).toBe(false);
    expect(isSecretQueryColumn('passwordPolicy.name', 'STRING')).toBe(false);
    expect(isSecretQueryColumn(null)).toBe(false);
  });
});
