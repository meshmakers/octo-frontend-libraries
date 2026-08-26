import {CommandOptions} from '../options/commandOptions';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';
import { Injectable, OnDestroy, inject } from '@angular/core';
import {DrawerItem} from '@progress/kendo-angular-layout';
import {CommandItem} from '../models/commandItem';
import {NavigationCancel, NavigationEnd, NavigationError, Router} from '@angular/router';
import {CommandSettingsService} from './command-settings.service';
import {CommandBaseService} from './command-base.service';

@Injectable()
export class CommandService extends CommandBaseService implements OnDestroy {
  private readonly options = inject(CommandOptions);


  private readonly _drawerItems: BehaviorSubject<DrawerItem[]> = new BehaviorSubject<DrawerItem[]>([]);
  private readonly _commandsMap: Map<string, CommandItem> = new Map<string, CommandItem>();

  private _builtItems: DrawerItem[] = [];
  private _selectedId: string | null = null;
  private _routerEventsSubscription: Subscription | null = null;

  // noinspection JSUnusedLocalSymbols
  constructor() {
    const router = inject(Router);
    const commandSettingsService = inject(CommandSettingsService);

    super(commandSettingsService, router);
  }

  // noinspection JSUnusedGlobalSymbols
  public async initialize(): Promise<void> {
    const items = new Array<DrawerItem>();

    this._commandsMap.clear();
    const commandItems = this.commandSettingsService.commandItems;
    await this.createDrawerItems(commandItems, items, null);

    this._builtItems = items;
    this._selectedId = await this.computeSelectedId(this.router.url);
    this._drawerItems.next(this.applySelection());
    this.subscribeToRouterEvents();
  }

  public ngOnDestroy(): void {
    this._routerEventsSubscription?.unsubscribe();
    this._routerEventsSubscription = null;
  }

  private async createDrawerItems(
    commandItems: CommandItem[],
    items: DrawerItem[],
    parentId: string | null,
    depth = 0,
  ) {
    for (const commandItem of commandItems) {
      const visible = await CommandBaseService.getIsVisible(commandItem);

      if (!visible) {
        continue;
      }

      const hierarchyClass = `mm-drawer-level-${depth}`;

      if (commandItem.type === 'separator') {
        items.push({
          id: commandItem.id,
          parentId: parentId ?? undefined,
          separator: true,
          cssClass: hierarchyClass
        });
      } else {
        items.push({
          id: commandItem.id,
          parentId: parentId ?? undefined,
          text: commandItem.text,
          selected: commandItem.selected,
          svgIcon: commandItem.svgIcon,
          cssClass: hierarchyClass
        });

        if (commandItem.children) {
          await this.createDrawerItems(commandItem.children, items, commandItem.id, depth + 1);
        }
        this._commandsMap.set(commandItem.id, commandItem);
      }
    }
  }

  /*
   * The drawer items are built once, but the drawer's visual selection must
   * follow every navigation — not only drawer clicks: breadcrumbs, in-page
   * links, redirects, deep links and the browser history all change the route
   * without going through setSelectedDrawerItem. NavigationCancel/-Error are
   * included so a click whose navigation a guard rejects snaps the highlight
   * back to the page that is actually shown.
   */
  private subscribeToRouterEvents(): void {
    if (this._routerEventsSubscription !== null) {
      return;
    }
    this._routerEventsSubscription = this.router.events
      .pipe(filter(event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError))
      .subscribe(() => {
        void this.updateSelectionFromUrl();
      });
  }

  private async updateSelectionFromUrl(): Promise<void> {
    const url = this.router.url;
    const selectedId = await this.computeSelectedId(url);

    if (url !== this.router.url) {
      // A newer navigation finished while the links resolved; its own
      // router event triggers the update for the final URL.
      return;
    }
    if (selectedId === this._selectedId) {
      return;
    }
    this._selectedId = selectedId;
    this._drawerItems.next(this.applySelection());
  }

  /*
   * The longest matching link prefix wins, so a child route (documents/4711)
   * keeps its list entry (documents) highlighted. A link that only points at
   * the navigation base (a home entry like './') would be a prefix of every
   * URL, so it must match exactly — it wins on the base URL itself and never
   * steals the highlight from pages without their own drawer entry.
   */
  private async computeSelectedId(url: string): Promise<string | null> {
    const currentSegments = CommandService.urlToSegments(url);
    const baseSegments = this.baseRouteSegments();

    let bestId: string | null = null;
    let bestLength = -1;
    for (const [id, commandItem] of this._commandsMap) {
      const link = await CommandBaseService.getLink(commandItem);
      if (link === null) {
        continue;
      }
      const segments = CommandService.resolveLinkSegments(link, baseSegments);
      const requiresExactMatch = segments.length <= baseSegments.length;
      if (requiresExactMatch && segments.length !== currentSegments.length) {
        continue;
      }
      if (segments.length > currentSegments.length || segments.length <= bestLength) {
        continue;
      }
      if (segments.every((segment, index) => segment === currentSegments[index])) {
        bestId = id;
        bestLength = segments.length;
      }
    }
    return bestId;
  }

  /*
   * Command links navigate relative to navigateRelativeToRoute (see
   * CommandBaseService.navigateAsync), so their absolute segments are that
   * route's path plus the link — mirroring what router.navigate resolves.
   */
  private baseRouteSegments(): string[] {
    return (this.commandSettingsService.navigateRelativeToRoute?.snapshot?.pathFromRoot ?? [])
      .flatMap(route => route.url.map(segment => segment.path));
  }

  private static resolveLinkSegments(link: string, baseSegments: string[]): string[] {
    const segments: string[] = link.startsWith('/') ? [] : [...baseSegments];

    for (const part of link.split('/')) {
      if (part === '' || part === '.') {
        continue;
      }
      if (part === '..') {
        segments.pop();
        continue;
      }
      segments.push(part);
    }
    return segments;
  }

  private applySelection(): DrawerItem[] {
    return this._builtItems.map(item =>
      item.separator === true
        ? item
        : {...item, selected: item.id === this._selectedId});
  }

  private static urlToSegments(url: string): string[] {
    const path = url.split('#')[0].split('?')[0];
    return path
      .split('/')
      .map(segment => decodeURIComponent(segment.split(';')[0]))
      .filter(segment => segment.length > 0);
  }

  // noinspection JSUnusedGlobalSymbols
  public get drawerItems(): Observable<DrawerItem[]> {
    return this._drawerItems;
  }

  // noinspection JSUnusedGlobalSymbols
  public async setSelectedDrawerItem(value: DrawerItem): Promise<void> {
    console.debug('setSelectedDrawerItem', value);

    if (typeof value.id !== "string") {
      return;
    }
    const commandItem = this._commandsMap.get(value.id);

    if (commandItem === undefined) {
      return;
    }
    await this.navigateAsync(commandItem);
  }
}

