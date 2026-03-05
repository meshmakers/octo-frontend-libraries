import {TestBed} from '@angular/core/testing';

import {AppConfigurationService} from './configuration.service';

describe('AppConfigurationService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service = TestBed.inject(AppConfigurationService);
    expect(service).toBeTruthy();
  });
});
