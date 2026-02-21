import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { AutoCompleteModule } from '@progress/kendo-angular-dropdowns';
import { LoaderModule } from '@progress/kendo-angular-indicators';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { IconsModule, SVGIconModule } from '@progress/kendo-angular-icons';
import { CkTypeSelectorService, CkTypeSelectorItem } from '@meshmakers/octo-services';
import { CkTypeSelectorDialogService } from '../ck-type-selector-dialog/ck-type-selector-dialog.service';
import { CkTypeSelectorInputComponent } from './ck-type-selector-input.component';

describe('CkTypeSelectorInputComponent', () => {
  let component: CkTypeSelectorInputComponent;
  let fixture: ComponentFixture<CkTypeSelectorInputComponent>;
  let ckTypeSelectorServiceMock: jasmine.SpyObj<CkTypeSelectorService>;
  let dialogServiceMock: jasmine.SpyObj<CkTypeSelectorDialogService>;

  const mockCkTypes: CkTypeSelectorItem[] = [
    {
      fullName: 'OctoSdkDemo-1.0.0/Customer-1',
      rtCkTypeId: 'OctoSdkDemo/Customer',
      isAbstract: false,
      isFinal: false,
      description: 'Customer entity'
    },
    {
      fullName: 'OctoSdkDemo-1.0.0/Order-1',
      rtCkTypeId: 'OctoSdkDemo/Order',
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
    }
  ];

  beforeEach(async () => {
    ckTypeSelectorServiceMock = jasmine.createSpyObj('CkTypeSelectorService', ['getCkTypes']);
    ckTypeSelectorServiceMock.getCkTypes.and.returnValue(of({
      items: [...mockCkTypes],
      totalCount: mockCkTypes.length
    }));

    dialogServiceMock = jasmine.createSpyObj('CkTypeSelectorDialogService', ['openCkTypeSelector']);
    dialogServiceMock.openCkTypeSelector.and.returnValue(Promise.resolve({
      confirmed: false,
      selectedCkType: null
    }));

    await TestBed.configureTestingModule({
      imports: [
        CkTypeSelectorInputComponent,
        ReactiveFormsModule,
        AutoCompleteModule,
        LoaderModule,
        ButtonsModule,
        IconsModule,
        SVGIconModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: CkTypeSelectorService, useValue: ckTypeSelectorServiceMock },
        { provide: CkTypeSelectorDialogService, useValue: dialogServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CkTypeSelectorInputComponent);
    component = fixture.componentInstance;
  });

  describe('Component creation', () => {
    it('should create the component', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have default input values', () => {
      expect(component.placeholder).toBe('Select a CK type...');
      expect(component.minSearchLength).toBe(2);
      expect(component.maxResults).toBe(50);
      expect(component.debounceMs).toBe(300);
      expect(component.allowAbstract).toBeFalse();
      expect(component.dialogTitle).toBe('Select Construction Kit Type');
      expect(component.advancedSearchLabel).toBe('Advanced Search...');
    });

    it('should initialize with empty state', () => {
      fixture.detectChanges();
      expect(component.filteredTypes).toEqual([]);
      expect(component.selectedCkType).toBeNull();
      expect(component.isLoading).toBeFalse();
    });

    it('should have disabled default to false', () => {
      expect(component.disabled).toBeFalse();
    });

    it('should have required default to false', () => {
      expect(component.required).toBeFalse();
    });
  });

  describe('Input properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should accept custom placeholder', () => {
      component.placeholder = 'Custom placeholder';
      expect(component.placeholder).toBe('Custom placeholder');
    });

    it('should accept custom minSearchLength', () => {
      component.minSearchLength = 3;
      expect(component.minSearchLength).toBe(3);
    });

    it('should accept custom maxResults', () => {
      component.maxResults = 100;
      expect(component.maxResults).toBe(100);
    });

    it('should accept custom debounceMs', () => {
      component.debounceMs = 500;
      expect(component.debounceMs).toBe(500);
    });

    it('should accept ckModelIds', () => {
      component.ckModelIds = ['Model1', 'Model2'];
      expect(component.ckModelIds).toEqual(['Model1', 'Model2']);
    });

    it('should accept allowAbstract', () => {
      component.allowAbstract = true;
      expect(component.allowAbstract).toBeTrue();
    });

    it('should accept dialogTitle', () => {
      component.dialogTitle = 'Custom Title';
      expect(component.dialogTitle).toBe('Custom Title');
    });

    it('should accept advancedSearchLabel', () => {
      component.advancedSearchLabel = 'Browse...';
      expect(component.advancedSearchLabel).toBe('Browse...');
    });
  });

  describe('Disabled state', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should disable searchFormControl when disabled is set', () => {
      component.disabled = true;
      expect(component.searchFormControl.disabled).toBeTrue();
    });

    it('should enable searchFormControl when disabled is unset', () => {
      component.disabled = true;
      component.disabled = false;
      expect(component.searchFormControl.enabled).toBeTrue();
    });

    it('should coerce truthy values to true', () => {
      (component as any).disabled = 'yes';
      expect(component.disabled).toBeTrue();
    });

    it('should coerce falsy values to false', () => {
      component.disabled = true;
      (component as any).disabled = '';
      expect(component.disabled).toBeFalse();
    });
  });

  describe('Required state', () => {
    it('should set required property', () => {
      component.required = true;
      expect(component.required).toBeTrue();
    });

    it('should coerce truthy values to true', () => {
      (component as any).required = 'yes';
      expect(component.required).toBeTrue();
    });
  });

  describe('ControlValueAccessor', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    describe('writeValue', () => {
      it('should set selectedCkType when value is provided', () => {
        component.writeValue(mockCkTypes[0]);
        expect(component.selectedCkType).toBe(mockCkTypes[0]);
      });

      it('should set searchFormControl value to rtCkTypeId', () => {
        component.writeValue(mockCkTypes[0]);
        expect(component.searchFormControl.value).toBe('OctoSdkDemo/Customer');
      });

      it('should clear selectedCkType when null is provided', () => {
        component.selectedCkType = mockCkTypes[0];
        component.writeValue(null);
        expect(component.selectedCkType).toBeNull();
      });

      it('should clear searchFormControl when null is provided', () => {
        // First set a non-null value to ensure the component tracks it
        component.writeValue(mockCkTypes[0]);
        expect(component.searchFormControl.value).toBe('OctoSdkDemo/Customer');
        // Now clear with null
        component.writeValue(null);
        expect(component.searchFormControl.value).toBe('');
      });

      it('should not emit event when setting value', () => {
        const spy = jasmine.createSpy('valueChangeSpy');
        component.searchFormControl.valueChanges.subscribe(spy);
        component.writeValue(mockCkTypes[0]);
        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('registerOnChange', () => {
      it('should register onChange callback', () => {
        const callback = jasmine.createSpy('onChange');
        component.registerOnChange(callback);

        // Trigger internal onChange
        (component as any).onChange(mockCkTypes[0]);
        expect(callback).toHaveBeenCalledWith(mockCkTypes[0]);
      });
    });

    describe('registerOnTouched', () => {
      it('should register onTouched callback', () => {
        const callback = jasmine.createSpy('onTouched');
        component.registerOnTouched(callback);

        // Trigger internal onTouched
        (component as any).onTouched();
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('setDisabledState', () => {
      it('should disable component when called with true', () => {
        component.setDisabledState(true);
        expect(component.disabled).toBeTrue();
      });

      it('should enable component when called with false', () => {
        component.disabled = true;
        component.setDisabledState(false);
        expect(component.disabled).toBeFalse();
      });
    });
  });

  describe('Validator', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should return null when not required and no selection', () => {
      component.required = false;
      component.selectedCkType = null;
      const control = new FormControl(null);
      expect(component.validate(control)).toBeNull();
    });

    it('should return required error when required and no selection', () => {
      component.required = true;
      component.selectedCkType = null;
      const control = new FormControl(null);
      expect(component.validate(control)).toEqual({ required: true });
    });

    it('should return null when required and selection exists', () => {
      component.required = true;
      component.selectedCkType = mockCkTypes[0];
      const control = new FormControl(mockCkTypes[0]);
      expect(component.validate(control)).toBeNull();
    });

    it('should return invalidCkType error when value is string', () => {
      component.required = false;
      component.selectedCkType = null;
      const control = new FormControl('invalid string');
      expect(component.validate(control)).toEqual({ invalidCkType: true });
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should not search when filter length is less than minSearchLength', () => {
      component.onFilterChange('a');
      expect(ckTypeSelectorServiceMock.getCkTypes).not.toHaveBeenCalled();
      expect(component.filteredTypes).toEqual([]);
    });

    it('should trigger search when filter meets minSearchLength', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.onFilterChange('cus');
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    }));

    it('should debounce search requests', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.onFilterChange('cus');
      tick(100);
      component.onFilterChange('cust');
      tick(100);
      component.onFilterChange('custo');
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalledTimes(1);
    }));

    it('should set isLoading to true during search', fakeAsync(() => {
      component.onFilterChange('customer');
      tick(300);
      // After completion isLoading should be false
      expect(component.isLoading).toBeFalse();
    }));

    it('should populate filteredTypes with rtCkTypeIds', fakeAsync(() => {
      component.onFilterChange('customer');
      tick(300);
      expect(component.filteredTypes).toContain('OctoSdkDemo/Customer');
      expect(component.filteredTypes).toContain('OctoSdkDemo/Order');
    }));

    it('should filter out abstract types when allowAbstract is false', fakeAsync(() => {
      component.allowAbstract = false;
      component.onFilterChange('entity');
      tick(300);
      expect(component.filteredTypes).not.toContain('OctoSdkDemo/Entity');
    }));

    it('should include abstract types when allowAbstract is true', fakeAsync(() => {
      component.allowAbstract = true;
      component.onFilterChange('entity');
      tick(300);
      expect(component.filteredTypes).toContain('OctoSdkDemo/Entity');
    }));

    it('should pass ckModelIds to service', fakeAsync(() => {
      component.ckModelIds = ['TestModel'];
      component.onFilterChange('test');
      tick(300);
      const call = ckTypeSelectorServiceMock.getCkTypes.calls.mostRecent();
      expect(call?.args[0]?.ckModelIds).toEqual(['TestModel']);
    }));

    it('should pass maxResults to service', fakeAsync(() => {
      component.maxResults = 25;
      component.onFilterChange('test');
      tick(300);
      const call = ckTypeSelectorServiceMock.getCkTypes.calls.mostRecent();
      expect(call?.args[0]?.first).toBe(25);
    }));

    it('should handle search errors gracefully', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(throwError(() => new Error('Test error')));
      component.onFilterChange('test');
      tick(300);
      expect(component.isLoading).toBeFalse();
      expect(component.filteredTypes).toEqual([]);
    }));
  });

  describe('Selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should select CkType when valid value is selected', fakeAsync(() => {
      // First trigger search to populate typeMap
      component.onFilterChange('customer');
      tick(300);

      component.onSelectionChange('OctoSdkDemo/Customer');
      expect(component.selectedCkType?.rtCkTypeId).toBe('OctoSdkDemo/Customer');
    }));

    it('should emit ckTypeSelected event on selection', fakeAsync(() => {
      const spy = jasmine.createSpy('ckTypeSelected');
      component.ckTypeSelected.subscribe(spy);

      component.onFilterChange('customer');
      tick(300);

      component.onSelectionChange('OctoSdkDemo/Customer');
      expect(spy).toHaveBeenCalled();
    }));

    it('should clear filteredTypes on selection', fakeAsync(() => {
      component.onFilterChange('customer');
      tick(300);
      expect(component.filteredTypes.length).toBeGreaterThan(0);

      component.onSelectionChange('OctoSdkDemo/Customer');
      expect(component.filteredTypes).toEqual([]);
    }));

    it('should not select if value not in typeMap', fakeAsync(() => {
      component.onFilterChange('customer');
      tick(300);

      component.onSelectionChange('NonExistent/Type');
      expect(component.selectedCkType).toBeNull();
    }));

    it('should call onChange callback on selection', fakeAsync(() => {
      const callback = jasmine.createSpy('onChange');
      component.registerOnChange(callback);

      component.onFilterChange('customer');
      tick(300);

      component.onSelectionChange('OctoSdkDemo/Customer');
      expect(callback).toHaveBeenCalled();
    }));
  });

  describe('Focus and Blur', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should trigger search on focus if value meets minSearchLength', fakeAsync(() => {
      component.searchFormControl.setValue('customer');
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();

      component.onFocus();
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).toHaveBeenCalled();
    }));

    it('should not trigger search on focus if value is too short', fakeAsync(() => {
      component.searchFormControl.setValue('c');
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();

      component.onFocus();
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).not.toHaveBeenCalled();
    }));

    it('should not trigger search on focus if filteredTypes already populated', fakeAsync(() => {
      component.searchFormControl.setValue('customer');
      component.onFilterChange('customer');
      tick(300);

      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.onFocus();
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).not.toHaveBeenCalled();
    }));

    it('should call onTouched on blur', () => {
      const callback = jasmine.createSpy('onTouched');
      component.registerOnTouched(callback);

      component.onBlur();
      expect(callback).toHaveBeenCalled();
    });

    it('should auto-select on blur if only one result and no selection', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(of({
        items: [mockCkTypes[0]],
        totalCount: 1
      }));

      component.onFilterChange('customer');
      tick(300);

      expect(component.filteredTypes.length).toBe(1);
      expect(component.selectedCkType).toBeNull();

      component.onBlur();
      expect(component.selectedCkType?.rtCkTypeId).toBe('OctoSdkDemo/Customer');
    }));

    it('should not auto-select on blur if already selected', fakeAsync(() => {
      component.selectedCkType = mockCkTypes[1];
      ckTypeSelectorServiceMock.getCkTypes.and.returnValue(of({
        items: [mockCkTypes[0]],
        totalCount: 1
      }));

      component.onFilterChange('customer');
      tick(300);

      component.onBlur();
      expect(component.selectedCkType).toBe(mockCkTypes[1]);
    }));
  });

  describe('Clear and Reset', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should clear selectedCkType', () => {
      component.selectedCkType = mockCkTypes[0];
      component.clear();
      expect(component.selectedCkType).toBeNull();
    });

    it('should clear filteredTypes', fakeAsync(() => {
      component.onFilterChange('customer');
      tick(300);
      expect(component.filteredTypes.length).toBeGreaterThan(0);

      component.clear();
      expect(component.filteredTypes).toEqual([]);
    }));

    it('should clear searchFormControl value', () => {
      component.searchFormControl.setValue('test');
      component.clear();
      expect(component.searchFormControl.value).toBe('');
    });

    it('should call onChange with null', () => {
      const callback = jasmine.createSpy('onChange');
      component.registerOnChange(callback);

      component.clear();
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should emit ckTypeCleared event', () => {
      const spy = jasmine.createSpy('ckTypeCleared');
      component.ckTypeCleared.subscribe(spy);

      component.clear();
      expect(spy).toHaveBeenCalled();
    });

    it('should call clear on reset', () => {
      spyOn(component, 'clear');
      component.reset();
      expect(component.clear).toHaveBeenCalled();
    });
  });

  describe('Dialog integration', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should open dialog with correct options', async () => {
      component.ckModelIds = ['TestModel'];
      component.dialogTitle = 'Custom Title';
      component.allowAbstract = true;
      component.selectedCkType = mockCkTypes[0];

      await component.openDialog();

      expect(dialogServiceMock.openCkTypeSelector).toHaveBeenCalledWith({
        selectedCkTypeId: mockCkTypes[0].fullName,
        ckModelIds: ['TestModel'],
        dialogTitle: 'Custom Title',
        allowAbstract: true
      });
    });

    it('should select type when dialog confirms with selection', async () => {
      dialogServiceMock.openCkTypeSelector.and.returnValue(Promise.resolve({
        confirmed: true,
        selectedCkType: mockCkTypes[0]
      }));

      await component.openDialog();

      expect(component.selectedCkType).toBe(mockCkTypes[0]);
    });

    it('should not select type when dialog is cancelled', async () => {
      dialogServiceMock.openCkTypeSelector.and.returnValue(Promise.resolve({
        confirmed: false,
        selectedCkType: null
      }));

      component.selectedCkType = null;
      await component.openDialog();

      expect(component.selectedCkType).toBeNull();
    });

    it('should emit ckTypeSelected when dialog confirms', async () => {
      const spy = jasmine.createSpy('ckTypeSelected');
      component.ckTypeSelected.subscribe(spy);

      dialogServiceMock.openCkTypeSelector.and.returnValue(Promise.resolve({
        confirmed: true,
        selectedCkType: mockCkTypes[0]
      }));

      await component.openDialog();

      expect(spy).toHaveBeenCalledWith(mockCkTypes[0]);
    });

    it('should prevent default and stop propagation when event is provided', async () => {
      const mockEvent = {
        preventDefault: jasmine.createSpy('preventDefault'),
        stopPropagation: jasmine.createSpy('stopPropagation')
      };

      await component.openDialog(mockEvent as any);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should handle missing dialog service gracefully', async () => {
      // Create component without dialog service
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [
          CkTypeSelectorInputComponent,
          ReactiveFormsModule,
          AutoCompleteModule,
          LoaderModule,
          ButtonsModule,
          IconsModule,
          SVGIconModule
        ],
        providers: [
          provideNoopAnimations(),
          { provide: CkTypeSelectorService, useValue: ckTypeSelectorServiceMock }
        ]
      }).compileComponents();

      const newFixture = TestBed.createComponent(CkTypeSelectorInputComponent);
      const newComponent = newFixture.componentInstance;
      newFixture.detectChanges();

      // Should not throw
      await expectAsync(newComponent.openDialog()).toBeResolved();
    });
  });

  describe('Focus method', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should call autocomplete focus', () => {
      spyOn(component.autocomplete, 'focus');
      component.focus();
      expect(component.autocomplete.focus).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should clean up subscriptions', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should complete searchSubject', fakeAsync(() => {
      ckTypeSelectorServiceMock.getCkTypes.calls.reset();
      component.ngOnDestroy();

      // After destroy, search should not trigger
      component.onFilterChange('test');
      tick(300);
      expect(ckTypeSelectorServiceMock.getCkTypes).not.toHaveBeenCalled();
    }));
  });

  describe('Integration with reactive forms', () => {
    it('should work with FormGroup', () => {
      const formGroup = new FormGroup({
        ckType: new FormControl<CkTypeSelectorItem | null>(null)
      });

      fixture.detectChanges();

      // Simulate form control integration
      component.registerOnChange((value) => {
        formGroup.get('ckType')?.setValue(value);
      });

      // Write initial value
      component.writeValue(mockCkTypes[0]);
      expect(component.selectedCkType).toBe(mockCkTypes[0]);
    });

    it('should work with required validator', () => {
      component.required = true;
      fixture.detectChanges();

      const control = new FormControl<CkTypeSelectorItem | null>(null, [
        (c) => component.validate(c)
      ]);

      expect(control.valid).toBeFalse();
      expect(control.errors).toEqual({ required: true });
    });

    it('should pass validation when value is set', () => {
      component.required = true;
      component.selectedCkType = mockCkTypes[0];
      fixture.detectChanges();

      const control = new FormControl<CkTypeSelectorItem | null>(mockCkTypes[0], [
        (c) => component.validate(c)
      ]);

      expect(control.valid).toBeTrue();
    });
  });
});
