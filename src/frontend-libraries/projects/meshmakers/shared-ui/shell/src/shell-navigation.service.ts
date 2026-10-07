import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { DrawerItem } from '@progress/kendo-angular-layout';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { CommandItem, CommandService, CommandSettingsService } from '@meshmakers/shared-services';
import { filter } from 'rxjs/operators';
import { areaId, RAIL_BOTTOM_SEPARATOR_ID, SHELL_SETTINGS_SPACE, spaceOfAreaId, tabId } from './shell-areas';

/**
 * One entry of the shell navigation: a rail area, a tab, or an entry nested
 * below a tab (flyout only). Built from the CommandService's visible items.
 */
export interface ShellNavNode {
  id: string;
  text: string;
  svgIcon?: SVGIcon;
  tooltip?: string;
  separator: boolean;
  /** The CommandService highlights exactly this entry (longest link match on the URL). */
  selected: boolean;
  /** This entry or one below it is selected. */
  active: boolean;
  /** Opening it navigates (router link or external href); otherwise it only groups entries. */
  navigable: boolean;
  /** Opens in a new browser tab. */
  external: boolean;
  children: ShellNavNode[];
}

/** `space` / `tab` / `objectDetail` route data, merged from the root to the deepest active route. */
export interface ShellRouteData {
  space?: string;
  tab?: string;
  /**
   * The page is the detail page of one object (AB#5547): its own object header (name, chips,
   * actions, object tabs) replaces the area title and tab strip of the space header. Set by
   * `data: { objectDetail: true }` on any route of the chain.
   */
  objectDetail?: boolean;
  /**
   * `data: { spaceTabs: false }`: the page brings its own navigation for the area's entries, so
   * the space header leaves its tab strip out instead of showing the same entries twice.
   * (Settings needs no flag: its side navigation replaces the tab strip on every page.)
   */
  spaceTabs?: boolean;
}

/** Navigation traits of one command item, keyed by id (see {@link ShellNavigationService.buildTree}). */
export interface ShellNavItemKind {
  navigable: boolean;
  external: boolean;
  tooltip?: string;
}

/**
 * The shell's view of the navigation: turns the flat, visibility-filtered
 * item list of the CommandService into a tree (rail areas → tabs → nested
 * entries) and works out which area and tab are active.
 *
 * The active area comes from the route's `data.space` when it names an area
 * of the current mode, otherwise from the area that holds the selected
 * entry. The active tab likewise comes from `data.tab` (matched as
 * `<space>-<tab>`) or from the selection. URLs never change for the shell.
 */
@Injectable({ providedIn: 'root' })
export class ShellNavigationService {
  private readonly commandService = inject(CommandService);
  private readonly commandSettings = inject(CommandSettingsService);
  private readonly router = inject(Router);
  private readonly settingsSpace = inject(SHELL_SETTINGS_SPACE);

  private readonly items = toSignal(this.commandService.drawerItems, { initialValue: [] as DrawerItem[] });
  private readonly _routeData = signal<ShellRouteData>({});

  readonly routeData = this._routeData.asReadonly();

  private readonly tree = computed(() => ShellNavigationService.buildTree(this.items(), this.collectKinds()));

  /** Rail areas above the bottom separator. */
  readonly topAreas = computed(() => this.tree().top);

  /** Rail areas pinned to the bottom (Settings). */
  readonly bottomAreas = computed(() => this.tree().bottom);

  readonly activeArea = computed<ShellNavNode | null>(() => {
    const areas = [...this.topAreas(), ...this.bottomAreas()];
    const space = this._routeData().space;
    if (space) {
      const fromRoute = areas.find(area => area.id === areaId(space));
      if (fromRoute) {
        return fromRoute;
      }
    }
    return areas.find(area => area.active) ?? null;
  });

  readonly activeTab = computed<ShellNavNode | null>(() => {
    const area = this.activeArea();
    if (!area) {
      return null;
    }
    const tab = this._routeData().tab;
    const space = spaceOfAreaId(area.id);
    if (tab && space) {
      const fromRoute = area.children.find(child => child.id === tabId(space, tab));
      if (fromRoute) {
        return fromRoute;
      }
    }
    return area.children.find(child => child.active) ?? null;
  });

  /**
   * Settings has one navigation (concept §5.6, AB#5523; the space comes from {@link SHELL_SETTINGS_SPACE}): the category list on the left of every
   * Settings page, never the tab strip — so opening a category cannot switch between two layouts.
   * Off on object detail pages, whose object header owns the navigation.
   */
  readonly settingsSideNav = computed(() =>
    this.settingsSpace !== null && this.activeArea()?.id === areaId(this.settingsSpace) && !this.objectDetail());

  /** The Settings home is open: Settings side navigation without an active category. */
  readonly settingsHomeActive = computed(() => this.settingsSideNav() && this.activeTab() === null);

  /**
   * Whether the space header shows the area's tab strip: not in Settings (side navigation), not
   * when the route says `spaceTabs: false`; default true.
   */
  readonly showTabs = computed(() => this._routeData().spaceTabs !== false && !this.settingsSideNav());

  /** The current page is an object detail page (route data `objectDetail`). */
  readonly objectDetail = computed(() => this._routeData().objectDetail === true);

  /**
   * Where "back" leads from an object detail page: the selected entry of the active area
   * (the list the object belongs to, e.g. Integration › Adapters), else the active tab.
   */
  readonly backTarget = computed<ShellNavNode | null>(() => {
    const area = this.activeArea();
    return (area ? ShellNavigationService.deepestSelected(area) : null) ?? this.activeTab();
  });

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this._routeData.set(ShellNavigationService.readRouteData(this.router.routerState?.snapshot?.root)));
  }

  /**
   * Opens an entry: navigable entries navigate (or open their href), grouping
   * entries open their first navigable descendant.
   */
  async open(node: ShellNavNode): Promise<void> {
    const target = node.navigable ? node : ShellNavigationService.firstPage(node, true);
    if (target) {
      await this.commandService.setSelectedDrawerItem({ id: target.id } as DrawerItem);
    }
  }

  /**
   * Opens an area from the rail: its first page — unless the current page
   * already lives in it, then nothing happens (re-clicking the active area
   * must not throw the person out of the page they are on). External entries
   * are skipped; an area click never pops up a browser tab.
   */
  async openArea(area: ShellNavNode): Promise<void> {
    if (area.id === this.activeArea()?.id) {
      return;
    }
    const target = ShellNavigationService.firstPage(area, false);
    if (target) {
      await this.commandService.setSelectedDrawerItem({ id: target.id } as DrawerItem);
    }
  }

  /** Opens the first page of the first area (used after a mode switch). */
  async openFirstPage(): Promise<void> {
    const first = this.topAreas()[0];
    const target = first ? ShellNavigationService.firstPage(first, false) : null;
    if (target) {
      await this.commandService.setSelectedDrawerItem({ id: target.id } as DrawerItem);
    }
  }

  /** The selected entry at or below a node, deepest first; `null` when none is selected. */
  static deepestSelected(node: ShellNavNode): ShellNavNode | null {
    for (const child of node.children) {
      const nested = ShellNavigationService.deepestSelected(child);
      if (nested) {
        return nested;
      }
    }
    return node.selected && node.navigable ? node : null;
  }

  /** The first navigable, in-app entry below a node (depth first). */
  static firstPage(node: ShellNavNode, allowExternal: boolean): ShellNavNode | null {
    for (const child of node.children) {
      if (child.separator) {
        continue;
      }
      if (child.navigable && (allowExternal || !child.external)) {
        return child;
      }
      const nested = ShellNavigationService.firstPage(child, allowExternal);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  /**
   * Link / href / target per item id, read from the command item tree. The
   * CommandService's items carry neither, but the rail must know whether an
   * entry navigates and whether it leaves the app.
   */
  private collectKinds(): Map<string, ShellNavItemKind> {
    // Re-read whenever the items change: the tree depends on mode and tenant data.
    this.items();
    const kinds = new Map<string, ShellNavItemKind>();
    const walk = (items: CommandItem[]): void => {
      for (const item of items) {
        const navigable = item.link !== undefined || item.href !== undefined || item.onClick !== undefined;
        kinds.set(item.id, {
          navigable,
          external: item.href !== undefined,
          tooltip: item.tooltip
        });
        if (item.children) {
          walk(item.children);
        }
      }
    };
    walk(this.commandSettings.commandItems);
    return kinds;
  }

  static buildTree(items: DrawerItem[], kinds: Map<string, ShellNavItemKind>): { top: ShellNavNode[]; bottom: ShellNavNode[] } {
    const byParent = new Map<string, DrawerItem[]>();
    const roots: DrawerItem[] = [];
    for (const item of items) {
      const parentId = (item as { parentId?: string }).parentId;
      if (parentId) {
        const siblings = byParent.get(String(parentId)) ?? [];
        siblings.push(item);
        byParent.set(String(parentId), siblings);
      } else {
        roots.push(item);
      }
    }

    const toNode = (item: DrawerItem): ShellNavNode => {
      const id = String(item.id ?? '');
      const children = ShellNavigationService.tidySeparators((byParent.get(id) ?? []).map(toNode));
      const kind = kinds.get(id);
      const selected = item.selected === true;
      return {
        id,
        text: item.text ?? '',
        svgIcon: item.svgIcon,
        tooltip: kind?.tooltip,
        separator: item.separator === true,
        selected,
        active: selected || children.some(child => child.active),
        navigable: kind?.navigable ?? false,
        external: kind?.external ?? false,
        children
      };
    };

    const top: ShellNavNode[] = [];
    const bottom: ShellNavNode[] = [];
    let target = top;
    for (const root of roots) {
      if (root.separator === true) {
        if (root.id === RAIL_BOTTOM_SEPARATOR_ID) {
          target = bottom;
        }
        continue;
      }
      target.push(toNode(root));
    }
    return { top, bottom };
  }

  /** Drops leading, trailing and repeated separators (left over when entries around them are hidden). */
  static tidySeparators(nodes: ShellNavNode[]): ShellNavNode[] {
    const result: ShellNavNode[] = [];
    for (const node of nodes) {
      if (node.separator && (result.length === 0 || result[result.length - 1].separator)) {
        continue;
      }
      result.push(node);
    }
    while (result.length > 0 && result[result.length - 1].separator) {
      result.pop();
    }
    return result;
  }

  static readRouteData(root: ActivatedRouteSnapshot | null | undefined): ShellRouteData {
    const data: ShellRouteData = {};
    let route = root ?? null;
    while (route) {
      const space = route.data?.['space'];
      const tab = route.data?.['tab'];
      if (route.data?.['objectDetail'] === true) {
        data.objectDetail = true;
      }
      if (typeof route.data?.['spaceTabs'] === 'boolean') {
        data.spaceTabs = route.data['spaceTabs'];
      }
      if (typeof space === 'string') {
        data.space = space;
        // A new space resets the tab unless this route names one as well.
        data.tab = typeof tab === 'string' ? tab : undefined;
      } else if (typeof tab === 'string') {
        data.tab = tab;
      }
      route = route.firstChild;
    }
    return data;
  }
}
