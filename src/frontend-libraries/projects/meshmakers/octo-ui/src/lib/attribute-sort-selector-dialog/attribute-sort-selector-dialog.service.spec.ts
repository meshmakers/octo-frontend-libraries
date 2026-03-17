import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { AttributeSortSelectorDialogService } from './attribute-sort-selector-dialog.service';
import {
  AttributeSortSelectorDialogComponent,
  AttributeSortSelectorDialogResult,
  AttributeSortItem
} from './attribute-sort-selector-dialog.component';

interface MockComponentInstance {
  data?: {
    ckTypeId: string;
    selectedAttributes?: AttributeSortItem[];
    dialogTitle?: string;
    includeNavigationProperties?: boolean;
    hideNavigationControls?: boolean;
    attributePaths?: string[];
  };
}

describe('AttributeSortSelectorDialogService', () => {
  let service: AttributeSortSelectorDialogService;
  let windowServiceMock: jasmine.SpyObj<WindowService>;
  let windowResultSubject: Subject<AttributeSortSelectorDialogResult | WindowCloseResult | Record<string, unknown> | string | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWindowRef: Record<string, any>;
  let mockComponentInstance: MockComponentInstance;

  const mockSortAttributes: AttributeSortItem[] = [
    { attributePath: 'name', attributeValueType: 'STRING', sortOrder: 'ascending' },
    { attributePath: 'createdAt', attributeValueType: 'DATE_TIME', sortOrder: 'descending' }
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
        AttributeSortSelectorDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });

    service = TestBed.inject(AttributeSortSelectorDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openAttributeSortSelector', () => {
    it('should open window with correct configuration', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith({
        content: AttributeSortSelectorDialogComponent,
        width: 1200,
        height: 750,
        minWidth: 1050,
        minHeight: 700,
        resizable: true,
        title: 'Select Attributes with Sort Order'
      });
    });

    it('should use custom dialog title when provided', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity', undefined, 'Sort Configuration');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(windowServiceMock.open).toHaveBeenCalledWith(
        jasmine.objectContaining({
          title: 'Sort Configuration'
        })
      );
    });

    it('should pass data to dialog component', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity', mockSortAttributes, 'Custom Title');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        ckTypeId: 'TestType/Entity',
        selectedAttributes: mockSortAttributes,
        dialogTitle: 'Custom Title',
        includeNavigationProperties: undefined,
        hideNavigationControls: undefined,
        attributePaths: undefined
      });
    });

    it('should return confirmed=true with selected attributes when user confirms', async () => {
      const dialogResult: AttributeSortSelectorDialogResult = {
        selectedAttributes: mockSortAttributes
      };

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next(dialogResult);
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual(mockSortAttributes);
    });

    it('should return confirmed=false when WindowCloseResult (X button)', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next(new WindowCloseResult());
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when user cancels', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next(undefined);
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result is not an object', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next('invalid');
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when result has no selectedAttributes property', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ someOtherProperty: 'value' });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should return confirmed=false with empty array when window throws error', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.error(new Error('Window closed'));

      const result = await resultPromise;

      expect(result.confirmed).toBe(false);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle window without content instance', async () => {
      mockWindowRef['content'] = null as unknown as WindowRef['content'];

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: mockSortAttributes });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
    });

    it('should handle null selectedAttributes in result', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: null });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should handle empty selectedAttributes array', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.confirmed).toBe(true);
      expect(result.selectedAttributes).toEqual([]);
    });

    it('should work without optional parameters', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: mockSortAttributes });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual({
        ckTypeId: 'TestType/Entity',
        selectedAttributes: undefined,
        dialogTitle: undefined,
        includeNavigationProperties: undefined,
        hideNavigationControls: undefined,
        attributePaths: undefined
      });
    });

    it('should preserve sort order in returned attributes', async () => {
      const mixedSortAttributes: AttributeSortItem[] = [
        { attributePath: 'field1', attributeValueType: 'STRING', sortOrder: 'standard' },
        { attributePath: 'field2', attributeValueType: 'INT', sortOrder: 'ascending' },
        { attributePath: 'field3', attributeValueType: 'DATE_TIME', sortOrder: 'descending' }
      ];

      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

      windowResultSubject.next({ selectedAttributes: mixedSortAttributes });
      windowResultSubject.complete();

      const result = await resultPromise;

      expect(result.selectedAttributes[0].sortOrder).toBe('standard');
      expect(result.selectedAttributes[1].sortOrder).toBe('ascending');
      expect(result.selectedAttributes[2].sortOrder).toBe('descending');
    });

    it('should pass new optional params to dialog component', async () => {
      const resultPromise = service.openAttributeSortSelector(
        'TestType/Entity', undefined, undefined, false, true
      );

      windowResultSubject.next({ selectedAttributes: [] });
      windowResultSubject.complete();

      await resultPromise;

      expect(mockComponentInstance.data).toEqual(jasmine.objectContaining({
        includeNavigationProperties: false,
        hideNavigationControls: true
      }));
    });

    it('should set resizable to true', async () => {
      const resultPromise = service.openAttributeSortSelector('TestType/Entity');

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
