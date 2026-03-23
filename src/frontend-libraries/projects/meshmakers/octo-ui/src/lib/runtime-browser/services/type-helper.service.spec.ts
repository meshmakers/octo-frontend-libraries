import { TestBed } from '@angular/core/testing';

import { TypeHelperService } from './type-helper.service';
import { RtEntityDto } from '@meshmakers/octo-services';

describe('TypeHelperService', () => {
  let service: TypeHelperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeHelperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isRuntimeEntity', () => {
    it('should return true if both rtId and ckTypeId are present', () => {
      const validEntity = { rtId: 'a1eb19f061208b98373fc381', ckTypeId: 'Basic/TreeNode' } as RtEntityDto;
      expect(service.isRuntimeEntity(validEntity)).toBeTrue();
    });

    it('should return false if rtId is missing', () => {
      const invalidEntity = { ckTypeId: 'Basic/Tree' };
      expect(service.isRuntimeEntity(invalidEntity)).toBeFalsy();
    });

    it('should return false if ckTypeId is missing', () => {
      const invalidEntity = { rtId: 'f276b0ca7d6e1ae55d295d2a' };
      expect(service.isRuntimeEntity(invalidEntity)).toBeFalsy();
    });

    it('should return false for an empty object', () => {
      expect(service.isRuntimeEntity({})).toBeFalsy();
    });

    it('should return false for null or undefined', () => {
      expect(service.isRuntimeEntity(null)).toBeFalsy();
      expect(service.isRuntimeEntity(undefined)).toBeFalsy();
    });

    it('should return false if properties are present but falsy (e.g., empty strings)', () => {
      const emptyProps = { rtId: '', ckTypeId: '' };
      expect(service.isRuntimeEntity(emptyProps)).toBeFalsy();
    });
  });
});
