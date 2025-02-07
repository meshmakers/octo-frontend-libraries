import {TestBed} from '@angular/core/testing';

import {OctoMessageService} from './octo-message.service';

describe('MessageService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: OctoMessageService = TestBed.get(OctoMessageService);
    expect(service).toBeTruthy();
  });
});
