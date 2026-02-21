import { MarkdownConfigDialogComponent, MarkdownConfigResult } from './markdown-config-dialog.component';

/**
 * Unit tests for MarkdownConfigDialogComponent.
 * These tests focus on component logic without rendering the template,
 * avoiding the complexity of mocking Kendo UI components.
 */
describe('MarkdownConfigDialogComponent', () => {
  let component: MarkdownConfigDialogComponent;

  beforeEach(() => {
    component = new MarkdownConfigDialogComponent();
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
    it('should emit save event with current values', (done) => {
      component.content = '# Test Content';
      component.resolveVariables = true;
      component.padding = '20px';
      component.textAlign = 'center';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.content).toBe('# Test Content');
        expect(result.resolveVariables).toBeTrue();
        expect(result.padding).toBe('20px');
        expect(result.textAlign).toBe('center');
        expect(result.ckTypeId).toBe('');
        done();
      });

      component.onSave();
    });

    it('should emit undefined padding when padding is empty', (done) => {
      component.content = 'Test';
      component.padding = '';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.padding).toBeUndefined();
        done();
      });

      component.onSave();
    });

    it('should emit left textAlign', (done) => {
      component.content = 'Test';
      component.textAlign = 'left';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.textAlign).toBe('left');
        done();
      });

      component.onSave();
    });

    it('should emit center textAlign', (done) => {
      component.content = 'Test';
      component.textAlign = 'center';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.textAlign).toBe('center');
        done();
      });

      component.onSave();
    });

    it('should emit right textAlign', (done) => {
      component.content = 'Test';
      component.textAlign = 'right';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.textAlign).toBe('right');
        done();
      });

      component.onSave();
    });

    it('should emit resolveVariables as false when set', (done) => {
      component.content = 'Test';
      component.resolveVariables = false;

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.resolveVariables).toBeFalse();
        done();
      });

      component.onSave();
    });

    it('should emit empty content when not set', (done) => {
      component.content = '';

      component.save.subscribe((result: MarkdownConfigResult) => {
        expect(result.content).toBe('');
        done();
      });

      component.onSave();
    });
  });

  // ========================================================================
  // Cancel Tests
  // ========================================================================

  describe('cancel', () => {
    it('should emit cancelled event', (done) => {
      component.cancelled.subscribe(() => {
        expect(true).toBeTrue();
        done();
      });

      component.onCancel();
    });

    it('should not emit save event on cancel', () => {
      let saveCalled = false;
      component.save.subscribe(() => {
        saveCalled = true;
      });

      component.onCancel();
      expect(saveCalled).toBeFalse();
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
