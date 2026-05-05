import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ThemeSwitcherComponent } from './theme-switcher.component';
import { BrandingDataSource } from '../../services/branding-data-source.service';
import { ThemeService } from '../../services/theme.service';
import { NEUTRAL_BRANDING_DEFAULTS } from '../../branding.tokens';

describe('ThemeSwitcherComponent', () => {
  function configure(opts: { isDark: boolean; darkAvailable: boolean }): {
    el: HTMLElement;
    setDark: jasmine.Spy;
  } {
    const isDarkSignal = signal(opts.isDark);
    const setDarkSpy = jasmine
      .createSpy('setDark')
      .and.callFake((v: boolean) => isDarkSignal.set(v));
    const themeStub = {
      isDark: isDarkSignal,
      setDark: setDarkSpy,
    };
    const branding = signal({
      ...NEUTRAL_BRANDING_DEFAULTS,
      darkTheme: opts.darkAvailable ? NEUTRAL_BRANDING_DEFAULTS.darkTheme : null,
    });
    TestBed.configureTestingModule({
      imports: [ThemeSwitcherComponent],
      providers: [
        { provide: ThemeService, useValue: themeStub },
        { provide: BrandingDataSource, useValue: { branding } },
      ],
    });
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      setDark: setDarkSpy,
    };
  }

  it('renders an aria-labeled button', () => {
    const { el } = configure({ isDark: false, darkAvailable: true });
    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toContain('dark');
  });

  it('disables the button when tenant has dark theme = null', () => {
    const { el } = configure({ isDark: false, darkAvailable: false });
    const btn = el.querySelector('button');
    expect(btn?.hasAttribute('disabled')).toBeTrue();
  });

  it('toggles via setDark when clicked and dark is available', () => {
    const { el, setDark } = configure({ isDark: false, darkAvailable: true });
    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(setDark).toHaveBeenCalledWith(true);
  });

  it('does not call setDark when disabled (no dark theme)', () => {
    const { el, setDark } = configure({ isDark: false, darkAvailable: false });
    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(setDark).not.toHaveBeenCalled();
  });
});
