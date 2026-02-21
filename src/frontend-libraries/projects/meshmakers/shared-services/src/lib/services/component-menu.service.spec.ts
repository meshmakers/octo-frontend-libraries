import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ComponentMenuService } from './component-menu.service';
import { CommandSettingsService } from './command-settings.service';

describe('ComponentMenuService', () => {
  let service: ComponentMenuService;
  let routerEvents$: Subject<any>;
  let mockActivatedRoute: any;
  let mockRouter: any;
  let mockCommandSettingsService: any;

  beforeEach(() => {
    routerEvents$ = new Subject<any>();

    mockActivatedRoute = {
      root: {
        children: [],
        snapshot: {
          data: {},
          params: {}
        }
      }
    };

    mockRouter = {
      events: routerEvents$.asObservable(),
      navigate: jasmine.createSpy('navigate')
    };

    mockCommandSettingsService = {
      navigateRelativeToRoute: mockActivatedRoute,
      commandItems: []
    };

    TestBed.configureTestingModule({
      providers: [
        ComponentMenuService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: CommandSettingsService, useValue: mockCommandSettingsService }
      ]
    });

    service = TestBed.inject(ComponentMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('menuItems', () => {
    it('should return an observable', () => {
      expect(service.menuItems).toBeTruthy();
      expect(typeof service.menuItems.subscribe).toBe('function');
    });

    it('should emit empty array when no navigation menu data', (done) => {
      service.menuItems.subscribe(items => {
        expect(items).toEqual([]);
        done();
      });
    });
  });
});
