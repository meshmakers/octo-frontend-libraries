import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { DialogService, DialogRef, DialogResult } from '@progress/kendo-angular-dialog';
import { AttributeSelectorDialogService } from './attribute-selector-dialog.service';
import { AttributeSelectorDialogComponent, AttributeSelectorDialogResult } from './attribute-selector-dialog.component';
import { AttributeItem } from '@meshmakers/octo-services';

interface MockComponentInstance {
  data?: {
    rtCkTypeId: string;
    selectedAttributes?: string[];
    dialogTitle?: string;
    singleSelect?: boolean;
  };
}

describe('AttributeSelectorDialogService', () => {
  let service: AttributeSelectorDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogResultSubject: Subject<AttributeSelectorDialogResult | Record<string, unknown> | string | undefined>;
  let mockDialogRef: Partial<DialogRef>;
  let mockComponentInstance: MockComponentInstance;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING' },
    { attributePath: 'age', attributeValueType: 'INT' }
  ];

  beforeEach(() => {
    dialogResultSubject = new Subject<AttributeSelectorDialogResult | Record<string, unknown> | string | undefined>();
    mockComponentInstance = {};

    mockDialogRef = {
      result: dialogResultSubject.asObservable() as unknown as Observable<DialogResult>,
      content: {
        instance: mockComponentInstance
      } as unknown as DialogRef['content']
    };

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(mockDialogRef as DialogRef);

    TestBed.configureTestingModule({
      providers: [
        AttributeSelectorDialogService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });

    service = TestBed.inject(AttributeSelectorDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openAttributeSelector', () => {
    it('should open dialog with correct configuration', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Emit result
      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(dialogServiceMock.open).toHaveBeenCalledWith({
        content: AttributeSelectorDialogComponent,
        width: 900,
        height: 700,
        minWidth: 800,
        minHeight: 650,
        title: 'Select Attributes'
      });
    });

    it('should use custom dialog title when provided', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity', undefined, 'Custom Title');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(dialogServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: 'Custom Title'
        })
      );
    });

    it('should pass data to dialog component', async () => {
      const selectedAttrs = ['name', 'age'];
      const resultPromise = service.openAttributeSelector('TestType/Entity', selectedAttrs, 'My Title');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: selectedAttrs,
        dialogTitle: 'My Title',
        singleSelect: undefined
      });
    });

    it('should return confirmed=true with selected attributes when user confirms', async () => {
      const dialogResult: AttributeSelectorDialogResult = {
        selectedAttributes: mockAttributes
      };

      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next(dialogResult);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual(mockAttributes);
    });

    it('should return confirmed=false with empty array when user cancels', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Simulate cancel (undefined result)
      dialogResultSubject.next(undefined);
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result is not an object', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next('invalid');
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result has no selectedAttributes property', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next({ someOtherProperty: 'value' });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when dialog throws error', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Simulate error (e.g., ESC key pressed)
      dialogResultSubject.error(new Error('Dialog closed'));

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle dialog without content instance', async () => {
      mockDialogRef.content = null as unknown as DialogRef['content'];

      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: mockAttributes });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
    });

    it('should handle empty selectedAttributes array', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: [] });
      dialogResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should work without optional parameters', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      dialogResultSubject.next({ selectedAttributes: mockAttributes });
      dialogResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: undefined,
        dialogTitle: undefined,
        singleSelect: undefined
      });
    });
  });
});
