import {TestBed} from '@angular/core/testing';

import {ProgressNotifierService} from './progress-notifier.service';

describe('ProgressNotifierService', () => {
  let service: ProgressNotifierService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProgressNotifierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
