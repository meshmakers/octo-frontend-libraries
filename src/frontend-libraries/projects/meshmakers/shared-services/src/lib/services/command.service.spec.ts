import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommandService } from './command.service';
import { CommandSettingsService } from './command-settings.service';
import { CommandOptions } from '../options/commandOptions';

describe('CommandService', () => {
  let service: CommandService;
  let mockRouter: unknown;
  let mockCommandSettingsService: unknown;
  let mockCommandOptions: unknown;

  beforeEach(() => {
    mockRouter = {
      navigate: jasmine.createSpy('navigate')
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

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('drawerItems', () => {
    it('should return an observable', () => {
      expect(service.drawerItems).toBeTruthy();
      expect(typeof service.drawerItems.subscribe).toBe('function');
    });

    it('should emit empty array initially', (done) => {
      service.drawerItems.subscribe(items => {
        expect(items).toEqual([]);
        done();
      });
    });
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
});
