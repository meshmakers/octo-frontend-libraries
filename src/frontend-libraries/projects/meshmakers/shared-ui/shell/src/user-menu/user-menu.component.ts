import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { formatShellMessage, ShellMessages, shellMessages } from '../shell.messages';

/** One density choice of the user menu (the host owns the density modes and applies them). */
export interface ShellDensityOption {
  mode: string;
  label: string;
}

/** One language of the user menu's language choice. */
export interface ShellLanguage {
  /** Language code the host understands, e.g. `'en'` or `'de-AT'`. */
  code: string;
  /** Name of the language, ideally in that language ("Deutsch"). */
  label: string;
}

/** The default language list: English only, shown as a fact instead of a choice. */
export const DEFAULT_SHELL_LANGUAGES: readonly ShellLanguage[] = [{ code: 'en', label: 'English' }];

/** Theme preference of the user menu (same values as octo-ui's `ThemeModePreference`). */
export type ShellThemePreference = 'system' | 'light' | 'dark';

/** The signed-in user as the user menu shows it. */
export interface ShellUser {
  /** Avatar initials; empty shows "?". */
  initials?: string | null;
  /** Full name, e.g. "Gerald Lochner". */
  displayName?: string | null;
  /** Login / account name, e.g. "gerald". */
  userName?: string | null;
  /** Account page of the identity provider; null leaves "Manage profile" out. */
  profileUri?: string | null;
}

/**
 * A host entry of the user menu (AB#5621), e.g. "My identities" or "Developer info". Listed
 * above "Manage profile" and "Sign out".
 */
export interface ShellUserMenuItem {
  id: string;
  /** Visible label (already translated by the host). */
  text: string;
  svgIcon?: SVGIcon;
  /** External link, opened in a new tab; without one choosing the entry emits `itemSelected`. */
  href?: string;
}

interface ThemeOption {
  value: ShellThemePreference;
  label: string;
}

/**
 * Avatar menu of the top bar. Besides sign-out and the profile link it holds
 * the personal settings (concept §3.1, §10): theme mode, density and
 * language. Tenant configuration belongs elsewhere (the Settings space).
 *
 * - **Session**: `sessionLoading` shows a placeholder, `user` null offers "Sign in"
 *   (`signIn` output), otherwise the avatar opens the panel; "Sign out" emits `signOut`.
 *   The host wires its auth service (e.g. shared-auth's `AuthorizeService`).
 * - **Theme**: `theme` is the current preference, a choice emits `themeChange` (e.g. wired to
 *   octo-ui's `ThemeModeService`).
 * - **Density** lists `densityOptions` (none: the group is left out); a choice emits
 *   `densityChange`, the host applies and stores it and feeds `density` back.
 * - **Language** lists `languages`. With one language (the default, English) the entry
 *   states it instead of offering a choice that changes nothing; with several it is a
 *   radio group that emits `languageChange`. Persisting the choice (per user) and
 *   switching the translations is the host's job; it feeds the current code back
 *   through `language`.
 * - **Version** shows `version` when set.
 * - **Host entries** (AB#5621): `items` lists the host's own entries above "Manage profile" and
 *   "Sign out"; choosing one closes the panel and emits `itemSelected` (entries with `href`
 *   open in a new tab instead). For richer content the host may project elements with the
 *   `shellUserMenuItems` attribute into the same place; a click on a button or link there
 *   closes the panel as well.
 *
 * Opening moves focus into the panel, Escape or the avatar button close it
 * and return focus to the avatar. Theme, density and language are native radio groups
 * (arrow keys move and select, one tab stop each).
 */
@Component({
  selector: 'mm-shell-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  imports: [SVGIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellUserMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The signed-in user; null shows the "Sign in" button. */
  readonly user = input<ShellUser | null>(null);
  /** The session is being restored: a placeholder instead of avatar or sign-in. */
  readonly sessionLoading = input(false);
  /** The current theme preference. */
  readonly theme = input<ShellThemePreference>('system');

  /** Density choices; empty leaves the density group out. */
  readonly densityOptions = input<readonly ShellDensityOption[]>([]);
  /** The current density mode (one of `densityOptions`). */
  readonly density = input<string | null>(null);
  /** Languages to choose from; one entry is shown as a fact, none hides the entry. */
  readonly languages = input<readonly ShellLanguage[]>(DEFAULT_SHELL_LANGUAGES);
  /** The current language code; defaults to the first of `languages`. */
  readonly language = input<string | null>(null);
  /** App version shown at the bottom of the panel; null leaves the line out. */
  readonly version = input<string | null>(null);
  /** Host entries above "Manage profile" / "Sign out"; empty leaves the list out. */
  readonly items = input<readonly ShellUserMenuItem[]>([]);
  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);

  readonly signIn = output<void>();
  readonly signOut = output<void>();
  /** The person picked a theme preference. */
  readonly themeChange = output<ShellThemePreference>();
  /** The person picked a density mode. */
  readonly densityChange = output<string>();
  /** The person picked a language (its code). */
  readonly languageChange = output<string>();
  /** The person chose a host entry without `href`. */
  readonly itemSelected = output<ShellUserMenuItem>();

  protected readonly m = shellMessages(this.messages);
  protected readonly open = signal(false);

  protected readonly initials = computed(() => this.user()?.initials || '?');
  protected readonly fullName = computed(() => this.user()?.displayName || null);
  protected readonly userName = computed(() => this.user()?.userName || null);
  protected readonly profileUri = computed(() => this.user()?.profileUri || null);

  protected readonly avatarLabel = computed(() => {
    const name = this.fullName();
    return name ? formatShellMessage(this.m().accountAndPreferencesOf, { name }) : this.m().accountAndPreferences;
  });

  protected readonly versionText = computed(() => {
    const version = this.version();
    return version ? formatShellMessage(this.m().version, { version }) : null;
  });

  protected readonly themeOptions = computed<readonly ThemeOption[]>(() => [
    { value: 'system', label: this.m().themeSystem },
    { value: 'light', label: this.m().themeLight },
    { value: 'dark', label: this.m().themeDark }
  ]);

  /** The code of the current language: `language`, else the first of `languages`. */
  protected readonly currentLanguage = computed(() => this.language() ?? this.languages()[0]?.code ?? null);

  protected readonly currentLanguageLabel = computed(() => {
    const code = this.currentLanguage();
    const languages = this.languages();
    return (languages.find(language => language.code === code) ?? languages[0])?.label ?? null;
  });

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
    } else {
      this.open.set(true);
      // Move focus into the panel once it is rendered: the checked theme radio.
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.user-panel input:checked')?.focus());
    }
  }

  /** Closes the panel; `restoreFocus` puts focus back on the avatar button. */
  private close(restoreFocus: boolean): void {
    this.open.set(false);
    if (restoreFocus) {
      this.host.nativeElement.querySelector<HTMLElement>('.avatar-button')?.focus();
    }
  }

  protected setTheme(value: ShellThemePreference): void {
    this.themeChange.emit(value);
  }

  protected setDensity(mode: string): void {
    this.densityChange.emit(mode);
  }

  protected setLanguage(code: string): void {
    if (code !== this.currentLanguage()) {
      this.languageChange.emit(code);
    }
  }

  /** A host entry: close the panel (focus back on the avatar), then let the host act. */
  protected selectItem(item: ShellUserMenuItem): void {
    this.close(true);
    this.itemSelected.emit(item);
  }

  /** An external host entry opens in a new tab; the panel closes and focus returns to the avatar. */
  protected followItemLink(): void {
    this.close(true);
  }

  /** A click on a button or link of the projected `shellUserMenuItems` content closes the panel. */
  protected onProjectedClick(event: Event): void {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a[href]')) {
      this.close(true);
    }
  }

  protected login(): void {
    this.signIn.emit();
  }

  protected logout(): void {
    this.open.set(false);
    this.signOut.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.close(true);
    }
  }

  /** A click outside closes without stealing focus from what was clicked. */
  @HostListener('document:click', ['$event.target'])
  protected onDocumentClick(target: EventTarget | null): void {
    if (this.open() && target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  /** Tabbing out of the panel closes it. */
  protected onPanelFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.nativeElement.contains(next)) {
      this.close(false);
    }
  }
}
