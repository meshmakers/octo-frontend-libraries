import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { WindowStateService, WindowDimensions } from './window-state.service';

describe('WindowStateService', () => {
  let service: WindowStateService;

  beforeEach(() => {
    sessionStorage.clear();
    // Remove any leftover backdrop elements from previous tests
    document.querySelectorAll('.mm-window-backdrop').forEach(el => el.remove());
    TestBed.configureTestingModule({});
    service = TestBed.inject(WindowStateService);
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
    it('should capture element bounds and save', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 850, height: 700, x: 0, y: 0, top: 0, left: 0, right: 850, bottom: 700, toJSON: () => ({}) })
      } as HTMLElement;

      service.captureAndSave('captured-dialog', mockElement);
      expect(service.getDimensions('captured-dialog')).toEqual({ width: 850, height: 700 });
    });

    it('should round captured dimensions', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 850.7, height: 700.3, x: 0, y: 0, top: 0, left: 0, right: 850.7, bottom: 700.3, toJSON: () => ({}) })
      } as HTMLElement;

      service.captureAndSave('rounded-dialog', mockElement);
      expect(service.getDimensions('rounded-dialog')).toEqual({ width: 851, height: 700 });
    });

    it('should not save zero-size elements', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 0, height: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) })
      } as HTMLElement;

      service.captureAndSave('zero-dialog', mockElement);
      expect(service.getDimensions('zero-dialog')).toBeNull();
    });
  });

  it('should handle corrupted sessionStorage gracefully', () => {
    sessionStorage.setItem('mm-window-states', 'not-valid-json');
    expect(service.getDimensions('any-key')).toBeNull();
  });

  describe('applyModalBehavior', () => {
    function createMockWindowRef(): { windowRef: Partial<WindowRef>; resultSubject: Subject<WindowCloseResult> } {
      const resultSubject = new Subject<WindowCloseResult>();
      const mockNativeElement = {
        getBoundingClientRect: () => ({ width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => ({}) })
      };
      return {
        resultSubject,
        windowRef: {
          result: resultSubject.asObservable(),
          window: { location: { nativeElement: mockNativeElement } } as unknown as WindowRef['window'],
          content: { instance: {} } as unknown as WindowRef['content'],
          close: jasmine.createSpy('close')
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
