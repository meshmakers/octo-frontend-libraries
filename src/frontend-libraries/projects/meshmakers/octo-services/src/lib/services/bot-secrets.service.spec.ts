import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { BotSecretsService } from './bot-secrets.service';
import { CONFIGURATION_SERVICE } from './configuration.service';
import { SecretEnvironmentStatusDto, SecretSweepRunDto } from '../shared/secretAdministrationDtos';

describe('BotSecretsService', () => {
  const baseUrl = 'https://bot.example.com/';
  let service: BotSecretsService;
  let httpMock: HttpTestingController;
  let config: { config: { botServices: string } | null };

  beforeEach(() => {
    config = { config: { botServices: baseUrl } };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: CONFIGURATION_SERVICE, useValue: config },
      ],
    });
    service = TestBed.inject(BotSecretsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the environment status of the tenant route', async () => {
    const status: SecretEnvironmentStatusDto = {
      keyRingConfigured: true, activeKeyId: 'k1', knownKeyIds: ['k1'], legacyV1KeyConfigured: true,
      strictMode: false, strictModeSince: null, recurringVerifyCron: '0 3 * * *', lastVerifyAt: null,
    };
    const promise = service.getSecretEnvironmentStatus('meshmakers');
    const req = httpMock.expectOne(`${baseUrl}meshmakers/v1/secrets/status`);
    expect(req.request.method).toBe('GET');
    req.flush(status);
    expect(await promise).toEqual(status);
  });

  it('starts a Verify sweep without confirm', async () => {
    const promise = service.startSecretSweep('meshmakers', 'Verify');
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}meshmakers/v1/jobs/secret-sweep`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('mode')).toBe('Verify');
    expect(req.request.params.has('confirm')).toBe(false);
    req.flush({ jobId: 'job-1' });
    expect(await promise).toEqual({ jobId: 'job-1' });
  });

  it('sends confirm=true for a confirmed Encrypt / CleanupUnreadable sweep', async () => {
    const promise = service.startSecretSweep('meshmakers', 'CleanupUnreadable', true);
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}meshmakers/v1/jobs/secret-sweep`);
    expect(req.request.params.get('mode')).toBe('CleanupUnreadable');
    expect(req.request.params.get('confirm')).toBe('true');
    req.flush({ jobId: 'job-2' });
    await promise;
  });

  it('rethrows 400 ConfirmationRequired', async () => {
    const promise = service.startSecretSweep('meshmakers', 'Encrypt');
    httpMock.expectOne((r) => r.url.endsWith('jobs/secret-sweep'))
      .flush({ code: 'ConfirmationRequired' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('lists sweep runs with a limit', async () => {
    const runs = [{ runId: 'r1', mode: 'Verify' } as SecretSweepRunDto];
    const promise = service.getSecretSweepRuns('meshmakers', 10);
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}meshmakers/v1/secrets/sweep-runs`);
    expect(req.request.params.get('limit')).toBe('10');
    req.flush(runs);
    expect(await promise).toEqual(runs);
  });

  it('maps the dump delete answers 204 / 404 / 409', async () => {
    const url = `${baseUrl}meshmakers/v1/secrets/sweep-runs/r%2F1/dump`;
    const deleted = service.deleteSecretSweepDump('meshmakers', 'r/1');
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await deleted).toBe('Deleted');

    const missing = service.deleteSecretSweepDump('meshmakers', 'r/1');
    httpMock.expectOne(url).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await missing).toBe('NotFound');

    const gone = service.deleteSecretSweepDump('meshmakers', 'r/1');
    httpMock.expectOne(url).flush(null, { status: 409, statusText: 'Conflict' });
    expect(await gone).toBe('AlreadyDeleted');

    const forbidden = service.deleteSecretSweepDump('meshmakers', 'r/1');
    httpMock.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(forbidden).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('returns null without a bot service URL', async () => {
    config.config = null;
    expect(await service.getSecretEnvironmentStatus('t')).toBeNull();
    expect(await service.startSecretSweep('t', 'Verify')).toBeNull();
    expect(await service.getSecretSweepRuns('t')).toBeNull();
    expect(await service.deleteSecretSweepDump('t', 'r')).toBeNull();
  });
});
