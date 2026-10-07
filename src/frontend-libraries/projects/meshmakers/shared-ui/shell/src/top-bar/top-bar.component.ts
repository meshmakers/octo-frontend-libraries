import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ShellSearchTriggerService } from '../shell-search-trigger.service';
import {
  DEFAULT_SHELL_LANGUAGES,
  ShellDensityOption,
  ShellLanguage,
  ShellThemePreference,
  ShellUser,
  ShellUserMenuComponent
} from '../user-menu/user-menu.component';
import { ShellEnvironmentChip } from '../shell-environment';
import { ShellMessages, shellMessages } from '../shell.messages';

/** One choice of the top bar's mode switch (e.g. Home | Studio). */
export interface ShellModeOption {
  id: string;
  label: string;
  /** Tooltip. */
  description?: string;
}

/**
 * Top bar (concept §3.1, wireframe): brand mark + name, tenant switcher with the
 * environment chip, the mode switch, the search trigger, the optional ✦ assistant
 * toggle and the avatar menu (`mm-shell-user-menu`) with the personal settings.
 *
 * Pure presentation; the host feeds everything in and handles the outputs:
 *
 * - **Brand**: `brandName` and `brandMarkSrc` (an image URL of the host; none: no mark).
 * - **Tenant**: inside a tenant (`tenantId`) the host projects its tenant switcher with the
 *   `shellTenant` attribute (e.g. octo-ui's `<mm-tenant-switcher shellTenant …>`, which the
 *   bar styles flat); the environment chip follows it.
 * - **Environment**: `environment` (e.g. from {@link shellEnvironmentChip}); null hides the
 *   chip (also while the tenant mode is loading). `production: true` tints the bar.
 * - **Mode switch**: `modes` + `currentMode`; shown with two or more modes inside a tenant
 *   the user may open. Picking the other mode emits `modeChange`; the host applies it.
 * - **Search**: the button calls {@link ShellSearchTriggerService.request} and emits
 *   `searchRequested`; the host (or the palette) opens the command palette.
 * - **Assistant**: `assistantAvailable` shows the ✦ toggle (inside a tenant the user may
 *   open); a click emits `assistantToggle`, `assistantOpen` reflects the panel state.
 * - **User menu**: `user`, `sessionLoading`, `theme`, `densityOptions`, `density`,
 *   `languages`, `language`, `version` and the outputs `signIn`, `signOut`, `themeChange`,
 *   `densityChange` and `languageChange` are passed through to `mm-shell-user-menu`.
 */
@Component({
  selector: 'mm-shell-top-bar',
  imports: [ShellUserMenuComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellTopBarComponent {
  private readonly searchTrigger = inject(ShellSearchTriggerService);

  readonly tenantId = input<string | null>(null);
  readonly isDenied = input(false);

  /** Product name next to the mark, e.g. "OctoMesh Studio". */
  readonly brandName = input('OctoMesh');
  /** URL of the brand mark image (decorative); null leaves the mark out. */
  readonly brandMarkSrc = input<string | null>(null);
  /** The tenant's environment chip; null hides it. */
  readonly environment = input<ShellEnvironmentChip | null>(null);
  /** Choices of the mode switch; fewer than two hide it. */
  readonly modes = input<readonly ShellModeOption[]>([]);
  /** Id of the mode in effect. */
  readonly currentMode = input<string | null>(null);
  /** Shows the ✦ assistant toggle (feature flag on and the panel can be hosted). */
  readonly assistantAvailable = input(false);
  /** The assistant panel is open (`aria-expanded` of the toggle). */
  readonly assistantOpen = input(false);
  /** Id of the assistant panel element (`aria-controls` while open). */
  readonly assistantPanelId = input('assistant-panel');

  // --- passed through to mm-shell-user-menu ---
  readonly user = input<ShellUser | null>(null);
  readonly sessionLoading = input(false);
  readonly theme = input<ShellThemePreference>('system');
  readonly densityOptions = input<readonly ShellDensityOption[]>([]);
  readonly density = input<string | null>(null);
  readonly languages = input<readonly ShellLanguage[]>(DEFAULT_SHELL_LANGUAGES);
  readonly language = input<string | null>(null);
  readonly version = input<string | null>(null);

  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);

  /** The person picked the other mode; the host applies it and rebuilds the navigation. */
  readonly modeChange = output<string>();
  /** The search trigger was used. */
  readonly searchRequested = output<void>();
  /** The ✦ toggle was used. */
  readonly assistantToggle = output<void>();
  readonly signIn = output<void>();
  readonly signOut = output<void>();
  readonly themeChange = output<ShellThemePreference>();
  readonly densityChange = output<string>();
  readonly languageChange = output<string>();

  protected readonly m = shellMessages(this.messages);

  protected readonly isProduction = computed(() => this.environment()?.production === true);

  protected readonly showEnvironment = computed(() => !!this.environment() && !this.isDenied());

  /** A switch with one choice would be noise (e.g. users without builder roles). */
  protected readonly showModeSwitch = computed(() =>
    !!this.tenantId() && !this.isDenied() && this.modes().length > 1);

  /** The ✦ toggle: only when available and inside a tenant the user may open. */
  protected readonly showAssistant = computed(() =>
    this.assistantAvailable() && !!this.tenantId() && !this.isDenied());

  /** ⌘K on Apple platforms, Ctrl K elsewhere — the shortcut the palette binds. */
  private readonly isApple = /Mac|iPhone|iPad/i.test(navigator.platform ?? '');
  protected readonly shortcutLabel = this.isApple ? '⌘K' : 'Ctrl K';
  /** ⌘J / Ctrl J — the assistant shortcut the host binds. */
  protected readonly assistantShortcutLabel = this.isApple ? '⌘J' : 'Ctrl J';
  /** Both chords work everywhere; the platform's usual one is listed first. */
  protected readonly assistantKeyShortcut = this.isApple ? 'Meta+J Control+J' : 'Control+J Meta+J';

  protected selectMode(mode: string): void {
    if (mode !== this.currentMode()) {
      this.modeChange.emit(mode);
    }
  }

  protected toggleAssistant(): void {
    this.assistantToggle.emit();
  }

  protected requestSearch(): void {
    this.searchTrigger.request();
    this.searchRequested.emit();
  }
}
