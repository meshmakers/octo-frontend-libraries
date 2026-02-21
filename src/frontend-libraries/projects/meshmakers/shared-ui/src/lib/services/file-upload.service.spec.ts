import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { FileUploadService } from './file-upload.service';
import { FileUploadResult } from '../models/confirmation';

describe('FileUploadService', () => {
  let service: FileUploadService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let resultSubject: Subject<FileUploadResult | object>;

  beforeEach(() => {
    resultSubject = new Subject<FileUploadResult | object>();

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: resultSubject.asObservable(),
      content: {
        instance: {
          message: '',
          mimeTypes: null,
          fileExtensions: null
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    TestBed.configureTestingModule({
      providers: [
        FileUploadService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });
    service = TestBed.inject(FileUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showUploadDialog', () => {
    it('should return the file when user selects and confirms', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const resultPromise = service.showUploadDialog('Title', 'Message');

      expect(dialogServiceMock.open).toHaveBeenCalled();

      const uploadResult = new FileUploadResult(mockFile);
      resultSubject.next(uploadResult);
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(mockFile);
    });

    it('should return null when dialog is cancelled', async () => {
      const resultPromise = service.showUploadDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should pass message to component', async () => {
      const resultPromise = service.showUploadDialog('Title', 'Test Message');

      const component = dialogRefMock.content.instance;
      expect(component.message).toBe('Test Message');

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should pass mimeTypes to component when provided', async () => {
      const resultPromise = service.showUploadDialog('Title', 'Message', 'application/json');

      const component = dialogRefMock.content.instance;
      expect(component.mimeTypes).toBe('application/json');

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should pass fileExtensions to component when provided', async () => {
      const resultPromise = service.showUploadDialog('Title', 'Message', null, '.json,.xml');

      const component = dialogRefMock.content.instance;
      expect(component.fileExtensions).toBe('.json,.xml');

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });

    it('should pass both mimeTypes and fileExtensions when provided', async () => {
      const resultPromise = service.showUploadDialog('Title', 'Message', 'image/*', '.png,.jpg');

      const component = dialogRefMock.content.instance;
      expect(component.mimeTypes).toBe('image/*');
      expect(component.fileExtensions).toBe('.png,.jpg');

      resultSubject.next({});
      resultSubject.complete();
      await resultPromise;
    });
  });
});
