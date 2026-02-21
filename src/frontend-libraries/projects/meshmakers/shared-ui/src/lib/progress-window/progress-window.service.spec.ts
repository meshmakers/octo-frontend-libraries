import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { ProgressWindowService } from './progress-window.service';
import { ProgressValue } from '../models/progressValue';

describe('ProgressWindowService', () => {
  let service: ProgressWindowService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let progressSubject: Subject<ProgressValue>;

  beforeEach(() => {
    progressSubject = new Subject<ProgressValue>();

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: new Subject().asObservable(),
      content: {
        instance: {
          isDeterminate: true,
          progress: null,
          isCancelOperationAvailable: false,
          cancelOperation: null
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    TestBed.configureTestingModule({
      providers: [
        ProgressWindowService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });
    service = TestBed.inject(ProgressWindowService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showProgress', () => {
    it('should open dialog with progress window component', () => {
      const progress = progressSubject.asObservable();
      service.showProgress({
        title: 'Test Title',
        progress
      });

      expect(dialogServiceMock.open).toHaveBeenCalled();
      const openCall = dialogServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.title).toBe('Test Title');
    });

    it('should pass isDeterminate to component', () => {
      const progress = progressSubject.asObservable();
      service.showProgress({
        title: 'Title',
        progress,
        isDeterminate: true
      });

      const component = dialogRefMock.content.instance;
      expect(component.isDeterminate).toBeTrue();
    });

    it('should pass progress observable to component', () => {
      const progress = progressSubject.asObservable();
      service.showProgress({
        title: 'Title',
        progress
      });

      const component = dialogRefMock.content.instance;
      expect(component.progress).toBe(progress);
    });

    it('should pass cancel operation to component when available', () => {
      const progress = progressSubject.asObservable();
      const cancelFn = jasmine.createSpy('cancelOperation');

      service.showProgress({
        title: 'Title',
        progress,
        isCancelOperationAvailable: true,
        cancelOperation: cancelFn
      });

      const component = dialogRefMock.content.instance;
      expect(component.isCancelOperationAvailable).toBeTrue();
      expect(component.cancelOperation).toBe(cancelFn);
    });

    it('should return DialogRef', () => {
      const progress = progressSubject.asObservable();
      const result = service.showProgress({
        title: 'Title',
        progress
      });

      expect(result).toBe(dialogRefMock);
    });
  });

  describe('showDeterminateProgress', () => {
    it('should set isDeterminate to true', () => {
      const progress = progressSubject.asObservable();
      service.showDeterminateProgress('Title', progress);

      const component = dialogRefMock.content.instance;
      expect(component.isDeterminate).toBeTrue();
    });

    it('should pass optional options', () => {
      const progress = progressSubject.asObservable();
      const cancelFn = jasmine.createSpy('cancelOperation');

      service.showDeterminateProgress('Title', progress, {
        isCancelOperationAvailable: true,
        cancelOperation: cancelFn
      });

      const component = dialogRefMock.content.instance;
      expect(component.isCancelOperationAvailable).toBeTrue();
    });
  });

  describe('showIndeterminateProgress', () => {
    it('should set isDeterminate to false', () => {
      const progress = progressSubject.asObservable();
      service.showIndeterminateProgress('Title', progress);

      const component = dialogRefMock.content.instance;
      expect(component.isDeterminate).toBeFalse();
    });

    it('should pass optional options', () => {
      const progress = progressSubject.asObservable();
      const cancelFn = jasmine.createSpy('cancelOperation');

      service.showIndeterminateProgress('Title', progress, {
        isCancelOperationAvailable: true,
        cancelOperation: cancelFn
      });

      const component = dialogRefMock.content.instance;
      expect(component.isCancelOperationAvailable).toBeTrue();
    });
  });
});
