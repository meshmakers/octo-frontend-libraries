import { DEFAULT_DATA_POINT, extractDataPointNames } from './data-point-picker.utils';

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
