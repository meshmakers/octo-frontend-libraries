import { resolveLocalizedText } from './meshboard-language';

/**
 * The one resolver for author texts with a single default and a per-language map (board name and
 * description, widget title and explanation): lookup order, fallback and ignored entries.
 */
describe('resolveLocalizedText', () => {
  const TITLES = { 'de-AT': 'Energiemengen', 'en-GB': 'Energy quantities' };

  it('picks the exact culture of the host language', () => {
    expect(resolveLocalizedText('Energy quantities', TITLES, 'de-AT').text).toBe('Energiemengen');
    expect(resolveLocalizedText('Energiemengen', TITLES, 'en-GB').text).toBe('Energy quantities');
  });

  it('takes the language part when the culture has no entry, but never a sibling culture', () => {
    expect(resolveLocalizedText('Fallback', { de: 'Deutsch', 'de-AT': 'Österreich' }, 'de-CH').text).toBe('Deutsch');
    expect(resolveLocalizedText('Fallback', { 'de-AT': 'Österreich' }, 'de-DE').text).toBe('Fallback');
  });

  it('shows the single text without a host language or without a map', () => {
    expect(resolveLocalizedText('Energy quantities', TITLES, null)).toEqual({ text: 'Energy quantities', ignoredKeys: [] });
    expect(resolveLocalizedText('Energy quantities', undefined, 'de-AT')).toEqual({ text: 'Energy quantities', ignoredKeys: [] });
  });

  it('ignores empty and non-string entries, reports them and never returns an empty text', () => {
    const result = resolveLocalizedText('Energy quantities', { 'de-AT': '', 'en-GB': 42, german: 'Deutsch' }, 'de-AT');

    expect(result.text).toBe('Energy quantities');
    expect(result.ignoredKeys.sort()).toEqual(['de-AT', 'en-GB', 'german']);
  });

  it('ignores a map that is no object', () => {
    expect(resolveLocalizedText('Energy quantities', 'Energiemengen', 'de-AT')).toEqual({ text: 'Energy quantities', ignoredKeys: ['*'] });
    expect(resolveLocalizedText('Energy quantities', ['Energiemengen'], 'de-AT')).toEqual({ text: 'Energy quantities', ignoredKeys: ['*'] });
  });
});
