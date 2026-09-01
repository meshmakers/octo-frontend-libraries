import { TestBed } from '@angular/core/testing';
import { ThemeModeService, ThemeModePreference } from './theme-mode.service';

describe('ThemeModeService', () => {
  let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[];
  let mockMediaQuery: MediaQueryList;

  beforeEach(() => {
    mediaQueryListeners = [];
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    mockMediaQuery = {
      matches: false,
      addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) =>
        mediaQueryListeners.push(listener),
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList;
    spyOn(window, 'matchMedia').and.returnValue(mockMediaQuery);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function service(): ThemeModeService {
    return TestBed.inject(ThemeModeService);
  }

  it('defaults to "system" preference when no value stored', () => {
    expect(service().preference()).toBe('system');
  });

  it('reads stored "light" preference on init', () => {
    localStorage.setItem('octo-theme-preference', 'light');
    expect(service().preference()).toBe('light');
  });

  it('reads stored "dark" preference on init', () => {
    localStorage.setItem('octo-theme-preference', 'dark');
    expect(service().preference()).toBe('dark');
  });

  it('falls back to "system" when stored value is invalid', () => {
    localStorage.setItem('octo-theme-preference', 'rainbow');
    expect(service().preference()).toBe('system');
  });

  it('setPreference("light") persists to localStorage and sets data-theme attr', () => {
    service().setPreference('light');
    expect(localStorage.getItem('octo-theme-preference')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setPreference("dark") persists to localStorage and sets data-theme attr', () => {
    service().setPreference('dark');
    expect(localStorage.getItem('octo-theme-preference')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setPreference("system") removes localStorage entry and data-theme attr', () => {
    localStorage.setItem('octo-theme-preference', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    service().setPreference('system');
    expect(localStorage.getItem('octo-theme-preference')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBeFalse();
  });

  it('cycle() goes system -> light -> dark -> system', () => {
    const svc = service();
    expect(svc.preference()).toBe('system');
    svc.cycle();
    expect(svc.preference()).toBe('light');
    svc.cycle();
    expect(svc.preference()).toBe('dark');
    svc.cycle();
    expect(svc.preference()).toBe('system');
  });

  it('resolved is "dark" when preference is "system" and OS pref is dark', () => {
    (mockMediaQuery as { matches: boolean }).matches = false;
    expect(service().resolved()).toBe('dark');
  });

  it('resolved is "light" when preference is "system" and OS pref is light', () => {
    (mockMediaQuery as { matches: boolean }).matches = true;
    expect(service().resolved()).toBe('light');
  });

  it('resolved follows explicit preference regardless of OS pref', () => {
    (mockMediaQuery as { matches: boolean }).matches = true; // OS = light
    const svc = service();
    svc.setPreference('dark');
    expect(svc.resolved()).toBe('dark');
  });

  it('OS pref change updates resolved when preference is "system"', () => {
    const svc = service();
    expect(svc.resolved()).toBe('dark');
    (mockMediaQuery as { matches: boolean }).matches = true;
    mediaQueryListeners.forEach(listener =>
      listener({ matches: true } as MediaQueryListEvent)
    );
    expect(svc.resolved()).toBe('light');
  });

  it('OS pref change does NOT update resolved when preference is forced', () => {
    const svc = service();
    svc.setPreference('dark');
    (mockMediaQuery as { matches: boolean }).matches = true;
    mediaQueryListeners.forEach(listener =>
      listener({ matches: true } as MediaQueryListEvent)
    );
    expect(svc.resolved()).toBe('dark');
  });
});

const _typeCheck: ThemeModePreference = 'system';
void _typeCheck;
