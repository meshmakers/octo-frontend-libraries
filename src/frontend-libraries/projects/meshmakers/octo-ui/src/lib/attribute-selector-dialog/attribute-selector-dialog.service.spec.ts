import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { AttributeSelectorDialogService } from './attribute-selector-dialog.service';
import { AttributeSelectorDialogComponent, AttributeSelectorDialogResult } from './attribute-selector-dialog.component';
import { AttributeItem } from '@meshmakers/octo-services';

interface MockComponentInstance {
  data?: {
    rtCkTypeId: string;
    selectedAttributes?: string[];
    dialogTitle?: string;
    singleSelect?: boolean;
    additionalAttributes?: AttributeItem[];
    includeNavigationProperties?: boolean;
    maxDepth?: number;
    hideNavigationControls?: boolean;
    attributePaths?: string[];
  };
}

describe('AttributeSelectorDialogService', () => {
  let service: AttributeSelectorDialogService;
  let windowServiceMock: jasmine.SpyObj<WindowService>;
  let windowResultSubject: Subject<AttributeSelectorDialogResult | WindowCloseResult | Record<string, unknown> | string | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWindowRef: Record<string, any>;
  let mockComponentInstance: MockComponentInstance;

  const mockAttributes: AttributeItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING', description: 'The name' },
    { attributePath: 'age', attributeValueType: 'INT', description: null }
  ];

  beforeEach(() => {
    sessionStorage.clear();
    windowResultSubject = new Subject();
    mockComponentInstance = {};

    mockWindowRef = {
      result: windowResultSubject.asObservable(),
      content: {
        instance: mockComponentInstance
      } as unknown as WindowRef['content'],
      window: {
        location: {
          nativeElement: {
            getBoundingClientRect: () => ({
              width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600,
              toJSON: () => ({})
            })
          }
        }
      }
    };

    windowServiceMock = jasmine.createSpyObj('WindowService', ['open']);
    windowServiceMock.open.and.returnValue(mockWindowRef as WindowRef);

    TestBed.configureTestingModule({
      providers: [
        AttributeSelectorDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });

    service = TestBed.inject(AttributeSelectorDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openAttributeSelector', () => {
    it('should open window with correct configuration', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Emit result
      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith({
        content: AttributeSelectorDialogComponent,
        width: 1000,
        height: 700,
        minWidth: 850,
        minHeight: 650,
        resizable: true,
        title: 'Select Attributes'
      });
    });

    it('should use smaller dimensions for singleSelect mode', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity', undefined, undefined, true);

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith({
        content: AttributeSelectorDialogComponent,
        width: 550,
        height: 650,
        minWidth: 450,
        minHeight: 550,
        resizable: true,
        title: 'Select Attributes'
      });
    });

    it('should use custom dialog title when provided', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity', undefined, 'Custom Title');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: 'Custom Title'
        })
      );
    });

    it('should pass data to dialog component', async () => {
      const selectedAttrs = ['name', 'age'];
      const resultPromise = service.openAttributeSelector('TestType/Entity', selectedAttrs, 'My Title');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: selectedAttrs,
        dialogTitle: 'My Title',
        singleSelect: undefined,
        additionalAttributes: undefined,
        includeNavigationProperties: undefined,
        maxDepth: undefined,
        hideNavigationControls: undefined,
        attributePaths: undefined
      });
    });

    it('should return confirmed=true with selected attributes when user confirms', async () => {
      const dialogResult: AttributeSelectorDialogResult = {
        selectedAttributes: mockAttributes
      };

      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next(dialogResult);
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual(mockAttributes);
    });

    it('should return confirmed=false when WindowCloseResult (X button)', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next(new WindowCloseResult());
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when user cancels', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Simulate cancel (undefined result)
      windowResultSubject.next(undefined);
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result is not an object', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next('invalid');
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result has no selectedAttributes property', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next({ someOtherProperty: 'value' });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when window throws error', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      // Simulate error (e.g., ESC key pressed)
      windowResultSubject.error(new Error('Window closed'));

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle window without content instance', async () => {
      mockWindowRef['content'] = null as unknown as WindowRef['content'];

      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: mockAttributes });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
    });

    it('should handle empty selectedAttributes array', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should work without optional parameters', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: mockAttributes });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        rtCkTypeId: 'TestType/Entity',
        selectedAttributes: undefined,
        dialogTitle: undefined,
        singleSelect: undefined,
        additionalAttributes: undefined,
        includeNavigationProperties: undefined,
        maxDepth: undefined,
        hideNavigationControls: undefined,
        attributePaths: undefined
      });
    });

    it('should pass new optional params to dialog component', async () => {
      const resultPromise = service.openAttributeSelector(
        'TestType/Entity', undefined, undefined, undefined, undefined,
        false, 2, true
      );

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual(jasmine.objectContaining({
        includeNavigationProperties: false,
        maxDepth: 2,
        hideNavigationControls: true
      }));
    });

    it('should set resizable to true', async () => {
      const resultPromise = service.openAttributeSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          resizable: true
        })
      );
    });
  });
});
