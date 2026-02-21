import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommandService } from './command.service';
import { CommandSettingsService } from './command-settings.service';
import { CommandOptions } from '../options/commandOptions';

describe('CommandService', () => {
  let service: CommandService;
  let mockRouter: any;
  let mockCommandSettingsService: any;
  let mockCommandOptions: any;

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
});
