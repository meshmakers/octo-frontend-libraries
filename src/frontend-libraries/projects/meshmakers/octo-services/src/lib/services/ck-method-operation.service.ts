import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { CkMethodOperationStateDto } from '../graphQL/globalTypes';
import {
  GetCkMethodOperationsDtoGQL,
  GetCkMethodOperationsQueryDto,
  GetCkMethodOperationsQueryVariablesDto
} from '../graphQL/getCkMethodOperations';
import { OCTO_SILENT_ERRORS } from '../shared/octo-error-link';

/** One operation of an asynchronous CK method as `runtime.operations` returns it (AB#8444). */
export type CkMethodOperationItem = NonNullable<
  NonNullable<NonNullable<GetCkMethodOperationsQueryDto['runtime']>['operations']>['items']
>[number];

/** `runtime.operations` refuses an unknown, expired or foreign operation id with this code. */
export const OPERATION_NOT_FOUND_CODE = 'OPERATION_NOT_FOUND';
/** Error code of an operation whose handler was lost; the outcome is unknown and the platform never re-runs it. */
export const METHOD_OUTCOME_UNKNOWN_CODE = 'METHOD_OUTCOME_UNKNOWN';
/** `reason` parameter of {@link METHOD_OUTCOME_UNKNOWN_CODE} when the handler stopped before it finished. */
export const HANDLER_LOST_REASON = 'handler-lost';

/** Thrown by {@link CkMethodOperationService.getOperation} for `OPERATION_NOT_FOUND`. */
export class CkMethodOperationNotFoundError extends Error {
  constructor(public readonly operationId: string) {
    super(`The operation '${operationId}' is no longer available.`);
    this.name = 'CkMethodOperationNotFoundError';
  }
}

/** Filter and page of {@link CkMethodOperationService.listOperations}. */
export interface CkMethodOperationListRequest {
  /** Every caller's operations of the tenant (tenant administrators only); default: the caller's own. */
  allOwners?: boolean;
  /** Qualified, version-less method id, e.g. `System.Bot/TenantRepository.Dump-1`. */
  methodId?: string | null;
  state?: CkMethodOperationStateDto | null;
  /** Only operations accepted at or after this time. */
  since?: Date | null;
  skip?: number;
  /** 1–200, server default 50. */
  take?: number;
}

/** One page of operations, newest accepted first. */
export interface CkMethodOperationPage {
  items: CkMethodOperationItem[];
  totalCount: number;
}

/** What {@link CkMethodOperationService.follow} emits. */
export type CkMethodOperationEvent =
  /** The current state of the operation (emitted on every successful read). */
  | { kind: 'update'; operation: CkMethodOperationItem }
  /** The operation id is unknown, expired or not readable; following stops. */
  | { kind: 'notFound'; operationId: string }
  /** A read failed (network, server); the next try follows after `retryInMs`. */
  | { kind: 'connectionLost'; error: unknown; retryInMs: number };

/** Options of {@link CkMethodOperationService.follow}. */
export interface CkMethodOperationFollowOptions {
  /**
   * `retryAfterSeconds` of the handle the mutation returned: the delay before the first read and the polling
   * interval. Without it (e.g. after a page reload) the first read runs at once and the default interval applies.
   */
  retryAfterSeconds?: number | null;
}

/** Polling limits of {@link CkMethodOperationService.follow}. */
export interface CkMethodOperationPollingOptions {
  /** Lower bound of the polling interval, whatever the handle suggests. */
  minIntervalMs: number;
  /** Interval when no `retryAfterSeconds` is known. */
  defaultIntervalMs: number;
  /** Upper bound of the backoff after failed reads. */
  maxBackoffMs: number;
}

/** Default polling limits: at least 2 s, 5 s without a hint, backoff up to 60 s. */
export const DEFAULT_CK_METHOD_OPERATION_POLLING: CkMethodOperationPollingOptions = {
  minIntervalMs: 2_000,
  defaultIntervalMs: 5_000,
  maxBackoffMs: 60_000
};

/** Overrides the polling limits (tests, special hosts). */
export const CK_METHOD_OPERATION_POLLING = new InjectionToken<CkMethodOperationPollingOptions>(
  'CK_METHOD_OPERATION_POLLING',
  { providedIn: 'root', factory: () => DEFAULT_CK_METHOD_OPERATION_POLLING }
);

/**
 * Reads and follows the operations of asynchronous CK methods (AB#8448, Feature F3.6) through
 * `runtime.operations` of the tenant's GraphQL endpoint (AB#8444).
 *
 * - {@link getOperation} — one operation by id; `OPERATION_NOT_FOUND` becomes {@link CkMethodOperationNotFoundError}.
 * - {@link listOperations} — the caller's operations (or, with `allOwners`, every caller's — tenant administrators).
 * - {@link follow} — polls one operation until it is final, not found any more, or the subscriber unsubscribes.
 *   The interval follows the handle's `retryAfterSeconds` (at least {@link CkMethodOperationPollingOptions.minIntervalMs});
 *   failed reads back off exponentially up to {@link CkMethodOperationPollingOptions.maxBackoffMs}. There is no time
 *   limit: the state of the operation decides when following ends.
 *
 * Reads run with {@link OCTO_SILENT_ERRORS}: a failed read never raises a toast, the caller shows the state itself
 * (no toast loop while the network is down or after the operation expired).
 */
@Injectable({ providedIn: 'root' })
export class CkMethodOperationService {
  private readonly getOperationsGQL = inject(GetCkMethodOperationsDtoGQL);
  private readonly polling = inject(CK_METHOD_OPERATION_POLLING);

  /** True for SUCCEEDED and FAILED (a final operation never changes again). */
  static isFinal(state: CkMethodOperationStateDto | null | undefined): boolean {
    return state === CkMethodOperationStateDto.SucceededDto || state === CkMethodOperationStateDto.FailedDto;
  }

  /** True when the operation failed because its handler was lost (`METHOD_OUTCOME_UNKNOWN`, reason `handler-lost`). */
  static isHandlerLost(operation: Pick<CkMethodOperationItem, 'state' | 'error'> | null | undefined): boolean {
    return operation?.state === CkMethodOperationStateDto.FailedDto &&
      operation.error?.code === METHOD_OUTCOME_UNKNOWN_CODE &&
      CkMethodOperationService.parameter(operation.error.parameters, 'reason') === HANDLER_LOST_REASON;
  }

  /** Value of the named parameter, or null. */
  static parameter(parameters: readonly { name: string; value: string }[] | null | undefined, name: string): string | null {
    return parameters?.find(p => p.name === name)?.value ?? null;
  }

  /** True when the error is the GraphQL error `OPERATION_NOT_FOUND`. */
  static isNotFoundError(error: unknown): boolean {
    return graphQlErrorCodes(error).includes(OPERATION_NOT_FOUND_CODE);
  }

  /**
   * Reads one operation.
   *
   * @throws CkMethodOperationNotFoundError when the id is unknown, expired or not readable for the caller.
   */
  async getOperation(operationId: string): Promise<CkMethodOperationItem> {
    let result: Awaited<ReturnType<CkMethodOperationService['fetch']>>;
    try {
      result = await this.fetch({ operationId });
    } catch (error) {
      if (CkMethodOperationService.isNotFoundError(error)) {
        throw new CkMethodOperationNotFoundError(operationId);
      }
      throw error;
    }
    const operation = result.data?.runtime?.operations?.items?.[0];
    if (!operation) {
      throw new CkMethodOperationNotFoundError(operationId);
    }
    return operation;
  }

  /** Reads one page of operations, newest accepted first. */
  async listOperations(request: CkMethodOperationListRequest = {}): Promise<CkMethodOperationPage> {
    const result = await this.fetch({
      allOwners: request.allOwners ?? false,
      methodId: request.methodId ?? null,
      state: request.state ?? null,
      since: request.since ?? null,
      skip: request.skip ?? 0,
      take: request.take ?? 50
    });
    const connection = result.data?.runtime?.operations;
    return { items: connection?.items ?? [], totalCount: connection?.totalCount ?? 0 };
  }

  /**
   * Follows one operation: emits its state after every read, completes after a final state or `notFound`, and stops
   * polling when the subscriber unsubscribes.
   */
  follow(operationId: string, options: CkMethodOperationFollowOptions = {}): Observable<CkMethodOperationEvent> {
    const hintMs = options.retryAfterSeconds != null && options.retryAfterSeconds > 0
      ? options.retryAfterSeconds * 1000
      : null;
    const intervalMs = Math.max(this.polling.minIntervalMs, hintMs ?? this.polling.defaultIntervalMs);
    const firstDelayMs = hintMs === null ? 0 : intervalMs;

    return new Observable<CkMethodOperationEvent>(subscriber => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      let failures = 0;

      const schedule = (delayMs: number): void => {
        if (!stopped) {
          timer = setTimeout(() => void read(), delayMs);
        }
      };

      const read = async (): Promise<void> => {
        try {
          const operation = await this.getOperation(operationId);
          if (stopped) return;
          failures = 0;
          subscriber.next({ kind: 'update', operation });
          if (CkMethodOperationService.isFinal(operation.state)) {
            subscriber.complete();
            return;
          }
          schedule(intervalMs);
        } catch (error) {
          if (stopped) return;
          if (error instanceof CkMethodOperationNotFoundError) {
            subscriber.next({ kind: 'notFound', operationId });
            subscriber.complete();
            return;
          }
          failures++;
          const retryInMs = Math.min(this.polling.maxBackoffMs, intervalMs * 2 ** failures);
          subscriber.next({ kind: 'connectionLost', error, retryInMs });
          schedule(retryInMs);
        }
      };

      schedule(firstDelayMs);
      return () => {
        stopped = true;
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      };
    });
  }

  private fetch(variables: GetCkMethodOperationsQueryVariablesDto) {
    return firstValueFrom(this.getOperationsGQL.fetch({
      variables,
      fetchPolicy: 'no-cache',
      context: { [OCTO_SILENT_ERRORS]: true }
    }));
  }
}

/** `extensions.code` values of every GraphQL error entry an Apollo call failed with (structural, no `instanceof`). */
function graphQlErrorCodes(error: unknown): string[] {
  const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
  const entries = Array.isArray(record?.['errors'])
    ? (record['errors'] as unknown[])
    : Array.isArray(record?.['graphQLErrors']) ? (record['graphQLErrors'] as unknown[]) : [];
  return entries
    .map(entry => (entry as { extensions?: Record<string, unknown> } | null)?.extensions?.['code'])
    .filter((code): code is string => typeof code === 'string');
}
