import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';

import {FileUploadService} from './file-upload.service';

describe('FileUploadService', () => {
  let service: FileUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FileUploadService,
        {provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open'])}
      ]
    });
    service = TestBed.inject(FileUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
