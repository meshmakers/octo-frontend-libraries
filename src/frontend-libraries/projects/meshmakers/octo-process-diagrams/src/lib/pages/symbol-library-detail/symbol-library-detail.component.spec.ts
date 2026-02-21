import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SymbolLibraryDetailComponent } from './symbol-library-detail.component';
import { SymbolLibraryService } from '../../services/symbol-library.service';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { ConfirmationService, InputService } from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import { ActivatedRoute, Router } from '@angular/router';
import { SymbolLibrary, SymbolDefinition } from '../../primitives/models/symbol.model';
import { PrimitiveBase } from '../../primitives';
import { By } from '@angular/platform-browser';

// Helper to create primitives with config (using type assertion for tests)
function createPrimitive(primitive: Record<string, unknown>): PrimitiveBase {
  return primitive as unknown as PrimitiveBase;
}

describe('SymbolLibraryDetailComponent', () => {
  let component: SymbolLibraryDetailComponent;
  let fixture: ComponentFixture<SymbolLibraryDetailComponent>;
  let mockSymbolLibraryService: jasmine.SpyObj<SymbolLibraryService>;
  let mockBreadCrumbService: jasmine.SpyObj<BreadCrumbService>;
  let mockConfirmationService: jasmine.SpyObj<ConfirmationService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockInputService: jasmine.SpyObj<InputService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const createMockSymbol = (overrides: Partial<SymbolDefinition> = {}): SymbolDefinition => ({
    rtId: 'sym-1',
    name: 'Test Symbol',
    version: '1.0.0',
    bounds: { width: 100, height: 100 },
    primitives: [],
    ...overrides
  });

  const createMockLibrary = (symbols: SymbolDefinition[] = []): SymbolLibrary => ({
    id: 'lib-1',
    name: 'Test Library',
    version: '1.0.0',
    symbols
  });

  beforeEach(async () => {
    mockSymbolLibraryService = jasmine.createSpyObj('SymbolLibraryService', [
      'loadLibrary',
      'createSymbol',
      'deleteSymbol'
    ]);
    mockBreadCrumbService = jasmine.createSpyObj('BreadCrumbService', ['updateBreadcrumbLabels']);
    mockConfirmationService = jasmine.createSpyObj('ConfirmationService', ['showYesNoConfirmationDialog']);
    mockNotificationService = jasmine.createSpyObj('NotificationService', ['show']);
    mockInputService = jasmine.createSpyObj('InputService', ['showInputDialog']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockBreadCrumbService.updateBreadcrumbLabels.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [SymbolLibraryDetailComponent],
      providers: [
        { provide: SymbolLibraryService, useValue: mockSymbolLibraryService },
        { provide: BreadCrumbService, useValue: mockBreadCrumbService },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: InputService, useValue: mockInputService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => key === 'libraryId' ? 'lib-1' : null
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SymbolLibraryDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Symbol Preview Rendering', () => {
    beforeEach(fakeAsync(() => {
      // Setup a library with symbols for preview testing
      const symbolWithPrimitives = createMockSymbol({
        rtId: 'sym-preview',
        name: 'Preview Test',
        bounds: { width: 200, height: 150 },
        primitives: [
          createPrimitive({
            id: 'rect-1',
            name: 'Test Rectangle',
            type: 'rectangle',
            position: { x: 10, y: 20 },
            config: { width: 80, height: 60 },
            style: {
              fill: { color: '#ff0000', opacity: 1 },
              stroke: { color: '#0000ff', width: 2 }
            }
          })
        ]
      });

      mockSymbolLibraryService.loadLibrary.and.returnValue(
        Promise.resolve(createMockLibrary([symbolWithPrimitives]))
      );

      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should render rectangle with correct fill color from style.fill.color', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('fill')).toBe('#ff0000');
    });

    it('should render rectangle with correct stroke color from style.stroke.color', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('stroke')).toBe('#0000ff');
    });

    it('should render rectangle with correct stroke width from style.stroke.width', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('stroke-width')).toBe('2');
    });

    it('should render rectangle at correct position', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('x')).toBe('10');
      expect(rect.nativeElement.getAttribute('y')).toBe('20');
    });

    it('should render rectangle with correct dimensions', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('width')).toBe('80');
      expect(rect.nativeElement.getAttribute('height')).toBe('60');
    });
  });

  describe('Symbol Preview - Line Primitive', () => {
    beforeEach(fakeAsync(() => {
      const symbolWithLine = createMockSymbol({
        rtId: 'sym-line',
        name: 'Line Test',
        bounds: { width: 200, height: 150 },
        primitives: [
          createPrimitive({
            id: 'line-1',
            name: 'Test Line',
            type: 'line',
            position: { x: 0, y: 0 },
            config: {
              start: { x: 10, y: 20 },
              end: { x: 100, y: 80 }
            },
            style: {
              stroke: { color: '#00ff00', width: 3 }
            }
          })
        ]
      });

      mockSymbolLibraryService.loadLibrary.and.returnValue(
        Promise.resolve(createMockLibrary([symbolWithLine]))
      );

      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should render line with correct start coordinates from config.start', () => {
      const line = fixture.debugElement.query(By.css('.symbol-preview line'));
      expect(line).toBeTruthy();
      expect(line.nativeElement.getAttribute('x1')).toBe('10');
      expect(line.nativeElement.getAttribute('y1')).toBe('20');
    });

    it('should render line with correct end coordinates from config.end', () => {
      const line = fixture.debugElement.query(By.css('.symbol-preview line'));
      expect(line).toBeTruthy();
      expect(line.nativeElement.getAttribute('x2')).toBe('100');
      expect(line.nativeElement.getAttribute('y2')).toBe('80');
    });

    it('should render line with correct stroke color', () => {
      const line = fixture.debugElement.query(By.css('.symbol-preview line'));
      expect(line).toBeTruthy();
      expect(line.nativeElement.getAttribute('stroke')).toBe('#00ff00');
    });

    it('should render line with correct stroke width', () => {
      const line = fixture.debugElement.query(By.css('.symbol-preview line'));
      expect(line).toBeTruthy();
      expect(line.nativeElement.getAttribute('stroke-width')).toBe('3');
    });
  });

  describe('Symbol Preview - Ellipse Primitive', () => {
    beforeEach(fakeAsync(() => {
      const symbolWithEllipse = createMockSymbol({
        rtId: 'sym-ellipse',
        name: 'Ellipse Test',
        bounds: { width: 200, height: 150 },
        primitives: [
          createPrimitive({
            id: 'ellipse-1',
            name: 'Test Ellipse',
            type: 'ellipse',
            position: { x: 50, y: 40 },
            config: {
              radiusX: 30,
              radiusY: 20
            },
            style: {
              fill: { color: '#ffff00' },
              stroke: { color: '#ff00ff', width: 1.5 }
            }
          })
        ]
      });

      mockSymbolLibraryService.loadLibrary.and.returnValue(
        Promise.resolve(createMockLibrary([symbolWithEllipse]))
      );

      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should render ellipse with correct fill color', () => {
      const ellipse = fixture.debugElement.query(By.css('.symbol-preview ellipse'));
      expect(ellipse).toBeTruthy();
      expect(ellipse.nativeElement.getAttribute('fill')).toBe('#ffff00');
    });

    it('should render ellipse with correct stroke color', () => {
      const ellipse = fixture.debugElement.query(By.css('.symbol-preview ellipse'));
      expect(ellipse).toBeTruthy();
      expect(ellipse.nativeElement.getAttribute('stroke')).toBe('#ff00ff');
    });

    it('should render ellipse with correct radii', () => {
      const ellipse = fixture.debugElement.query(By.css('.symbol-preview ellipse'));
      expect(ellipse).toBeTruthy();
      expect(ellipse.nativeElement.getAttribute('rx')).toBe('30');
      expect(ellipse.nativeElement.getAttribute('ry')).toBe('20');
    });
  });

  describe('Symbol Preview - Path Primitive', () => {
    beforeEach(fakeAsync(() => {
      const symbolWithPath = createMockSymbol({
        rtId: 'sym-path',
        name: 'Path Test',
        bounds: { width: 200, height: 150 },
        primitives: [
          createPrimitive({
            id: 'path-1',
            name: 'Test Path',
            type: 'path',
            position: { x: 0, y: 0 },
            config: {
              d: 'M10,10 L50,50 L90,10 Z'
            },
            style: {
              fill: { color: '#00ffff' },
              stroke: { color: '#ff8800', width: 2 }
            }
          })
        ]
      });

      mockSymbolLibraryService.loadLibrary.and.returnValue(
        Promise.resolve(createMockLibrary([symbolWithPath]))
      );

      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should render path with correct d attribute', () => {
      const path = fixture.debugElement.query(By.css('.symbol-preview path'));
      expect(path).toBeTruthy();
      expect(path.nativeElement.getAttribute('d')).toBe('M10,10 L50,50 L90,10 Z');
    });

    it('should render path with correct fill color', () => {
      const path = fixture.debugElement.query(By.css('.symbol-preview path'));
      expect(path).toBeTruthy();
      expect(path.nativeElement.getAttribute('fill')).toBe('#00ffff');
    });

    it('should render path with correct stroke color', () => {
      const path = fixture.debugElement.query(By.css('.symbol-preview path'));
      expect(path).toBeTruthy();
      expect(path.nativeElement.getAttribute('stroke')).toBe('#ff8800');
    });
  });

  describe('Symbol Preview - Default Styles', () => {
    beforeEach(fakeAsync(() => {
      const symbolWithoutStyles = createMockSymbol({
        rtId: 'sym-no-style',
        name: 'No Style Test',
        bounds: { width: 200, height: 150 },
        primitives: [
          createPrimitive({
            id: 'rect-no-style',
            name: 'Rectangle Without Style',
            type: 'rectangle',
            position: { x: 0, y: 0 },
            config: { width: 50, height: 50 }
            // No style property
          })
        ]
      });

      mockSymbolLibraryService.loadLibrary.and.returnValue(
        Promise.resolve(createMockLibrary([symbolWithoutStyles]))
      );

      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should use default fill color when style is missing', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('fill')).toBe('#cccccc');
    });

    it('should use default stroke color when style is missing', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('stroke')).toBe('#333333');
    });

    it('should use default stroke width when style is missing', () => {
      const rect = fixture.debugElement.query(By.css('.symbol-preview rect'));
      expect(rect).toBeTruthy();
      expect(rect.nativeElement.getAttribute('stroke-width')).toBe('1');
    });
  });

  describe('getPointsString', () => {
    it('should return string as-is', () => {
      const result = (component as any).getPointsString('10,20 30,40');
      expect(result).toBe('10,20 30,40');
    });

    it('should convert array of points to string', () => {
      const points = [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }];
      const result = (component as any).getPointsString(points);
      expect(result).toBe('10,20 30,40 50,60');
    });

    it('should handle empty array', () => {
      const result = (component as any).getPointsString([]);
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect((component as any).getPointsString(null)).toBe('');
      expect((component as any).getPointsString(undefined)).toBe('');
    });

    it('should handle points with missing coordinates', () => {
      const points = [{ x: 10 }, { y: 20 }, {}];
      const result = (component as any).getPointsString(points);
      expect(result).toBe('10,0 0,20 0,0');
    });
  });
});
