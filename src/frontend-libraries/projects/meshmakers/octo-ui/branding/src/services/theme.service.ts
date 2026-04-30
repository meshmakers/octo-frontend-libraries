import {
  DOCUMENT,
  inject,
  Injectable,
  Renderer2,
  RendererFactory2,
  signal,
} from '@angular/core';

/**
 * Light/dark mode toggle backed by `localStorage` + `<html data-theme="...">`.
 * Pure mode toggle; palette generation lives in `BrandingApplicationService`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly renderer: Renderer2;
  private readonly isDarkSignal = signal(false);

  readonly isDark = this.isDarkSignal.asReadonly();

  constructor() {
    this.renderer = inject(RendererFactory2).createRenderer(null, null);
    this.isDarkSignal.set(this.getInitialThemeIsDark());
    this.applyTheme();
  }

  toggleTheme(): void {
    this.setDark(!this.isDarkSignal());
  }

  setDark(isDark: boolean): void {
    this.isDarkSignal.set(isDark);
    try {
      this.document.defaultView?.localStorage.setItem(
        'theme',
        isDark ? 'dark' : 'light',
      );
    } catch {
      // localStorage may be unavailable (private mode, SSR) — degrade silently.
    }
    this.applyTheme();
  }

  private applyTheme(): void {
    const html = this.document.documentElement;
    this.renderer.setAttribute(
      html,
      'data-theme',
      this.isDarkSignal() ? 'dark' : 'light',
    );
  }

  private getInitialThemeIsDark(): boolean {
    let stored: string | null = null;
    try {
      stored = this.document.defaultView?.localStorage.getItem('theme') ?? null;
    } catch {
      stored = null;
    }
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return (
      this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')
        .matches ?? false
    );
  }
}
