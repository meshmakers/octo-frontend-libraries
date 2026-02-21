import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject, of } from 'rxjs';

import { EntitySelectDialogService } from './entity-select-dialog.service';
import {
  EntitySelectDialogDataSource,
  EntitySelectDialogResult
} from './entity-select-dialog-data-source';

describe('EntitySelectDialogService', () => {
  let service: EntitySelectDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let resultSubject: Subject<EntitySelectDialogResult<string> | object>;
  let mockDataSource: EntitySelectDialogDataSource<string>;

  beforeEach(() => {
    resultSubject = new Subject<EntitySelectDialogResult<string> | object>();

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: resultSubject.asObservable(),
      content: {
        instance: {
          dataSource: null,
          multiSelect: false,
          preSelectedEntities: []
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    mockDataSource = {
      getColumns: () => [],
      fetchData: () => of({ data: [], totalCount: 0 }),
      onDisplayEntity: (entity: string) => entity,
      getIdEntity: (entity: string) => entity
    };

    TestBed.configureTestingModule({
      providers: [
        EntitySelectDialogService,
        { provide: DialogService, useValue: dialogServiceMock }
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

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;

      expect(dialogServiceMock.open).toHaveBeenCalled();
      const openCall = dialogServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.title).toBe('Select Entity');
    });

    it('should pass dataSource to component', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const component = dialogRefMock.content.instance;
      expect(component.dataSource).toBe(mockDataSource);

      resultSubject.next({});
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

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should set multiSelect when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        multiSelect: true
      });

      const component = dialogRefMock.content.instance;
      expect(component.multiSelect).toBeTrue();

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should set preSelectedEntities when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        selectedEntities: ['entity1', 'entity2']
      });

      const component = dialogRefMock.content.instance;
      expect(component.preSelectedEntities).toEqual(['entity1', 'entity2']);

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should use default width and height when not provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select'
      });

      const openCall = dialogServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.width).toBe(800);
      expect(openCall.height).toBe(600);

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should use custom width and height when provided', async () => {
      const resultPromise = service.open(mockDataSource, {
        title: 'Select',
        width: 1000,
        height: 700
      });

      const openCall = dialogServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.width).toBe(1000);
      expect(openCall.height).toBe(700);

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });
  });
});
