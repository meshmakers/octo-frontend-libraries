import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { MarkdownConfigDialogComponent, MarkdownConfigResult } from './markdown-config-dialog.component';

/**
 * Unit tests for MarkdownConfigDialogComponent.
 * These tests focus on component logic without rendering the template,
 * avoiding the complexity of mocking Kendo UI components.
 */
describe('MarkdownConfigDialogComponent', () => {
  let component: MarkdownConfigDialogComponent;
  let mockWindowRef: jasmine.SpyObj<WindowRef>;
  let closeSpy: jasmine.Spy;

  beforeEach(() => {
    mockWindowRef = jasmine.createSpyObj('WindowRef', ['close']);
    closeSpy = mockWindowRef.close as jasmine.Spy;

    TestBed.configureTestingModule({
      providers: [
        MarkdownConfigDialogComponent,
        { provide: WindowRef, useValue: mockWindowRef }
      ]
    });

    component = TestBed.inject(MarkdownConfigDialogComponent);
  });

  // ========================================================================
  // Basic Component Tests
  // ========================================================================

  describe('initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have showPreview signal initially false', () => {
      expect(component.showPreview()).toBeFalse();
    });

    it('should have default values before ngOnInit', () => {
      expect(component.content).toBe('');
      expect(component.resolveVariables).toBeTrue();
      expect(component.padding).toBe('16px');
      expect(component.textAlign).toBe('left');
    });
  });

  // ========================================================================
  // Input Initialization Tests
  // ========================================================================

  describe('input initialization via ngOnInit', () => {
    it('should initialize content from input', () => {
      component.initialContent = '# Hello';
      component.ngOnInit();
      expect(component.content).toBe('# Hello');
    });

    it('should initialize resolveVariables from input', () => {
      component.initialResolveVariables = false;
      component.ngOnInit();
      expect(component.resolveVariables).toBeFalse();
    });

    it('should initialize padding from input', () => {
      component.initialPadding = '24px';
      component.ngOnInit();
      expect(component.padding).toBe('24px');
    });

    it('should initialize textAlign from input', () => {
      component.initialTextAlign = 'center';
      component.ngOnInit();
      expect(component.textAlign).toBe('center');
    });

    it('should use default when initialContent is undefined', () => {
      component.initialContent = undefined;
      component.ngOnInit();
      expect(component.content).toBe('');
    });

    it('should use default when initialResolveVariables is undefined', () => {
      component.initialResolveVariables = undefined;
      component.ngOnInit();
      expect(component.resolveVariables).toBeTrue();
    });

    it('should use default when initialPadding is undefined', () => {
      component.initialPadding = undefined;
      component.ngOnInit();
      expect(component.padding).toBe('16px');
    });

    it('should use default when initialTextAlign is undefined', () => {
      component.initialTextAlign = undefined;
      component.ngOnInit();
      expect(component.textAlign).toBe('left');
    });

    it('should initialize all inputs together', () => {
      component.initialContent = '# Test';
      component.initialResolveVariables = false;
      component.initialPadding = '32px';
      component.initialTextAlign = 'right';
      component.ngOnInit();

      expect(component.content).toBe('# Test');
      expect(component.resolveVariables).toBeFalse();
      expect(component.padding).toBe('32px');
      expect(component.textAlign).toBe('right');
    });
  });

  // ========================================================================
  // Save Tests
  // ========================================================================

  describe('save', () => {
    it('should close window with current values on save', () => {
      component.content = '# Test Content';
      component.resolveVariables = true;
      component.padding = '20px';
      component.textAlign = 'center';

      component.onSave();

      expect(mockWindowRef.close).toHaveBeenCalledWith(jasmine.objectContaining({
        content: '# Test Content',
        resolveVariables: true,
        padding: '20px',
        textAlign: 'center',
        ckTypeId: ''
      }));
    });

    it('should emit undefined padding when padding is empty', () => {
      component.content = 'Test';
      component.padding = '';

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.padding).toBeUndefined();
    });

    it('should emit left textAlign', () => {
      component.content = 'Test';
      component.textAlign = 'left';

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.textAlign).toBe('left');
    });

    it('should emit center textAlign', () => {
      component.content = 'Test';
      component.textAlign = 'center';

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.textAlign).toBe('center');
    });

    it('should emit right textAlign', () => {
      component.content = 'Test';
      component.textAlign = 'right';

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.textAlign).toBe('right');
    });

    it('should emit resolveVariables as false when set', () => {
      component.content = 'Test';
      component.resolveVariables = false;

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.resolveVariables).toBeFalse();
    });

    it('should emit empty content when not set', () => {
      component.content = '';

      component.onSave();

      const result = closeSpy.calls.mostRecent().args[0] as MarkdownConfigResult;
      expect(result.content).toBe('');
    });
  });

  // ========================================================================
  // Cancel Tests
  // ========================================================================

  describe('cancel', () => {
    it('should close window without result on cancel', () => {
      component.onCancel();
      expect(mockWindowRef.close).toHaveBeenCalledWith();
    });

    it('should not pass any result on cancel', () => {
      component.onCancel();
      expect(mockWindowRef.close).toHaveBeenCalledTimes(1);
      expect(closeSpy.calls.mostRecent().args.length).toBe(0);
    });
  });

  // ========================================================================
  // Preview Toggle Tests
  // ========================================================================

  describe('preview toggle', () => {
    it('should toggle showPreview to true', () => {
      expect(component.showPreview()).toBeFalse();
      component.showPreview.set(true);
      expect(component.showPreview()).toBeTrue();
    });

    it('should toggle showPreview to false', () => {
      component.showPreview.set(true);
      expect(component.showPreview()).toBeTrue();
      component.showPreview.set(false);
      expect(component.showPreview()).toBeFalse();
    });
  });

  // ========================================================================
  // Content Editing Tests
  // ========================================================================

  describe('content editing', () => {
    it('should allow content to be set', () => {
      component.content = '# New Content';
      expect(component.content).toBe('# New Content');
    });

    it('should allow empty content', () => {
      component.content = '';
      expect(component.content).toBe('');
    });

    it('should handle multiline content', () => {
      const multiline = '# Title\n\nParagraph\n\n- Item 1\n- Item 2';
      component.content = multiline;
      expect(component.content).toBe(multiline);
    });

    it('should handle special markdown characters', () => {
      const special = '**bold** *italic* `code` [link](url) > quote';
      component.content = special;
      expect(component.content).toBe(special);
    });

    it('should handle variable syntax in content', () => {
      const withVars = 'Hello $name and ${otherName}';
      component.content = withVars;
      expect(component.content).toBe(withVars);
    });
  });

  // ========================================================================
  // Text Alignment Tests
  // ========================================================================

  describe('text alignment', () => {
    it('should accept left alignment', () => {
      component.textAlign = 'left';
      expect(component.textAlign).toBe('left');
    });

    it('should accept center alignment', () => {
      component.textAlign = 'center';
      expect(component.textAlign).toBe('center');
    });

    it('should accept right alignment', () => {
      component.textAlign = 'right';
      expect(component.textAlign).toBe('right');
    });
  });

  // ========================================================================
  // Padding Tests
  // ========================================================================

  describe('padding', () => {
    it('should accept pixel values', () => {
      component.padding = '24px';
      expect(component.padding).toBe('24px');
    });

    it('should accept rem values', () => {
      component.padding = '1.5rem';
      expect(component.padding).toBe('1.5rem');
    });

    it('should accept shorthand padding', () => {
      component.padding = '16px 24px';
      expect(component.padding).toBe('16px 24px');
    });

    it('should accept empty padding', () => {
      component.padding = '';
      expect(component.padding).toBe('');
    });
  });
});
