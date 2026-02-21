import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { ConfirmationService } from './confirmation.service';
import { ButtonTypes, ConfirmationWindowResult, DialogType } from '../models/confirmation';

describe('ConfirmationService', () => {
  let service: ConfirmationService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let resultSubject: Subject<ConfirmationWindowResult | object>;

  beforeEach(() => {
    resultSubject = new Subject<ConfirmationWindowResult | object>();

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: resultSubject.asObservable(),
      content: {
        instance: {
          data: null
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    TestBed.configureTestingModule({
      providers: [
        ConfirmationService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });
    service = TestBed.inject(ConfirmationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showYesNoConfirmationDialog', () => {
    it('should return true when user clicks Yes', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      expect(dialogServiceMock.open).toHaveBeenCalled();

      // Emit Yes result
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Yes));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeTrue();
    });

    it('should return false when user clicks No', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      // Emit No result
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.No));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeFalse();
    });

    it('should return false when dialog is closed without selection', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      // Emit empty object (dialog closed)
      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeFalse();
    });

    it('should pass YesNo dialog type to component', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Test Title', 'Test Message');

      const component = dialogRefMock.content.instance;
      expect(component.data.title).toBe('Test Title');
      expect(component.data.message).toBe('Test Message');
      expect(component.data.dialogType).toBe(DialogType.YesNo);

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Yes));
      resultSubject.complete();
      await resultPromise;
    });
  });

  describe('showYesNoCancelConfirmationDialog', () => {
    it('should return ConfirmationWindowResult with Yes', async () => {
      const resultPromise = service.showYesNoCancelConfirmationDialog('Title', 'Message');

      const expectedResult = new ConfirmationWindowResult(ButtonTypes.Yes);
      resultSubject.next(expectedResult);
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toEqual(expectedResult);
      expect(result?.result).toBe(ButtonTypes.Yes);
    });

    it('should return ConfirmationWindowResult with No', async () => {
      const resultPromise = service.showYesNoCancelConfirmationDialog('Title', 'Message');

      const expectedResult = new ConfirmationWindowResult(ButtonTypes.No);
      resultSubject.next(expectedResult);
      resultSubject.complete();

      const result = await resultPromise;
      expect(result?.result).toBe(ButtonTypes.No);
    });

    it('should return ConfirmationWindowResult with Cancel', async () => {
      const resultPromise = service.showYesNoCancelConfirmationDialog('Title', 'Message');

      const expectedResult = new ConfirmationWindowResult(ButtonTypes.Cancel);
      resultSubject.next(expectedResult);
      resultSubject.complete();

      const result = await resultPromise;
      expect(result?.result).toBe(ButtonTypes.Cancel);
    });

    it('should return undefined when dialog is closed without selection', async () => {
      const resultPromise = service.showYesNoCancelConfirmationDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeUndefined();
    });
  });

  describe('showOkCancelConfirmationDialog', () => {
    it('should return true when user clicks Ok', async () => {
      const resultPromise = service.showOkCancelConfirmationDialog('Title', 'Message');

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Ok));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeTrue();
    });

    it('should return false when user clicks Cancel', async () => {
      const resultPromise = service.showOkCancelConfirmationDialog('Title', 'Message');

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Cancel));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeFalse();
    });

    it('should return false when dialog is closed', async () => {
      const resultPromise = service.showOkCancelConfirmationDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeFalse();
    });
  });

  describe('showOkDialog', () => {
    it('should return true when user clicks Ok', async () => {
      const resultPromise = service.showOkDialog('Title', 'Message');

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Ok));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeTrue();
    });

    it('should return false when dialog is closed', async () => {
      const resultPromise = service.showOkDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeFalse();
    });
  });
});
