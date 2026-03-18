import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { WindowService, WindowCloseResult, WindowRef } from '@progress/kendo-angular-dialog';
import { CkTypeSelectorDialogService } from './ck-type-selector-dialog.service';
import { CkTypeSelectorDialogComponent, CkTypeSelectorDialogResult } from './ck-type-selector-dialog.component';
import { CkTypeSelectorItem } from '@meshmakers/octo-services';

interface MockComponentInstance {
  data?: {
    selectedCkTypeId?: string;
    ckModelIds?: string[];
    dialogTitle?: string;
    allowAbstract?: boolean;
    derivedFromRtCkTypeId?: string;
  };
}

describe('CkTypeSelectorDialogService', () => {
  let service: CkTypeSelectorDialogService;
  let windowServiceMock: jasmine.SpyObj<WindowService>;
  let dialogResultSubject: Subject<CkTypeSelectorDialogResult | WindowCloseResult | Record<string, unknown> | string | undefined>;
  let mockWindowRef: Partial<WindowRef>;
  let mockComponentInstance: MockComponentInstance;

  const mockCkType: CkTypeSelectorItem = {
    fullName: 'TestModel-1.0.0/Customer-1',
    rtCkTypeId: 'TestModel/Customer',
    isAbstract: false,
    isFinal: false,
    description: 'A customer entity'
  };

  beforeEach(() => {
    sessionStorage.clear();
    dialogResultSubject = new Subject<CkTypeSelectorDialogResult | WindowCloseResult | Record<string, unknown> | string | undefined>();
    mockComponentInstance = {};

    mockWindowRef = {
      result: dialogResultSubject.asObservable() as unknown as Observable<WindowCloseResult>,
      content: {
        instance: mockComponentInstance
      } as unknown as WindowRef['content'],
      close: jasmine.createSpy('close'),
      window: {
        location: {
          nativeElement: {
            getBoundingClientRect: () => ({
              width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600,
              toJSON: () => ({})
            })
          }
        }
      } as unknown as WindowRef['window']
    };

    windowServiceMock = jasmine.createSpyObj('WindowService', ['open']);
    windowServiceMock.open.and.returnValue(mockWindowRef as WindowRef);

    TestBed.configureTestingModule({
      providers: [
        CkTypeSelectorDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });

    service = TestBed.inject(CkTypeSelectorDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openCkTypeSelector', () => {
    it('should open dialog with default configuration when no options provided', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: null } as unknown as CkTypeSelectorDialogResult);
      dialogResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          content: CkTypeSelectorDialogComponent,
          width: 900,
          height: 650,
          minWidth: 750,
          minHeight: 550,
          title: 'Select Construction Kit Type'
        })
      );
    });

    it('should use custom dialog title when provided', async () => {
      const resultPromise = service.openCkTypeSelector({ dialogTitle: 'Choose CK Type' });

      dialogResultSubject.next({ selectedCkType: null } as unknown as CkTypeSelectorDialogResult);
      dialogResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: 'Choose CK Type'
        })
      );
    });

    it('should pass all options to dialog component', async () => {
      const options = {
        selectedCkTypeId: 'TestModel/Existing',
        ckModelIds: ['Model1', 'Model2'],
        dialogTitle: 'Select Type',
        allowAbstract: true
      };

      const resultPromise = service.openCkTypeSelector(options);

      dialogResultSubject.next({ selectedCkType: null } as unknown as CkTypeSelectorDialogResult);
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        selectedCkTypeId: 'TestModel/Existing',
        ckModelIds: ['Model1', 'Model2'],
        dialogTitle: 'Select Type',
        allowAbstract: true,
        derivedFromRtCkTypeId: undefined
      });
    });

    it('should return confirmed=true with selected CkType when user confirms', async () => {
      const dialogResult: CkTypeSelectorDialogResult = {
        selectedCkType: mockCkType
      };

      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next(dialogResult);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedCkType).toEqual(mockCkType);
    });

    it('should return confirmed=false with null when user cancels via WindowCloseResult', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next(new WindowCloseResult());
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedCkType).toBeNull();
    });

    it('should return confirmed=false with null when result is not an object', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next('invalid');
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedCkType).toBeNull();
    });

    it('should return confirmed=false with null when result has no selectedCkType property', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ someOtherProperty: 'value' });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedCkType).toBeNull();
    });

    it('should return confirmed=false with null when dialog throws error', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.error(new Error('Dialog closed'));

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedCkType).toBeNull();
    });

    it('should handle dialog without content instance', async () => {
      mockWindowRef.content = null as unknown as WindowRef['content'];

      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: mockCkType });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
    });

    it('should handle null selectedCkType in result (valid confirmation with no selection)', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: null } as unknown as CkTypeSelectorDialogResult);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedCkType).toBeNull();
    });

    it('should pass empty options object when called without parameters', async () => {
      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: mockCkType });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        selectedCkTypeId: undefined,
        ckModelIds: undefined,
        dialogTitle: undefined,
        allowAbstract: undefined,
        derivedFromRtCkTypeId: undefined
      });
    });

    it('should handle abstract types when allowAbstract is true', async () => {
      const abstractCkType: CkTypeSelectorItem = {
        fullName: 'TestModel-1.0.0/AbstractEntity-1',
        rtCkTypeId: 'TestModel/AbstractEntity',
        isAbstract: true,
        isFinal: false,
        description: 'An abstract entity'
      };

      const resultPromise = service.openCkTypeSelector({ allowAbstract: true });

      dialogResultSubject.next({ selectedCkType: abstractCkType });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedCkType?.isAbstract).toBe(true);
    });

    it('should handle final types', async () => {
      const finalCkType: CkTypeSelectorItem = {
        fullName: 'TestModel-1.0.0/FinalEntity-1',
        rtCkTypeId: 'TestModel/FinalEntity',
        isAbstract: false,
        isFinal: true,
        description: 'A final entity'
      };

      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: finalCkType });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedCkType?.isFinal).toBe(true);
    });

    it('should preserve CkType properties in returned result', async () => {
      const detailedCkType: CkTypeSelectorItem = {
        fullName: 'TestModel-1.0.0/Customer-1',
        rtCkTypeId: 'TestModel/Customer',
        baseTypeFullName: 'System.Core-1.0.0/Entity-1',
        baseTypeRtCkTypeId: 'System.Core/Entity',
        isAbstract: false,
        isFinal: false,
        description: 'Customer with base type'
      };

      const resultPromise = service.openCkTypeSelector();

      dialogResultSubject.next({ selectedCkType: detailedCkType });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.selectedCkType?.fullName).toBe('TestModel-1.0.0/Customer-1');
      expect(result.selectedCkType?.rtCkTypeId).toBe('TestModel/Customer');
      expect(result.selectedCkType?.baseTypeFullName).toBe('System.Core-1.0.0/Entity-1');
      expect(result.selectedCkType?.baseTypeRtCkTypeId).toBe('System.Core/Entity');
    });

    it('should filter by ckModelIds when provided', async () => {
      const options = {
        ckModelIds: ['SpecificModel']
      };

      const resultPromise = service.openCkTypeSelector(options);

      dialogResultSubject.next({ selectedCkType: mockCkType });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data?.ckModelIds).toEqual(['SpecificModel']);
    });
  });
});
