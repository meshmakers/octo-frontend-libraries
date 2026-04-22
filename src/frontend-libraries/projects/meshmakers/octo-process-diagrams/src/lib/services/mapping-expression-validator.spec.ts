import { TestBed } from '@angular/core/testing';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { createMappingExpressionValidator, MappingExpressionValidatorFn } from './mapping-expression-validator';

describe('createMappingExpressionValidator', () => {
  let service: ExpressionEvaluatorService;
  let validator: MappingExpressionValidatorFn;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExpressionEvaluatorService],
    });
    service = TestBed.inject(ExpressionEvaluatorService);
    validator = createMappingExpressionValidator(service);
  });

  it('should validate simple arithmetic', () => {
    const result = validator('value / 100');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('0.42');
  });

  it('should validate multiplication', () => {
    const result = validator('value * 2');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('84');
  });

  it('should validate ternary expression', () => {
    const result = validator('value > 0 ? value : 0');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('42');
  });

  it('should validate abs function', () => {
    const result = validator('abs(value)');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('42');
  });

  it('should validate min/max clamping', () => {
    const result = validator('min(max(value, 0), 100)');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('42');
  });

  it('should return error for invalid syntax', () => {
    const result = validator('value ///');
    expect(result.valid).toBeFalse();
    expect(result.error).toBeDefined();
  });

  it('should return error for empty expression', () => {
    const result = validator('');
    expect(result.valid).toBeFalse();
    expect(result.error).toBe('Expression must not be empty');
  });

  it('should return error for whitespace-only expression', () => {
    const result = validator('   ');
    expect(result.valid).toBeFalse();
    expect(result.error).toBe('Expression must not be empty');
  });

  it('should use custom test value', () => {
    const customValidator = createMappingExpressionValidator(service, 100);
    const result = customValidator('value / 2');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('50');
  });

  it('should format integer results without decimals', () => {
    const result = validator('value * 1');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('42');
  });

  it('should format decimal results trimming trailing zeros', () => {
    const result = validator('value / 3');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('14');
  });

  it('should validate subtraction for calibration', () => {
    const result = validator('value - 2.5');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('39.5');
  });

  it('should validate inversion expression', () => {
    const result = validator('100 - value');
    expect(result.valid).toBeTrue();
    expect(result.preview).toBe('58');
  });
});
