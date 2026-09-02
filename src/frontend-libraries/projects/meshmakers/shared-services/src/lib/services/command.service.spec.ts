import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { DrawerItem } from '@progress/kendo-angular-layout';
import { CommandService } from './command.service';
import { CommandSettingsService } from './command-settings.service';
import { CommandOptions } from '../options/commandOptions';

interface MutableMockRouter {
  navigate: jasmine.Spy;
  events: Subject<unknown>;
  url: string;
}

describe('CommandService', () => {
  let service: CommandService;
  let mockRouter: MutableMockRouter;
  let mockCommandSettingsService: unknown;
  let mockCommandOptions: unknown;

  beforeEach(() => {
    mockRouter = {
      navigate: jasmine.createSpy('navigate'),
      events: new Subject<unknown>(),
      url: '/'
    };

    mockCommandSettingsService = {
      navigateRelativeToRoute: {},
      commandItems: []
    };

    mockCommandOptions = {};

    TestBed.configureTestingModule({
      providers: [
        CommandService,
        { provide: Router, useValue: mockRouter },
        { provide: CommandSettingsService, useValue: mockCommandSettingsService },
        { provide: CommandOptions, useValue: mockCommandOptions }
      ]
    });

    service = TestBed.inject(CommandService);
  });

  /** Emits a NavigationEnd for the given URL and waits for the async selection update. */
  async function navigateTo(url: string): Promise<void> {
    mockRouter.url = url;
    mockRouter.events.next(new NavigationEnd(1, url, url));
    // The selection update resolves command links asynchronously.
    await new Promise(resolve => setTimeout(resolve));
  }

  function selectedIds(items: DrawerItem[]): unknown[] {
    return items.filter(item => item.selected === true).map(item => item.id);
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('drawerItems', () => {
    it('should return an observable', () => {
      expect(service.drawerItems).toBeTruthy();
      expect(typeof service.drawerItems.subscribe).toBe('function');
    });

    it('should emit empty array initially', () => new Promise<void>((done) => {
      service.drawerItems.subscribe(items => {
        expect(items).toEqual([]);
        done();
      });
    }));
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expectAsync(service.initialize()).toBeResolved();
    });
  });

  describe('createDrawerItems hierarchy markers', () => {
    it('should emit cssClass mm-drawer-level-N matching the nesting depth', async () => {
      (mockCommandSettingsService as { commandItems: unknown[] }).commandItems = [
        {
          id: 'a',
          type: 'link',
          text: 'A',
          children: [
            {
              id: 'b',
              type: 'link',
              text: 'B',
              children: [
                { id: 'c', type: 'link', text: 'C' }
              ]
            }
          ]
        }
      ];

      await service.initialize();

      const items = await new Promise<{ id: unknown; cssClass: unknown }[]>(resolve => {
        service.drawerItems.subscribe(emitted => {
          resolve(emitted as { id: unknown; cssClass: unknown }[]);
        });
      });

      expect(items.length).toBe(3);
      expect(items.find(i => i.id === 'a')?.cssClass).toBe('mm-drawer-level-0');
      expect(items.find(i => i.id === 'b')?.cssClass).toBe('mm-drawer-level-1');
      expect(items.find(i => i.id === 'c')?.cssClass).toBe('mm-drawer-level-2');
    });
  });

  describe('route-driven selection', () => {
    beforeEach(() => {
      // Mirrors a typical app setup: a home entry pointing at the route root
      // plus flat list entries, navigating relative to a ':lang' child route.
      (mockCommandSettingsService as { commandItems: unknown[]; navigateRelativeToRoute: unknown }).commandItems = [
        { id: 'home', type: 'link', text: 'Home', link: './' },
        { id: 'documents', type: 'link', text: 'Documents', link: 'documents' },
        { id: 'separator-1', type: 'separator', text: '' },
        { id: 'settings', type: 'link', text: 'Settings', link: async () => 'settings' },
        { id: 'action', type: 'link', text: 'Action', onClick: async () => undefined }
      ];
      (mockCommandSettingsService as { navigateRelativeToRoute: unknown }).navigateRelativeToRoute = {
        snapshot: {
          pathFromRoot: [
            { url: [] },
            { url: [{ path: 'de-AT' }] }
          ]
        }
      };
    });

    it('should select the entry matching the initial URL on initialize', async () => {
      mockRouter.url = '/de-AT/documents';

      await service.initialize();

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['documents']);
    });

    it('should keep the list entry selected on its child routes', async () => {
      mockRouter.url = '/de-AT/documents/4711?tab=details';

      await service.initialize();

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['documents']);
    });

    it('should select the root link only when nothing more specific matches', async () => {
      mockRouter.url = '/de-AT';

      await service.initialize();

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['home']);
    });

    it('should resolve async links when matching', async () => {
      mockRouter.url = '/de-AT/settings';

      await service.initialize();

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['settings']);
    });

    it('should move the selection when the router navigates', async () => {
      mockRouter.url = '/de-AT';
      await service.initialize();

      await navigateTo('/de-AT/documents');

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['documents']);
    });

    it('should clear the selection for a URL outside every command link', async () => {
      mockRouter.url = '/de-AT/documents';
      await service.initialize();

      await navigateTo('/webform-complete');

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual([]);
    });

    it('should not select onClick-only entries', async () => {
      mockRouter.url = '/de-AT/action';

      await service.initialize();

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual([]);
    });

    it('should stop reacting to router events after destroy', async () => {
      mockRouter.url = '/de-AT';
      await service.initialize();

      service.ngOnDestroy();
      await navigateTo('/de-AT/documents');

      const items = await firstValueFrom(service.drawerItems);
      expect(selectedIds(items)).toEqual(['home']);
    });
  });
});
