import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';

import {ProgressNotifierService} from './progress-notifier.service';

describe('ProgressNotifierService', () => {
  let service: ProgressNotifierService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProgressNotifierService,
        {provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open'])}
      ]
    });
    service = TestBed.inject(ProgressNotifierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
