import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DialogService, DialogRef } from '@progress/kendo-angular-dialog';
import { AttributeSortSelectorDialogService } from './attribute-sort-selector-dialog.service';
import {
  AttributeSortSelectorDialogComponent,
  AttributeSortSelectorDialogResult,
  AttributeSortItem
} from './attribute-sort-selector-dialog.component';

describe('AttributeSortSelectorDialogService', () => {
  let service: AttributeSortSelectorDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogResultSubject: Subject<any>;
  let mockDialogRef: Partial<DialogRef>;
  let mockComponentInstance: any;

  const mockSortAttributes: AttributeSortItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING', sortOrder: 'ascending' },
    { attributePath: 'createdAt', attributeValueType: 'DATE_TIME', sortOrder: 'descending' }
  ];

  beforeEach(() => {
    dialogResultSubject = new Subject<any>();
    mockComponentInstance = {};

    mockDialogRef = {
      result: dialogResultSubject.asObservable(),
      content: {
        instance: mockComponentInstance
      } as any
    };

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(mockDialogRef as DialogRef);

    TestBed.configureTestingModule({
      providers: [
        AttributeSortSelectorDialogService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });

    service = TestBed.inject(AttributeSortSelectorDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openAttributeSortSelector', () => {
    it('should open dialog with correct configuration', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(dialogServiceMock.open).toHaveBeenCalledWith({
        content: AttributeSortSelectorDialogComponent,
        width: 1100,
        height: 750,
        minWidth: 1050,
        minHeight: 700,
        title: 'Select Attributes with Sort Order'
      });
    });

    it('should use custom dialog title when provided', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity', undefined, 'Sort Configuration');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(dialogServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: 'Sort Configuration'
        })
      );
    });

    it('should pass data to dialog component', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity', mockSortAttributes, 'Custom Title');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        ckTypeId: 'TestType/Entity',
        selectedAttributes: mockSortAttributes,
        dialogTitle: 'Custom Title'
      });
    });

    it('should return confirmed=true with selected attributes when user confirms', async () => {
      const dialogResult: AttributeSortSelectorDialogResult = {
        selectedAttributes: mockSortAttributes
      };

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next(dialogResult);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual(mockSortAttributes);
    });

    it('should return confirmed=false with empty array when user cancels', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next(undefined);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result is not an object', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next('invalid');
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result has no selectedAttributes property', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ someOtherProperty: 'value' });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when dialog throws error', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.error(new Error('Dialog closed'));

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle dialog without content instance', async () => {
      mockDialogRef.content = null as any;

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: mockSortAttributes });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
    });

    it('should handle null selectedAttributes in result', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: null });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle empty selectedAttributes array', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should work without optional parameters', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: mockSortAttributes });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        ckTypeId: 'TestType/Entity',
        selectedAttributes: undefined,
        dialogTitle: undefined
      });
    });

    it('should preserve sort order in returned attributes', async () => {
      const mixedSortAttributes: AttributeSortItem[] = [
        { attributePath: 'field1', attributeValueType: 'STRING', sortOrder: 'standard' },
        { attributePath: 'field2', attributeValueType: 'INT', sortOrder: 'ascending' },
        { attributePath: 'field3', attributeValueType: 'DATE_TIME', sortOrder: 'descending' }
      ];

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: mixedSortAttributes });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.selectedAttributes[0].sortOrder).toBe('standard');
      expect(result.selectedAttributes[1].sortOrder).toBe('ascending');
      expect(result.selectedAttributes[2].sortOrder).toBe('descending');
    });
  });
});
