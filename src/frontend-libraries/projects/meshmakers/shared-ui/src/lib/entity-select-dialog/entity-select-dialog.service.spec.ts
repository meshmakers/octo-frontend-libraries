import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WindowService, WindowCloseResult, WindowRef } from '@progress/kendo-angular-dialog';
import { Subject, of } from 'rxjs';

import { WindowStateService, WindowDimensions } from '../services/window-state.service';
import { EntitySelectDialogService } from './entity-select-dialog.service';
import { EntitySelectDialogDataSource, EntitySelectDialogResult } from './entity-select-dialog-data-source';

describe('EntitySelectDialogService', () => {
  let service: EntitySelectDialogService;
  let windowServiceMock: MockedObject<WindowService>;
  let resultSubject: Subject<EntitySelectDialogResult<string> | WindowCloseResult>;
  let mockWindowRef: Partial<WindowRef>;
  let mockDataSource: EntitySelectDialogDataSource<string>;

  beforeEach(() => {
    sessionStorage.clear();
    resultSubject = new Subject<EntitySelectDialogResult<string> | WindowCloseResult>();

    const mockNativeElement = {
      style: { width: '800px', height: '600px' }
    };

    mockWindowRef = {
      result: resultSubject.asObservable(),
      content: {
        instance: {
          dataSource: null,
          multiSelect: false,
          preSelectedEntities: []
        }
      } as unknown as WindowRef['content'],
      close: vi.fn().mockName('close'),
      window: { location: { nativeElement: mockNativeElement } } as unknown as WindowRef['window']
    };

    windowServiceMock = {
      open: vi.fn().mockName('WindowService.open')
    } as unknown as MockedObject<WindowService>;
    windowServiceMock.open.mockReturnValue(mockWindowRef as WindowRef);

    mockDataSource = {
      getColumns: () => [],
      fetchData: () => of({ data: [], totalCount: 0 }),
      onDisplayEntity: (entity: string) => entity,
      getIdEntity: (entity: string) => entity
    };

    TestBed.configureTestingModule({
      providers: [
        EntitySelectDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });
    service = TestBed.inject(EntitySelectDialogService);
    // Pin the viewport clamp in WindowStateService to a large screen — the
    // jsdom window is small and would otherwise shrink the widths
    // these specs assert verbatim.
    const windowState = TestBed.inject(WindowStateService);
    vi.spyOn(windowState as unknown as { viewportSize: () => WindowDimensions }, 'viewportSize').mockReturnValue({ width: 1920, height: 1080 });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('open', () => {
    it('should open dialog with title', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select Entity'
      });

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalled();
      const openCall = vi.mocked(windowServiceMock.open).mock.lastCall![0];
      expect(openCall.title).toBe('Select Entity');
    });

    it('should pass dataSource to component', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const component = (mockWindowRef.content as {
                instance: Record<string, unknown>;
            }).instance;
      expect(component['dataSource']).toBe(mockDataSource);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should return selected entities on confirm', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const expectedResult: EntitySelectDialogResult<string> = {
        selectedEntities: ['entity1', 'entity2']
      };

      resultSubject.next(expectedResult);
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toEqual(expectedResult);
    });

    it('should return null when dialog is cancelled', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should set multiSelect when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        multiSelect: true
      });

      const component = (mockWindowRef.content as {
                instance: Record<string, unknown>;
            }).instance;
      expect(component['multiSelect']).toBe(true);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should set preSelectedEntities when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        selectedEntities: ['entity1', 'entity2']
      });

      const component = (mockWindowRef.content as {
                instance: Record<string, unknown>;
            }).instance;
      expect(component['preSelectedEntities']).toEqual(['entity1', 'entity2']);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should use default width and height when not provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const openCall = vi.mocked(windowServiceMock.open).mock.lastCall![0];
      expect(openCall.width).toBe(900);
      expect(openCall.height).toBe(640);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should use custom width and height when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        width: 1000,
        height: 700
      });

      const openCall = vi.mocked(windowServiceMock.open).mock.lastCall![0];
      expect(openCall.width).toBe(1000);
      expect(openCall.height).toBe(700);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });
  });
});
