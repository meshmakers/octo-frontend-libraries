import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MM_LANGUAGE,
  MM_TRANSLATE,
  MmTranslateFn,
  injectMmLanguage,
  injectMmT,
  interpolateMm,
  lookupMmTable,
  provideMmTranslateDefaults,
  resolveMmTranslation,
} from './mm-translate';
import { MmTranslatePipe } from './mm-translate.pipe';

const DEFAULTS = {
  MM: { TEST: { save: 'Save', count: '{{ count }} items' } },
  'MM.TEST.flat': 'Flat entry',
};

describe('mm-translate', () => {
  describe('lookupMmTable', () => {
    it('finds flat and nested keys', () => {
      expect(lookupMmTable(DEFAULTS, 'MM.TEST.save')).toBe('Save');
      expect(lookupMmTable(DEFAULTS, 'MM.TEST.flat')).toBe('Flat entry');
    });

    it('returns undefined for unknown keys and inner nodes', () => {
      expect(lookupMmTable(DEFAULTS, 'MM.TEST.unknown')).toBeUndefined();
      expect(lookupMmTable(DEFAULTS, 'MM.TEST')).toBeUndefined();
      expect(lookupMmTable(null, 'MM.TEST.save')).toBeUndefined();
    });
  });

  describe('interpolateMm', () => {
    it('replaces {{ name }} placeholders and keeps unknown ones', () => {
      expect(interpolateMm('{{ count }} of {{total}}', { count: 2, total: 5 })).toBe('2 of 5');
      expect(interpolateMm('{{ count }} of {{ total }}', { count: 2 })).toBe('2 of {{ total }}');
      expect(interpolateMm('No params')).toBe('No params');
    });
  });

  describe('resolveMmTranslation', () => {
    it('prefers the host translation', () => {
      const host: MmTranslateFn = (key) => (key === 'MM.TEST.save' ? 'Speichern' : undefined);
      expect(resolveMmTranslation(host, [DEFAULTS], 'MM.TEST.save')).toBe('Speichern');
    });

    it('falls back to the defaults when the host has no translation or echoes the key', () => {
      const echo: MmTranslateFn = (key) => key;
      expect(resolveMmTranslation(echo, [DEFAULTS], 'MM.TEST.save')).toBe('Save');
      expect(resolveMmTranslation(() => '', [DEFAULTS], 'MM.TEST.save')).toBe('Save');
      expect(resolveMmTranslation(null, [DEFAULTS], 'MM.TEST.count', { count: 3 })).toBe('3 items');
    });

    it('treats a throwing host as missing', () => {
      const broken: MmTranslateFn = () => {
        throw new Error('boom');
      };
      expect(resolveMmTranslation(broken, [DEFAULTS], 'MM.TEST.save')).toBe('Save');
    });

    it('uses the explicit fallback, then the key', () => {
      expect(resolveMmTranslation(null, [], 'MM.TEST.x', { n: 1 }, 'Fallback {{ n }}')).toBe('Fallback 1');
      expect(resolveMmTranslation(null, [], 'MM.TEST.x')).toBe('MM.TEST.x');
    });
  });

  describe('without host providers', () => {
    it('injectMmLanguage is English and injectMmT returns the defaults', () => {
      TestBed.configureTestingModule({ providers: [provideMmTranslateDefaults(DEFAULTS)] });
      TestBed.runInInjectionContext(() => {
        expect(injectMmLanguage()()).toBe('en');
        const t = injectMmT();
        expect(t('MM.TEST.save')).toBe('Save');
        expect(t('MM.TEST.count', { count: 1 })).toBe('1 items');
      });
    });
  });

  describe('with host providers', () => {
    const language = signal('en');
    const DE: Record<string, string> = { 'MM.TEST.save': 'Speichern' };

    beforeEach(() => {
      language.set('en');
      TestBed.configureTestingModule({
        providers: [
          { provide: MM_LANGUAGE, useValue: language.asReadonly() },
          { provide: MM_TRANSLATE, useValue: (key: string) => (language() === 'de' ? DE[key] : undefined) },
        ],
      });
    });

    it('injectMmT follows the language inside computed()', () => {
      TestBed.runInInjectionContext(() => {
        const t = injectMmT(DEFAULTS);
        const label = computed(() => t('MM.TEST.save'));
        expect(label()).toBe('Save');
        language.set('de');
        expect(label()).toBe('Speichern');
      });
    });

    @Component({
      selector: 'mm-test-host',
      imports: [MmTranslatePipe],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span>{{ 'MM.TEST.save' | mmT : null : 'Save' }}</span>`,
    })
    class HostComponent {}

    it('the mmT pipe re-renders an OnPush template on a language switch', () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent?.trim()).toBe('Save');
      language.set('de');
      fixture.detectChanges();
      expect(el.textContent?.trim()).toBe('Speichern');
    });
  });

  describe('MmTranslatePipe', () => {
    it('returns an empty string for an empty key and caches by key and params', () => {
      const host = vi.fn((key: string, params?: Readonly<Record<string, unknown>>) => `${key}:${String(params?.['n'] ?? '')}`);
      TestBed.configureTestingModule({ providers: [{ provide: MM_TRANSLATE, useValue: host }] });
      const pipe = TestBed.runInInjectionContext(() => new MmTranslatePipe());
      expect(pipe.transform(null)).toBe('');
      expect(pipe.transform('A', { n: 1 })).toBe('A:1');
      expect(pipe.transform('A', { n: 1 })).toBe('A:1');
      expect(host).toHaveBeenCalledTimes(1);
      expect(pipe.transform('A', { n: 2 })).toBe('A:2');
      expect(host).toHaveBeenCalledTimes(2);
    });
  });
});
