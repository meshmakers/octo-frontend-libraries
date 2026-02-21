import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PathEditorComponent } from './path-editor.component';
import { PathEditorService } from './services/path-editor.service';

describe('PathEditorComponent', () => {
  let component: PathEditorComponent;
  let fixture: ComponentFixture<PathEditorComponent>;
  let pathService: PathEditorService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathEditorComponent],
      providers: [PathEditorService]
    }).compileComponents();

    fixture = TestBed.createComponent(PathEditorComponent);
    component = fixture.componentInstance;
    pathService = component.pathService;
    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty path', () => {
      expect(pathService.segments().length).toBe(0);
      expect(pathService.nodes().length).toBe(0);
    });

    it('should have default width of 300', () => {
      expect(component.width()).toBe(300);
    });

    it('should have default height of 200', () => {
      expect(component.height()).toBe(200);
    });

    it('should have default grid size of 10', () => {
      expect(component.gridSize()).toBe(10);
    });

    it('should have snapToGrid enabled by default', () => {
      expect(component.snapToGrid()).toBe(true);
    });
  });

  describe('viewBox calculations', () => {
    it('should return default viewBox when no nodes exist', () => {
      const bounds = component.viewBoxBounds();
      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBe(200);
    });

    it('should calculate viewBox based on node positions', () => {
      pathService.loadPath('M 10 20 L 100 80');
      fixture.detectChanges();

      const bounds = component.viewBoxBounds();
      // Should include padding around nodes
      expect(bounds.x).toBeLessThan(10);
      expect(bounds.y).toBeLessThan(20);
      expect(bounds.width).toBeGreaterThan(90);
      expect(bounds.height).toBeGreaterThan(60);
    });

    it('should generate viewBox string correctly', () => {
      const viewBox = component.viewBox();
      expect(viewBox).toMatch(/^-?\d+ -?\d+ \d+ \d+$/);
    });
  });

  describe('controlPointLines', () => {
    it('should return empty array for simple path without curves', () => {
      pathService.loadPath('M 0 0 L 100 100');
      fixture.detectChanges();

      const lines = component.controlPointLines();
      expect(lines.length).toBe(0);
    });

    it('should generate lines for cubic bezier control points', () => {
      pathService.loadPath('M 0 0 C 20 50 80 50 100 0');
      fixture.detectChanges();

      const lines = component.controlPointLines();
      // Should have 2 lines: one from start to cp1, one from cp2 to end
      expect(lines.length).toBe(2);

      // First line connects start point to first control point
      const cp1Line = lines[0];
      expect(cp1Line.x1).toBe(0);
      expect(cp1Line.y1).toBe(0);
      expect(cp1Line.x2).toBe(20);
      expect(cp1Line.y2).toBe(50);
    });

    it('should generate lines for quadratic bezier control points', () => {
      pathService.loadPath('M 0 0 Q 50 100 100 0');
      fixture.detectChanges();

      const lines = component.controlPointLines();
      // Should have 2 lines: start-to-cp and cp-to-end
      expect(lines.length).toBe(2);
    });

    it('should generate lines for S command', () => {
      pathService.loadPath('M 0 0 C 20 50 80 50 100 0 S 180 50 200 0');
      fixture.detectChanges();

      const lines = component.controlPointLines();
      // C produces 2 lines, S produces 1 line (only cp2)
      expect(lines.length).toBe(3);
    });
  });

  describe('canConvert methods', () => {
    beforeEach(() => {
      pathService.loadPath('M 0 0 L 50 50 C 70 70 90 70 100 50 Q 110 30 120 50');
      fixture.detectChanges();
    });

    describe('canConvertToLine', () => {
      it('should return false when no node is selected', () => {
        expect(component.canConvertToLine()).toBe(false);
      });

      it('should return false for M command', () => {
        const nodes = pathService.nodes();
        const moveNode = nodes.find(n => n.segmentId.includes('0'));
        if (moveNode) {
          pathService.selectNode(moveNode.id);
        }
        expect(component.canConvertToLine()).toBe(false);
      });

      it('should return false for line segment (already L)', () => {
        const segments = pathService.segments();
        const lineSegment = segments.find(s => s.command === 'L');
        if (lineSegment) {
          const lineNode = pathService.nodes().find(n => n.segmentId === lineSegment.id);
          if (lineNode) {
            pathService.selectNode(lineNode.id);
          }
        }
        expect(component.canConvertToLine()).toBe(false);
      });

      it('should return true for cubic bezier segment', () => {
        const segments = pathService.segments();
        const cubicSegment = segments.find(s => s.command === 'C');
        if (cubicSegment) {
          const cubicNode = pathService.nodes().find(n => n.segmentId === cubicSegment.id && n.type === 'point');
          if (cubicNode) {
            pathService.selectNode(cubicNode.id);
          }
        }
        expect(component.canConvertToLine()).toBe(true);
      });

      it('should return true for quadratic bezier segment', () => {
        const segments = pathService.segments();
        const quadSegment = segments.find(s => s.command === 'Q');
        if (quadSegment) {
          const quadNode = pathService.nodes().find(n => n.segmentId === quadSegment.id && n.type === 'point');
          if (quadNode) {
            pathService.selectNode(quadNode.id);
          }
        }
        expect(component.canConvertToLine()).toBe(true);
      });
    });

    describe('canConvertToCubic', () => {
      it('should return false when no node is selected', () => {
        expect(component.canConvertToCubic()).toBe(false);
      });

      it('should return false for M command', () => {
        const nodes = pathService.nodes();
        const moveNode = nodes.find(n => n.segmentId.includes('0'));
        if (moveNode) {
          pathService.selectNode(moveNode.id);
        }
        expect(component.canConvertToCubic()).toBe(false);
      });

      it('should return true for line segment', () => {
        const segments = pathService.segments();
        const lineSegment = segments.find(s => s.command === 'L');
        if (lineSegment) {
          const lineNode = pathService.nodes().find(n => n.segmentId === lineSegment.id);
          if (lineNode) {
            pathService.selectNode(lineNode.id);
          }
        }
        expect(component.canConvertToCubic()).toBe(true);
      });

      it('should return false for cubic bezier segment (already C)', () => {
        const segments = pathService.segments();
        const cubicSegment = segments.find(s => s.command === 'C');
        if (cubicSegment) {
          const cubicNode = pathService.nodes().find(n => n.segmentId === cubicSegment.id && n.type === 'point');
          if (cubicNode) {
            pathService.selectNode(cubicNode.id);
          }
        }
        expect(component.canConvertToCubic()).toBe(false);
      });
    });

    describe('canConvertToQuadratic', () => {
      it('should return false when no node is selected', () => {
        expect(component.canConvertToQuadratic()).toBe(false);
      });

      it('should return true for line segment', () => {
        const segments = pathService.segments();
        const lineSegment = segments.find(s => s.command === 'L');
        if (lineSegment) {
          const lineNode = pathService.nodes().find(n => n.segmentId === lineSegment.id);
          if (lineNode) {
            pathService.selectNode(lineNode.id);
          }
        }
        expect(component.canConvertToQuadratic()).toBe(true);
      });

      it('should return false for quadratic bezier segment (already Q)', () => {
        const segments = pathService.segments();
        const quadSegment = segments.find(s => s.command === 'Q');
        if (quadSegment) {
          const quadNode = pathService.nodes().find(n => n.segmentId === quadSegment.id && n.type === 'point');
          if (quadNode) {
            pathService.selectNode(quadNode.id);
          }
        }
        expect(component.canConvertToQuadratic()).toBe(false);
      });
    });
  });

  describe('text editor', () => {
    it('should initialize textEditorValue as empty string', () => {
      expect(component.textEditorValue()).toBe('');
    });

    it('should update path when text changes', () => {
      const spy = spyOn(component.pathChange, 'emit');

      component.onTextChange('M 0 0 L 100 100');

      expect(component.textEditorValue()).toBe('M 0 0 L 100 100');
      expect(spy).toHaveBeenCalled();
    });

    it('should update service when text changes', () => {
      component.onTextChange('M 10 20 L 30 40');

      expect(pathService.segments().length).toBe(2);
      expect(pathService.nodes().length).toBe(2);
    });
  });

  describe('toolbar actions', () => {
    describe('deleteSelectedNode', () => {
      beforeEach(() => {
        pathService.loadPath('M 0 0 L 50 50 L 100 0');
        fixture.detectChanges();
      });

      it('should not delete when no node selected', () => {
        const initialCount = pathService.segments().length;
        component.deleteSelectedNode();
        expect(pathService.segments().length).toBe(initialCount);
      });

      it('should delete segment when node is selected', () => {
        const spy = spyOn(component.pathChange, 'emit');

        const segments = pathService.segments();
        const middleSegment = segments[1]; // L 50 50
        const middleNode = pathService.nodes().find(n => n.segmentId === middleSegment.id);

        if (middleNode) {
          pathService.selectNode(middleNode.id);
          component.deleteSelectedNode();

          expect(pathService.segments().length).toBe(2);
          expect(spy).toHaveBeenCalled();
        }
      });
    });

    describe('convertToLine', () => {
      beforeEach(() => {
        pathService.loadPath('M 0 0 C 20 50 80 50 100 0');
        fixture.detectChanges();
      });

      it('should not convert when no node selected', () => {
        const _segment = pathService.segments()[1];
        component.convertToLine();
        expect(pathService.segments()[1].command).toBe('C');
      });

      it('should convert cubic to line when selected', () => {
        const spy = spyOn(component.pathChange, 'emit');
        const cubicSegment = pathService.segments()[1];
        const cubicNode = pathService.nodes().find(n => n.segmentId === cubicSegment.id && n.type === 'point');

        if (cubicNode) {
          pathService.selectNode(cubicNode.id);
          component.convertToLine();

          expect(pathService.segments()[1].command).toBe('L');
          expect(spy).toHaveBeenCalled();
        }
      });
    });

    describe('convertToCubic', () => {
      beforeEach(() => {
        pathService.loadPath('M 0 0 L 100 0');
        fixture.detectChanges();
      });

      it('should convert line to cubic when selected', () => {
        const spy = spyOn(component.pathChange, 'emit');
        const lineSegment = pathService.segments()[1];
        const lineNode = pathService.nodes().find(n => n.segmentId === lineSegment.id);

        if (lineNode) {
          pathService.selectNode(lineNode.id);
          component.convertToCubic();

          expect(pathService.segments()[1].command).toBe('C');
          expect(spy).toHaveBeenCalled();
        }
      });
    });

    describe('convertToQuadratic', () => {
      beforeEach(() => {
        pathService.loadPath('M 0 0 L 100 0');
        fixture.detectChanges();
      });

      it('should convert line to quadratic when selected', () => {
        const spy = spyOn(component.pathChange, 'emit');
        const lineSegment = pathService.segments()[1];
        const lineNode = pathService.nodes().find(n => n.segmentId === lineSegment.id);

        if (lineNode) {
          pathService.selectNode(lineNode.id);
          component.convertToQuadratic();

          expect(pathService.segments()[1].command).toBe('Q');
          expect(spy).toHaveBeenCalled();
        }
      });
    });
  });

  describe('mouse handlers', () => {
    let svg: SVGSVGElement;

    beforeEach(() => {
      pathService.loadPath('M 0 0 L 100 100');
      fixture.detectChanges();
      svg = fixture.nativeElement.querySelector('svg');
    });

    describe('onCanvasMouseDown', () => {
      it('should deselect node when clicking on canvas background', () => {
        // First select a node
        const node = pathService.nodes()[0];
        pathService.selectNode(node.id);
        expect(pathService.selectedNodeId()).toBe(node.id);

        // Click on canvas background
        const event = new MouseEvent('mousedown', { bubbles: true });
        Object.defineProperty(event, 'target', { value: svg });
        component.onCanvasMouseDown(event);

        expect(pathService.selectedNodeId()).toBeNull();
      });
    });

    describe('onNodeMouseDown', () => {
      it('should select the clicked node', () => {
        const node = pathService.nodes()[0];
        const event = new MouseEvent('mousedown', { bubbles: true });

        component.onNodeMouseDown(event, node);

        expect(pathService.selectedNodeId()).toBe(node.id);
      });

      it('should prevent event propagation', () => {
        const node = pathService.nodes()[0];
        const event = new MouseEvent('mousedown', { bubbles: true });
        spyOn(event, 'preventDefault');
        spyOn(event, 'stopPropagation');

        component.onNodeMouseDown(event, node);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
      });
    });

    describe('onCanvasMouseUp', () => {
      it('should emit change if path was modified during drag', () => {
        const spy = spyOn(component.pathChange, 'emit');

        // Select and start dragging
        const node = pathService.nodes()[0];
        const downEvent = new MouseEvent('mousedown', { bubbles: true });
        component.onNodeMouseDown(downEvent, node);

        // Mark path as dirty via service
        pathService.moveNode(node.id, { x: 50, y: 50 });

        // End drag
        const upEvent = new MouseEvent('mouseup', { bubbles: true });
        component.onCanvasMouseUp(upEvent);

        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('should clear path service on destroy', () => {
      pathService.loadPath('M 0 0 L 100 100');
      fixture.detectChanges();

      expect(pathService.segments().length).toBe(2);

      component.ngOnDestroy();

      expect(pathService.segments().length).toBe(0);
    });
  });
});
