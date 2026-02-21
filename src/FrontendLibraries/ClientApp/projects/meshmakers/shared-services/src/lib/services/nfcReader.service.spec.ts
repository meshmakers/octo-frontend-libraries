import { TestBed } from '@angular/core/testing';

import { NfcReaderService } from './nfcReader.service';

describe('NfcReaderService', () => {
  let service: NfcReaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NfcReaderService]
    });
    service = TestBed.inject(NfcReaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
