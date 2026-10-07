import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { ConfirmationService } from './confirmation.service';
import { ButtonTypes, ConfirmationWindowResult, DialogType } from '../models/confirmation';
import { DangerConfirmationResult, DangerConfirmationWindowComponent } from '../danger-confirmation/danger-confirmation-window.component';

describe('ConfirmationService', () => {
  let service: ConfirmationService;
  let dialogServiceMock: MockedObject<DialogService>;
  let dialogRefMock: MockedObject<DialogRef>;
  let resultSubject: Subject<ConfirmationWindowResult | object>;

  beforeEach(() => {
    resultSubject = new Subject<ConfirmationWindowResult | object>();

    dialogRefMock = {
      close: vi.fn().mockName('DialogRef.close'),
      result: resultSubject.asObservable(),
      content: {
        instance: {
          data: null
        }
      }
    } as unknown as MockedObject<DialogRef>;

    dialogServiceMock = {
      open: vi.fn().mockName('DialogService.open')
    } as unknown as MockedObject<DialogService>;
    dialogServiceMock.open.mockReturnValue(dialogRefMock);

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

  describe('showDangerConfirm (AB#5578)', () => {
    it('opens the danger window with the options, focuses Cancel and resolves true only on confirm', async () => {
      const set = vi.fn();
      (dialogRefMock.content.instance as unknown as { options: { set: typeof set } }).options = { set };
      service.defaultDangerMessages = { cancel: 'Abbrechen' };
      const promise = service.showDangerConfirm({ title: 'Delete adapter A?', targetName: 'A', consequence: 'Gone.', confirmText: 'Delete adapter' });
      expect(dialogServiceMock.open).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Delete adapter A?', content: DangerConfirmationWindowComponent, autoFocusedElement: '[data-action="cancel"]',
      }));
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'A', messages: { cancel: 'Abbrechen' } }));
      resultSubject.next(new DangerConfirmationResult(true));
      resultSubject.complete();
      expect(await promise).toBe(true);
    });

    it('focuses the type-to-confirm input when typing is required; false on cancel', async () => {
      (dialogRefMock.content.instance as unknown as { options: { set: () => void } }).options = { set: vi.fn() };
      const promise = service.showDangerConfirm({ title: 't', targetName: 'A', consequence: 'c', confirmText: 'Delete', requireTypingName: true });
      expect(dialogServiceMock.open).toHaveBeenCalledWith(expect.objectContaining({ autoFocusedElement: '[data-type-to-confirm]' }));
      resultSubject.next(new DangerConfirmationResult(false));
      resultSubject.complete();
      expect(await promise).toBe(false);
    });
  });

  it('focuses the dismissing button first in destructive and production-check dialogs (AB#5578)', () => {
    void service.showDestructiveConfirmationDialog('Delete user x?', 'Sure?', 'Delete user');
    expect(dialogServiceMock.open).toHaveBeenLastCalledWith(expect.objectContaining({ autoFocusedElement: '[data-action="dismiss"], [data-action="cancel"]' }));
    void service.showYesNoConfirmationDialog('PRODUCTION Environment', 'Sure?', 'mm-dialog-danger');
    expect(dialogServiceMock.open).toHaveBeenLastCalledWith(expect.objectContaining({ autoFocusedElement: '[data-action="dismiss"], [data-action="cancel"]' }));
    void service.showYesNoConfirmationDialog('Plain', 'Sure?');
    expect(dialogServiceMock.open.mock.lastCall?.[0]).not.toHaveProperty('autoFocusedElement');
  });

  describe('showDestructiveConfirmationDialog', () => {
    it('labels the buttons with the verbs, marks the dialog as danger and caps its width', async () => {
      const resultPromise = service.showDestructiveConfirmationDialog('Rotate secret', 'Sure?', 'Rotate');
      expect(dialogServiceMock.open).toHaveBeenCalledWith(expect.objectContaining({ minWidth: 'min(320px, calc(100vw - 32px))', maxWidth: 'min(560px, calc(100vw - 32px))' }));
      expect(dialogRefMock.content.instance.data).toEqual(expect.objectContaining({
        dialogType: DialogType.YesNo,
        buttonLabels: { yes: 'Rotate', no: 'Cancel' },
        danger: true,
      }));
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Yes));
      resultSubject.complete();
      expect(await resultPromise).toBe(true);
    });

    it('resolves false on cancel', async () => {
      const resultPromise = service.showDestructiveConfirmationDialog('Rotate secret', 'Sure?', 'Rotate', 'Keep');
      expect(dialogRefMock.content.instance.data).toEqual(expect.objectContaining({ buttonLabels: { yes: 'Rotate', no: 'Keep' } }));
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.No));
      resultSubject.complete();
      expect(await resultPromise).toBe(false);
    });
  });

  describe('showYesNoConfirmationDialog', () => {
    it('should return true when user clicks Yes', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      expect(dialogServiceMock.open).toHaveBeenCalled();

      // Emit Yes result
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Yes));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it('should return false when user clicks No', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      // Emit No result
      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.No));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should return false when dialog is closed without selection', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      // Emit empty object (dialog closed)
      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(false);
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

    it('should pass cssClass to dialog service when provided', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message', 'mm-dialog-danger');

      expect(dialogServiceMock.open).toHaveBeenCalledWith(expect.objectContaining({
        cssClass: 'mm-dialog-danger'
      }));

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Yes));
      resultSubject.complete();
      await resultPromise;
    });

    it('should not pass cssClass when not provided', async () => {
      const resultPromise = service.showYesNoConfirmationDialog('Title', 'Message');

      expect(dialogServiceMock.open).toHaveBeenCalledWith(expect.objectContaining({
        cssClass: undefined
      }));

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
      expect(result).toBe(true);
    });

    it('should return false when user clicks Cancel', async () => {
      const resultPromise = service.showOkCancelConfirmationDialog('Title', 'Message');

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Cancel));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should return false when dialog is closed', async () => {
      const resultPromise = service.showOkCancelConfirmationDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(false);
    });
  });

  describe('showOkDialog', () => {
    it('should return true when user clicks Ok', async () => {
      const resultPromise = service.showOkDialog('Title', 'Message');

      resultSubject.next(new ConfirmationWindowResult(ButtonTypes.Ok));
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it('should return false when dialog is closed', async () => {
      const resultPromise = service.showOkDialog('Title', 'Message');

      resultSubject.next({});
      resultSubject.complete();

      const result = await resultPromise;
      expect(result).toBe(false);
    });
  });
});
