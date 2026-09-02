import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WindowService, WindowRef } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { WindowStateService, WindowDimensions } from '../services/window-state.service';
import { MessageDetailsDialogService } from './message-details-dialog.service';
import { MessageDetailsDialogData } from './message-details-dialog.component';

describe('MessageDetailsDialogService', () => {
  let service: MessageDetailsDialogService;
  let windowServiceMock: MockedObject<WindowService>;
  let windowRefMock: MockedObject<WindowRef>;

  beforeEach(() => {
    const mockNativeElement = {
      style: { width: '', height: '' },
      getBoundingClientRect: () => ({ width: 900, height: 600, x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 600, toJSON: () => ({}) })
    };

    windowRefMock = {
      close: vi.fn().mockName('WindowRef.close'),
      result: new Subject().asObservable(),
      content: {
        instance: {
          data: null
        }
      },
      window: { location: { nativeElement: mockNativeElement } }
    } as unknown as MockedObject<WindowRef>;

    windowServiceMock = {
      open: vi.fn().mockName('WindowService.open')
    } as unknown as MockedObject<WindowService>;
    windowServiceMock.open.mockReturnValue(windowRefMock);

    TestBed.configureTestingModule({
      providers: [
        MessageDetailsDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });
    service = TestBed.inject(MessageDetailsDialogService);
    // Pin the viewport clamp in WindowStateService to a large screen — the
    // jsdom window is small and would otherwise shrink the dimensions
    // this spec asserts verbatim.
    const windowState = TestBed.inject(WindowStateService);
    vi.spyOn(windowState as unknown as { viewportSize: () => WindowDimensions }, 'viewportSize').mockReturnValue({ width: 1920, height: 1080 });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showDetailsDialog', () => {
    it('should open window with MessageDetailsDialogComponent', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      expect(windowServiceMock.open).toHaveBeenCalled();
    });

    it('should pass data to component instance', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'warning'
      };

      service.showDetailsDialog(data);

      const component = windowRefMock.content.instance;
      expect(component.data).toEqual(data);
    });

    it('should return WindowRef', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      const result = service.showDetailsDialog(data);

      expect(result).toBe(windowRefMock);
    });

    it('should open window with resizable enabled and correct dimensions', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      const openCall = vi.mocked(windowServiceMock.open).mock.lastCall![0];
      expect(openCall.minWidth).toBe(500);
      expect(openCall.width).toBe(900);
      expect(openCall.resizable).toBe(true);
    });

    it('should set title from data directly', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      const openCall = vi.mocked(windowServiceMock.open).mock.lastCall![0];
      expect(openCall.title).toBe('Test Title');
    });
  });
});
