import {
  DEFAULT_SECRET_STATUS_LABELS,
  formatSecretStatus,
  isSecretPresent,
  isSecretStateObject,
  isSecretValueType,
  secretInputValue,
  secretStateFromAttribute,
  secretStatusOf,
  toSecretState,
} from './secret-state';

describe('secret state (AB#5542, SECRET value type)', () => {
  it('recognises the SECRET value type case-insensitively', () => {
    expect(isSecretValueType('SECRET')).toBe(true);
    expect(isSecretValueType('Secret')).toBe(true);
    expect(isSecretValueType('STRING')).toBe(false);
    expect(isSecretValueType(null)).toBe(false);
  });

  it('normalises a typed OctoSecretState', () => {
    expect(toSecretState({ isSet: true, keyMissing: false, setAt: '2026-10-06T03:00:12Z' })).toEqual({
      isSet: true, keyMissing: false, setAt: new Date('2026-10-06T03:00:12Z'),
    });
    expect(toSecretState(null)).toEqual({ isSet: false, keyMissing: false, setAt: null });
    expect(toSecretState({ isSet: true, setAt: 'not a date' }).setAt).toBeNull();
  });

  it('reads the generic attribute state and returns null for non-secret attributes', () => {
    expect(secretStateFromAttribute({ secretIsSet: null })).toBeNull();
    expect(secretStateFromAttribute({})).toBeNull();
    expect(secretStateFromAttribute(undefined)).toBeNull();
    expect(secretStateFromAttribute({ secretIsSet: false, secretKeyMissing: true })).toEqual({
      isSet: false, keyMissing: true, setAt: null,
    });
    expect(secretStateFromAttribute({ secretIsSet: true, secretSetAt: '2026-10-01T10:00:00Z' })?.setAt)
      .toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  it('derives the display status: key missing wins over set', () => {
    expect(secretStatusOf({ isSet: false, keyMissing: true })).toBe('keyMissing');
    expect(secretStatusOf({ isSet: true, keyMissing: false })).toBe('set');
    expect(secretStatusOf({ isSet: false, keyMissing: false })).toBe('notSet');
    expect(secretStatusOf(null)).toBe('notSet');
  });

  it('counts a key-missing secret as present for required checks', () => {
    expect(isSecretPresent({ isSet: false, keyMissing: true })).toBe(true);
    expect(isSecretPresent({ isSet: true, keyMissing: false })).toBe(true);
    expect(isSecretPresent({ isSet: false, keyMissing: false })).toBe(false);
  });

  it('omits an empty typed secret (= keep) and never trims', () => {
    expect(secretInputValue('')).toBeUndefined();
    expect(secretInputValue(null)).toBeUndefined();
    expect(secretInputValue(' s3cret ')).toBe(' s3cret ');
    // A placeholder-looking value is an ordinary value (decision 2026-10-06).
    expect(secretInputValue('TODO_SET_PASSWORD')).toBe('TODO_SET_PASSWORD');
  });

  it('formats the status with set-at, legacy, not set and key missing', () => {
    const fmt = (d: Date) => d.toISOString();
    expect(formatSecretStatus({ isSet: true, keyMissing: false, setAt: new Date('2026-10-06T03:00:00Z') }, fmt))
      .toBe('Set · set at 2026-10-06T03:00:00.000Z');
    expect(formatSecretStatus({ isSet: true, keyMissing: false, setAt: null }, fmt)).toBe(DEFAULT_SECRET_STATUS_LABELS.set);
    expect(formatSecretStatus({ isSet: false, keyMissing: false, setAt: null }, fmt)).toBe('Not set');
    expect(formatSecretStatus({ isSet: false, keyMissing: true, setAt: null }, fmt)).toBe('Key missing — re-enter');
  });

  it('recognises secret state objects (marker / normalised) but not plain records', () => {
    expect(isSecretStateObject({ isSet: true })).toBe(true);
    expect(isSecretStateObject({ isSet: false, keyMissing: true, setAt: null })).toBe(true);
    expect(isSecretStateObject({ isSet: true, key: 'a' })).toBe(false);
    expect(isSecretStateObject({ isSet: 'yes' })).toBe(false);
    expect(isSecretStateObject('s3cret')).toBe(false);
    expect(isSecretStateObject(null)).toBe(false);
    expect(isSecretStateObject([{ isSet: true }])).toBe(false);
  });
});
