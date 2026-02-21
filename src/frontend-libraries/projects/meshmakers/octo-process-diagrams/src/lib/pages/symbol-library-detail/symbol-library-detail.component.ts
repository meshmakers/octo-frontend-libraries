import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { trashIcon, pencilIcon, plusIcon, arrowLeftIcon, uploadIcon } from '@progress/kendo-svg-icons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { InputsModule, NumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ConfirmationService } from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { SymbolLibraryService } from '../../services/symbol-library.service';
import { SvgImportService } from '../../services/svg-import.service';
import { SymbolLibrary, SymbolDefinition } from '../../primitives/models/symbol.model';
import { PrimitiveBase, PrimitiveStyle, StyleClass } from '../../primitives';
import { estimatePathBounds, PathPrimitive, offsetPathData } from '../../primitives/models/path.model';

/**
 * Symbol Library Detail Page Component.
 * Displays symbols in a library with CRUD operations.
 *
 * This component uses relative navigation, so it can be used in any app
 * by defining appropriate routes.
 *
 * Expected route structure:
 * - Parent: Symbol library list
 * - Current: :libraryId (library detail)
 * - :symbolId/edit: Navigate to symbol editor
 */
@Component({
  selector: 'mm-symbol-library-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    SVGIconModule,
    InputsModule,
    NumericTextBoxModule,
    DialogsModule
  ],
  templateUrl: './symbol-library-detail.component.html',
  styleUrl: './symbol-library-detail.component.scss'
})
export class SymbolLibraryDetailComponent implements OnInit {
  @ViewChild('svgFileInput') svgFileInputRef!: ElementRef<HTMLInputElement>;

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly breadCrumbService = inject(BreadCrumbService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly symbolLibraryService = inject(SymbolLibraryService);
  private readonly svgImportService = inject(SvgImportService);

  protected readonly plusIcon = plusIcon;
  protected readonly editIcon = pencilIcon;
  protected readonly deleteIcon = trashIcon;
  protected readonly backIcon = arrowLeftIcon;
  protected readonly uploadIcon = uploadIcon;

  protected readonly library = signal<SymbolLibrary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly selectedSymbol = signal<SymbolDefinition | null>(null);

  // Dialog state
  protected readonly showSymbolDialog = signal(false);
  protected readonly showSvgImportDialog = signal(false);

  // New Symbol form data
  protected newSymbol = {
    name: '',
    description: '',
    width: 100,
    height: 100,
    category: ''
  };

  // SVG Import form data
  protected svgImport: {
    name: string;
    description: string;
    category: string;
    svgPrimitives?: PrimitiveBase[];
    svgOriginalPrimitives?: PrimitiveBase[];
    svgFileName?: string;
    svgScale: number;
    svgOriginalWidth?: number;
    svgOriginalHeight?: number;
    width: number;
    height: number;
    styleClasses?: StyleClass[];
    originalStyleClasses?: StyleClass[];
  } = {
    name: '',
    description: '',
    category: '',
    svgScale: 1,
    width: 100,
    height: 100
  };

  protected readonly libraryName = computed(() => this.library()?.name ?? 'Loading...');
  protected readonly symbols = computed(() => this.library()?.symbols ?? []);

  async ngOnInit(): Promise<void> {
    const libraryId = this.activatedRoute.snapshot.paramMap.get('libraryId');
    if (libraryId) {
      await this.loadLibrary(libraryId);
    }
  }

  private async loadLibrary(rtId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const lib = await this.symbolLibraryService.loadLibrary(rtId, false);
      this.library.set(lib);

      // Update breadcrumb with library name
      await this.breadCrumbService.updateBreadcrumbLabels({
        libraryName: lib.name
      });
    } catch (error) {
      console.error('Error loading library:', error);
      this.notificationService.show({
        content: 'Failed to load symbol library',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  protected navigateBack(): void {
    // Navigate to parent (library list) using relative navigation
    this.router.navigate(['..'], { relativeTo: this.activatedRoute });
  }

  protected selectSymbol(symbol: SymbolDefinition): void {
    this.selectedSymbol.set(symbol);
  }

  protected editSymbol(symbol: SymbolDefinition): void {
    if (symbol.rtId) {
      // Navigate to symbol editor using relative navigation
      this.router.navigate([symbol.rtId, 'edit'], { relativeTo: this.activatedRoute });
    }
  }

  // ============================================================================
  // Create Symbol Dialog
  // ============================================================================

  protected showCreateSymbolDialog(): void {
    this.newSymbol = {
      name: '',
      description: '',
      width: 100,
      height: 100,
      category: ''
    };
    this.showSymbolDialog.set(true);
  }

  protected closeSymbolDialog(): void {
    this.showSymbolDialog.set(false);
  }

  protected async createSymbol(): Promise<void> {
    const libraryId = this.library()?.id;
    if (!libraryId || !this.newSymbol.name) {
      return;
    }

    try {
      const newSymbol = await this.symbolLibraryService.createSymbol(libraryId, {
        name: this.newSymbol.name.trim(),
        description: this.newSymbol.description || undefined,
        version: '1.0.0',
        primitives: [],
        bounds: {
          width: this.newSymbol.width,
          height: this.newSymbol.height
        },
        canvasSize: {
          width: Math.max(400, this.newSymbol.width * 2),
          height: Math.max(300, this.newSymbol.height * 2)
        },
        gridSize: 10,
        category: this.newSymbol.category || undefined
      });

      this.notificationService.show({
        content: `Symbol "${newSymbol.name}" created successfully`,
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'success', icon: true }
      });

      this.closeSymbolDialog();

      // Navigate to the symbol editor using relative navigation
      if (newSymbol.rtId) {
        await this.router.navigate([newSymbol.rtId, 'edit'], { relativeTo: this.activatedRoute });
      }
    } catch (error) {
      console.error('Error creating symbol:', error);
      this.notificationService.show({
        content: 'Failed to create symbol',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    }
  }

  // ============================================================================
  // SVG Import Dialog
  // ============================================================================

  protected showSvgImportDialogFn(): void {
    this.svgImport = {
      name: '',
      description: '',
      category: '',
      svgScale: 1,
      width: 100,
      height: 100,
      svgPrimitives: undefined,
      svgOriginalPrimitives: undefined,
      svgFileName: undefined,
      svgOriginalWidth: undefined,
      svgOriginalHeight: undefined,
      styleClasses: undefined,
      originalStyleClasses: undefined
    };
    this.showSvgImportDialog.set(true);
  }

  protected closeSvgImportDialog(): void {
    this.showSvgImportDialog.set(false);
  }

  protected onSvgFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Reset input for re-selection
    input.value = '';

    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      this.notificationService.show({
        content: 'Please select an SVG file',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'warning', icon: true }
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const svgContent = reader.result as string;
      this.importSvgContent(svgContent, file.name);
    };
    reader.onerror = () => {
      this.notificationService.show({
        content: 'Error reading SVG file',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    };
    reader.readAsText(file);
  }

  private importSvgContent(svgContent: string, fileName: string): void {
    const result = this.svgImportService.importSvg(svgContent, {
      namePrefix: 'svg'
    });

    if (result.primitives.length === 0) {
      this.notificationService.show({
        content: 'No importable elements found in SVG',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'warning', icon: true }
      });
      return;
    }

    if (result.warnings.length > 0) {
      console.warn('SVG import warnings:', result.warnings);
    }

    // Calculate bounds and normalize primitives to start at (0,0)
    const { primitives: normalizedPrimitives, width, height } = this.normalizePrimitives(result.primitives);

    // Store original (normalized but unscaled) data
    this.svgImport.svgOriginalPrimitives = normalizedPrimitives;
    this.svgImport.svgOriginalWidth = Math.ceil(width);
    this.svgImport.svgOriginalHeight = Math.ceil(height);
    this.svgImport.svgScale = 1;

    // Store style classes extracted from CSS
    this.svgImport.originalStyleClasses = result.styleClasses;
    this.svgImport.styleClasses = result.styleClasses;

    // Update with SVG data (initially unscaled)
    this.svgImport.svgPrimitives = normalizedPrimitives;
    this.svgImport.svgFileName = fileName;
    this.svgImport.width = Math.ceil(width);
    this.svgImport.height = Math.ceil(height);

    // Use filename without extension as default name if empty
    if (!this.svgImport.name) {
      this.svgImport.name = fileName.replace(/\.svg$/i, '');
    }

    // Log style classes for debugging
    if (result.styleClasses.length > 0) {
      console.log('Extracted style classes:', result.styleClasses);
    }
  }

  protected onSvgScaleChange(scale: number | null): void {
    if (scale === null || scale <= 0 || !this.svgImport.svgOriginalPrimitives) {
      return;
    }

    // Apply scaling to original primitives
    const scaled = this.svgImportService.scalePrimitives(
      this.svgImport.svgOriginalPrimitives,
      scale
    );

    this.svgImport.svgPrimitives = scaled.primitives;
    this.svgImport.width = Math.ceil(scaled.width);
    this.svgImport.height = Math.ceil(scaled.height);
  }

  protected resetSvgScale(): void {
    this.svgImport.svgScale = 1;
    this.onSvgScaleChange(1);
  }

  protected async createSymbolFromSvg(): Promise<void> {
    const libraryId = this.library()?.id;
    if (!libraryId || !this.svgImport.name || !this.svgImport.svgPrimitives?.length) {
      return;
    }

    try {
      const newSymbol = await this.symbolLibraryService.createSymbol(libraryId, {
        name: this.svgImport.name.trim(),
        description: this.svgImport.description || undefined,
        version: '1.0.0',
        primitives: this.svgImport.svgPrimitives,
        bounds: {
          width: this.svgImport.width,
          height: this.svgImport.height
        },
        canvasSize: {
          width: Math.max(400, this.svgImport.width * 2),
          height: Math.max(300, this.svgImport.height * 2)
        },
        gridSize: 10,
        category: this.svgImport.category || undefined,
        styleClasses: this.svgImport.styleClasses
      });

      this.notificationService.show({
        content: `Symbol "${newSymbol.name}" imported successfully`,
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'success', icon: true }
      });

      this.closeSvgImportDialog();

      // Navigate to the symbol editor using relative navigation
      if (newSymbol.rtId) {
        await this.router.navigate([newSymbol.rtId, 'edit'], { relativeTo: this.activatedRoute });
      }
    } catch (error) {
      console.error('Error creating symbol from SVG:', error);
      this.notificationService.show({
        content: 'Failed to import symbol',
        hideAfter: 3000,
        position: { horizontal: 'right', vertical: 'top' },
        animation: { type: 'fade', duration: 400 },
        type: { style: 'error', icon: true }
      });
    }
  }

  // ============================================================================
  // SVG Import Helper Methods
  // ============================================================================

  private normalizePrimitives(primitives: PrimitiveBase[]): {
    primitives: PrimitiveBase[];
    width: number;
    height: number;
  } {
    // First pass: calculate bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const prim of primitives) {
      const bounds = this.getPrimitiveBoundsForImport(prim);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    // Handle edge case of no valid bounds
    if (minX === Infinity) {
      return { primitives, width: 100, height: 100 };
    }

    // Second pass: normalize primitives to start at (0,0)
    const offsetX = minX;
    const offsetY = minY;
    const normalizedPrimitives = primitives.map(prim => this.offsetPrimitive(prim, -offsetX, -offsetY));

    return {
      primitives: normalizedPrimitives,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private getPrimitiveBoundsForImport(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const pos = prim.position;

    switch (prim.type) {
      case 'rectangle': {
        const config = (prim as unknown as { config: { width: number; height: number } }).config;
        return { x: pos.x, y: pos.y, width: config.width, height: config.height };
      }
      case 'ellipse': {
        const config = (prim as unknown as { config: { radiusX: number; radiusY: number } }).config;
        return {
          x: pos.x - config.radiusX,
          y: pos.y - config.radiusY,
          width: config.radiusX * 2,
          height: config.radiusY * 2
        };
      }
      case 'path': {
        return estimatePathBounds(prim as PathPrimitive);
      }
      case 'polygon':
      case 'polyline': {
        const points = (prim as unknown as { config: { points: { x: number; y: number }[] } }).config.points;
        if (!points || points.length === 0) {
          return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const pt of points) {
          pMinX = Math.min(pMinX, pos.x + pt.x);
          pMinY = Math.min(pMinY, pos.y + pt.y);
          pMaxX = Math.max(pMaxX, pos.x + pt.x);
          pMaxY = Math.max(pMaxY, pos.y + pt.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
      }
      default:
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }

  private offsetPrimitive(prim: PrimitiveBase, dx: number, dy: number): PrimitiveBase {
    if (prim.type === 'path') {
      // For paths, transform the d attribute using the shared function
      const pathPrim = prim as PathPrimitive;
      const transformedD = offsetPathData(pathPrim.config.d, dx, dy);
      const result: PathPrimitive = {
        ...pathPrim,
        position: { x: 0, y: 0 },
        config: {
          ...pathPrim.config,
          d: transformedD
        }
      };
      return result;
    }

    // For other primitives, just offset the position
    return {
      ...prim,
      position: {
        x: prim.position.x + dx,
        y: prim.position.y + dy
      }
    };
  }

  protected async deleteSymbol(symbol: SymbolDefinition): Promise<void> {
    const confirmed = await this.confirmationService.showYesNoConfirmationDialog(
      'Delete Symbol',
      `Are you sure you want to delete symbol "${symbol.name}"?`
    );

    if (confirmed) {
      try {
        const success = await this.symbolLibraryService.deleteSymbol(symbol);
        if (success) {
          this.notificationService.show({
            content: 'Symbol deleted successfully',
            hideAfter: 3000,
            position: { horizontal: 'right', vertical: 'top' },
            animation: { type: 'fade', duration: 400 },
            type: { style: 'success', icon: true }
          });

          // Refresh library
          const libraryId = this.library()?.id;
          if (libraryId) {
            await this.loadLibrary(libraryId);
          }
        }
      } catch (error) {
        console.error('Error deleting symbol:', error);
        this.notificationService.show({
          content: 'Failed to delete symbol',
          hideAfter: 3000,
          position: { horizontal: 'right', vertical: 'top' },
          animation: { type: 'fade', duration: 400 },
          type: { style: 'error', icon: true }
        });
      }
    }
  }

  /**
   * Convert points array to SVG points string.
   * Points can be either a string or an array of {x, y} objects.
   */
  protected getPointsString(points: unknown): string {
    if (typeof points === 'string') {
      return points;
    }
    if (Array.isArray(points)) {
      return points.map((p: { x?: number; y?: number }) => `${p.x ?? 0},${p.y ?? 0}`).join(' ');
    }
    return '';
  }

  /**
   * Get polygon/polyline points with position offset applied.
   * This ensures points are rendered at their absolute positions.
   */
  protected getPointsWithOffset(primitive: PrimitiveBase): string {
    const config = (primitive as unknown as { config: { points?: { x: number; y: number }[] } }).config;
    const points = config?.points;
    if (!points || !Array.isArray(points)) {
      return '';
    }
    const pos = primitive.position;
    return points.map(p => `${(p.x ?? 0) + pos.x},${(p.y ?? 0) + pos.y}`).join(' ');
  }

  /**
   * Resolve the effective style for a primitive.
   * Priority: inline style > class style > default style
   */
  protected resolveStyle(primitive: PrimitiveBase, styleClasses?: StyleClass[]): PrimitiveStyle {
    let classStyle: PrimitiveStyle = {};

    // Look up style class if referenced
    if (primitive.styleClassId && styleClasses) {
      const styleClass = styleClasses.find(c => c.id === primitive.styleClassId);
      if (styleClass) {
        classStyle = styleClass.style;
      }
    }

    // Merge: inline style overrides class style
    return {
      ...classStyle,
      ...primitive.style,
      fill: {
        ...classStyle?.fill,
        ...primitive.style?.fill
      },
      stroke: {
        ...classStyle?.stroke,
        ...primitive.style?.stroke
      }
    };
  }

  /**
   * Get fill color for a primitive, resolving style class if needed
   */
  protected getFillColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = '#cccccc'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.color || defaultColor;
  }

  /**
   * Get stroke color for a primitive, resolving style class if needed
   */
  protected getStrokeColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = '#333333'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.color || defaultColor;
  }

  /**
   * Get stroke width for a primitive, resolving style class if needed
   */
  protected getStrokeWidth(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultWidth = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.width ?? defaultWidth;
  }

  /**
   * Get fill opacity for a primitive, resolving style class if needed
   */
  protected getFillOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.opacity ?? defaultOpacity;
  }

  /**
   * Get stroke opacity for a primitive, resolving style class if needed
   */
  protected getStrokeOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.opacity ?? defaultOpacity;
  }
}
