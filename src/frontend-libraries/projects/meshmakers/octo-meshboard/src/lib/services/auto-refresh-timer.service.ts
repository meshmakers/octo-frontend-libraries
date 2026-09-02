import { Injectable, OnDestroy } from '@angular/core';

/**
 * Manages a `setInterval` lifecycle for MeshBoard auto-refresh.
 *
 * Encapsulates the three things the consumer otherwise has to track manually:
 * - clearing the previous interval before starting a new one,
 * - skipping the restart when the same interval is already active, and
 * - pausing the timer on tab-hidden / resuming on visible.
 *
 * The service has no Angular signal or component dependency — it's a thin
 * stateful wrapper around `setInterval`, which lets it be unit-tested with
 * `vi.useFakeTimers()` without standing up a TestBed.
 *
 * Provide at the component level (`providers: [AutoRefreshTimerService]`) so
 * each MeshBoard view gets its own timer instance; `ngOnDestroy` clears the
 * underlying interval automatically.
 */
@Injectable()
export class AutoRefreshTimerService implements OnDestroy {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private activeSeconds = 0;

  /**
   * Reconcile the timer to the requested state.
   *
   * - `seconds <= 0` OR `!isVisible` → stop any active timer.
   * - Timer already running at the requested interval → no-op (avoids a
   *   stop/start ping that would reset the countdown to the next tick).
   * - Otherwise → stop the old timer, start a new one that calls `onTick`
   *   every `seconds` seconds.
   */
  update(seconds: number, isVisible: boolean, onTick: () => void): void {
    if (seconds <= 0 || !isVisible) {
      this.stop();
      return;
    }

    if (this.timerId !== null && this.activeSeconds === seconds) {
      return;
    }

    this.stop();
    this.activeSeconds = seconds;
    this.timerId = setInterval(onTick, seconds * 1000);
  }

  /** Stops the active timer, if any. Safe to call when no timer is running. */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.activeSeconds = 0;
  }

  /** True while an interval is active. */
  get isRunning(): boolean {
    return this.timerId !== null;
  }

  /** The interval in seconds for the currently active timer (0 when stopped). */
  get intervalSeconds(): number {
    return this.activeSeconds;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
