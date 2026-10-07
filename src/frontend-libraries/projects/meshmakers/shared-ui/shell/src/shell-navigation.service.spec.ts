import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { DrawerItem } from '@progress/kendo-angular-layout';
import { BehaviorSubject, Subject } from 'rxjs';
import { CommandItem, CommandService, CommandSettingsService } from '@meshmakers/shared-services';
import { ShellNavigationService, ShellNavNode } from './shell-navigation.service';
import { RAIL_BOTTOM_SEPARATOR_ID, SHELL_SETTINGS_SPACE } from './shell-areas';

/*
 * Tree under test (as the CommandService emits it: flat, parentId links):
 *
 *   area-home        > home-cockpit (link), home-app-1 (href)
 *   area-integration > integration-pools, integration-adapters
 *   area-operate     > operate-events, sep, operate-swagger (section) > swagger-bot (href)
 *   ── rail-bottom ──
 *   area-settings    > settings-sign-in (link) > settings-sign-in-identity-providers
 */
const COMMAND_ITEMS: CommandItem[] = [
  {
    id: 'area-home', type: 'section', text: 'Home', children: [
      { id: 'home-cockpit', type: 'link', text: 'Cockpit', link: '/t' },
      { id: 'home-app-1', type: 'link', text: 'Grafana', href: 'https://grafana', target: '_blank' }
    ]
  },
  {
    id: 'area-integration', type: 'section', text: 'Integration', children: [
      { id: 'integration-pools', type: 'link', text: 'Pools', link: 'communication/pools' },
      { id: 'integration-adapters', type: 'link', text: 'Adapters', link: 'communication/adapters' }
    ]
  },
  {
    id: 'area-operate', type: 'section', text: 'Operate', children: [
      { id: 'operate-events', type: 'link', text: 'Events', link: 'repository/events' },
      { id: 'operate-sep', type: 'separator' },
      {
        id: 'operate-swagger', type: 'section', text: 'Swagger', children: [
          { id: 'swagger-bot', type: 'link', text: 'Bot', href: 'https://bot/swagger' }
        ]
      }
    ]
  },
  { id: RAIL_BOTTOM_SEPARATOR_ID, type: 'separator' },
  {
    id: 'area-settings', type: 'section', text: 'Settings', children: [
      {
        id: 'settings-sign-in', type: 'link', text: 'Sign-in', link: 'settings/sign-in', children: [
          { id: 'settings-sign-in-identity-providers', type: 'link', text: 'Identity Providers', link: 'identity/identity-providers' }
        ]
      }
    ]
  }
];

/** Flattens the command tree like CommandService.createDrawerItems does. */
function toDrawerItems(items: CommandItem[], selectedId: string | null, parentId?: string): DrawerItem[] {
  return items.flatMap(item => {
    const own = {
      id: item.id,
      parentId,
      text: item.text,
      separator: item.type === 'separator' ? true : undefined,
      selected: item.id === selectedId
    } as DrawerItem;
    return [own, ...toDrawerItems(item.children ?? [], selectedId, item.id)];
  });
}

function routeTree(...data: Record<string, unknown>[]): ActivatedRouteSnapshot {
  let child: ActivatedRouteSnapshot | null = null;
  for (let i = data.length - 1; i >= 0; i--) {
    child = { data: data[i], firstChild: child } as unknown as ActivatedRouteSnapshot;
  }
  return child as ActivatedRouteSnapshot;
}

describe('ShellNavigationService', () => {
  let drawerItems$: BehaviorSubject<DrawerItem[]>;
  let routerEvents$: Subject<unknown>;
  let routerRoot: ActivatedRouteSnapshot;
  let setSelectedDrawerItem: ReturnType<typeof vi.fn>;
  let service: ShellNavigationService;

  const select = (id: string | null): void => drawerItems$.next(toDrawerItems(COMMAND_ITEMS, id));
  const navigateWithData = (...data: Record<string, unknown>[]): void => {
    routerRoot = routeTree(...data);
    routerEvents$.next(new NavigationEnd(1, '/x', '/x'));
  };
  const openedId = (): string => (setSelectedDrawerItem.mock.lastCall![0] as DrawerItem).id as string;

  beforeEach(() => {
    drawerItems$ = new BehaviorSubject<DrawerItem[]>([]);
    routerEvents$ = new Subject<unknown>();
    routerRoot = routeTree({});
    setSelectedDrawerItem = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandService, useValue: { drawerItems: drawerItems$, setSelectedDrawerItem } },
        { provide: CommandSettingsService, useValue: { commandItems: COMMAND_ITEMS } },
        { provide: Router, useValue: { events: routerEvents$, get routerState() { return { snapshot: { root: routerRoot } }; } } }
      ]
    });
    service = TestBed.inject(ShellNavigationService);
  });

  it('splits the areas at the bottom separator', () => {
    select(null);

    expect(service.topAreas().map(a => a.id)).toEqual(['area-home', 'area-integration', 'area-operate']);
    expect(service.bottomAreas().map(a => a.id)).toEqual(['area-settings']);
  });

  it('marks entries as navigable or external from the command items', () => {
    select(null);
    const [home, , operate] = service.topAreas();

    expect(home.children.map(c => [c.id, c.navigable, c.external])).toEqual([
      ['home-cockpit', true, false],
      ['home-app-1', true, true]
    ]);
    const swagger = operate.children.find(c => c.id === 'operate-swagger')!;
    expect(swagger.navigable).toBe(false);
    expect(swagger.children[0].external).toBe(true);
  });

  it('derives the active area and tab from the selected entry', () => {
    select('integration-adapters');

    expect(service.activeArea()?.id).toBe('area-integration');
    expect(service.activeTab()?.id).toBe('integration-adapters');
  });

  it('activates the Settings category of a nested custom page', () => {
    select('settings-sign-in-identity-providers');

    expect(service.activeArea()?.id).toBe('area-settings');
    expect(service.activeTab()?.id).toBe('settings-sign-in');
  });

  it('prefers route data space and tab over the selection', () => {
    select(null);
    navigateWithData({}, { space: 'home' }, { tab: 'cockpit' });

    expect(service.routeData()).toEqual({ space: 'home', tab: 'cockpit' });
    expect(service.activeArea()?.id).toBe('area-home');
    expect(service.activeTab()?.id).toBe('home-cockpit');
  });

  it('flags an object detail page and leads back to the selected list (AB#5547)', () => {
    select('integration-adapters');
    navigateWithData({}, { objectDetail: true }, { runtimeObjectTab: 'configuration' });

    expect(service.objectDetail()).toBe(true);
    expect(service.backTarget()?.id).toBe('integration-adapters');

    navigateWithData({}, { tab: 'overview' });
    expect(service.objectDetail()).toBe(false);
  });

  it('leads back to the nested entry that is selected, not its tab', () => {
    select('settings-sign-in-identity-providers');
    navigateWithData({ objectDetail: true });

    expect(service.activeTab()?.id).toBe('settings-sign-in');
    expect(service.backTarget()?.id).toBe('settings-sign-in-identity-providers');
  });

  it('uses the side navigation instead of the tab strip on every Settings page (AB#5523)', () => {
    select(null);
    navigateWithData({}, { space: 'settings' });

    expect(service.settingsSideNav()).toBe(true);
    expect(service.settingsHomeActive()).toBe(true);
    expect(service.showTabs()).toBe(false);

    // A form / hand-written page of a category: same layout, the category is active.
    navigateWithData({}, { space: 'settings' }, { tab: 'sign-in' });
    expect(service.settingsSideNav()).toBe(true);
    expect(service.settingsHomeActive()).toBe(false);
    expect(service.activeTab()?.id).toBe('settings-sign-in');
    expect(service.showTabs()).toBe(false);

    // A custom page outside /settings that only the selection places in Settings.
    select('settings-sign-in-identity-providers');
    navigateWithData({});
    expect(service.settingsSideNav()).toBe(true);
    expect(service.showTabs()).toBe(false);
  });

  it('keeps the tab strip outside Settings and drops the side navigation on object detail pages', () => {
    select('integration-adapters');
    navigateWithData({});
    expect(service.settingsSideNav()).toBe(false);
    expect(service.settingsHomeActive()).toBe(false);
    expect(service.showTabs()).toBe(true);

    navigateWithData({}, { spaceTabs: false });
    expect(service.showTabs()).toBe(false);

    select('settings-sign-in-identity-providers');
    navigateWithData({ objectDetail: true });
    expect(service.settingsSideNav()).toBe(false);
  });

  it('falls back to the selection when the route names a space the mode does not have', () => {
    select('integration-pools');
    navigateWithData({ space: 'data', tab: 'libraries' });

    expect(service.activeArea()?.id).toBe('area-integration');
    expect(service.activeTab()?.id).toBe('integration-pools');
  });

  it('has no active area for a page outside the navigation', () => {
    select(null);

    expect(service.activeArea()).toBeNull();
    expect(service.activeTab()).toBeNull();
  });

  it('opening an area goes to its first in-app page, skipping external entries', async () => {
    select('home-cockpit');
    const integration = service.topAreas()[1];

    await service.openArea(integration);

    expect(openedId()).toBe('integration-pools');
  });

  it('opening the active area does not navigate', async () => {
    select('integration-adapters');

    await service.openArea(service.topAreas()[1]);

    expect(setSelectedDrawerItem).not.toHaveBeenCalled();
  });

  it('opening a grouping entry opens its first entry, external allowed', async () => {
    select(null);
    const swagger = service.topAreas()[2].children.find(c => c.id === 'operate-swagger')!;

    await service.open(swagger);

    expect(openedId()).toBe('swagger-bot');
  });

  it('opening a navigable entry with children opens the entry itself', async () => {
    select(null);

    await service.open(service.bottomAreas()[0].children[0]);

    expect(openedId()).toBe('settings-sign-in');
  });

  it('openFirstPage opens the first page of the first area', async () => {
    select(null);

    await service.openFirstPage();

    expect(openedId()).toBe('home-cockpit');
  });
});

describe('ShellNavigationService with SHELL_SETTINGS_SPACE', () => {
  const setup = (settingsSpace: string | null) => {
    const drawerItems$ = new BehaviorSubject<DrawerItem[]>([]);
    const routerEvents$ = new Subject<unknown>();
    let routerRoot = routeTree({});
    TestBed.configureTestingModule({
      providers: [
        { provide: CommandService, useValue: { drawerItems: drawerItems$, setSelectedDrawerItem: vi.fn().mockResolvedValue(undefined) } },
        { provide: CommandSettingsService, useValue: { commandItems: COMMAND_ITEMS } },
        { provide: Router, useValue: { events: routerEvents$, get routerState() { return { snapshot: { root: routerRoot } }; } } },
        { provide: SHELL_SETTINGS_SPACE, useValue: settingsSpace }
      ]
    });
    const service = TestBed.inject(ShellNavigationService);
    drawerItems$.next(toDrawerItems(COMMAND_ITEMS, null));
    const navigateTo = (space: string): void => {
      routerRoot = routeTree({ space });
      routerEvents$.next(new NavigationEnd(1, '/x', '/x'));
    };
    return { service, navigateTo };
  };

  it('null: no space uses the side navigation, Settings keeps its tab strip', () => {
    const { service, navigateTo } = setup(null);
    navigateTo('settings');

    expect(service.activeArea()?.id).toBe('area-settings');
    expect(service.settingsSideNav()).toBe(false);
    expect(service.settingsHomeActive()).toBe(false);
    expect(service.showTabs()).toBe(true);
  });

  it('a custom space gets the side navigation instead of Settings', () => {
    const { service, navigateTo } = setup('integration');
    navigateTo('integration');
    expect(service.settingsSideNav()).toBe(true);
    expect(service.showTabs()).toBe(false);

    navigateTo('settings');
    expect(service.settingsSideNav()).toBe(false);
    expect(service.showTabs()).toBe(true);
  });
});

describe('ShellNavigationService helpers', () => {
  const node = (id: string, separator = false): ShellNavNode => ({
    id, text: id, separator, selected: false, active: false, navigable: !separator, external: false, children: []
  });

  it('tidySeparators drops leading, trailing and repeated separators', () => {
    const result = ShellNavigationService.tidySeparators([
      node('s1', true), node('a'), node('s2', true), node('s3', true), node('b'), node('s4', true)
    ]);

    expect(result.map(n => n.id)).toEqual(['a', 's2', 'b']);
  });

  it('readRouteData lets a deeper space reset an outer tab', () => {
    const data = ShellNavigationService.readRouteData(routeTree({ space: 'data', tab: 'libraries' }, { space: 'home' }));

    expect(data).toEqual({ space: 'home', tab: undefined });
  });

  it('readRouteData sets objectDetail only when a route of the chain says so', () => {
    expect(ShellNavigationService.readRouteData(routeTree({ space: 'integration' }, { objectDetail: true }, {})))
      .toEqual({ space: 'integration', tab: undefined, objectDetail: true });
    expect(ShellNavigationService.readRouteData(routeTree({ space: 'integration' }, { objectDetail: 'yes' })))
      .toEqual({ space: 'integration', tab: undefined });
  });

  it('deepestSelected ignores grouping entries and returns null without a selection', () => {
    const group: ShellNavNode = { ...node('g'), navigable: false, selected: true, children: [node('a'), { ...node('b'), selected: true }] };
    expect(ShellNavigationService.deepestSelected(group)?.id).toBe('b');
    expect(ShellNavigationService.deepestSelected({ ...group, children: [node('a')] })).toBeNull();
  });

  it('readRouteData reads spaceTabs, the deepest route wins', () => {
    expect(ShellNavigationService.readRouteData(routeTree({ space: 'settings' }, { spaceTabs: false })))
      .toEqual({ space: 'settings', tab: undefined, spaceTabs: false });
    expect(ShellNavigationService.readRouteData(routeTree({ space: 'settings', spaceTabs: false }, { spaceTabs: true })).spaceTabs)
      .toBe(true);
    expect(ShellNavigationService.readRouteData(routeTree({ space: 'settings' }, {})).spaceTabs).toBeUndefined();
  });

  it('readRouteData handles a missing snapshot', () => {
    expect(ShellNavigationService.readRouteData(undefined)).toEqual({});
  });
});
