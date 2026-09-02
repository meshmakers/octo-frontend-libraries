import type { Mock, MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { DesignerCoordinateService } from './designer-coordinate.service';
import { DesignerStateService } from './designer-state.service';

describe('DesignerCoordinateService', () => {
    let service: DesignerCoordinateService;
    let stateService: DesignerStateService;

    // Mock SVG element for testing
    let mockSvgElement: MockedObject<SVGSVGElement>;
    let mockSvgPoint: {
        x: number;
        y: number;
        matrixTransform: Mock;
    };
    let mockCtm: DOMMatrix;

    beforeEach(() => {
        // Create mock SVG point
        mockSvgPoint = {
            x: 0,
            y: 0,
            matrixTransform: vi.fn().mockName('matrixTransform')
        };

        // Create mock CTM (identity matrix for simple tests).
        // jsdom does not implement DOMMatrix, so the identity matrix is supplied as a
        // structural stub. The service only calls inverse() on the CTM and passes it to
        // matrixTransform, which is mocked below, so this behaves exactly like the real
        // `new DOMMatrix([1, 0, 0, 1, 0, 0])` did in the previous browser runner
        // (the identity matrix is its own inverse).
        mockCtm = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: 0,
            f: 0,
            inverse: (): DOMMatrix => mockCtm
        } as unknown as DOMMatrix;

        // Create mock SVG element
        mockSvgElement = {
            createSVGPoint: vi.fn().mockName("SVGSVGElement.createSVGPoint"),
            getScreenCTM: vi.fn().mockName("SVGSVGElement.getScreenCTM")
        } as unknown as MockedObject<SVGSVGElement>;
        mockSvgElement.createSVGPoint.mockReturnValue(mockSvgPoint as unknown as SVGPoint);
        mockSvgElement.getScreenCTM.mockReturnValue(mockCtm);

        TestBed.configureTestingModule({
            providers: [
                DesignerCoordinateService,
                DesignerStateService
            ]
        });

        service = TestBed.inject(DesignerCoordinateService);
        stateService = TestBed.inject(DesignerStateService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    // ============================================================================
    // SVG Element Management
    // ============================================================================

    describe('SVG element management', () => {
        it('should initially have no SVG element', () => {
            expect(service.hasSvgElement()).toBe(false);
            expect(service.getSvgElement()).toBeNull();
        });

        it('should set SVG element', () => {
            service.setSvgElement(mockSvgElement);
            expect(service.hasSvgElement()).toBe(true);
            expect(service.getSvgElement()).toBe(mockSvgElement);
        });

        it('should allow clearing SVG element', () => {
            service.setSvgElement(mockSvgElement);
            service.setSvgElement(null);
            expect(service.hasSvgElement()).toBe(false);
        });
    });

    // ============================================================================
    // Coordinate Transformations
    // ============================================================================

    describe('getCanvasCoordinates', () => {
        it('should return null when no SVG element is set', () => {
            const result = service.getCanvasCoordinates({ clientX: 100, clientY: 200 });
            expect(result).toBeNull();
        });

        it('should transform client coordinates to canvas coordinates', () => {
            service.setSvgElement(mockSvgElement);

            // Mock the matrix transformation
            mockSvgPoint.matrixTransform.mockReturnValue({ x: 50, y: 100 });

            const result = service.getCanvasCoordinates({ clientX: 100, clientY: 200 });

            expect(mockSvgElement.createSVGPoint).toHaveBeenCalled();
            expect(mockSvgElement.getScreenCTM).toHaveBeenCalled();
            expect(result).toEqual({ x: 50, y: 100 });
        });

        it('should return null when getScreenCTM returns null', () => {
            service.setSvgElement(mockSvgElement);
            mockSvgElement.getScreenCTM.mockReturnValue(null);

            const result = service.getCanvasCoordinates({ clientX: 100, clientY: 200 });
            expect(result).toBeNull();
        });
    });

    describe('screenToCanvas', () => {
        it('should be an alias for getCanvasCoordinates', () => {
            service.setSvgElement(mockSvgElement);
            mockSvgPoint.matrixTransform.mockReturnValue({ x: 25, y: 75 });

            const result = service.screenToCanvas(100, 200);
            expect(result).toEqual({ x: 25, y: 75 });
        });
    });

    describe('canvasToScreen', () => {
        it('should return null when no SVG element is set', () => {
            const result = service.canvasToScreen({ x: 50, y: 100 });
            expect(result).toBeNull();
        });

        it('should transform canvas coordinates to screen coordinates', () => {
            service.setSvgElement(mockSvgElement);
            mockSvgPoint.matrixTransform.mockReturnValue({ x: 200, y: 400 });

            const result = service.canvasToScreen({ x: 50, y: 100 });

            expect(result).toEqual({ x: 200, y: 400 });
        });
    });

    // ============================================================================
    // Grid Snapping
    // ============================================================================

    describe('snapToGrid', () => {
        it('should delegate to stateService.snapPosition', () => {
            stateService.setSnapToGrid(true);
            stateService.setGridSize(20);

            const result = service.snapToGrid({ x: 25, y: 33 });
            expect(result).toEqual({ x: 20, y: 40 });
        });

        it('should not snap when disabled in state service', () => {
            stateService.setSnapToGrid(false);

            const result = service.snapToGrid({ x: 25, y: 33 });
            expect(result).toEqual({ x: 25, y: 33 });
        });
    });

    describe('snapToGridSize', () => {
        it('should snap to specified grid size regardless of state', () => {
            stateService.setSnapToGrid(false); // Disabled in state

            const result = service.snapToGridSize({ x: 25, y: 33 }, 10);
            expect(result).toEqual({ x: 30, y: 30 });
        });

        it('should snap to different grid sizes', () => {
            expect(service.snapToGridSize({ x: 17, y: 23 }, 5)).toEqual({ x: 15, y: 25 });
            expect(service.snapToGridSize({ x: 17, y: 23 }, 10)).toEqual({ x: 20, y: 20 });
            expect(service.snapToGridSize({ x: 17, y: 23 }, 25)).toEqual({ x: 25, y: 25 });
        });
    });

    describe('getSnappedCanvasCoordinates', () => {
        it('should return null when no SVG element', () => {
            const result = service.getSnappedCanvasCoordinates({ clientX: 100, clientY: 200 });
            expect(result).toBeNull();
        });

        it('should combine coordinate transformation and grid snapping', () => {
            service.setSvgElement(mockSvgElement);
            mockSvgPoint.matrixTransform.mockReturnValue({ x: 25, y: 33 });

            stateService.setSnapToGrid(true);
            stateService.setGridSize(20);

            const result = service.getSnappedCanvasCoordinates({ clientX: 100, clientY: 200 });
            expect(result).toEqual({ x: 20, y: 40 });
        });
    });

    // ============================================================================
    // Utility Methods
    // ============================================================================

    describe('distance', () => {
        it('should calculate distance between two points', () => {
            // 3-4-5 right triangle
            const result = service.distance({ x: 0, y: 0 }, { x: 3, y: 4 });
            expect(result).toBe(5);
        });

        it('should return 0 for same point', () => {
            const result = service.distance({ x: 10, y: 20 }, { x: 10, y: 20 });
            expect(result).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const result = service.distance({ x: -3, y: -4 }, { x: 0, y: 0 });
            expect(result).toBe(5);
        });
    });

    describe('delta', () => {
        it('should calculate difference between positions', () => {
            const result = service.delta({ x: 10, y: 20 }, { x: 30, y: 50 });
            expect(result).toEqual({ x: 20, y: 30 });
        });

        it('should handle negative deltas', () => {
            const result = service.delta({ x: 30, y: 50 }, { x: 10, y: 20 });
            expect(result).toEqual({ x: -20, y: -30 });
        });
    });

    describe('add', () => {
        it('should add two positions', () => {
            const result = service.add({ x: 10, y: 20 }, { x: 5, y: 15 });
            expect(result).toEqual({ x: 15, y: 35 });
        });

        it('should handle negative values', () => {
            const result = service.add({ x: 10, y: 20 }, { x: -5, y: -15 });
            expect(result).toEqual({ x: 5, y: 5 });
        });
    });

    describe('subtract', () => {
        it('should subtract two positions', () => {
            const result = service.subtract({ x: 30, y: 50 }, { x: 10, y: 20 });
            expect(result).toEqual({ x: 20, y: 30 });
        });
    });

    describe('scale', () => {
        it('should scale a position', () => {
            const result = service.scale({ x: 10, y: 20 }, 2);
            expect(result).toEqual({ x: 20, y: 40 });
        });

        it('should handle fractional scale', () => {
            const result = service.scale({ x: 10, y: 20 }, 0.5);
            expect(result).toEqual({ x: 5, y: 10 });
        });

        it('should handle negative scale', () => {
            const result = service.scale({ x: 10, y: 20 }, -1);
            expect(result).toEqual({ x: -10, y: -20 });
        });
    });

    describe('isInsideBounds', () => {
        const bounds = { x: 10, y: 20, width: 100, height: 50 };

        it('should return true for position inside bounds', () => {
            expect(service.isInsideBounds({ x: 50, y: 40 }, bounds)).toBe(true);
        });

        it('should return true for position on boundary', () => {
            expect(service.isInsideBounds({ x: 10, y: 20 }, bounds)).toBe(true);
            expect(service.isInsideBounds({ x: 110, y: 70 }, bounds)).toBe(true);
        });

        it('should return false for position outside bounds', () => {
            expect(service.isInsideBounds({ x: 5, y: 40 }, bounds)).toBe(false);
            expect(service.isInsideBounds({ x: 50, y: 15 }, bounds)).toBe(false);
            expect(service.isInsideBounds({ x: 115, y: 40 }, bounds)).toBe(false);
            expect(service.isInsideBounds({ x: 50, y: 75 }, bounds)).toBe(false);
        });
    });

    describe('clampToBounds', () => {
        const bounds = { x: 10, y: 20, width: 100, height: 50 };

        it('should not modify position inside bounds', () => {
            const result = service.clampToBounds({ x: 50, y: 40 }, bounds);
            expect(result).toEqual({ x: 50, y: 40 });
        });

        it('should clamp position to left edge', () => {
            const result = service.clampToBounds({ x: 5, y: 40 }, bounds);
            expect(result).toEqual({ x: 10, y: 40 });
        });

        it('should clamp position to right edge', () => {
            const result = service.clampToBounds({ x: 120, y: 40 }, bounds);
            expect(result).toEqual({ x: 110, y: 40 });
        });

        it('should clamp position to top edge', () => {
            const result = service.clampToBounds({ x: 50, y: 15 }, bounds);
            expect(result).toEqual({ x: 50, y: 20 });
        });

        it('should clamp position to bottom edge', () => {
            const result = service.clampToBounds({ x: 50, y: 80 }, bounds);
            expect(result).toEqual({ x: 50, y: 70 });
        });

        it('should clamp position to corner', () => {
            const result = service.clampToBounds({ x: 0, y: 0 }, bounds);
            expect(result).toEqual({ x: 10, y: 20 });
        });
    });

    describe('getBoundsCenter', () => {
        it('should calculate center of bounds', () => {
            const result = service.getBoundsCenter({ x: 10, y: 20, width: 100, height: 50 });
            expect(result).toEqual({ x: 60, y: 45 });
        });

        it('should handle zero-sized bounds', () => {
            const result = service.getBoundsCenter({ x: 10, y: 20, width: 0, height: 0 });
            expect(result).toEqual({ x: 10, y: 20 });
        });

        it('should handle bounds at origin', () => {
            const result = service.getBoundsCenter({ x: 0, y: 0, width: 100, height: 100 });
            expect(result).toEqual({ x: 50, y: 50 });
        });
    });

    // ============================================================================
    // Cache Invalidation
    // ============================================================================

    describe('invalidateCache', () => {
        it('should not throw when called', () => {
            expect(() => service.invalidateCache()).not.toThrow();
        });

        // Note: Cache behavior is internal and tested implicitly through coordinate transformations
    });
});
