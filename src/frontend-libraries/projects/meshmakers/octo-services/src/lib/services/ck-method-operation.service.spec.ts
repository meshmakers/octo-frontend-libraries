import { TestBed } from '@angular/core/testing';
import { of, Subscription, throwError } from 'rxjs';
import {
  CK_METHOD_OPERATION_POLLING,
  CkMethodOperationItem,
  CkMethodOperationEvent,
  CkMethodOperationNotFoundError,
  CkMethodOperationService
} from './ck-method-operation.service';
import { GetCkMethodOperationsDtoGQL } from '../graphQL/getCkMethodOperations';
import { CkMethodOperationStateDto } from '../graphQL/globalTypes';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';

describe('CkMethodOperationService (AB#8448)', () => {
  let fetch: ReturnType<typeof vi.fn>;
  let service: CkMethodOperationService;

  const operation = (state: CkMethodOperationStateDto, extra: Partial<CkMethodOperationItem> = {}): CkMethodOperationItem => ({
    operationId: 'op-1',
    methodId: 'System.Bot/TenantRepository.Dump-1',
    invocationId: 'inv-1',
    state,
    acceptedAtUtc: '2026-11-14T06:29:12Z',
    progress: null,
    result: null,
    error: null,
    ...extra
  });
  const answer = (op: CkMethodOperationItem) => of({ data: { runtime: { operations: { totalCount: 1, items: [op] } } } });
  const notFound = () => throwError(() => ({
    errors: [{ message: 'The operation was not found.', extensions: { code: 'OPERATION_NOT_FOUND' } }]
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    fetch = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: GetCkMethodOperationsDtoGQL, useValue: { fetch } },
        { provide: CK_METHOD_OPERATION_POLLING, useValue: { minIntervalMs: 2_000, defaultIntervalMs: 5_000, maxBackoffMs: 20_000 } }
      ]
    });
    service = TestBed.inject(CkMethodOperationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function collect(events: CkMethodOperationEvent[], retryAfterSeconds?: number | null): { sub: Subscription; done: () => boolean } {
    let completed = false;
    const sub = service.follow('op-1', { retryAfterSeconds }).subscribe({
      next: e => events.push(e),
      complete: () => (completed = true)
    });
    return { sub, done: () => completed };
  }

  it('reads one operation silently (no toast) and without cache', async () => {
    fetch.mockReturnValue(answer(operation(CkMethodOperationStateDto.RunningDto)));
    const op = await service.getOperation('op-1');
    expect(op.state).toBe(CkMethodOperationStateDto.RunningDto);
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
      variables: { operationId: 'op-1' },
      fetchPolicy: 'no-cache',
      context: { [OCTO_SILENT_ERRORS]: true }
    }));
  });

  it('turns OPERATION_NOT_FOUND into CkMethodOperationNotFoundError', async () => {
    fetch.mockReturnValue(notFound());
    await expect(service.getOperation('op-1')).rejects.toBeInstanceOf(CkMethodOperationNotFoundError);
  });

  it('lists the caller\'s or, with allOwners, every caller\'s operations', async () => {
    fetch.mockReturnValue(answer(operation(CkMethodOperationStateDto.SucceededDto)));
    const page = await service.listOperations({ allOwners: true, skip: 20, take: 10 });
    expect(page.totalCount).toBe(1);
    expect(fetch.mock.lastCall![0].variables).toEqual(expect.objectContaining({ allOwners: true, skip: 20, take: 10 }));
  });

  it('polls with retryAfterSeconds of the handle and completes on a final state', async () => {
    fetch
      .mockReturnValueOnce(answer(operation(CkMethodOperationStateDto.RunningDto, { progress: { percent: 40, stageCode: 'DUMPING_DATABASE', parameters: [] } })))
      .mockReturnValueOnce(answer(operation(CkMethodOperationStateDto.SucceededDto)));
    const events: CkMethodOperationEvent[] = [];
    const { done } = collect(events, 3);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(events.map(e => e.kind)).toEqual(['update', 'update']);
    expect(done()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reads at once and uses the default interval without a handle (after a reload)', async () => {
    fetch.mockReturnValue(answer(operation(CkMethodOperationStateDto.RunningDto)));
    const events: CkMethodOperationEvent[] = [];
    const { sub } = collect(events);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    sub.unsubscribe();
  });

  it('never polls faster than the minimum interval', async () => {
    fetch.mockReturnValue(answer(operation(CkMethodOperationStateDto.RunningDto)));
    const events: CkMethodOperationEvent[] = [];
    const { sub } = collect(events, 0.5);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    sub.unsubscribe();
  });

  it('stops polling when the subscriber unsubscribes', async () => {
    fetch.mockReturnValue(answer(operation(CkMethodOperationStateDto.RunningDto)));
    const events: CkMethodOperationEvent[] = [];
    const { sub } = collect(events);
    await vi.advanceTimersByTimeAsync(0);
    sub.unsubscribe();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('emits notFound once and stops for an expired or unknown operation', async () => {
    fetch.mockReturnValue(notFound());
    const events: CkMethodOperationEvent[] = [];
    const { done } = collect(events);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual([{ kind: 'notFound', operationId: 'op-1' }]);
    expect(done()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially on network errors (capped) and recovers', async () => {
    fetch
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValue(answer(operation(CkMethodOperationStateDto.FailedDto)));
    const events: CkMethodOperationEvent[] = [];
    const { done } = collect(events);
    await vi.advanceTimersByTimeAsync(0);
    const retries = () => events.filter(e => e.kind === 'connectionLost').map(e => (e as { retryInMs: number }).retryInMs);
    expect(retries()).toEqual([10_000]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(retries()).toEqual([10_000, 20_000]);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(retries()).toEqual([10_000, 20_000, 20_000]);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(events.at(-1)?.kind).toBe('update');
    expect(done()).toBe(true);
  });

  it('stops polling on a permanent read error (GraphQL refusal or HTTP 403) instead of retrying', async () => {
    fetch.mockReturnValue(throwError(() => ({ errors: [{ message: 'refused', extensions: { code: 'OPERATION_QUERY_REFUSED' } }] })));
    const events: CkMethodOperationEvent[] = [];
    const { done } = collect(events);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(events.map(e => e.kind)).toEqual(['readFailed']);
    expect(done()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    expect(CkMethodOperationService.isTransientError({ statusCode: 403 })).toBe(false);
    expect(CkMethodOperationService.isTransientError({ status: 404 })).toBe(false);
  });

  it('treats network errors, 0, 408, 429 and 5xx as transient', () => {
    expect(CkMethodOperationService.isTransientError(new Error('Failed to fetch'))).toBe(true);
    expect(CkMethodOperationService.isTransientError({ status: 0 })).toBe(true);
    expect(CkMethodOperationService.isTransientError({ statusCode: 503 })).toBe(true);
    expect(CkMethodOperationService.isTransientError({ status: 429 })).toBe(true);
    expect(CkMethodOperationService.isTransientError({ status: 408 })).toBe(true);
  });

  it('recognises a lost handler only for METHOD_OUTCOME_UNKNOWN with reason handler-lost', () => {
    const lost = operation(CkMethodOperationStateDto.FailedDto, {
      error: { code: 'METHOD_OUTCOME_UNKNOWN', parameters: [{ name: 'reason', value: 'handler-lost' }], details: [] }
    });
    const other = operation(CkMethodOperationStateDto.FailedDto, {
      error: { code: 'DUMP_FAILED', parameters: [{ name: 'jobId', value: 'j' }], details: [] }
    });
    expect(CkMethodOperationService.isHandlerLost(lost)).toBe(true);
    expect(CkMethodOperationService.isHandlerLost(other)).toBe(false);
    expect(CkMethodOperationService.isFinal(CkMethodOperationStateDto.AcceptedDto)).toBe(false);
    expect(CkMethodOperationService.isFinal(CkMethodOperationStateDto.SucceededDto)).toBe(true);
  });
});
