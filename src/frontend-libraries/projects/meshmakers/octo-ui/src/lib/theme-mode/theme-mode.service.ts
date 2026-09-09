import { Injectable, signal } from '@angular/core';

export type ThemeModePreference = 'system' | 'dark' | 'light';
export type ResolvedThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'octo-theme-preference';

/**
 * Light/dark mode for the LCARS theme, shared by every OctoMesh host app.
 *
 * The preference is one of three states and is persisted in `localStorage`:
 * `system` follows `prefers-color-scheme` and stamps no attribute, `light` and
 * `dark` force the mode via `<html data-theme="…">`. That attribute is the
 * contract the token blocks in `octo-ui` `_theme.scss` key off:
 * `:root:not([data-theme="dark"])` inside the media query for the OS default
 * and `:root[data-theme="light"]` for the explicit override.
 *
 * Not to be confused with `ThemeService` in `@meshmakers/octo-ui/branding`,
 * which applies a tenant's custom brand palette on top of the active mode.
 */
@Injectable({ providedIn: 'root' })
export class ThemeModeService {
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  private readonly _preference = signal<ThemeModePreference>(this.loadPreference());
  private readonly _resolved = signal<ResolvedThemeMode>(this.resolve(this._preference()));

  readonly preference = this._preference.asReadonly();
  readonly resolved = this._resolved.asReadonly();

  constructor() {
    this.applyAttribute(this._preference());

    this.mediaQuery.addEventListener('change', () => {
      if (this._preference() === 'system') {
        this._resolved.set(this.resolve('system'));
      }
    });
  }

  setPreference(pref: ThemeModePreference): void {
    this._preference.set(pref);
    this.persist(pref);
    this.applyAttribute(pref);
    this._resolved.set(this.resolve(pref));
  }

  /** system → light → dark → system. */
  cycle(): void {
    const next: Record<ThemeModePreference, ThemeModePreference> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    this.setPreference(next[this._preference()]);
  }

  private resolve(pref: ThemeModePreference): ResolvedThemeMode {
    if (pref === 'system') {
      return this.mediaQuery.matches ? 'light' : 'dark';
    }
    return pref;
  }

  private applyAttribute(pref: ThemeModePreference): void {
    const root = document.documentElement;
    if (pref === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', pref);
    }
  }

  private loadPreference(): ThemeModePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  }

  private persist(pref: ThemeModePreference): void {
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }
}
