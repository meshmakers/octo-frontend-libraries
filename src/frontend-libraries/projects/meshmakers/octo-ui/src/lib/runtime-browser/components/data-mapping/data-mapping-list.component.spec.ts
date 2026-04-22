import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DataMappingListComponent,
  DataPointMappingItem,
  ExpressionValidatorFn,
} from './data-mapping-list.component';

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

      expect(mapping._expressionValid).toBeTrue();
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

      expect(mapping._expressionValid).toBeFalse();
      expect(mapping._expressionError).toBe('Unexpected token at position 5');
      expect(mapping._expressionPreview).toBeUndefined();
    });

    it('should emit mappingChanged when expression changes', () => {
      const validator: ExpressionValidatorFn = () => ({ valid: true, preview: '42' });
      component.expressionValidator = validator;

      spyOn(component.mappingChanged, 'emit');
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
