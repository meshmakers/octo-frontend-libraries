import { PascalCasePipe } from './pascal-case.pipe';

describe('PascalCasePipe', () => {
  let pipe: PascalCasePipe;

  beforeEach(() => {
    pipe = new PascalCasePipe();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should capitalize first letter of lowercase string', () => {
    expect(pipe.transform('hello')).toBe('Hello');
  });

  it('should keep already capitalized string unchanged', () => {
    expect(pipe.transform('Hello')).toBe('Hello');
  });

  it('should capitalize single character', () => {
    expect(pipe.transform('a')).toBe('A');
  });

  it('should return empty string as is', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should return null as is', () => {
    expect(pipe.transform(null as any)).toBeNull();
  });

  it('should return undefined as is', () => {
    expect(pipe.transform(undefined as any)).toBeUndefined();
  });

  it('should only capitalize first letter, not entire string', () => {
    expect(pipe.transform('hELLO wORLD')).toBe('HELLO wORLD');
  });

  it('should handle string with numbers', () => {
    expect(pipe.transform('123abc')).toBe('123abc');
  });

  it('should handle string starting with space', () => {
    expect(pipe.transform(' hello')).toBe(' hello');
  });
});
