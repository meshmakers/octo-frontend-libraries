import { TestBed } from '@angular/core/testing';

import { MacoSchemeDecoderService } from "./macoSchemeDecoder.service";

describe('MacoSchemeDecoderService', () => {
  let service: MacoSchemeDecoderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MacoSchemeDecoderService]
    });
    service = TestBed.inject(MacoSchemeDecoderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
