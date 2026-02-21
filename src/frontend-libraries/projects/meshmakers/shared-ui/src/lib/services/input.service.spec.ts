import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { InputService } from './input.service';
import { InputDialogResult } from '../models/inputDialogResult';

describe('InputService', () => {
  let service: InputService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;
  let resultSubject: Subject<InputDialogResult | object>;

  beforeEach(() => {
    resultSubject = new Subject<InputDialogResult | object>();

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: resultSubject.asObservable(),
      content: {
        instance: {
          message: '',
          placeholder: '',
          buttonOkText: ''
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    TestBed.configureTestingModule({
      providers: [
        InputService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });
    service = TestBed.inject(InputService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showInputDialog', () => {
    it('should return the input value when user confirms', async () => {
      const resultPromise = service.showInputDialog('Title', 'Message', 'Placeholder');

      expect(dialogServiceMock.open).toHaveBeenCalled();

      resultSubject.next(new InputDialogResult('user input'));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe('user input');
    });

    it('should return null when dialog is closed without confirmation', async () => {
      const resultPromise = service.showInputDialog('Title', 'Message', 'Placeholder');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should pass message and placeholder to component', async () => {
      const resultPromise = service.showInputDialog('Title', 'Test Message', 'Test Placeholder');

      const component = dialogRefMock.content.instance;
      expect(component.message).toBe('Test Message');
      expect(component.placeholder).toBe('Test Placeholder');

      resultSubject.next(new InputDialogResult('value'));
      resultSubject.complete();
      await resultPromise;
    });

    it('should set custom button text when provided', async () => {
      const resultPromise = service.showInputDialog('Title', 'Message', 'Placeholder', 'Custom OK');

      const component = dialogRefMock.content.instance;
      expect(component.buttonOkText).toBe('Custom OK');

      resultSubject.next(new InputDialogResult('value'));
      resultSubject.complete();
      await resultPromise;
    });

    it('should not override button text when not provided', async () => {
      const resultPromise = service.showInputDialog('Title', 'Message', 'Placeholder', null);

      const component = dialogRefMock.content.instance;
      // Button text should remain empty (not overwritten)
      expect(component.buttonOkText).toBe('');

      resultSubject.next(new InputDialogResult('value'));
      resultSubject.complete();
      await resultPromise;
    });
  });
});
