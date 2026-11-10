import {
  archiveCorrectionFormName,
  isArchiveCorrectionForm,
  matchesArchiveCorrectionFormName,
} from './archive-correction-form';

describe('archive correction form helpers (AB#8591)', () => {
  it('recognises the category in any casing, trimmed', () => {
    expect(isArchiveCorrectionForm({ category: 'ArchiveCorrection' })).toBe(true);
    expect(isArchiveCorrectionForm({ category: ' archivecorrection ' })).toBe(true);
    expect(isArchiveCorrectionForm({ category: 'connections' })).toBe(false);
    expect(isArchiveCorrectionForm({ category: null })).toBe(false);
    expect(isArchiveCorrectionForm({})).toBe(false);
  });

  it('builds the lower-case well-known name from the archive key', () => {
    expect(archiveCorrectionFormName('Meter-Consumption')).toBe('archive-correction-meter-consumption');
    expect(archiveCorrectionFormName(' 65f1a2b3c4d5e6f708192a3b ')).toBe('archive-correction-65f1a2b3c4d5e6f708192a3b');
  });

  it('matches the exact name and suffixed overrides, not other archives', () => {
    expect(matchesArchiveCorrectionFormName('archive-correction-meter', 'meter')).toBe(true);
    expect(matchesArchiveCorrectionFormName('Archive-Correction-Meter-custom', 'Meter')).toBe(true);
    expect(matchesArchiveCorrectionFormName('archive-correction-meterreadings', 'meter')).toBe(false);
    expect(matchesArchiveCorrectionFormName('form-meter', 'meter')).toBe(false);
    expect(matchesArchiveCorrectionFormName(null, 'meter')).toBe(false);
    expect(matchesArchiveCorrectionFormName('archive-correction-', '')).toBe(false);
  });
});
