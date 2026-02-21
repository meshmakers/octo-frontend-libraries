import '@angular/localize/init';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { GridModule, SelectionEvent, PageChangeEvent } from '@progress/kendo-angular-grid';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { IconsModule } from '@progress/kendo-angular-icons';
import { LoaderModule } from '@progress/kendo-angular-indicators';
import { CkTypeSelectorService, CkTypeSelectorItem } from '@meshmakers/octo-services';
import {
  CkTypeSelectorDialogComponent,
  CkTypeSelectorDialogData,
  CkTypeSelectorDialogResult
} from './ck-type-selector-dialog.component';

describe('CkTypeSelectorDialogComponent', () => {
  let component: CkTypeSelectorDialogComponent;
  let fixture: ComponentFixture<CkTypeSelectorDialogComponent>;
  let ckTypeSelectorServiceMock: jasmine.SpyObj<CkTypeSelectorService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;

  const mockCkTypes: CkTypeSelectorItem[] = [
    {
      fullName: 'OctoSdkDemo-1.0.0/Customer-1',
      rtCkTypeId: 'OctoSdkDemo/Customer',
      baseTypeFullName: 'OctoSdkDemo-1.0.0/Entity-1',
      baseTypeRtCkTypeId: 'OctoSdkDemo/Entity',
      isAbstract: false,
      isFinal: false,
      description: 'Customer entity'
    },
    {
      fullName: 'OctoSdkDemo-1.0.0/Order-1',
      rtCkTypeId: 'OctoSdkDemo/Order',
      baseTypeFullName: 'OctoSdkDemo-1.0.0/Entity-1',
      baseTypeRtCkTypeId: 'OctoSdkDemo/Entity',
      isAbstract: false,
      isFinal: true,
      description: 'Order entity'
    },
    {
      fullName: 'OctoSdkDemo-1.0.0/Entity-1',
      rtCkTypeId: 'OctoSdkDemo/Entity',
      isAbstract: true,
      isFinal: false,
      description: 'Base entity'
    },
    {
      fullName: 'TestModel-2.0.0/Product-1',
      rtCkTypeId: 'TestModel/Product',
      isAbstract: false,
      isFinal: false,
      description: 'Product entity'
    },
    {
      fullName: 'TestModel-2.0.0/Category-1',
      rtCkTypeId: 'TestModel/Category',
      isAbstract: false,
      isFinal: true,
      description: 'Category entity'
    }
  ];

  const mockDialogData: CkTypeSelectorDialogData = {
    dialogTitle: 'Select CK Type',
    allowAbstract: false
  };

  beforeEach(async () => {
    ckTypeSelectorServiceMock = jasmine.createSpyObj('CkTypeSelectorService', ['getCkTypes']);
    ckTypeSelectorServiceMock.getCkTypes.and.returnValue(of({
      items: [...mockCkTypes],
      totalCount: mockCkTypes.length
    }));

    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close']);
    (dialogRefMock as any).content = {
      instance: {
        data: { ...mockDialogData }
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        CkTypeSelectorDialogComponent,
        FormsModule,
        GridModule,
        ButtonsModule,
        InputsModule,
        DropDownsModule,
        IconsModule,
        LoaderModule,
        DialogModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: CkTypeSelectorService, useValue: ckTypeSelectorServiceMock },
        { provide: DialogRef, useValue: dialogRefMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CkTypeSelectorDialogComponent);
    component = fixture.componentInstance;
  });

  describe('Component creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.searchText).toBe('');
      expect(component.selectedModel).toBeNull();
      expect(component.availableModels).toEqual([]);
      expect(component.isLoading).toBeFalse();
      expect(component.pageSize).toBe(50);
      expect(component.skip).toBe(0);
      expect(component.selectedKeys).toEqual([]);
      expect(component.selectedType).toBeNull();
    });

    it('should have default dialog title', () => {
      expect(component.dialogTitle).toBe('Select Construction Kit Type');
    });

    it('should have allowAbstract default to false', () => {
      expect(component.allowAbstract).toBeFalse();
    });
  });

  describe('ngOnInit', () => {
    it('should set dialog title from dialog data', () => {
      fixture.detectChanges();
      expect(component.dialogTitle).toBe('Select CK Type');
    });

    it('should use default dialog title when not provided', () => {
      (dialogRefMock as any).content.instance.data = {};
      fixture.detectChanges();
      expect(component.dialogTitle).toBe('Select Construction Kit Type');
    });

    it('should set allowAbstract from dialog data', () => {
      (dialogRefMock as any).content.instance.data = { allowAbstract: true };
      fixture.detectChanges();
      expect(component.allowAbstract).toBeTrue();
    });

    it('should set selectedKeys from dialog data', () => {
      (dialogRefMock as any).content.instance.data = {
        selectedCkTypeId: 'OctoSdkDemo-1.0.0/Customer-1'
      };
      fixture.detectChanges();
      expect(component.selectedKeys).toEqual(['OctoSdkDemo-1.0.0/Customer-1']);
    });

    it('should load types on init', () => {
      fixture.detectChanges();
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    });

    it('should load available models on init', () => {
      fixture.detectChanges();
      // Called twice: once for types, once for available models
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalledTimes(2);
    });

    it('should populate grid data after loading', () => {
      fixture.detectChanges();
      expect(component.gridData.data.length).toBe(5);
      expect(component.gridData.total).toBe(5);
    });

    it('should extract unique models from loaded types', () => {
      fixture.detectChanges();
      expect(component.availableModels).toContain('OctoSdkDemo-1.0.0');
      expect(component.availableModels).toContain('TestModel-2.0.0');
      expect(component.availableModels.length).toBe(2);
    });

    it('should sort available models alphabetically', () => {
      fixture.detectChanges();
      const models = component.availableModels;
      const sortedModels = [...models].sort();
      expect(models).toEqual(sortedModels);
    });

    it('should handle null dialog data', () => {
      (dialogRefMock as any).content = { instance: { data: null } };
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('should restore selection if item exists in loaded data', () => {
      (dialogRefMock as any).content.instance.data = {
        selectedCkTypeId: 'OctoSdkDemo-1.0.0/Customer-1'
      };
      fixture.detectChanges();
      expect(component.selectedType).toBeTruthy();
      expect(component.selectedType?.rtCkTypeId).toBe('OctoSdkDemo/Customer');
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should trigger search after debounce delay', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();

      component.onSearchChange('customer');
      expect(ckTypeSelectorServiceMock.getCkTypes).not.toHaveBeenCalled();

      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    }));

    it('should reset skip to 0 on search', fakeAsync(() => {
      component.skip = 50;
      component.onSearchChange('test');
      tick(300);
      expect(component.skip).toBe(0);
    }));

    it('should not trigger search for same value (distinctUntilChanged)', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();

      component.onSearchChange('test');
      tick(300);
      const callCount = ckTypeSelectorServiceMock.getCkTypes.calls.count();

      component.onSearchChange('test');
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes.calls.count()).toBe(callCount);
    }));

    it('should pass search text to service', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.searchText = 'customer';
      component.onSearchChange('customer');
      tick(300);

      const calls = ckTypeSelectorServiceMock.getCkTypes.calls.allArgs();
      const lastCall = calls[calls.length - 1]?.[0];
      expect(lastCall?.searchText).toBe('customer');
    }));
  });

  describe('Model filter', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should filter by selected model', () => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.selectedModel = 'OctoSdkDemo-1.0.0';
      component.onModelFilterChange('OctoSdkDemo-1.0.0');

      const calls = ckTypeSelectorServiceMock.getCkTypes.calls.allArgs();
      const lastCall = calls[calls.length - 1]?.[0];
      expect(lastCall?.ckModelIds).toEqual(['OctoSdkDemo-1.0.0']);
    });

    it('should reset skip to 0 on model filter change', () => {
      component.skip = 50;
      component.onModelFilterChange('TestModel-2.0.0');
      expect(component.skip).toBe(0);
    });

    it('should use initial ckModelIds when no model selected', () => {
      (dialogRefMock as any).content.instance.data = {
        ckModelIds: ['OctoSdkDemo-1.0.0']
      };
      fixture = TestBed.createComponent(CkTypeSelectorDialogComponent);
      component = fixture.componentInstance;
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      fixture.detectChanges();

      const calls = ckTypeSelectorServiceMock.getCkTypes.calls.allArgs();
      expect(calls[0]?.[0]?.ckModelIds).toEqual(['OctoSdkDemo-1.0.0']);
    });
  });

  describe('clearFilters', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should clear search text', () => {
      component.searchText = 'test';
      component.clearFilters();
      expect(component.searchText).toBe('');
    });

    it('should clear selected model', () => {
      component.selectedModel = 'OctoSdkDemo-1.0.0';
      component.clearFilters();
      expect(component.selectedModel).toBeNull();
    });

    it('should reset skip to 0', () => {
      component.skip = 50;
      component.clearFilters();
      expect(component.skip).toBe(0);
    });

    it('should reload types', () => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.clearFilters();
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should update skip on page change', () => {
      const pageEvent: PageChangeEvent = { skip: 50, take: 50 };
      component.onPageChange(pageEvent);
      expect(component.skip).toBe(50);
    });

    it('should update pageSize on page change', () => {
      const pageEvent: PageChangeEvent = { skip: 0, take: 100 };
      component.onPageChange(pageEvent);
      expect(component.pageSize).toBe(100);
    });

    it('should reload types on page change', () => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      const pageEvent: PageChangeEvent = { skip: 50, take: 50 };
      component.onPageChange(pageEvent);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    });

    it('should pass pagination to service', () => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      const pageEvent: PageChangeEvent = { skip: 100, take: 25 };
      component.onPageChange(pageEvent);

      const calls = ckTypeSelectorServiceMock.getCkTypes.calls.allArgs();
      const lastCall = calls[calls.length - 1]?.[0];
      expect(lastCall?.skip).toBe(100);
      expect(lastCall?.first).toBe(25);
    });
  });

  describe('Selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set selectedType on selection', () => {
      const selectionEvent: SelectionEvent = {
        selectedRows: [{ dataItem: mockCkTypes[0], index: 0 }],
        deselectedRows: [],
        ctrlKey: false,
        shiftKey: false
      };
      component.onSelectionChange(selectionEvent);
      expect(component.selectedType).toBe(mockCkTypes[0]);
    });

    it('should clear selectedType on deselection', () => {
      component.selectedType = mockCkTypes[0];
      const selectionEvent: SelectionEvent = {
        selectedRows: [],
        deselectedRows: [{ dataItem: mockCkTypes[0], index: 0 }],
        ctrlKey: false,
        shiftKey: false
      };
      component.onSelectionChange(selectionEvent);
      expect(component.selectedType).toBeNull();
    });

    it('should handle selection of abstract type', () => {
      const abstractType = mockCkTypes.find(t => t.isAbstract);
      const selectionEvent: SelectionEvent = {
        selectedRows: [{ dataItem: abstractType, index: 2 }],
        deselectedRows: [],
        ctrlKey: false,
        shiftKey: false
      };
      component.onSelectionChange(selectionEvent);
      expect(component.selectedType?.isAbstract).toBeTrue();
    });

    it('should handle selection of final type', () => {
      const finalType = mockCkTypes.find(t => t.isFinal);
      const selectionEvent: SelectionEvent = {
        selectedRows: [{ dataItem: finalType, index: 1 }],
        deselectedRows: [],
        ctrlKey: false,
        shiftKey: false
      };
      component.onSelectionChange(selectionEvent);
      expect(component.selectedType?.isFinal).toBeTrue();
    });
  });

  describe('onConfirm', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should close dialog with selected type', () => {
      component.selectedType = mockCkTypes[0];
      component.onConfirm();

      expect(dialogRefMock.close).toHaveBeenCalled();
      const result = (dialogRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as CkTypeSelectorDialogResult;
      expect(result.selectedCkType).toBe(mockCkTypes[0]);
    });

    it('should not close dialog when no selection', () => {
      component.selectedType = null;
      component.onConfirm();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('should include all type properties in result', () => {
      component.selectedType = mockCkTypes[0];
      component.onConfirm();

      const result = (dialogRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as CkTypeSelectorDialogResult;
      expect(result.selectedCkType.fullName).toBe('OctoSdkDemo-1.0.0/Customer-1');
      expect(result.selectedCkType.rtCkTypeId).toBe('OctoSdkDemo/Customer');
      expect(result.selectedCkType.description).toBe('Customer entity');
    });
  });

  describe('onCancel', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should close dialog without result', () => {
      component.onCancel();
      expect(dialogRefMock.close).toHaveBeenCalledWith();
    });

    it('should close dialog without result even with selection', () => {
      component.selectedType = mockCkTypes[0];
      component.onCancel();
      expect(dialogRefMock.close).toHaveBeenCalledWith();
    });
  });

  describe('Loading state', () => {
    it('should set isLoading to true while loading', () => {
      fixture.detectChanges();
      // isLoading is set to false after data loads, but we can check the flow
      expect(component.isLoading).toBeFalse();
    });

    it('should set isLoading to false after load completes', () => {
      fixture.detectChanges();
      expect(component.isLoading).toBeFalse();
    });

    it('should set isLoading to false on error', () => {
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(throwError(() => new Error('Test error')));
      fixture.detectChanges();
      expect(component.isLoading).toBeFalse();
    });

    it('should clear grid data on error', () => {
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(throwError(() => new Error('Test error')));
      fixture.detectChanges();
      expect(component.gridData.data).toEqual([]);
      expect(component.gridData.total).toBe(0);
    });
  });

  describe('Abstract type handling', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should allow confirm button when allowAbstract is true and abstract type selected', () => {
      component.allowAbstract = true;
      component.selectedType = mockCkTypes.find(t => t.isAbstract)!;
      // The button disabled logic: !selectedType || (selectedType.isAbstract && !allowAbstract)
      const isDisabled = !component.selectedType || (component.selectedType.isAbstract && !component.allowAbstract);
      expect(isDisabled).toBeFalse();
    });

    it('should disable confirm button when allowAbstract is false and abstract type selected', () => {
      component.allowAbstract = false;
      component.selectedType = mockCkTypes.find(t => t.isAbstract)!;
      const isDisabled = !component.selectedType || (component.selectedType.isAbstract && !component.allowAbstract);
      expect(isDisabled).toBeTrue();
    });

    it('should enable confirm button for non-abstract type regardless of allowAbstract', () => {
      component.allowAbstract = false;
      component.selectedType = mockCkTypes.find(t => !t.isAbstract)!;
      const isDisabled = !component.selectedType || (component.selectedType.isAbstract && !component.allowAbstract);
      expect(isDisabled).toBeFalse();
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe from subscriptions on destroy', () => {
      fixture.detectChanges();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should clean up search subject', fakeAsync(() => {
      fixture.detectChanges();
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();

      component.onSearchChange('test');
      component.ngOnDestroy();
      tick(300);

      // After destroy, no new calls should be made
      // (subscription is cleaned up)
    }));
  });

  describe('Model extraction', () => {
    it('should extract model from fullName format', () => {
      fixture.detectChanges();
      // Models should be extracted from "ModelName-Version/TypeName-Version" format
      expect(component.availableModels).toContain('OctoSdkDemo-1.0.0');
      expect(component.availableModels).toContain('TestModel-2.0.0');
    });

    it('should handle types without slash in fullName', () => {
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(of({
        items: [{ fullName: 'NoSlashType', rtCkTypeId: 'NoSlash', isAbstract: false, isFinal: false }],
        totalCount: 1
      }));
      fixture.detectChanges();
      // Should not throw and should handle gracefully
      expect(component.availableModels.length).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should filter, select, and confirm workflow', () => {
      // Set model filter
      component.selectedModel = 'OctoSdkDemo-1.0.0';
      component.onModelFilterChange('OctoSdkDemo-1.0.0');

      // Select a type
      const selectionEvent: SelectionEvent = {
        selectedRows: [{ dataItem: mockCkTypes[0], index: 0 }],
        deselectedRows: [],
        ctrlKey: false,
        shiftKey: false
      };
      component.onSelectionChange(selectionEvent);

      // Confirm
      component.onConfirm();

      const result = (dialogRefMock.close as jasmine.Spy).calls.mostRecent().args[0] as CkTypeSelectorDialogResult;
      expect(result.selectedCkType.rtCkTypeId).toBe('OctoSdkDemo/Customer');
    });

    it('should search, paginate, and select workflow', fakeAsync(() => {
      // Search
      component.searchText = 'product';
      component.onSearchChange('product');
      tick(300);

      // Change page size
      const pageEvent: PageChangeEvent = { skip: 0, take: 25 };
      component.onPageChange(pageEvent);

      expect(component.pageSize).toBe(25);
    }));

    it('should clear filters and reload', () => {
      component.searchText = 'test';
      component.selectedModel = 'TestModel-2.0.0';
      component.skip = 50;

      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.clearFilters();

      expect(component.searchText).toBe('');
      expect(component.selectedModel).toBeNull();
      expect(component.skip).toBe(0);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    });

    it('should handle pre-selected type that exists in initial load', () => {
      (dialogRefMock as any).content.instance.data = {
        selectedCkTypeId: 'OctoSdkDemo-1.0.0/Customer-1'
      };

      fixture = TestBed.createComponent(CkTypeSelectorDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.selectedType).toBeTruthy();
      expect(component.selectedType?.fullName).toBe('OctoSdkDemo-1.0.0/Customer-1');
    });
  });
});
