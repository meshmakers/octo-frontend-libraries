import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ShellNavNode } from '../shell-navigation.service';
import { SettingsSideNavBadge } from './settings-side-nav-badges.service';
import { formatShellMessage, ShellMessages, shellMessages } from '../shell.messages';

let nextSideNavId = 0;

/**
 * A heading over some categories of the Settings side navigation (AB#5621).
 */
export interface SettingsSideNavGroup {
  id: string;
  /** Visible heading (already translated by the host). */
  label: string;
  /** Tab ids of the categories under the heading, in display order. */
  tabIds: readonly string[];
}

/** One block of the side navigation: a group with its categories, or the ungrouped ones. */
interface SideNavSection {
  id: string;
  label: string | null;
  categories: ShellNavNode[];
}

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
 *
 * Groups (AB#5621, optional): `groups` puts headings over the categories they list (in the
 * group's order); categories in no group follow without a heading, groups without a visible
 * category are left out. Without groups the list is flat, as before.
 *
 * Labels are shown exactly as given (AB#5621): the area name, the categories and the group
 * headings keep the host's case — no lower-casing, no CSS `text-transform`. A language that
 * needs a different case in "All {area}" sets `allOfArea` to the whole text.
 */
@Component({
  selector: 'mm-settings-side-nav',
  templateUrl: './settings-side-nav.component.html',
  styleUrl: './settings-side-nav.component.scss',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSideNavComponent {
  readonly area = input.required<ShellNavNode>();
  readonly activeTabId = input<string | null>(null);
  /** The Settings home is open ("All settings" is the current entry). */
  readonly homeActive = input(false);
  readonly badges = input<Record<string, SettingsSideNavBadge>>({});
  /** Optional headings over the categories; empty keeps the flat list. */
  readonly groups = input<readonly SettingsSideNavGroup[]>([]);
  /** Translations; members left out fall back to {@link SHELL_MESSAGES}, then English. */
  readonly messages = input<Partial<ShellMessages> | null>(null);
  protected readonly m = shellMessages(this.messages);

  readonly homeSelected = output<void>();
  readonly tabSelected = output<ShellNavNode>();

  protected readonly categories = computed(() => this.area().children.filter((child) => !child.separator));
  protected readonly sections = computed<SideNavSection[]>(() => {
    const categories = this.categories();
    const groups = this.groups();
    if (groups.length === 0) {
      return [{ id: '', label: null, categories }];
    }
    const byId = new Map(categories.map((category) => [category.id, category]));
    const placed = new Set<string>();
    const sections: SideNavSection[] = [];
    for (const group of groups) {
      const members = group.tabIds
        .filter((id) => byId.has(id) && !placed.has(id))
        .map((id) => byId.get(id) as ShellNavNode);
      members.forEach((member) => placed.add(member.id));
      if (members.length > 0) {
        sections.push({ id: group.id, label: group.label, categories: members });
      }
    }
    const rest = categories.filter((category) => !placed.has(category.id));
    if (rest.length > 0) {
      sections.push({ id: '', label: null, categories: rest });
    }
    return sections;
  });

  /** Unique per instance, so two side navs on one page never share heading ids. */
  private readonly instanceId = nextSideNavId++;

  protected groupHeadingId(section: SideNavSection): string {
    return `mm-settings-side-nav-${this.instanceId}-group-${section.id}`;
  }

  protected readonly navLabel = computed(() => formatShellMessage(this.m().areaCategories, { area: this.area().text }));
  protected readonly homeLabel = computed(() => formatShellMessage(this.m().allOfArea, { area: this.area().text }));
}
