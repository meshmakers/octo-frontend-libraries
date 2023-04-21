import { TestBed } from '@angular/core/testing';

import { OctoUiService } from './octo-ui.service';

describe('OctoUiService', () => {
  let service: OctoUiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OctoUiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
