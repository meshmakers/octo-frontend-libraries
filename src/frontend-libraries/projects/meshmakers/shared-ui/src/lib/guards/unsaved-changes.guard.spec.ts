import { TestBed } from '@angular/core/testing';
import { UnsavedChangesGuard } from './unsaved-changes.guard';
import { ConfirmationService } from '../services/confirmation.service';
import { HasUnsavedChanges } from './unsaved-changes.interface';
import { ButtonTypes, ConfirmationWindowResult } from '../models/confirmation';

describe('UnsavedChangesGuard', () => {
  let guard: UnsavedChangesGuard;
  let confirmationServiceMock: jasmine.SpyObj<ConfirmationService>;

  beforeEach(() => {
    confirmationServiceMock = jasmine.createSpyObj('ConfirmationService', [
      'showYesNoConfirmationDialog',
      'showYesNoCancelConfirmationDialog'
    ]);

    TestBed.configureTestingModule({
      providers: [
        UnsavedChangesGuard,
        { provide: ConfirmationService, useValue: confirmationServiceMock }
      ]
    });

    guard = TestBed.inject(UnsavedChangesGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('when component is null or undefined', () => {
    it('should allow navigation when component is null', async () => {
      const result = await guard.canDeactivate(null as unknown as HasUnsavedChanges);
      expect(result).toBeTrue();
    });

    it('should allow navigation when component is undefined', async () => {
      const result = await guard.canDeactivate(undefined as unknown as HasUnsavedChanges);
      expect(result).toBeTrue();
    });
  });

  describe('when component does not implement hasUnsavedChanges', () => {
    it('should allow navigation when hasUnsavedChanges is not a function', async () => {
      const component = {} as HasUnsavedChanges;
      const result = await guard.canDeactivate(component);
      expect(result).toBeTrue();
    });
  });

  describe('when component has no unsaved changes', () => {
    it('should allow navigation when hasUnsavedChanges returns false', async () => {
      const component: HasUnsavedChanges = {
        hasUnsavedChanges: () => false
      };

      const result = await guard.canDeactivate(component);
      expect(result).toBeTrue();
      expect(confirmationServiceMock.showYesNoConfirmationDialog).not.toHaveBeenCalled();
      expect(confirmationServiceMock.showYesNoCancelConfirmationDialog).not.toHaveBeenCalled();
    });
  });

  describe('when component has unsaved changes and supports saving', () => {
    let component: HasUnsavedChanges;
    let saveChangesSpy: jasmine.Spy;

    beforeEach(() => {
      saveChangesSpy = jasmine.createSpy('saveChanges');
      component = {
        hasUnsavedChanges: () => true,
        saveChanges: saveChangesSpy
      };
    });

    it('should save and allow navigation when user clicks Yes and save succeeds', async () => {
      saveChangesSpy.and.returnValue(Promise.resolve(true));
      confirmationServiceMock.showYesNoCancelConfirmationDialog.and.returnValue(
        Promise.resolve(new ConfirmationWindowResult(ButtonTypes.Yes))
      );

      const result = await guard.canDeactivate(component);

      expect(confirmationServiceMock.showYesNoCancelConfirmationDialog).toHaveBeenCalledWith(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before leaving?',
        undefined
      );
      expect(saveChangesSpy).toHaveBeenCalled();
      expect(result).toBeTrue();
    });

    it('should block navigation when user clicks Yes but save fails', async () => {
      saveChangesSpy.and.returnValue(Promise.resolve(false));
      confirmationServiceMock.showYesNoCancelConfirmationDialog.and.returnValue(
        Promise.resolve(new ConfirmationWindowResult(ButtonTypes.Yes))
      );

      const result = await guard.canDeactivate(component);

      expect(saveChangesSpy).toHaveBeenCalled();
      expect(result).toBeFalse();
    });

    it('should discard changes and allow navigation when user clicks No', async () => {
      confirmationServiceMock.showYesNoCancelConfirmationDialog.and.returnValue(
        Promise.resolve(new ConfirmationWindowResult(ButtonTypes.No))
      );

      const result = await guard.canDeactivate(component);

      expect(saveChangesSpy).not.toHaveBeenCalled();
      expect(result).toBeTrue();
    });

    it('should block navigation when user clicks Cancel', async () => {
      confirmationServiceMock.showYesNoCancelConfirmationDialog.and.returnValue(
        Promise.resolve(new ConfirmationWindowResult(ButtonTypes.Cancel))
      );

      const result = await guard.canDeactivate(component);

      expect(saveChangesSpy).not.toHaveBeenCalled();
      expect(result).toBeFalse();
    });

    it('should block navigation when dialog is closed without selection', async () => {
      confirmationServiceMock.showYesNoCancelConfirmationDialog.and.returnValue(
        Promise.resolve(undefined)
      );

      const result = await guard.canDeactivate(component);

      expect(saveChangesSpy).not.toHaveBeenCalled();
      expect(result).toBeFalse();
    });
  });

  describe('when component has unsaved changes but does not support saving', () => {
    let component: HasUnsavedChanges;

    beforeEach(() => {
      component = {
        hasUnsavedChanges: () => true
        // No saveChanges method
      };
    });

    it('should allow navigation when user confirms to leave', async () => {
      confirmationServiceMock.showYesNoConfirmationDialog.and.returnValue(
        Promise.resolve(true)
      );

      const result = await guard.canDeactivate(component);

      expect(confirmationServiceMock.showYesNoConfirmationDialog).toHaveBeenCalledWith(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
        undefined,
        undefined
      );
      expect(result).toBeTrue();
    });

    it('should block navigation when user declines to leave', async () => {
      confirmationServiceMock.showYesNoConfirmationDialog.and.returnValue(
        Promise.resolve(false)
      );

      const result = await guard.canDeactivate(component);

      expect(result).toBeFalse();
    });
  });
});
