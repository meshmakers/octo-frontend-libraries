import { hasValue, isVisible, parseVisibleWhen } from './visible-when';
import { attr } from './testing/factories';

const attrs = [attr('privateKey'), attr('mode', 'ENUM'), attr('enabled', 'BOOLEAN'), attr('url')];

describe('parseVisibleWhen', () => {
  it('parses Path=value and Path=* with canonical (camelCase) paths', () => {
    expect(parseVisibleWhen('PrivateKey=*', attrs)).toEqual({ path: 'privateKey', value: '*' });
    expect(parseVisibleWhen('Mode=Release', attrs)).toEqual({ path: 'mode', value: 'Release' });
    expect(parseVisibleWhen('rtwellknownname=x', attrs)).toEqual({ path: 'rtWellKnownName', value: 'x' });
  });

  it('splits at the first = so values may contain =', () => {
    expect(parseVisibleWhen('Url=a=b', attrs)).toEqual({ path: 'url', value: 'a=b' });
  });

  it('returns null for empty, malformed or unresolvable expressions', () => {
    expect(parseVisibleWhen('', attrs)).toBeNull();
    expect(parseVisibleWhen('=x', attrs)).toBeNull();
    expect(parseVisibleWhen('NoEquals', attrs)).toBeNull();
    expect(parseVisibleWhen('Ghost=1', attrs)).toBeNull();
  });
});

describe('isVisible', () => {
  it('no rule is visible', () => {
    expect(isVisible(undefined, {})).toBe(true);
  });

  it('Path=* is visible with a value, hidden when empty', () => {
    const rule = { path: 'privateKey', value: '*' };
    expect(isVisible(rule, { privateKey: 'pem' })).toBe(true);
    expect(isVisible(rule, { privateKey: '  ' })).toBe(false);
    expect(isVisible(rule, { privateKey: null })).toBe(false);
  });

  it('secret presence counts as having a value', () => {
    const rule = { path: 'privateKey', value: '*' };
    expect(isVisible(rule, { privateKey: '' }, { privateKey: true })).toBe(true);
    expect(isVisible(rule, { privateKey: '' }, { privateKey: false })).toBe(false);
  });

  it('booleans compare against true/false', () => {
    expect(isVisible({ path: 'enabled', value: 'true' }, { enabled: true })).toBe(true);
    expect(isVisible({ path: 'enabled', value: 'True' }, { enabled: true })).toBe(true);
    expect(isVisible({ path: 'enabled', value: 'true' }, { enabled: false })).toBe(false);
  });

  it('enums compare by name or key', () => {
    const options = [{ key: 0, name: 'Dev' }, { key: 1, name: 'Release' }];
    expect(isVisible({ path: 'mode', value: 'Release' }, { mode: 1 }, {}, options)).toBe(true);
    expect(isVisible({ path: 'mode', value: '1' }, { mode: 1 }, {}, options)).toBe(true);
    expect(isVisible({ path: 'mode', value: 'release' }, { mode: 0 }, {}, options)).toBe(false);
  });

  it('plain values compare as strings', () => {
    expect(isVisible({ path: 'url', value: 'a=b' }, { url: 'a=b' })).toBe(true);
    expect(isVisible({ path: 'url', value: '5' }, { url: 5 })).toBe(true);
    expect(isVisible({ path: 'url', value: 'x' }, {})).toBe(false);
  });

  it('hasValue treats empty arrays as empty', () => {
    expect(hasValue([])).toBe(false);
    expect(hasValue([1])).toBe(true);
    expect(hasValue(0)).toBe(true);
    expect(hasValue(false)).toBe(true);
  });
});
