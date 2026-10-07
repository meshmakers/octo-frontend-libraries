import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataPointPickerComponent } from '../../../data-point-picker/data-point-picker.component';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { DataMappingListComponent, DataPointMappingItem, ExpressionValidatorFn, } from './data-mapping-list.component';

describe('DataMappingListComponent', () => {
  let component: DataMappingListComponent;
  let fixture: ComponentFixture<DataMappingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataMappingListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataMappingListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('names the icon-only card buttons after the mapping (AB#5581 guard)', async () => {
    // The data point picker needs Apollo; it is not under test here.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [DataMappingListComponent] })
      .overrideComponent(DataMappingListComponent, {
        remove: { imports: [DataPointPickerComponent] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(DataMappingListComponent);
    fixture.componentInstance.mappings = [
      { name: 'Room temperature', sourceAttributePath: 'currentValue', mappingExpression: '', targetAttributePath: 'temperature' },
      { sourceAttributePath: 'currentValue', mappingExpression: '', targetAttributePath: 'humidity' },
    ];
    fixture.detectChanges();
    const removes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-action="delete"]');
    expect(removes[0].getAttribute('aria-label')).toBe('Remove mapping Room temperature');
    expect(removes[1].getAttribute('aria-label')).toBe('Remove mapping MAPPING 2');
    expect(removes[0].getAttribute('title')).toBe('Remove mapping');
    expectIconButtonsAccessible(fixture);
  });

  describe('expression validation', () => {
    let mapping: DataPointMappingItem;

    beforeEach(() => {
      mapping = {
        sourceAttributePath: 'CurrentValue',
        mappingExpression: '',
        targetAttributePath: 'Temperature',
      };
      component.mappings = [mapping];
    });

    it('should not validate when no validator is provided', () => {
      component.expressionValidator = undefined;
      component.onExpressionChange(mapping, 'value / 100');

      expect(mapping._expressionValid).toBeUndefined();
      expect(mapping._expressionError).toBeUndefined();
      expect(mapping._expressionPreview).toBeUndefined();
    });

    it('should clear validation state when expression is empty', () => {
      const validator: ExpressionValidatorFn = () => ({ valid: true, preview: '42' });
      component.expressionValidator = validator;

      // First set a value to create validation state
      mapping._expressionValid = true;
      mapping._expressionPreview = '42';

      // Then clear the expression
      component.onExpressionChange(mapping, '');

      expect(mapping._expressionValid).toBeUndefined();
      expect(mapping._expressionError).toBeUndefined();
      expect(mapping._expressionPreview).toBeUndefined();
    });

    it('should show success when validator returns valid result', () => {
      const validator: ExpressionValidatorFn = () => ({
        valid: true,
        preview: '0.42',
      });
      component.expressionValidator = validator;

      component.onExpressionChange(mapping, 'value / 100');

      expect(mapping._expressionValid).toBe(true);
      expect(mapping._expressionError).toBeUndefined();
      expect(mapping._expressionPreview).toBe('0.42');
    });

    it('should show error when validator returns invalid result', () => {
      const validator: ExpressionValidatorFn = () => ({
        valid: false,
        error: 'Unexpected token at position 5',
      });
      component.expressionValidator = validator;

      component.onExpressionChange(mapping, 'value ///');

      expect(mapping._expressionValid).toBe(false);
      expect(mapping._expressionError).toBe('Unexpected token at position 5');
      expect(mapping._expressionPreview).toBeUndefined();
    });

    it('should emit mappingChanged when expression changes', () => {
      const validator: ExpressionValidatorFn = () => ({ valid: true, preview: '42' });
      component.expressionValidator = validator;

      vi.spyOn(component.mappingChanged, 'emit').mockReturnValue(undefined);
      component.onExpressionChange(mapping, 'value * 2');

      expect(component.mappingChanged.emit).toHaveBeenCalledWith(mapping);
    });

    it('should update mapping.mappingExpression with new value', () => {
      const validator: ExpressionValidatorFn = () => ({ valid: true, preview: '84' });
      component.expressionValidator = validator;

      component.onExpressionChange(mapping, 'value * 2');

      expect(mapping.mappingExpression).toBe('value * 2');
    });

    it('should handle whitespace-only expression as empty', () => {
      const validator: ExpressionValidatorFn = () => ({ valid: true, preview: '42' });
      component.expressionValidator = validator;

      component.onExpressionChange(mapping, '   ');

      expect(mapping._expressionValid).toBeUndefined();
    });
  });
});
