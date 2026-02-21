import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';

import {ConfirmationService} from './confirmation.service';

describe('ConfirmationService', () => {
  let service: ConfirmationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfirmationService,
        {provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open'])}
      ]
    });
    service = TestBed.inject(ConfirmationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
