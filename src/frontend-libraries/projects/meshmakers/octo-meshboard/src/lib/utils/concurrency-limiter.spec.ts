import { ConcurrencyLimiter, QueuedTaskCancelledError } from './concurrency-limiter';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Lets every pending promise callback run. */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('ConcurrencyLimiter (AB#8994)', () => {
  it('rejects a limit below one', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow(/positive integer/);
    expect(() => new ConcurrencyLimiter(1.5)).toThrow(/positive integer/);
  });

  it('keeps at most `limit` tasks in flight and starts queued tasks in FIFO order as earlier ones settle', async () => {
    const limiter = new ConcurrencyLimiter(3);
    const tasks = Array.from({ length: 10 }, () => deferred<number>());
    const started: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const results = tasks.map((task, i) => limiter.run(async () => {
      started.push(i);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        return await task.promise;
      } finally {
        inFlight--;
      }
    }));

    await flush();
    expect(started).toEqual([0, 1, 2]);
    expect(limiter.running).toBe(3);
    expect(limiter.queued).toBe(7);

    for (let i = 0; i < tasks.length; i++) {
      tasks[i].resolve(i * 10);
      await flush();
    }

    expect(await Promise.all(results)).toEqual(tasks.map((_, i) => i * 10));
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maxInFlight).toBe(3);
    expect(limiter.running).toBe(0);
  });

  it('a rejected task frees its slot: the queue keeps going', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const first = limiter.run(() => Promise.reject(new Error('boom')));
    const second = limiter.run(() => Promise.resolve('ok'));

    await expect(first).rejects.toThrow(/^boom$/);
    await expect(second).resolves.toBe('ok');
  });

  it('a task that throws synchronously rejects its promise and frees its slot', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const first = limiter.run((): Promise<string> => { throw new Error('sync'); });
    const second = limiter.run(() => Promise.resolve('ok'));

    await expect(first).rejects.toThrow(/^sync$/);
    await expect(second).resolves.toBe('ok');
  });

  it('cancelQueued drops the waiting tasks, never starts them, and leaves tasks in flight alone', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const running = [deferred<string>(), deferred<string>()];
    const startedQueued = vi.fn();

    const inFlight = running.map(d => limiter.run(() => d.promise));
    const queued = [limiter.run(async () => { startedQueued(); return 'x'; }), limiter.run(async () => { startedQueued(); return 'y'; })];
    await flush();

    limiter.cancelQueued();
    expect(limiter.queued).toBe(0);
    for (const q of queued) await expect(q).rejects.toBeInstanceOf(QueuedTaskCancelledError);

    // In-flight tasks still count against the limit until they settle.
    expect(limiter.running).toBe(2);
    running.forEach((d, i) => d.resolve(`r${i}`));
    expect(await Promise.all(inFlight)).toEqual(['r0', 'r1']);
    await flush();
    expect(startedQueued).not.toHaveBeenCalled();
    expect(limiter.running).toBe(0);
  });

  it('a task queued after cancelQueued still runs', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const blocker = deferred<void>();
    const first = limiter.run(() => blocker.promise);
    const dropped = limiter.run(() => Promise.resolve('dropped'));
    limiter.cancelQueued();
    const next = limiter.run(() => Promise.resolve('next'));

    blocker.resolve();
    await first;
    await expect(dropped).rejects.toBeInstanceOf(QueuedTaskCancelledError);
    await expect(next).resolves.toBe('next');
  });
});
