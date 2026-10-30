import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MESHBOARD_LANGUAGE, injectMeshBoardLanguage, isCultureKey, pickLocalizedText, readMeshBoardLanguageSource } from './meshboard-language';

describe('meshboard-language (AB#7655)', () => {
  it('reads a fixed or signal source and normalises it', () => {
    expect(readMeshBoardLanguageSource('de-AT')).toBe('de-AT');
    expect(readMeshBoardLanguageSource(' de_AT ')).toBe('de-AT');
    expect(readMeshBoardLanguageSource(signal<string | null>('en-GB'))).toBe('en-GB');
    expect(readMeshBoardLanguageSource(signal<string | null>(null))).toBeNull();
    expect(readMeshBoardLanguageSource('')).toBeNull();
    expect(readMeshBoardLanguageSource(undefined)).toBeNull();
  });

  it('injects null without MESHBOARD_LANGUAGE', () => {
    TestBed.configureTestingModule({});
    const language = TestBed.runInInjectionContext(() => injectMeshBoardLanguage());
    expect(language()).toBeNull();
  });

  it('follows a language signal', () => {
    const host = signal('de-AT');
    TestBed.configureTestingModule({ providers: [{ provide: MESHBOARD_LANGUAGE, useValue: host }] });
    const language = TestBed.runInInjectionContext(() => injectMeshBoardLanguage());
    expect(language()).toBe('de-AT');
    host.set('en-GB');
    expect(language()).toBe('en-GB');
  });

  it('accepts culture keys and rejects others', () => {
    for (const key of ['de', 'de-AT', 'en-GB', 'zh-Hant-TW', 'gsw']) {
      expect(isCultureKey(key)).toBe(true);
    }
    for (const key of ['german', 'de_AT', '', 'd', 'de-']) {
      expect(isCultureKey(key)).toBe(false);
    }
  });

  it('picks exact culture, then language part, never a sibling culture', () => {
    const texts = { 'de-AT': 'AT', de: 'DE', 'en-GB': 'GB' };
    expect(pickLocalizedText(texts, 'de-AT')).toBe('AT');
    expect(pickLocalizedText(texts, 'de-CH')).toBe('DE');
    expect(pickLocalizedText({ 'de-AT': 'AT' }, 'de-DE')).toBeUndefined();
    expect(pickLocalizedText(texts, null)).toBeUndefined();
    expect(pickLocalizedText(undefined, 'de')).toBeUndefined();
  });
});
