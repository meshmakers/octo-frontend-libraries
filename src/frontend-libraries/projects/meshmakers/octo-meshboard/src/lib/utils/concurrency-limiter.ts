/**
 * Thrown into the promise of a queued task that was dropped by {@link ConcurrencyLimiter.cancelQueued}
 * before it started. Callers that cancel on purpose (a widget reload) ignore it.
 */
export class QueuedTaskCancelledError extends Error {
  constructor() {
    super('Queued request cancelled by a newer load');
    this.name = 'QueuedTaskCancelledError';
  }
}

interface QueuedTask {
  start(): void;
  cancel(): void;
}

/**
 * Runs asynchronous tasks with at most `limit` of them in flight; the rest wait in FIFO order and
 * start as earlier ones settle, whether they resolve or reject (AB#8994).
 *
 * One instance per consumer (e.g. per widget) bounds every request that consumer sends through it,
 * across overlapping loads: requests already in flight keep counting until they settle, so
 * {@link cancelQueued} never lets a newer load exceed the limit.
 */
export class ConcurrencyLimiter {
  private readonly queue: QueuedTask[] = [];
  private active = 0;

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`ConcurrencyLimiter: limit must be a positive integer, got ${limit}`);
    }
  }

  /** Tasks currently in flight. */
  get running(): number {
    return this.active;
  }

  /** Tasks waiting for a free slot. */
  get queued(): number {
    return this.queue.length;
  }

  /** Runs `task` as soon as fewer than `limit` tasks are in flight. */
  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        this.active++;
        let result: Promise<T>;
        try {
          result = task();
        } catch (err) {
          result = Promise.reject(err);
        }
        result.then(resolve, reject).finally(() => {
          this.active--;
          this.next();
        });
      };
      if (this.active < this.limit) {
        start();
      } else {
        this.queue.push({ start, cancel: () => reject(new QueuedTaskCancelledError()) });
      }
    });
  }

  /**
   * Drops every task that has not started yet; their promises reject with
   * {@link QueuedTaskCancelledError}. Tasks in flight are not affected.
   */
  cancelQueued(): void {
    const dropped = this.queue.splice(0, this.queue.length);
    for (const task of dropped) task.cancel();
  }

  private next(): void {
    const task = this.queue.shift();
    task?.start();
  }
}
