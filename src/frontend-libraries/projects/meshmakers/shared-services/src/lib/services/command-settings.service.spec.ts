import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CommandSettingsService } from './command-settings.service';

describe('CommandSettingsService', () => {
  let service: CommandSettingsService;
  let mockActivatedRoute: unknown;

  beforeEach(() => {
    mockActivatedRoute = {
      snapshot: {
        data: {},
        params: {}
      }
    };

    TestBed.configureTestingModule({
      providers: [
        CommandSettingsService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    });

    service = TestBed.inject(CommandSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return navigateRelativeToRoute', () => {
    expect(service.navigateRelativeToRoute).toBe(mockActivatedRoute as ActivatedRoute);
  });

  it('should return empty commandItems array', () => {
    expect(service.commandItems).toEqual([]);
  });
});
