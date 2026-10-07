import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ShellNavNode } from '../shell-navigation.service';
import { SettingsSideNavBadge } from './settings-side-nav-badges.service';
import { formatShellMessage, ShellMessages, shellMessages } from '../shell.messages';

/**
 * The one navigation of the Settings space (concept §5.6, AB#5523): "All settings" plus the
 * categories of the Settings area on the left, on every Settings page — the home, the category
 * pages, the generated forms and the hand-written pages (secrets, identity providers, …). The
 * space header shows no tab strip in Settings, so opening a category never switches between two
 * navigation layouts.
 *
 * The entries are the area's children from the command tree (the same entries as the rail
 * flyout); counts and the re-entry badge come from {@link SettingsSideNavBadgesService}.
 * Navigation, not ARIA tabs: a `nav` with buttons and `aria-current="page"` on the active one.
 */
@Component({
  selector: 'mm-settings-side-nav',
  templateUrl: './settings-side-nav.component.html',
  styleUrl: './settings-side-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSideNavComponent {
  readonly area = input.required<ShellNavNode>();
  readonly activeTabId = input<string | null>(null);
  /** The Settings home is open ("All settings" is the current entry). */
  readonly homeActive = input(false);
  readonly badges = input<Record<string, SettingsSideNavBadge>>({});
  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);
  protected readonly m = shellMessages(this.messages);

  readonly homeSelected = output<void>();
  readonly tabSelected = output<ShellNavNode>();

  protected readonly categories = computed(() => this.area().children.filter((child) => !child.separator));
  protected readonly navLabel = computed(() => formatShellMessage(this.m().areaCategories, { area: this.area().text }));
  protected readonly homeLabel = computed(() => formatShellMessage(this.m().allOfArea, { area: this.area().text.toLowerCase() }));
}
