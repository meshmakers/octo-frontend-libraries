import {TestBed} from '@angular/core/testing';

import {MessageService} from './message.service';

describe('MessageService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [MessageService]
  }));

  it('should be created', () => {
    const service: MessageService = TestBed.inject(MessageService);
    expect(service).toBeTruthy();
  });
});
