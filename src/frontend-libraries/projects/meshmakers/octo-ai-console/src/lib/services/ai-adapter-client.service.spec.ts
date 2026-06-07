import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AiAdapterClientService } from './ai-adapter-client.service';
import { provideOctoAiConsole } from './ai-adapter-options';
import { CreateSessionRequestDto } from '../models/ai-session';
import { AiApprovalDecisionDto } from '../models/ai-approval';

describe('AiAdapterClientService', () => {
  let service: AiAdapterClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideOctoAiConsole({
          baseUrl: 'https://ai.test',
          tenantId: 'acme',
          hubPath: '/hubs/ai',
        }),
      ],
    });
    service = TestBed.inject(AiAdapterClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listSessions GETs the tenant-scoped sessions route', () => {
    service.listSessions().subscribe();
    const req = httpMock.expectOne('https://ai.test/acme/v1/sessions');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBeNull();
    req.flush([]);
  });

  it('listSessions appends ?status= when supplied', () => {
    service.listSessions('Running').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'https://ai.test/acme/v1/sessions' &&
        r.params.get('status') === 'Running',
    );
    expect(req.request.params.get('status')).toBe('Running');
    req.flush([]);
  });

  it('createSession POSTs the request body to the tenant route', () => {
    const body: CreateSessionRequestDto = { goal: 'test', jobKind: 'DataModel' };
    service.createSession(body).subscribe();
    const req = httpMock.expectOne('https://ai.test/acme/v1/sessions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ session: {}, quota: {} });
  });

  it('decideApproval composes session + request ids into the URL', () => {
    const decision: AiApprovalDecisionDto = { outcome: 'Approved', comment: 'lgtm' };
    service.decideApproval('sess-1', 'req-2', decision).subscribe();
    const req = httpMock.expectOne(
      'https://ai.test/acme/v1/sessions/sess-1/approvals/req-2',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(decision);
    req.flush(null);
  });

  it('listEvents appends sinceSequence when provided', () => {
    service.listEvents('sess-1', 42).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'https://ai.test/acme/v1/sessions/sess-1/events' &&
        r.params.get('sinceSequence') === '42',
    );
    expect(req.request.params.get('sinceSequence')).toBe('42');
    req.flush([]);
  });
});
