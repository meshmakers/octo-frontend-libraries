/**
 * Styles Panel Component - Unit Tests
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StylesPanelComponent } from './styles-panel.component';
import { StyleClass, createStyleClass } from '../../primitives';

describe('StylesPanelComponent', () => {
  let component: StylesPanelComponent;
  let fixture: ComponentFixture<StylesPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StylesPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StylesPanelComponent);
    component = fixture.componentInstance;
  });

  // ============================================================================
  // Component Initialization
  // ============================================================================

  describe('Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have empty styleClasses initially', () => {
      expect(component.styleClasses).toEqual([]);
    });

    it('should have no selected style initially', () => {
      expect(component.selectedStyleId).toBeNull();
      expect(component.selectedStyle).toBeNull();
    });
  });

  // ============================================================================
  // Params Handling
  // ============================================================================

  describe('Params Handling', () => {
    it('should read styleClasses from params as array', () => {
      const testStyles: StyleClass[] = [
        createStyleClass('style-1'),
        createStyleClass('style-2')
      ];

      component.params = { styleClasses: testStyles };

      expect(component.styleClasses).toEqual(testStyles);
    });

    it('should read styleClasses from params as signal', () => {
      const testStyles: StyleClass[] = [
        createStyleClass('signal-style-1')
      ];
      const stylesSignal = signal(testStyles);

      component.params = { styleClasses: stylesSignal };

      expect(component.styleClasses).toEqual(testStyles);
    });

    it('should handle undefined styleClasses in params', () => {
      component.params = {};

      expect(component.styleClasses).toEqual([]);
    });
  });

  // ============================================================================
  // Add Style
  // ============================================================================

  describe('Add Style', () => {
    let onStyleClassesChangeSpy: jasmine.Spy;

    beforeEach(() => {
      onStyleClassesChangeSpy = jasmine.createSpy('onStyleClassesChange');
      component.params = {
        styleClasses: [],
        onStyleClassesChange: onStyleClassesChangeSpy
      };
    });

    it('should add a new style when addStyle is called', () => {
      component.addStyle();

      expect(onStyleClassesChangeSpy).toHaveBeenCalledTimes(1);
      const addedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(addedStyles.length).toBe(1);
      expect(addedStyles[0].name).toBe('style-1');
    });

    it('should generate unique names for subsequent styles', () => {
      const existingStyles: StyleClass[] = [
        { id: 'existing-1', name: 'style-1', style: {} },
        { id: 'existing-2', name: 'style-2', style: {} }
      ];

      component.params = {
        styleClasses: existingStyles,
        onStyleClassesChange: onStyleClassesChangeSpy
      };

      component.addStyle();

      const addedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(addedStyles.length).toBe(3);
      expect(addedStyles[2].name).toBe('style-3');
    });

    it('should select the newly added style', () => {
      component.addStyle();

      const addedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(component.selectedStyleId).toBe(addedStyles[0].id);
    });
  });

  // ============================================================================
  // Delete Style
  // ============================================================================

  describe('Delete Style', () => {
    let onStyleClassesChangeSpy: jasmine.Spy;
    const testStyles: StyleClass[] = [
      { id: 'style-1', name: 'first', style: { fill: { color: '#ff0000' } } },
      { id: 'style-2', name: 'second', style: { fill: { color: '#00ff00' } } },
      { id: 'style-3', name: 'third', style: { fill: { color: '#0000ff' } } }
    ];

    beforeEach(() => {
      onStyleClassesChangeSpy = jasmine.createSpy('onStyleClassesChange');
      component.params = {
        styleClasses: testStyles,
        onStyleClassesChange: onStyleClassesChangeSpy
      };
    });

    it('should remove a style when deleteStyle is called', () => {
      component.deleteStyle(testStyles[1]);

      expect(onStyleClassesChangeSpy).toHaveBeenCalledTimes(1);
      const remainingStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(remainingStyles.length).toBe(2);
      expect(remainingStyles.find(s => s.id === 'style-2')).toBeUndefined();
    });

    it('should clear selection when deleting the selected style', () => {
      component.selectStyle(testStyles[1]);
      expect(component.selectedStyleId).toBe('style-2');

      component.deleteStyle(testStyles[1]);

      expect(component.selectedStyleId).toBeNull();
    });

    it('should keep selection when deleting a different style', () => {
      component.selectStyle(testStyles[0]);
      expect(component.selectedStyleId).toBe('style-1');

      component.deleteStyle(testStyles[2]);

      expect(component.selectedStyleId).toBe('style-1');
    });
  });

  // ============================================================================
  // Select Style
  // ============================================================================

  describe('Select Style', () => {
    const testStyles: StyleClass[] = [
      { id: 'style-1', name: 'first', style: {} },
      { id: 'style-2', name: 'second', style: {} }
    ];

    beforeEach(() => {
      component.params = { styleClasses: testStyles };
    });

    it('should select a style', () => {
      component.selectStyle(testStyles[0]);

      expect(component.selectedStyleId).toBe('style-1');
      expect(component.selectedStyle).toEqual(testStyles[0]);
    });

    it('should deselect when clicking the same style again', () => {
      component.selectStyle(testStyles[0]);
      expect(component.selectedStyleId).toBe('style-1');

      component.selectStyle(testStyles[0]);
      expect(component.selectedStyleId).toBeNull();
      expect(component.selectedStyle).toBeNull();
    });

    it('should switch selection when clicking a different style', () => {
      component.selectStyle(testStyles[0]);
      expect(component.selectedStyleId).toBe('style-1');

      component.selectStyle(testStyles[1]);
      expect(component.selectedStyleId).toBe('style-2');
      expect(component.selectedStyle).toEqual(testStyles[1]);
    });
  });

  // ============================================================================
  // Update Style Property
  // ============================================================================

  describe('Update Style Property', () => {
    let onStyleClassesChangeSpy: jasmine.Spy;
    const testStyle: StyleClass = {
      id: 'style-1',
      name: 'test-style',
      style: {
        fill: { color: '#ff0000', opacity: 1 },
        stroke: { color: '#000000', width: 1, opacity: 1 }
      }
    };

    beforeEach(() => {
      onStyleClassesChangeSpy = jasmine.createSpy('onStyleClassesChange');
      component.params = {
        styleClasses: [testStyle],
        onStyleClassesChange: onStyleClassesChangeSpy
      };
      component.selectStyle(testStyle);
    });

    it('should update style name', () => {
      component.updateStyleProperty('name', 'new-name');

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].name).toBe('new-name');
    });

    it('should update fill color', () => {
      component.updateStyleProperty('fill.color', '#00ff00');

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].style.fill?.color).toBe('#00ff00');
    });

    it('should update fill opacity', () => {
      component.updateStyleProperty('fill.opacity', 0.5);

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].style.fill?.opacity).toBe(0.5);
    });

    it('should update stroke color', () => {
      component.updateStyleProperty('stroke.color', '#0000ff');

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].style.stroke?.color).toBe('#0000ff');
    });

    it('should update stroke width', () => {
      component.updateStyleProperty('stroke.width', 3);

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].style.stroke?.width).toBe(3);
    });

    it('should update stroke dashArray', () => {
      component.updateStyleProperty('stroke.dashArray', [8, 4]);

      const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
      expect(updatedStyles[0].style.stroke?.dashArray).toEqual([8, 4]);
    });

    it('should not update if no style is selected', () => {
      component.selectStyle(testStyle); // Deselect by clicking again
      component.selectStyle(testStyle);
      onStyleClassesChangeSpy.calls.reset();

      component.selectStyle(testStyle); // Deselect
      component.updateStyleProperty('fill.color', '#ffffff');

      expect(onStyleClassesChangeSpy).not.toHaveBeenCalled();
    });

    it('should not update for invalid property path', () => {
      component.updateStyleProperty('invalid.path', 'value');

      expect(onStyleClassesChangeSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Line Type Helpers
  // ============================================================================

  describe('Line Type Helpers', () => {
    describe('getLineType', () => {
      it('should return "solid" for undefined dashArray', () => {
        expect(component.getLineType(undefined)).toBe('solid');
      });

      it('should return "solid" for empty dashArray', () => {
        expect(component.getLineType([])).toBe('solid');
      });

      it('should return "dashed" for [8, 4] pattern', () => {
        expect(component.getLineType([8, 4])).toBe('dashed');
      });

      it('should return "dotted" for [2, 2] pattern', () => {
        expect(component.getLineType([2, 2])).toBe('dotted');
      });

      it('should return "dash-dot" for [8, 4, 2, 4] pattern', () => {
        expect(component.getLineType([8, 4, 2, 4])).toBe('dash-dot');
      });

      it('should return "long-dash" for [12, 6] pattern', () => {
        expect(component.getLineType([12, 6])).toBe('long-dash');
      });

      it('should return "dashed" for unknown patterns', () => {
        expect(component.getLineType([5, 3])).toBe('dashed');
        expect(component.getLineType([10, 10, 10])).toBe('dashed');
      });
    });

    describe('getDashArrayString', () => {
      it('should return empty string for undefined dashArray', () => {
        expect(component.getDashArrayString(undefined)).toBe('');
      });

      it('should return empty string for empty dashArray', () => {
        expect(component.getDashArrayString([])).toBe('');
      });

      it('should convert dashArray to space-separated string', () => {
        expect(component.getDashArrayString([8, 4])).toBe('8 4');
        expect(component.getDashArrayString([8, 4, 2, 4])).toBe('8 4 2 4');
        expect(component.getDashArrayString([12, 6])).toBe('12 6');
      });
    });

    describe('onLineTypeChange', () => {
      let onStyleClassesChangeSpy: jasmine.Spy;
      const testStyle: StyleClass = {
        id: 'style-1',
        name: 'test',
        style: { stroke: { color: '#000', width: 1 } }
      };

      beforeEach(() => {
        onStyleClassesChangeSpy = jasmine.createSpy('onStyleClassesChange');
        component.params = {
          styleClasses: [testStyle],
          onStyleClassesChange: onStyleClassesChangeSpy
        };
        component.selectStyle(testStyle);
      });

      it('should set dashArray for "dashed" line type', () => {
        component.onLineTypeChange('dashed');

        const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
        expect(updatedStyles[0].style.stroke?.dashArray).toEqual([8, 4]);
      });

      it('should set dashArray for "dotted" line type', () => {
        component.onLineTypeChange('dotted');

        const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
        expect(updatedStyles[0].style.stroke?.dashArray).toEqual([2, 2]);
      });

      it('should set dashArray for "dash-dot" line type', () => {
        component.onLineTypeChange('dash-dot');

        const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
        expect(updatedStyles[0].style.stroke?.dashArray).toEqual([8, 4, 2, 4]);
      });

      it('should set dashArray for "long-dash" line type', () => {
        component.onLineTypeChange('long-dash');

        const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
        expect(updatedStyles[0].style.stroke?.dashArray).toEqual([12, 6]);
      });

      it('should set empty dashArray for "solid" line type', () => {
        // Set up style with dashArray already set
        const styleWithDash: StyleClass = {
          id: 'style-dashed',
          name: 'dashed-test',
          style: { stroke: { color: '#000', width: 1, dashArray: [8, 4] } }
        };

        component.params = {
          styleClasses: [styleWithDash],
          onStyleClassesChange: onStyleClassesChangeSpy
        };
        component.selectStyle(styleWithDash);

        // Now set to solid
        component.onLineTypeChange('solid');

        expect(onStyleClassesChangeSpy).toHaveBeenCalled();
        const updatedStyles = onStyleClassesChangeSpy.calls.mostRecent().args[0] as StyleClass[];
        expect(updatedStyles[0].style.stroke?.dashArray).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Drag & Drop
  // ============================================================================

  describe('Drag & Drop', () => {
    it('should set style class id in dataTransfer on drag start', () => {
      const testStyle: StyleClass = {
        id: 'drag-style-1',
        name: 'draggable',
        style: { fill: { color: '#ff0000' } }
      };

      const mockDataTransfer = {
        setData: jasmine.createSpy('setData'),
        setDragImage: jasmine.createSpy('setDragImage'),
        effectAllowed: ''
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer
      } as unknown as DragEvent;

      component.onDragStart(mockEvent, testStyle);

      expect(mockDataTransfer.setData).toHaveBeenCalledWith(
        'application/x-style-class',
        'drag-style-1'
      );
      expect(mockDataTransfer.effectAllowed).toBe('copy');
    });

    it('should handle drag start without dataTransfer', () => {
      const testStyle: StyleClass = {
        id: 'style-1',
        name: 'test',
        style: {}
      };

      const mockEvent = { dataTransfer: null } as DragEvent;

      // Should not throw
      expect(() => component.onDragStart(mockEvent, testStyle)).not.toThrow();
    });
  });
});
