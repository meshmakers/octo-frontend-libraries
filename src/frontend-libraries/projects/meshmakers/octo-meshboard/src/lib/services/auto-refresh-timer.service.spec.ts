import { AutoRefreshTimerService } from './auto-refresh-timer.service';

describe('AutoRefreshTimerService', () => {
  let service: AutoRefreshTimerService;
  let onTick: jasmine.Spy;

  beforeEach(() => {
    jasmine.clock().install();
    service = new AutoRefreshTimerService();
    onTick = jasmine.createSpy('onTick');
  });

  afterEach(() => {
    service.ngOnDestroy();
    jasmine.clock().uninstall();
  });

  describe('starting and stopping', () => {
    it('does not start a timer when seconds = 0', () => {
      service.update(0, true, onTick);
      expect(service.isRunning).toBeFalse();
      jasmine.clock().tick(60_000);
      expect(onTick).not.toHaveBeenCalled();
    });

    it('does not start a timer when the tab is hidden', () => {
      service.update(10, false, onTick);
      expect(service.isRunning).toBeFalse();
      jasmine.clock().tick(60_000);
      expect(onTick).not.toHaveBeenCalled();
    });

    it('starts a timer and fires onTick at the requested interval', () => {
      service.update(5, true, onTick);
      expect(service.isRunning).toBeTrue();
      expect(service.intervalSeconds).toBe(5);

      jasmine.clock().tick(5_000);
      expect(onTick).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(5_000);
      expect(onTick).toHaveBeenCalledTimes(2);

      jasmine.clock().tick(10_000);
      expect(onTick).toHaveBeenCalledTimes(4);
    });

    it('stops the timer and resets state on stop()', () => {
      service.update(10, true, onTick);
      service.stop();
      expect(service.isRunning).toBeFalse();
      expect(service.intervalSeconds).toBe(0);

      jasmine.clock().tick(60_000);
      expect(onTick).not.toHaveBeenCalled();
    });
  });

  describe('reconcile semantics', () => {
    it('is a no-op when called with the same interval and visible state', () => {
      service.update(10, true, onTick);
      jasmine.clock().tick(5_000); // halfway to first tick

      // Second update with same interval should NOT restart the countdown
      service.update(10, true, onTick);

      jasmine.clock().tick(5_000); // total: 10s — the original fire
      expect(onTick).toHaveBeenCalledTimes(1);
    });

    it('restarts the timer when the interval changes', () => {
      service.update(10, true, onTick);
      expect(service.intervalSeconds).toBe(10);

      service.update(2, true, onTick);
      expect(service.intervalSeconds).toBe(2);

      jasmine.clock().tick(2_000);
      expect(onTick).toHaveBeenCalledTimes(1);
    });

    it('stops the timer when visibility transitions to hidden', () => {
      service.update(5, true, onTick);
      jasmine.clock().tick(5_000);
      expect(onTick).toHaveBeenCalledTimes(1);

      service.update(5, false, onTick);
      expect(service.isRunning).toBeFalse();

      jasmine.clock().tick(60_000);
      expect(onTick).toHaveBeenCalledTimes(1); // no further fires
    });

    it('resumes the timer when visibility transitions back to visible', () => {
      service.update(5, false, onTick);
      expect(service.isRunning).toBeFalse();

      service.update(5, true, onTick);
      expect(service.isRunning).toBeTrue();

      jasmine.clock().tick(5_000);
      expect(onTick).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('clears the interval on ngOnDestroy', () => {
      service.update(5, true, onTick);
      service.ngOnDestroy();

      expect(service.isRunning).toBeFalse();
      jasmine.clock().tick(60_000);
      expect(onTick).not.toHaveBeenCalled();
    });

    it('is safe to call stop() multiple times', () => {
      service.update(5, true, onTick);
      service.stop();
      service.stop();
      expect(service.isRunning).toBeFalse();
    });

    it('is safe to call stop() when no timer was started', () => {
      expect(() => service.stop()).not.toThrow();
      expect(service.isRunning).toBeFalse();
    });
  });
});
