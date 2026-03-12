import { TestBed } from '@angular/core/testing';
import { WindowService, WindowCloseResult, WindowRef } from '@progress/kendo-angular-dialog';
import { Subject, of } from 'rxjs';

import { EntitySelectDialogService } from './entity-select-dialog.service';
import {
  EntitySelectDialogDataSource,
  EntitySelectDialogResult
} from './entity-select-dialog-data-source';

describe('EntitySelectDialogService', () => {
  let service: EntitySelectDialogService;
  let windowServiceMock: jasmine.SpyObj<WindowService>;
  let resultSubject: Subject<EntitySelectDialogResult<string> | WindowCloseResult>;
  let mockWindowRef: Partial<WindowRef>;
  let mockDataSource: EntitySelectDialogDataSource<string>;

  beforeEach(() => {
    sessionStorage.clear();
    resultSubject = new Subject<EntitySelectDialogResult<string> | WindowCloseResult>();

    const mockNativeElement = {
      getBoundingClientRect: () => ({ width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => ({}) })
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
      close: jasmine.createSpy('close'),
      window: { location: { nativeElement: mockNativeElement } } as unknown as WindowRef['window']
    };

    windowServiceMock = jasmine.createSpyObj('WindowService', ['open']);
    windowServiceMock.open.and.returnValue(mockWindowRef as WindowRef);

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
      const openCall = windowServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.title).toBe('Select Entity');
    });

    it('should pass dataSource to component', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const component = (mockWindowRef.content as { instance: Record<string, unknown> }).instance;
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

      const component = (mockWindowRef.content as { instance: Record<string, unknown> }).instance;
      expect(component['multiSelect']).toBeTrue();

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should set preSelectedEntities when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        selectedEntities: ['entity1', 'entity2']
      });

      const component = (mockWindowRef.content as { instance: Record<string, unknown> }).instance;
      expect(component['preSelectedEntities']).toEqual(['entity1', 'entity2']);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });

    it('should use default width and height when not provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const openCall = windowServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.width).toBe(800);
      expect(openCall.height).toBe(600);

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

      const openCall = windowServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.width).toBe(1000);
      expect(openCall.height).toBe(700);

      resultSubject.next(new WindowCloseResult());
      resultSubject.complete();
      await resultPromise;
    });
  });
});
