import { DEFAULT_DATA_POINT, extractDataPointNames, extractDataPoints } from './data-point-picker.utils';

describe('extractDataPointNames', () => {
  it('returns the default for null/undefined input', () => {
    expect(extractDataPointNames(null)).toEqual([DEFAULT_DATA_POINT]);
    expect(extractDataPointNames(undefined)).toEqual([DEFAULT_DATA_POINT]);
  });

  it('returns the default when no States/DataPoints attribute is present', () => {
    expect(
      extractDataPointNames([
        { attributeName: 'Name', value: 'Wohnzimmer' },
        { attributeName: 'ControlType', value: 'IRoomControllerV2' },
      ]),
    ).toEqual([DEFAULT_DATA_POINT]);
  });

  it('matches the States attribute case-insensitively', () => {
    const records = [{ Name: 'tempActual' }, { Name: 'co2' }];
    expect(
      extractDataPointNames([{ attributeName: 'states', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'co2', 'tempActual']);
    expect(
      extractDataPointNames([{ attributeName: 'STATES', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'co2', 'tempActual']);
  });

  it('also matches a DataPoints attribute name', () => {
    expect(
      extractDataPointNames([
        { attributeName: 'DataPoints', value: [{ Name: 'topicA' }] },
      ]),
    ).toEqual([DEFAULT_DATA_POINT, 'topicA']);
  });

  it('parses records in GraphQL attributes-array shape', () => {
    const records = [
      {
        attributes: [
          { attributeName: 'name', value: 'tempActual' },
          { attributeName: 'ExternalId', value: 'uuid-1' },
        ],
      },
      {
        attributes: [
          { attributeName: 'Name', value: 'humidityActual' },
        ],
      },
    ];
    expect(
      extractDataPointNames([{ attributeName: 'States', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'humidityActual', 'tempActual']);
  });

  it('parses records in MongoDB attributes-object shape', () => {
    const records = [
      { attributes: { Name: 'tempActual', ExternalId: 'uuid-1' } },
      { attributes: { stateName: 'co2' } },
    ];
    expect(
      extractDataPointNames([{ attributeName: 'States', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'co2', 'tempActual']);
  });

  it('parses records in flat shape', () => {
    const records = [{ Name: 'tempActual' }, { name: 'co2' }];
    expect(
      extractDataPointNames([{ attributeName: 'States', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'co2', 'tempActual']);
  });

  it('coerces JSON-stringified arrays', () => {
    const json = JSON.stringify([{ Name: 'tempActual' }, { Name: 'humidityActual' }]);
    expect(
      extractDataPointNames([{ attributeName: 'States', value: json }]),
    ).toEqual([DEFAULT_DATA_POINT, 'humidityActual', 'tempActual']);
  });

  it('falls back to default on malformed JSON', () => {
    expect(
      extractDataPointNames([{ attributeName: 'States', value: '{not json' }]),
    ).toEqual([DEFAULT_DATA_POINT]);
  });

  it('falls back to default on non-array, non-string values', () => {
    expect(
      extractDataPointNames([{ attributeName: 'States', value: 42 }]),
    ).toEqual([DEFAULT_DATA_POINT]);
    expect(
      extractDataPointNames([{ attributeName: 'States', value: {} }]),
    ).toEqual([DEFAULT_DATA_POINT]);
  });

  it('skips records without a usable name', () => {
    const records = [
      { Name: 'tempActual' },
      { somethingElse: 'no-name-here' },
      null,
      'a-string-not-an-object',
      { attributes: [{ attributeName: 'description', value: 'just a description' }] },
    ];
    expect(
      extractDataPointNames([{ attributeName: 'States', value: records }]),
    ).toEqual([DEFAULT_DATA_POINT, 'tempActual']);
  });

  it('sorts names alphabetically (locale-aware) and always prepends the default', () => {
    const records = [{ Name: 'Zeta' }, { Name: 'alpha' }, { Name: 'beta' }];
    const result = extractDataPointNames([{ attributeName: 'States', value: records }]);
    expect(result[0]).toBe(DEFAULT_DATA_POINT);
    // Lowercase 'alpha' comes before 'Zeta' in locale-aware order; assert the full
    // result so we lock the sort behaviour.
    expect(result.slice(1)).toEqual(['alpha', 'beta', 'Zeta']);
  });

  it('handles null/undefined entries in the attributes array', () => {
    expect(
      extractDataPointNames([
        null,
        undefined,
        { attributeName: 'States', value: [{ Name: 'tempActual' }] },
      ]),
    ).toEqual([DEFAULT_DATA_POINT, 'tempActual']);
  });

  it('returns just the default when the States RecordArray is empty', () => {
    expect(
      extractDataPointNames([{ attributeName: 'States', value: [] }]),
    ).toEqual([DEFAULT_DATA_POINT]);
  });
});

describe('extractDataPoints', () => {
  it('carries the entity-level CurrentValue on the default data point', () => {
    const infos = extractDataPoints([
      { attributeName: 'currentValue', value: '21.5' },
    ]);
    expect(infos).toEqual([{ name: DEFAULT_DATA_POINT, currentValue: '21.5' }]);
  });

  it('leaves currentValue undefined when the entity has none', () => {
    const infos = extractDataPoints([{ attributeName: 'Name', value: 'X' }]);
    expect(infos.length).toBe(1);
    expect(infos[0].name).toBe(DEFAULT_DATA_POINT);
    expect(infos[0].currentValue).toBeUndefined();
  });

  it('extracts CurrentValue from the GraphQL attributes-array record shape', () => {
    const records = [
      {
        attributes: [
          { attributeName: 'name', value: 'tempActual' },
          { attributeName: 'currentValue', value: '22.3' },
        ],
      },
    ];
    const infos = extractDataPoints([{ attributeName: 'states', value: records }]);
    expect(infos.find(i => i.name === 'tempActual')?.currentValue).toBe('22.3');
  });

  it('extracts CurrentValue from the attributes-object record shape', () => {
    const records = [{ attributes: { Name: 'co2', CurrentValue: 640 } }];
    const infos = extractDataPoints([{ attributeName: 'States', value: records }]);
    expect(infos.find(i => i.name === 'co2')?.currentValue).toBe(640);
  });

  it('extracts CurrentValue from the flat record shape', () => {
    const records = [{ Name: 'humidity', CurrentValue: '48' }];
    const infos = extractDataPoints([{ attributeName: 'States', value: records }]);
    expect(infos.find(i => i.name === 'humidity')?.currentValue).toBe('48');
  });

  it('leaves record currentValue undefined when the record carries none', () => {
    const records = [{ Name: 'tempTarget' }];
    const infos = extractDataPoints([{ attributeName: 'States', value: records }]);
    expect(infos.find(i => i.name === 'tempTarget')?.currentValue).toBeUndefined();
  });
});
