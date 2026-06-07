import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AiAdapterClientService } from './ai-adapter-client.service';
import { AiSessionStreamService } from './ai-session-stream.service';
import { provideOctoAiConsole } from './ai-adapter-options';
import { AiSessionEventDto } from '../models/ai-session-event';

describe('AiSessionStreamService', () => {
  let service: AiSessionStreamService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideOctoAiConsole({
          baseUrl: 'https://ai.test',
          tenantId: 'acme',
          hubPath: 'hubs/ai',
        }),
        AiAdapterClientService,
        AiSessionStreamService,
      ],
    });
    service = TestBed.inject(AiSessionStreamService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exposes the tenant-scoped hub URL combining baseUrl + tenantId + hubPath', () => {
    // hubPath was supplied without a leading slash in this test; service must
    // still produce a valid absolute URL. tenantId is rendered between baseUrl
    // and hubPath to match the AI Adapter's hub mapping
    // (`/{tenantId:tenantId}/aiHub`).
    expect(service.hubUrl).toBe('https://ai.test/acme/hubs/ai');
  });

  it('streamSession backfills events from listEvents on open', (done) => {
    const events: AiSessionEventDto[] = [
      {
        sessionId: 's',
        kind: 'Message',
        sequence: 1,
        payload: 'hello',
        actorRef: 'agent',
        at: '2026-01-01T00:00:00Z',
      },
    ];

    const stream = service.streamSession('s');
    stream.events$.subscribe((event) => {
      expect(event.sequence).toBe(1);
      stream.disconnect();
      done();
    });

    const req = httpMock.expectOne(
      'https://ai.test/acme/v1/sessions/s/events',
    );
    req.flush(events);
  });
});
