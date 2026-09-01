import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ThemeModeToggleComponent } from './theme-mode-toggle.component';
import { ThemeModeService } from './theme-mode.service';

describe('ThemeModeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeModeToggleComponent>;
  let themeService: ThemeModeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList);

    TestBed.configureTestingModule({
      imports: [ThemeModeToggleComponent],
    });
    fixture = TestBed.createComponent(ThemeModeToggleComponent);
    themeService = TestBed.inject(ThemeModeService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a button with an aria-label', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });

  it('clicking the button cycles theme preference', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(themeService.preference()).toBe('system');
    button.click();
    expect(themeService.preference()).toBe('light');
    button.click();
    expect(themeService.preference()).toBe('dark');
    button.click();
    expect(themeService.preference()).toBe('system');
  });

  it('aria-label reflects the current preference', () => {
    const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

    expect(button().getAttribute('aria-label')).toContain('System');

    themeService.setPreference('light');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toContain('Light');

    themeService.setPreference('dark');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toContain('Dark');
  });
});
