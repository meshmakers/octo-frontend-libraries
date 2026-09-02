import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { WindowStateService, WindowDimensions } from './window-state.service';

describe('WindowStateService', () => {
  let service: WindowStateService;
  let viewportSpy: Mock<() => WindowDimensions>;

  beforeEach(() => {
    sessionStorage.clear();
    // Remove any leftover backdrop elements from previous tests
    document.querySelectorAll('.mm-window-backdrop').forEach(el => el.remove());
    TestBed.configureTestingModule({});
    service = TestBed.inject(WindowStateService);
    // Pin the viewport seam to a large screen so the viewport clamp in
    // resolveWindowSize is inert for the classic persistence specs (the jsdom
    // window is small); the clamp itself has dedicated specs below.
    viewportSpy = vi.spyOn(service as unknown as { viewportSize: () => WindowDimensions }, 'viewportSize').mockReturnValue({ width: 1920, height: 1080 });
  });

  afterEach(() => {
    sessionStorage.clear();
    document.querySelectorAll('.mm-window-backdrop').forEach(el => el.remove());
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when no saved state exists', () => {
    expect(service.getDimensions('nonexistent')).toBeNull();
  });

  it('should save and retrieve dimensions', () => {
    const dims: WindowDimensions = { width: 800, height: 600 };
    service.saveDimensions('test-dialog', dims);
    expect(service.getDimensions('test-dialog')).toEqual(dims);
  });

  it('should persist to sessionStorage', () => {
    service.saveDimensions('test-dialog', { width: 800, height: 600 });
    const stored = JSON.parse(sessionStorage.getItem('mm-window-states')!);
    expect(stored['test-dialog']).toEqual({ width: 800, height: 600 });
  });

  it('should clear dimensions for a specific key', () => {
    service.saveDimensions('dialog-a', { width: 800, height: 600 });
    service.saveDimensions('dialog-b', { width: 900, height: 700 });
    service.clearDimensions('dialog-a');
    expect(service.getDimensions('dialog-a')).toBeNull();
    expect(service.getDimensions('dialog-b')).toEqual({ width: 900, height: 700 });
  });

  it('should resolve to defaults when no saved state exists', () => {
    const defaults: WindowDimensions = { width: 700, height: 500 };
    expect(service.resolveWindowSize('new-dialog', defaults)).toEqual(defaults);
  });

  it('should resolve to saved dimensions when available', () => {
    const saved: WindowDimensions = { width: 1000, height: 800 };
    service.saveDimensions('saved-dialog', saved);
    const defaults: WindowDimensions = { width: 700, height: 500 };
    expect(service.resolveWindowSize('saved-dialog', defaults)).toEqual(saved);
  });

  it('should fall back to defaults when saved dimensions are below min', () => {
    service.saveDimensions('stale-dialog', { width: 400, height: 300 });
    const defaults: WindowDimensions = { width: 900, height: 640 };
    const min: WindowDimensions = { width: 550, height: 400 };
    expect(service.resolveWindowSize('stale-dialog', defaults, min)).toEqual(defaults);
  });

  it('should return saved dimensions unchanged when above min', () => {
    const saved: WindowDimensions = { width: 1000, height: 700 };
    service.saveDimensions('valid-dialog', saved);
    const defaults: WindowDimensions = { width: 900, height: 640 };
    const min: WindowDimensions = { width: 550, height: 400 };
    expect(service.resolveWindowSize('valid-dialog', defaults, min)).toEqual(saved);
  });

  describe('viewport clamp', () => {
    it('clamps defaults that exceed the viewport (24px margin per side)', () => {
      viewportSpy.mockReturnValue({ width: 700, height: 600 });
      const defaults: WindowDimensions = { width: 760, height: 760 };
      expect(service.resolveWindowSize('small-screen', defaults)).toEqual({
        width: 700 - 48,
        height: 600 - 48
      });
    });

    it('clamps stored sizes captured on a larger screen', () => {
      service.saveDimensions('roamer', { width: 1400, height: 900 });
      viewportSpy.mockReturnValue({ width: 1024, height: 700 });
      expect(service.resolveWindowSize('roamer', { width: 700, height: 500 })).toEqual({
        width: 1024 - 48,
        height: 700 - 48
      });
      // The stored size stays untouched — a larger screen restores it.
      expect(service.getDimensions('roamer')).toEqual({ width: 1400, height: 900 });
    });

    it('wins over the dialog minimum on very small viewports', () => {
      viewportSpy.mockReturnValue({ width: 500, height: 480 });
      const defaults: WindowDimensions = { width: 760, height: 760 };
      const min: WindowDimensions = { width: 540, height: 480 };
      expect(service.resolveWindowSize('tiny', defaults, min)).toEqual({
        width: 500 - 48,
        height: 480 - 48
      });
    });

    it('never clamps below the hard floor', () => {
      viewportSpy.mockReturnValue({ width: 200, height: 180 });
      expect(service.resolveWindowSize('nano', { width: 760, height: 760 })).toEqual({
        width: 280,
        height: 240
      });
    });

    it('leaves sizes that already fit untouched', () => {
      viewportSpy.mockReturnValue({ width: 1920, height: 1080 });
      const defaults: WindowDimensions = { width: 760, height: 760 };
      expect(service.resolveWindowSize('fits', defaults)).toEqual(defaults);
    });
  });

  it('should keep multiple dialog keys independent', () => {
    service.saveDimensions('dialog-1', { width: 100, height: 200 });
    service.saveDimensions('dialog-2', { width: 300, height: 400 });
    expect(service.getDimensions('dialog-1')).toEqual({ width: 100, height: 200 });
    expect(service.getDimensions('dialog-2')).toEqual({ width: 300, height: 400 });
  });

  it('should overwrite previously saved dimensions', () => {
    service.saveDimensions('dialog', { width: 100, height: 200 });
    service.saveDimensions('dialog', { width: 500, height: 600 });
    expect(service.getDimensions('dialog')).toEqual({ width: 500, height: 600 });
  });

  describe('captureAndSave', () => {
    function mockElementWithStyle(width: string, height: string): HTMLElement {
      return { style: { width, height } } as HTMLElement;
    }

    it('should capture inline style dimensions and save', () => {
      service.captureAndSave('captured-dialog', mockElementWithStyle('850px', '700px'));
      expect(service.getDimensions('captured-dialog')).toEqual({ width: 850, height: 700 });
    });

    it('should round captured dimensions', () => {
      service.captureAndSave('rounded-dialog', mockElementWithStyle('850.7px', '700.3px'));
      expect(service.getDimensions('rounded-dialog')).toEqual({ width: 851, height: 700 });
    });

    it('should not save zero-size elements', () => {
      service.captureAndSave('zero-dialog', mockElementWithStyle('0px', '0px'));
      expect(service.getDimensions('zero-dialog')).toBeNull();
    });

    it('should not save when inline style is missing', () => {
      service.captureAndSave('empty-dialog', mockElementWithStyle('', ''));
      expect(service.getDimensions('empty-dialog')).toBeNull();
    });
  });

  it('should handle corrupted sessionStorage gracefully', () => {
    sessionStorage.setItem('mm-window-states', 'not-valid-json');
    expect(service.getDimensions('any-key')).toBeNull();
  });

  describe('applyModalBehavior', () => {
    function createMockWindowRef(): {
            windowRef: Partial<WindowRef>;
            resultSubject: Subject<WindowCloseResult>;
            } {
      const resultSubject = new Subject<WindowCloseResult>();
      const mockNativeElement = {
        style: { width: '800px', height: '600px' }
      };
      return {
        resultSubject,
        windowRef: {
          result: resultSubject.asObservable(),
          window: { location: { nativeElement: mockNativeElement } } as unknown as WindowRef['window'],
          content: { instance: {} } as unknown as WindowRef['content'],
          close: vi.fn().mockName('close')
        }
      };
    }

    it('should show backdrop when dialog opens', () => {
      const { windowRef } = createMockWindowRef();
      service.applyModalBehavior('test', windowRef as WindowRef);

      const backdrop = document.querySelector('.mm-window-backdrop') as HTMLElement;
      expect(backdrop).toBeTruthy();
      expect(backdrop.style.display).toBe('block');
    });

    it('should hide backdrop when dialog closes', () => {
      const { windowRef, resultSubject } = createMockWindowRef();
      service.applyModalBehavior('test', windowRef as WindowRef);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();

      const backdrop = document.querySelector('.mm-window-backdrop') as HTMLElement;
      expect(backdrop.style.display).toBe('none');
    });

    it('should save dimensions when dialog closes', () => {
      const { windowRef, resultSubject } = createMockWindowRef();
      service.applyModalBehavior('modal-test', windowRef as WindowRef);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();

      expect(service.getDimensions('modal-test')).toEqual({ width: 800, height: 600 });
    });

    it('should keep backdrop visible when multiple dialogs are open', () => {
      const mock1 = createMockWindowRef();
      const mock2 = createMockWindowRef();

      service.applyModalBehavior('dialog-1', mock1.windowRef as WindowRef);
      service.applyModalBehavior('dialog-2', mock2.windowRef as WindowRef);

      // Close first dialog
      mock1.resultSubject.next(new WindowCloseResult());
      mock1.resultSubject.complete();

      const backdrop = document.querySelector('.mm-window-backdrop') as HTMLElement;
      expect(backdrop.style.display).toBe('block');

      // Close second dialog
      mock2.resultSubject.next(new WindowCloseResult());
      mock2.resultSubject.complete();

      expect(backdrop.style.display).toBe('none');
    });

    it('should hide backdrop on error', () => {
      const { windowRef, resultSubject } = createMockWindowRef();
      service.applyModalBehavior('test', windowRef as WindowRef);

      resultSubject.error(new Error('test'));

      const backdrop = document.querySelector('.mm-window-backdrop') as HTMLElement;
      expect(backdrop.style.display).toBe('none');
    });

    it('should set backdrop z-index below Kendo Window', () => {
      const { windowRef } = createMockWindowRef();
      service.applyModalBehavior('test', windowRef as WindowRef);

      const backdrop = document.querySelector('.mm-window-backdrop') as HTMLElement;
      expect(backdrop.style.zIndex).toBe('11499');
    });
  });
});
