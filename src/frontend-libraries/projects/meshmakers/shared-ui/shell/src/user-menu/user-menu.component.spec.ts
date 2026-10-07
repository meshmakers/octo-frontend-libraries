import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellDensityOption, ShellThemePreference, ShellUser, ShellUserMenuComponent, ShellUserMenuItem } from './user-menu.component';
import { SHELL_MESSAGES } from '../shell.messages';

const DENSITY_OPTIONS: ShellDensityOption[] = [
  { mode: 'auto', label: 'Auto (by screen size)' },
  { mode: 'compact', label: 'Compact' },
  { mode: 'comfortable', label: 'Comfortable' },
  { mode: 'spacious', label: 'Spacious' },
  { mode: 'xlarge', label: 'Extra Large' }
];

const USER: ShellUser = {
  initials: 'GL',
  displayName: 'Gerald Lochner',
  userName: 'gerald',
  profileUri: 'https://id.example/meshmakers/manage'
};

describe('ShellUserMenuComponent', () => {
  let fixture: ComponentFixture<ShellUserMenuComponent>;
  let element: HTMLElement;
  let densityChanges: string[];
  let languageChanges: string[];
  let themeChanges: ShellThemePreference[];
  let signIns: number;
  let signOuts: number;

  beforeEach(() => {
    densityChanges = [];
    languageChanges = [];
    themeChanges = [];
    signIns = 0;
    signOuts = 0;

    TestBed.configureTestingModule({ imports: [ShellUserMenuComponent] });
    fixture = TestBed.createComponent(ShellUserMenuComponent);
    fixture.componentRef.setInput('user', USER);
    fixture.componentRef.setInput('densityOptions', DENSITY_OPTIONS);
    fixture.componentRef.setInput('density', 'auto');
    const menu = fixture.componentInstance;
    menu.densityChange.subscribe(mode => densityChanges.push(mode));
    menu.languageChange.subscribe(code => languageChanges.push(code));
    menu.themeChange.subscribe(theme => {
      themeChanges.push(theme);
      // The host applies the preference and feeds it back.
      fixture.componentRef.setInput('theme', theme);
    });
    menu.signIn.subscribe(() => signIns++);
    menu.signOut.subscribe(() => signOuts++);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  const openMenu = (): void => {
    element.querySelector<HTMLButtonElement>('.avatar-button')!.click();
    fixture.detectChanges();
  };
  const radios = (name: string): HTMLInputElement[] =>
    Array.from(element.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`));
  const labelOf = (input: HTMLInputElement): string => input.closest('label')?.textContent?.trim() ?? '';
  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  it('shows the initials and opens the panel on click', () => {
    expect(element.querySelector('.avatar')?.textContent?.trim()).toBe('GL');
    expect(element.querySelector('.user-panel')).toBeNull();

    openMenu();

    expect(element.querySelector('.user-panel')).not.toBeNull();
    expect(element.querySelector('.user-full-name')?.textContent?.trim()).toBe('Gerald Lochner');
    expect(element.querySelector('.user-login')?.textContent?.trim()).toBe('gerald');
    expect(element.querySelector<HTMLAnchorElement>('.action-link')?.href).toBe('https://id.example/meshmakers/manage');
    expect(element.querySelector<HTMLAnchorElement>('.action-link')?.rel).toBe('noopener noreferrer');
  });

  it('leaves the profile link out without a profile URI and falls back to "?" initials', () => {
    fixture.componentRef.setInput('user', { displayName: 'Gerald Lochner' });
    fixture.detectChanges();
    expect(element.querySelector('.avatar')?.textContent?.trim()).toBe('?');
    openMenu();
    expect(element.querySelector('.action-link')).toBeNull();
    expect(element.querySelector('.user-login')).toBeNull();
  });

  it('moves focus into the panel on open and back to the avatar on Escape', async () => {
    openMenu();
    await flush();

    expect(document.activeElement).toBe(radios('user-menu-theme')[0]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(element.querySelector('.avatar-button'));
  });

  it('holds the theme mode as a native radio group and emits a choice', () => {
    openMenu();
    const theme = radios('user-menu-theme');
    expect(theme.map(labelOf)).toEqual(['System', 'Light', 'Dark']);
    expect(theme[0].checked).toBe(true);
    expect(element.querySelector('fieldset legend')?.textContent?.trim()).toBe('Theme');

    theme[2].click();
    fixture.detectChanges();

    expect(themeChanges).toEqual(['dark']);
    expect(radios('user-menu-theme')[2].checked).toBe(true);
  });

  it('lays each radio over its whole label instead of clipping it to 1px (directly clickable)', () => {
    openMenu();
    for (const radio of [...radios('user-menu-theme'), ...radios('user-menu-density')]) {
      expect(radio.classList).not.toContain('visually-hidden');
      const style = getComputedStyle(radio);
      expect(style.position).toBe('absolute');
      expect(style.opacity).toBe('0');
      expect(radio.closest('label')).not.toBeNull();
    }
  });

  it('holds the density as a native radio group and emits a choice', () => {
    openMenu();
    const options = radios('user-menu-density');
    expect(options.length).toBe(5);
    expect(options[0].checked).toBe(true);

    options.find(o => labelOf(o) === 'Compact')!.click();

    expect(densityChanges).toEqual(['compact']);
  });

  it('leaves the density group out without options', () => {
    fixture.componentRef.setInput('densityOptions', []);
    openMenu();
    expect(radios('user-menu-density').length).toBe(0);
    expect(element.querySelector('.user-panel')?.textContent).not.toContain('Density');
  });

  it('names the language', () => {
    openMenu();

    expect(element.querySelector('.user-panel')?.textContent).toContain('Language');
    expect(element.querySelector('.user-panel')?.textContent).toContain('English');
    expect(radios('user-menu-language').length).toBe(0);
  });

  it('offers several languages as a radio group and emits the choice', () => {
    fixture.componentRef.setInput('languages', [{ code: 'en', label: 'English' }, { code: 'de', label: 'Deutsch' }]);
    fixture.componentRef.setInput('language', 'en');
    openMenu();

    const languages = radios('user-menu-language');
    expect(languages.map(labelOf)).toEqual(['English', 'Deutsch']);
    expect(languages[0].checked).toBe(true);

    languages[0].click();
    languages[1].click();
    expect(languageChanges).toEqual(['de']);

    // The host persists the choice and feeds the language back.
    fixture.componentRef.setInput('language', 'de');
    fixture.detectChanges();
    expect(radios('user-menu-language')[1].checked).toBe(true);
  });

  it('defaults the current language to the first entry and names a single one as a fact', () => {
    fixture.componentRef.setInput('languages', [{ code: 'de', label: 'Deutsch' }]);
    openMenu();
    expect(radios('user-menu-language').length).toBe(0);
    expect(element.querySelector('.pref-value')?.textContent?.trim()).toBe('Deutsch');
  });

  it('hides the language entry without languages', () => {
    fixture.componentRef.setInput('languages', []);
    openMenu();
    expect(element.querySelector('.user-panel')?.textContent).not.toContain('Language');
  });

  it('shows the version only when set', () => {
    openMenu();
    expect(element.querySelector('.user-version')).toBeNull();
    fixture.componentRef.setInput('version', '3.1.7');
    fixture.detectChanges();
    expect(element.querySelector('.user-version')?.textContent?.trim()).toBe('Version 3.1.7');
  });

  it('labels the avatar with the user name', () => {
    expect(element.querySelector('.avatar-button')?.getAttribute('aria-label')).toBe('Account and preferences of Gerald Lochner');
  });

  it('signs out', () => {
    openMenu();
    element.querySelector<HTMLButtonElement>('.action-button')!.click();
    fixture.detectChanges();

    expect(signOuts).toBe(1);
    expect(element.querySelector('.user-panel')).toBeNull();
  });

  it('closes on Escape and on a click outside', () => {
    openMenu();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('.user-panel')).toBeNull();

    openMenu();
    document.body.click();
    fixture.detectChanges();
    expect(element.querySelector('.user-panel')).toBeNull();
  });

  it('offers sign-in when nobody is signed in', () => {
    fixture.componentRef.setInput('user', null);
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.sign-in')!.click();

    expect(signIns).toBe(1);
  });

  it('shows a placeholder while the session loads', () => {
    fixture.componentRef.setInput('sessionLoading', true);
    fixture.detectChanges();
    expect(element.querySelector('.avatar.placeholder')).not.toBeNull();
    expect(element.querySelector('.avatar-button')).toBeNull();
  });
});

describe('ShellUserMenuComponent host entries (AB#5621)', () => {
  const ITEMS: ShellUserMenuItem[] = [
    { id: 'my-identities', text: 'My identities' },
    { id: 'developer-info', text: 'Developer info' },
    { id: 'docs', text: 'Documentation', href: 'https://docs.example' }
  ];
  let fixture: ComponentFixture<ShellUserMenuComponent>;
  let element: HTMLElement;
  let chosen: string[];

  const openMenu = (): void => {
    element.querySelector<HTMLButtonElement>('.avatar-button')!.click();
    fixture.detectChanges();
  };
  const entry = (id: string): HTMLElement => element.querySelector<HTMLElement>(`[data-user-item="${id}"]`)!;

  beforeEach(() => {
    chosen = [];
    fixture = TestBed.createComponent(ShellUserMenuComponent);
    fixture.componentRef.setInput('user', USER);
    fixture.componentInstance.itemSelected.subscribe(item => chosen.push(item.id));
    element = fixture.nativeElement as HTMLElement;
  });

  it('lists no entry block without items', () => {
    fixture.detectChanges();
    openMenu();
    expect(element.querySelector('.user-items')).toBeNull();
  });

  it('lists the entries as buttons (links for href) above profile and sign-out', () => {
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
    openMenu();

    const entries = Array.from(element.querySelectorAll<HTMLElement>('.user-items .user-item'));
    expect(entries.map(e => e.textContent!.trim())).toEqual(['My identities', 'Developer info', 'Documentation↗(opens in a new tab)']);
    expect(entries[0].tagName).toBe('BUTTON');
    expect((entries[0] as HTMLButtonElement).type).toBe('button');
    const link = entries[2] as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('https://docs.example/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    const actions = element.querySelector('.user-actions')!;
    expect(element.querySelector('.user-items')!.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('emits the chosen entry, closes the panel and returns focus to the avatar', () => {
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
    openMenu();

    entry('developer-info').click();
    fixture.detectChanges();

    expect(chosen).toEqual(['developer-info']);
    expect(element.querySelector('.user-panel')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.avatar-button'));
  });

  it('opens an href entry without emitting, closes the panel and returns focus to the avatar', () => {
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
    openMenu();

    const link = entry('docs');
    link.addEventListener('click', event => event.preventDefault());
    link.click();
    fixture.detectChanges();

    expect(chosen).toEqual([]);
    expect(element.querySelector('.user-panel')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.avatar-button'));
  });
});

@Component({
  imports: [ShellUserMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-shell-user-menu [user]="user">
      <div shellUserMenuItems class="custom"><button type="button" class="custom-entry" (click)="clicks = clicks + 1">Custom</button><span class="custom-text">Note</span></div>
    </mm-shell-user-menu>`
})
class ProjectingMenuHostComponent {
  readonly user = USER;
  clicks = 0;
}

describe('ShellUserMenuComponent projected entries (AB#5621)', () => {
  it('shows projected content in the panel and closes on a click on its button, not on plain text', () => {
    const fixture = TestBed.createComponent(ProjectingMenuHostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const open = (): void => {
      element.querySelector<HTMLButtonElement>('.avatar-button')!.click();
      fixture.detectChanges();
    };
    expect(element.querySelector('.custom-entry')).toBeNull();

    open();
    element.querySelector<HTMLElement>('.user-items-slot .custom-text')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.user-panel')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('.user-items-slot .custom-entry')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.clicks).toBe(1);
    expect(element.querySelector('.user-panel')).toBeNull();
  });
});

describe('ShellUserMenuComponent messages', () => {
  it('translates through SHELL_MESSAGES and the messages input', () => {
    TestBed.configureTestingModule({
      imports: [ShellUserMenuComponent],
      providers: [{ provide: SHELL_MESSAGES, useValue: { signIn: 'Anmelden', signOut: 'Abmelden' } }]
    });
    const fixture = TestBed.createComponent(ShellUserMenuComponent);
    fixture.detectChanges();
    const signIn = (): string | undefined => (fixture.nativeElement as HTMLElement).querySelector('.sign-in')?.textContent?.trim();
    expect(signIn()).toBe('Anmelden');

    fixture.componentRef.setInput('messages', { signIn: 'Einloggen' });
    fixture.detectChanges();
    expect(signIn()).toBe('Einloggen');
  });
});
