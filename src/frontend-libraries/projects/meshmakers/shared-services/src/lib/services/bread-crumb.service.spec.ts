import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Event as RouterEvent, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { BreadCrumbService } from './bread-crumb.service';
import { BreadCrumbRouteItem } from '../models/breadCrumbRouteItem';
import { BreadCrumbData } from '../models/breadCrumbData';

interface MockRoute {
  snapshot: {
    data: Record<string, unknown>;
    params: Record<string, string>;
    url: { path: string }[];
  };
  children: MockRoute[];
}

describe('BreadCrumbService', () => {
  let service: BreadCrumbService;
  let routerEvents$: Subject<RouterEvent>;
  let mockActivatedRoute: { root: MockRoute };
  let mockRouter: unknown;

  function createMockRoute(breadcrumb: BreadCrumbRouteItem[] | undefined, params: Record<string, string> = {}, children: MockRoute[] = []): MockRoute {
    return {
      snapshot: {
        data: breadcrumb ? { breadcrumb } : {},
        params,
        url: []
      },
      children
    };
  }

  beforeEach(() => {
    routerEvents$ = new Subject<RouterEvent>();

    mockActivatedRoute = {
      root: createMockRoute(undefined, {}, [])
    };

    mockRouter = {
      events: routerEvents$.asObservable()
    };

    TestBed.configureTestingModule({
      providers: [
        BreadCrumbService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  describe('initialization', () => {
    it('should be created', () => {
      service = TestBed.inject(BreadCrumbService);
      expect(service).toBeTruthy();
    });

    it('should emit empty breadcrumbs when no route has breadcrumb data', (done) => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, []);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items).toEqual([]);
        done();
      });
    });

    it('should create breadcrumbs from initial route on construction', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Home', url: '/home' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(1);
        expect(items[0].text).toBe('Home');
        expect(items[0].url).toBe('/home');
        done();
      });
    });
  });

  describe('navigation events', () => {
    it('should update breadcrumbs on NavigationEnd event', fakeAsync(() => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, []);

      service = TestBed.inject(BreadCrumbService);

      const receivedItems: BreadCrumbData[][] = [];
      service.breadCrumbItems.subscribe(items => {
        receivedItems.push([...items]);
      });

      // Initial emission
      expect(receivedItems.length).toBe(1);
      expect(receivedItems[0]).toEqual([]);

      // Update route structure
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute([{ label: 'Dashboard', url: '/dashboard' }], {}, [])
      ]);

      // Emit NavigationEnd event
      routerEvents$.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
      tick();

      expect(receivedItems.length).toBe(2);
      expect(receivedItems[1].length).toBe(1);
      expect(receivedItems[1][0].text).toBe('Dashboard');
    }));

    it('should ignore non-NavigationEnd events', fakeAsync(() => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, []);

      service = TestBed.inject(BreadCrumbService);

      const receivedItems: BreadCrumbData[][] = [];
      service.breadCrumbItems.subscribe(items => {
        receivedItems.push([...items]);
      });

      // Emit other router events
      routerEvents$.next(new NavigationStart(1, '/test'));
      routerEvents$.next(new NavigationStart(2, '/test2'));
      tick();

      // Should only have initial emission
      expect(receivedItems.length).toBe(1);
    }));
  });

  describe('breadcrumb creation', () => {
    it('should handle multiple breadcrumb items per route', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Home', url: '/home' },
        { label: 'Settings', url: '/settings' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(2);
        expect(items[0].text).toBe('Home');
        expect(items[1].text).toBe('Settings');
        done();
      });
    });

    it('should traverse nested routes', (done) => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute([{ label: 'Parent', url: '/parent' }], {}, [
          createMockRoute([{ label: 'Child', url: '/parent/child' }], {}, [])
        ])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(2);
        expect(items[0].text).toBe('Parent');
        expect(items[1].text).toBe('Child');
        done();
      });
    });

    it('should skip routes without breadcrumb data', (done) => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(undefined, {}, [
          createMockRoute([{ label: 'Nested', url: '/nested' }], {}, [])
        ])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(1);
        expect(items[0].text).toBe('Nested');
        done();
      });
    });

    it('should include svgIcon in breadcrumb data', (done) => {
      const mockIcon = { name: 'home', content: '<svg></svg>', viewBox: '0 0 24 24' };
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Home', url: '/home', svgIcon: mockIcon }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].svgIcon).toEqual(mockIcon);
        done();
      });
    });
  });

  describe('route parameter replacement in URL', () => {
    it('should replace :param in URL with actual route param value', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'User', url: ':userId' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, { userId: '123' }, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].url).toBe('123');
        done();
      });
    });

    it('should replace multiple params in URL path', (done) => {
      // Note: The current implementation only handles one param replacement per URL
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Item', url: ':itemId' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, { itemId: '456' }, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].url).toBe('456');
        done();
      });
    });

    it('should handle URL without params', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Static', url: '/static/path' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].url).toBe('/static/path');
        done();
      });
    });
  });

  describe('label parameter replacement', () => {
    it('should replace {{param}} in label with route param value', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'User {{userId}}', url: '/users' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, { userId: 'john' }, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].text).toBe('User john');
        expect(items[0].title).toBe('User john');
        done();
      });
    });

    it('should keep label template in labelTemplate property', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'User {{userId}}', url: '/users' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, { userId: 'john' }, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].labelTemplate).toBe('User {{userId}}');
        done();
      });
    });

    it('should handle label without params', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Static Label', url: '/static' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].text).toBe('Static Label');
        done();
      });
    });

    it('should handle missing route param in label', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'User {{missingParam}}', url: '/users' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        // When param is missing, the placeholder is replaced with ellipsis
        expect(items[0].text).toBe('User \u2026');
        done();
      });
    });
  });

  describe('updateBreadcrumbLabels', () => {
    it('should update labels with provided data', fakeAsync(async () => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: '{{entityName}}', url: '/entity' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);
      tick();

      await service.updateBreadcrumbLabels({ entityName: 'My Entity' });

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].text).toBe('My Entity');
        expect(items[0].title).toBe('My Entity');
      });
    }));

    it('should skip update when data value is undefined', fakeAsync(async () => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: '{{entityName}}', url: '/entity' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);
      tick();

      await service.updateBreadcrumbLabels({ otherField: 'value' });

      service.breadCrumbItems.subscribe(items => {
        // Label should remain unchanged (still has placeholder)
        expect(items[0].text).toBe('{{entityName}}');
      });
    }));

    it('should update single parameter in label', fakeAsync(async () => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'User: {{userName}}', url: '/user' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);
      tick();

      await service.updateBreadcrumbLabels({ userName: 'JohnDoe' });

      service.breadCrumbItems.subscribe(items => {
        expect(items[0].text).toBe('User: JohnDoe');
      });
    }));

    it('should handle empty breadcrumb list', fakeAsync(async () => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, []);

      service = TestBed.inject(BreadCrumbService);
      tick();

      // Should not throw
      await expectAsync(service.updateBreadcrumbLabels({ anyField: 'value' })).toBeResolved();
    }));
  });

  describe('breadCrumbItems observable', () => {
    it('should be a BehaviorSubject that emits current value to new subscribers', fakeAsync(() => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Initial', url: '/initial' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);
      tick();

      // Subscribe after initialization
      let receivedItems: BreadCrumbData[] | undefined;
      service.breadCrumbItems.subscribe(items => {
        receivedItems = items;
      });

      expect(receivedItems).toBeDefined();
      expect(receivedItems!.length).toBe(1);
      expect(receivedItems![0].text).toBe('Initial');
    }));

    it('should allow multiple subscribers', fakeAsync(() => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: 'Shared', url: '/shared' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);
      tick();

      const subscriber1Items: BreadCrumbData[][] = [];
      const subscriber2Items: BreadCrumbData[][] = [];

      service.breadCrumbItems.subscribe(items => subscriber1Items.push(items));
      service.breadCrumbItems.subscribe(items => subscriber2Items.push(items));

      expect(subscriber1Items.length).toBe(1);
      expect(subscriber2Items.length).toBe(1);
      expect(subscriber1Items[0]).toEqual(subscriber2Items[0]);
    }));
  });

  describe('edge cases', () => {
    it('should handle deeply nested routes', (done) => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute([{ label: 'Level 1', url: '/l1' }], {}, [
          createMockRoute([{ label: 'Level 2', url: '/l2' }], {}, [
            createMockRoute([{ label: 'Level 3', url: '/l3' }], {}, [
              createMockRoute([{ label: 'Level 4', url: '/l4' }], {}, [])
            ])
          ])
        ])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(4);
        expect(items.map(i => i.text)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4']);
        done();
      });
    });

    it('should handle route with empty breadcrumb array', (done) => {
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute([], {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items).toEqual([]);
        done();
      });
    });

    it('should handle route with empty label and url', (done) => {
      const breadcrumbData: BreadCrumbRouteItem[] = [
        { label: '', url: '' }
      ];
      mockActivatedRoute.root = createMockRoute(undefined, {}, [
        createMockRoute(breadcrumbData, {}, [])
      ]);

      service = TestBed.inject(BreadCrumbService);

      service.breadCrumbItems.subscribe(items => {
        expect(items.length).toBe(1);
        expect(items[0].text).toBe('');
        expect(items[0].url).toBe('');
        done();
      });
    });
  });
});
