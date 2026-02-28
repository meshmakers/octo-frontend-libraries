import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
  inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  Type,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { KENDO_TOOLBAR } from '@progress/kendo-angular-toolbar';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  undoIcon,
  redoIcon,
  saveIcon,
  fileTxtIcon,
  pencilIcon,
  handIcon,
  arrowsNoRepeatIcon,
  zoomInIcon,
  zoomOutIcon,
  zoomBestFitIcon,
  gridIcon,
  uploadIcon,
  groupIcon,
  ungroupIcon,
  trashIcon,
  eyeIcon,
  menuIcon,
  gearsIcon,
  linkIcon
} from '@progress/kendo-svg-icons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { DockviewApi } from 'dockview-core';
import { DockviewComponent, DockviewReadyEvent } from './dockview/dockview.component';

import {
  ProcessDiagramConfig,
  ProcessElement,
  ProcessConnection,
  ProcessElementType,
  Position,
  Size,
  ProcessCanvasConfig
} from '../process-widget.models';
import { ElementPaletteComponent, PaletteItem } from './element-palette.component';
import { SymbolLibraryPanelComponent, SymbolPaletteItem } from './symbol-library-panel.component';
import { PropertyInspectorComponent } from './property-inspector.component';
import { AnimationChangeEvent } from './animation-editor.component';
import { ContextMenuComponent, ContextMenuItem, ContextMenuAction } from './context-menu.component';
import { PathEditorComponent } from './path-editor.component';
import {
  PrimitiveBase,
  PrimitiveType,
  PrimitiveTypeValue
} from '../primitives';
import { PrimitiveRendererRegistry, SymbolRenderer } from '../primitives';
import { SaveAsDialogService } from '@meshmakers/shared-ui';
import {
  SymbolInstance,
  SymbolDefinition,
  getSymbolInstanceBounds
} from '../primitives/models/symbol.model';
import { GroupPrimitive, isGroupPrimitive } from '../primitives';
import { TransformProperty, PropertyBinding } from '../primitives/models/transform-property.models';
import { BindingEditorDialogComponent } from './binding-editor-dialog.component';
import { BoundingBox } from '../primitives/models/primitive.models';
import { RectanglePrimitive } from '../primitives/models/rectangle.model';
import { EllipsePrimitive } from '../primitives/models/ellipse.model';
import { LinePrimitive } from '../primitives/models/line.model';
import { TextPrimitive } from '../primitives/models/text.model';
import { PathPrimitive, offsetPathData } from '../primitives/models/path.model';
import { PolygonPrimitive, PolylinePrimitive } from '../primitives/models/polygon.model';
import { ImagePrimitive } from '../primitives/models/image.model';
import { AttributeAnimation, TransformAnimation } from '../primitives/models/animation.models';
import { renderAnimations, AnimationRenderContext, renderFlowParticles, getFlowParticlesAnimation } from '../primitives/renderers/animation.renderer';
import { SymbolLibraryService } from '../services/symbol-library.service';
import { SvgImportService } from '../services/svg-import.service';
import { ExpressionEvaluatorService } from '../services/expression-evaluator.service';
import {
  DesignerSelectionService,
  DesignerClipboardService,
  DesignerHistoryService,
  DesignerStateService,
  DesignerCoordinateService,
  DesignerDragService,
  DesignerResizeService,
  DesignerZOrderService,
  DesignerDeletionService,
  DesignerGroupingService,
  DesignerContextMenuService,
  DesignerKeyboardService,
  DesignerCreationService,
  DesignerRenderingService,
  PathEditorService,
  GeometryUtilService,
  DesignerDiagramService,
  DesignerPrimitiveService,
  DesignerBoundsService,
  DesignerAlignmentService,
  DesignerAlignmentGuideService,
  DesignerLayoutService
} from './services';
import {
  ElementsPanelComponent,
  SymbolsPanelComponent,
  PropertiesPanelComponent,
  TransformPanelComponent,
  AnimationsPanelComponent,
  SimulationPanelWrapperComponent,
  SettingsPanelComponent,
  StylesPanelComponent,
  TransformPropertyChangeEvent,
  SimulationValueChange
} from './panels';
import { StyleClass } from '../primitives';

/**
 * Symbol settings for the settings panel
 */
export interface SymbolSettings {
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string;
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
}

/**
 * Designer mode for the editor
 */
export type DesignerMode = 'select' | 'pan' | 'connect';

/**
 * Drag state for element manipulation
 */
interface DragState {
  isDragging: boolean;
  elementId: string | null;
  /** The original position of the element/primitive when drag started */
  startPosition: Position | null;
  /** The mouse position when drag started (in canvas coordinates) */
  startMousePosition: Position | null;
  /** For primitives: true if dragging a primitive */
  isPrimitive?: boolean;
  /** True if dragging a group */
  isGroup?: boolean;
}


/**
 * Resize handle position type
 */
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

/**
 * Resize state for element resizing
 */
interface ResizeState {
  isResizing: boolean;
  elementId: string | null;
  handle: ResizeHandle | null;
  startSize: Size | null;
  startPosition: Position | null;
  startMousePosition: Position | null;
  // For primitives
  isPrimitive?: boolean;
  startBounds?: { x: number; y: number; width: number; height: number };
  // For groups
  isGroup?: boolean;
  groupChildData?: {
    id: string;
    type: 'primitive' | 'symbol';
    startBounds: { x: number; y: number; width: number; height: number };
  }[];
}

/**
 * Process Designer Component
 *
 * A visual editor for creating and modifying process diagrams.
 * Features:
 * - Drag-and-drop element placement from palette
 * - Element selection and multi-selection
 * - Property editing via inspector panel
 * - Zoom and pan navigation
 * - Grid snapping
 * - Connection drawing between elements
 * - Undo/redo support (planned)
 */
@Component({
  selector: 'mm-process-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    KENDO_TOOLBAR,
    SVGIconModule,
    InputsModule,
    DropDownsModule,
    DialogsModule,
    ElementPaletteComponent,
    SymbolLibraryPanelComponent,
    PropertyInspectorComponent,
    ContextMenuComponent,
    PathEditorComponent,
    ElementsPanelComponent,
    SymbolsPanelComponent,
    PropertiesPanelComponent,
    TransformPanelComponent,
    AnimationsPanelComponent,
    SimulationPanelWrapperComponent,
    SettingsPanelComponent,
    StylesPanelComponent,
    DockviewComponent,
    BindingEditorDialogComponent
  ],
  providers: [
    DesignerDiagramService,
    DesignerSelectionService,
    DesignerClipboardService,
    DesignerHistoryService,
    DesignerStateService,
    DesignerCoordinateService,
    DesignerDragService,
    DesignerResizeService,
    DesignerZOrderService,
    DesignerDeletionService,
    DesignerGroupingService,
    DesignerContextMenuService,
    DesignerKeyboardService,
    DesignerCreationService,
    DesignerRenderingService,
    DesignerPrimitiveService,
    DesignerBoundsService,
    DesignerAlignmentService,
    DesignerAlignmentGuideService
  ],
  templateUrl: './process-designer.component.html',
  styleUrl: './process-designer.component.scss'
})

export class ProcessDesignerComponent implements OnInit, OnDestroy, AfterViewInit {

  // SVG Icons
  readonly undoIcon = undoIcon;
  readonly redoIcon = redoIcon;
  readonly saveIcon = saveIcon;
  readonly fileTxtIcon = fileTxtIcon;
  readonly pencilIcon = pencilIcon;
  readonly handIcon = handIcon;
  readonly arrowsNoRepeatIcon = arrowsNoRepeatIcon;
  readonly zoomInIcon = zoomInIcon;
  readonly zoomOutIcon = zoomOutIcon;
  readonly zoomBestFitIcon = zoomBestFitIcon;
  readonly gridIcon = gridIcon;
  readonly uploadIcon = uploadIcon;
  readonly groupIcon = groupIcon;
  readonly ungroupIcon = ungroupIcon;
  readonly trashIcon = trashIcon;
  readonly eyeIcon = eyeIcon;
  readonly menuIcon = menuIcon;
  readonly gearsIcon = gearsIcon;
  readonly linkIcon = linkIcon;

  @Input() set diagramConfig(config: ProcessDiagramConfig | null) {
    if (config) {
      // Prevent effect from emitting during input update
      this._updatingFromInput = true;
      try {
        this.diagramService.setDiagram(config);
        // Sync grid settings from canvas config to stateService
        this.stateService.syncGridSettings(config.canvas.gridSize, config.canvas.showGrid);
        // Load symbol definitions for any symbol instances in the diagram
        void this.loadSymbolDefinitions();
        // Initialize diagram-level property state from loaded config
        this._diagramTransformProperties.set(config.transformProperties ?? []);
        this._diagramPropertyBindings.set(config.propertyBindings ?? []);
        this._diagramAnimations.set(config.animations ?? []);
        this._diagramSimulationValues.set({});
      } finally {
        this._updatingFromInput = false;
      }
    }
  }

  /**
   * Editor mode configuration
   * - 'diagram': Full process diagram editing (default)
   * - 'symbol': Symbol definition editing (hides elements, simplified toolbar)
   */
  @Input() editorMode: 'diagram' | 'symbol' = 'diagram';

  /**
   * Whether to show the Save/SaveAs/Rename toolbar buttons
   */
  @Input() showSaveButtons = true;

  /**
   * Transform properties available for animation property linking.
   * In symbol editor mode, these come from the symbol definition.
   * Stored as a signal for reactive updates in dockview panels.
   */
  private readonly _transformPropertiesInput = signal<TransformProperty[]>([]);
  @Input()
  set transformProperties(value: TransformProperty[]) {
    this._transformPropertiesInput.set(value);
  }
  get transformProperties(): TransformProperty[] {
    return this._transformPropertiesInput();
  }
  readonly transformPropertiesSignal = this._transformPropertiesInput.asReadonly();

  /**
   * Property bindings for the symbol.
   * Used to evaluate animation enabled states based on expressions.
   * Stored as a signal for reactive updates in dockview panels.
   */
  private readonly _propertyBindings = signal<PropertyBinding[]>([]);
  @Input()
  set propertyBindings(value: PropertyBinding[]) {
    this._propertyBindings.set(value);
  }
  get propertyBindings(): PropertyBinding[] {
    return this._propertyBindings();
  }
  readonly propertyBindingsSignal = this._propertyBindings.asReadonly();

  /**
   * Current simulation property values.
   * When set, these override default values for animation evaluation.
   * Stored as a signal for reactive animation enabled state evaluation.
   */
  private readonly _simulationPropertyValues = signal<Record<string, unknown>>({});
  @Input()
  set simulationPropertyValues(value: Record<string, unknown>) {
    this._simulationPropertyValues.set(value);
  }
  get simulationPropertyValues(): Record<string, unknown> {
    return this._simulationPropertyValues();
  }
  readonly simulationPropertyValuesSignal = this._simulationPropertyValues.asReadonly();

  // ============================================================================
  // Diagram-level property state (used when editorMode='diagram')
  // ============================================================================

  /**
   * Diagram-level transform properties.
   * When editorMode='diagram', these are stored in the diagram itself.
   */
  private readonly _diagramTransformProperties = signal<TransformProperty[]>([]);

  /**
   * Diagram-level property bindings.
   * When editorMode='diagram', these are stored in the diagram itself.
   */
  private readonly _diagramPropertyBindings = signal<PropertyBinding[]>([]);

  /**
   * Diagram-level animations.
   * When editorMode='diagram', these are stored in the diagram itself.
   */
  private readonly _diagramAnimations = signal<import('../primitives/models/animation.models').AnimationDefinition[]>([]);

  /**
   * Diagram-level simulation values for testing bindings.
   * Used to preview data binding effects in diagram mode.
   */
  private readonly _diagramSimulationValues = signal<Record<string, unknown>>({});

  @Output() diagramChange = new EventEmitter<ProcessDiagramConfig>();
  @Output() saveRequest = new EventEmitter<ProcessDiagramConfig>();

  /**
   * Emitted when transform properties or bindings change (symbol editor mode).
   * Only relevant when useDockview is true in symbol mode.
   */
  @Output() transformPropertiesChange = new EventEmitter<TransformPropertyChangeEvent>();

  /**
   * Emitted when a simulation value changes (symbol editor mode).
   * Only relevant when useDockview is true in symbol mode.
   */
  @Output() simulationValueChange = new EventEmitter<SimulationValueChange>();

  /**
   * Emitted when simulation values are reset (symbol editor mode).
   * Only relevant when useDockview is true in symbol mode.
   */
  @Output() simulationReset = new EventEmitter<void>();

  @ViewChild('canvasContainer') canvasContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgFileInput') svgFileInputRef!: ElementRef<HTMLInputElement>;

  private readonly svgImportService = inject(SvgImportService);
  private readonly primitiveRendererRegistry = inject(PrimitiveRendererRegistry);
  private readonly saveAsDialogService = inject(SaveAsDialogService);
  private readonly symbolRenderer = inject(SymbolRenderer);
  private readonly symbolLibraryService = inject(SymbolLibraryService);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ngZone = inject(NgZone);
  private readonly selectionService = inject(DesignerSelectionService);
  // creationService must be injected before _diagram initialization (uses generateId)
  private readonly creationService = inject(DesignerCreationService);
  // State service manages mode, zoom, pan, grid settings, and change tracking
  private readonly stateService = inject(DesignerStateService);
  // Coordinate service handles coordinate transformations and grid snapping
  private readonly coordinateService = inject(DesignerCoordinateService);
  // Context menu service handles context menu state and items
  private readonly contextMenuService = inject(DesignerContextMenuService);
  // Drag service handles drag state and position calculations
  private readonly dragService = inject(DesignerDragService);
  // Resize service handles resize state and bounds calculations
  private readonly resizeService = inject(DesignerResizeService);
  // Diagram service owns the diagram signal and provides mutation methods
  private readonly diagramService = inject(DesignerDiagramService);

  // State signals
  // Diagram is now owned by DesignerDiagramService - computed signal for reactivity
  private readonly _diagram = computed(() => this.diagramService.diagram());
  // Selection is now managed by DesignerSelectionService
  // Drag state is now managed by DesignerDragService - adapter for legacy interface
  // Resize state is now managed by DesignerResizeService - adapter for legacy interface
  readonly resizeState = computed<ResizeState>(() => {
    const state = this.resizeService.state();
    return {
      isResizing: state.isResizing,
      elementId: state.itemId,
      handle: state.handle,
      startSize: state.startSize,
      startPosition: state.startPosition,
      startMousePosition: state.startMousePosition,
      isPrimitive: state.itemType === 'primitive' || state.itemType === 'group',
      startBounds: state.startBounds ?? undefined,
      isGroup: state.itemType === 'group',
      groupChildData: state.groupChildData ?? undefined
    };
  });
  private readonly _panState = signal<{
    isPanning: boolean;
    startMousePosition: Position | null;
    startPanOffset: Position | null;
  }>({
    isPanning: false,
    startMousePosition: null,
    startPanOffset: null
  });
  // selectionRect is now managed by DesignerSelectionService
  // hasChanges is now managed by DesignerStateService

  // Panel visibility state
  private readonly _showLeftPanel = signal(true);
  private readonly _showRightPanel = signal(true);

  // Dockview layout state
  private readonly layoutService = inject(DesignerLayoutService);
  private dockviewApi: DockviewApi | null = null;
  private readonly _dockviewReady = signal(false);
  readonly dockviewReady = this._dockviewReady.asReadonly();

  // Dockview panel visibility tracking
  private readonly _panelVisibility = signal<Record<string, boolean>>({
    elements: true,
    symbols: true,
    properties: true,
    transform: true,
    animations: true,
    simulation: true,
    settings: true,
    styles: true
  });
  readonly panelVisibility = this._panelVisibility.asReadonly();

  // Dockview panel width (resizable)
  private readonly _dockviewPanelWidth = signal(400);
  readonly dockviewPanelWidth = this._dockviewPanelWidth.asReadonly();
  private _isResizingDockview = false;
  private _resizeStartX = 0;
  private _resizeStartWidth = 400;

  // View menu state
  private readonly _viewMenuOpen = signal(false);
  readonly viewMenuOpen = this._viewMenuOpen.asReadonly();

  /**
   * View menu items for dropdown button
   */
  readonly viewMenuItems = computed(() => {
    const visibility = this._panelVisibility();
    const items: { text: string; click?: () => void; disabled?: boolean }[] = this.panelConfig.map(panel => ({
      text: `${visibility[panel.id] ? '✓ ' : '   '}${panel.label}`,
      click: () => this.togglePanelVisibility(panel.id)
    }));
    // Separator - use em dash line with disabled flag
    items.push({ text: '────────────', disabled: true });
    items.push({
      text: 'Reset Layout',
      click: () => this.resetDockviewLayout()
    });
    return items;
  });

  /**
   * Handle view menu item click
   */
  onViewMenuItemClick(event: { item: { text: string; click?: () => void; disabled?: boolean } }): void {
    if (event.item.click && !event.item.disabled) {
      event.item.click();
    }
  }

  /**
   * Enable dockview-based flexible panel layout.
   * When false (default), uses traditional fixed sidebar layout.
   */
  @Input() useDockview = false;

  /**
   * Symbol settings for the settings panel (only used when useDockview is true)
   */
  @Input() symbolSettings: SymbolSettings | null = null;

  /**
   * Emitted when symbol settings change in the settings panel
   */
  @Output() symbolSettingsChange = new EventEmitter<{ key: string; value: string | number }>();

  /**
   * Style classes for the symbol (only used in symbol mode with dockview)
   * Stored as signal for reactivity in dockview panels
   */
  private readonly _styleClasses = signal<StyleClass[]>([]);

  @Input()
  set styleClasses(value: StyleClass[]) {
    this._styleClasses.set(value);
  }

  get styleClasses(): StyleClass[] {
    return this._styleClasses();
  }

  /** Signal accessor for style classes (for passing to panels) */
  readonly styleClassesSignal = this._styleClasses.asReadonly();

  /**
   * Emitted when style classes change in the styles panel
   */
  @Output() styleClassesChange = new EventEmitter<StyleClass[]>();

  // Container dimensions for effective zoom calculation
  private readonly _containerDimensions = signal<{ width: number; height: number }>({ width: 1, height: 1 });
  private resizeObserver: ResizeObserver | null = null;

  // History service for undo/redo
  private readonly historyService = inject(DesignerHistoryService<ProcessDiagramConfig>);

  // Clipboard service for copy/paste
  private readonly clipboardService = inject(DesignerClipboardService);

  // New services for refactored logic
  private readonly zOrderService = inject(DesignerZOrderService);
  private readonly deletionService = inject(DesignerDeletionService);
  private readonly groupingService = inject(DesignerGroupingService);
  // Rendering and keyboard services
  private readonly renderingService = inject(DesignerRenderingService);
  private readonly keyboardService = inject(DesignerKeyboardService);
  private readonly geometryService = inject(GeometryUtilService);
  private readonly primitiveService = inject(DesignerPrimitiveService);
  private readonly boundsService = inject(DesignerBoundsService);
  private readonly alignmentService = inject(DesignerAlignmentService);
  private readonly alignmentGuideService = inject(DesignerAlignmentGuideService);

  // Context menu state
  // Context menu state is now delegated to DesignerContextMenuService
  // Use computed to adapt service state to expected shape
  readonly contextMenu = computed(() => {
    const state = this.contextMenuService.state();
    return {
      visible: state.visible,
      position: state.screenPosition,
      canvasPosition: state.canvasPosition
    };
  });

  // Sidebar tab state
  private readonly _activeSidebarTab = signal<'elements' | 'symbols'>('elements');
  readonly activeSidebarTab = this._activeSidebarTab.asReadonly();

  // Path editor state
  private readonly _pathEditorVisible = signal(false);
  private readonly _editingPathId = signal<string | null>(null);
  readonly pathEditorVisible = this._pathEditorVisible.asReadonly();

  // Line endpoint drag state
  private readonly _lineEndpointDrag = signal<{
    isDragging: boolean;
    lineId: string | null;
    endpoint: 'start' | 'end' | null;
  }>({ isDragging: false, lineId: null, endpoint: null });

  // Polyline/Polygon point drag state
  private readonly _polyPointDrag = signal<{
    isDragging: boolean;
    primitiveId: string | null;
    pointIndex: number | null;
  }>({ isDragging: false, primitiveId: null, pointIndex: null });

  // Binding editor dialog state
  private readonly _showBindingEditor = signal(false);
  private readonly _editingBindingProperty = signal<TransformProperty | null>(null);
  readonly showBindingEditor = this._showBindingEditor.asReadonly();
  readonly editingBindingProperty = this._editingBindingProperty.asReadonly();

  // Currently selected polyline point (for deletion with Delete key)
  private readonly _selectedPolyPoint = signal<{
    primitiveId: string;
    pointIndex: number;
  } | null>(null);
  readonly selectedPolyPoint = this._selectedPolyPoint.asReadonly();

  /** The path data string of the currently editing path primitive */
  readonly editingPathData = computed(() => {
    const pathId = this._editingPathId();
    if (!pathId) return '';
    const primitive = (this._diagram().primitives ?? []).find(p => p.id === pathId);
    if (!primitive || primitive.type !== PrimitiveType.Path) return '';
    return (primitive as unknown as { config: { d: string } }).config.d;
  });

  /** Check if exactly one path primitive is selected */
  readonly canEditPath = computed(() => {
    const sel = this.selectionService.selection();
    if (sel.elements.size !== 1) return false;
    const primitives = this._diagram().primitives ?? [];
    const selectedId = Array.from(sel.elements)[0];
    const primitive = primitives.find(p => p.id === selectedId);
    return primitive?.type === PrimitiveType.Path;
  });

  /** Check if exactly one polyline/polygon is selected */
  readonly isPolylineSelected = computed(() => {
    const sel = this.selectionService.selection();
    if (sel.elements.size !== 1) return false;
    const primitives = this._diagram().primitives ?? [];
    const selectedId = Array.from(sel.elements)[0];
    const primitive = primitives.find(p => p.id === selectedId);
    return primitive?.type === PrimitiveType.Polyline || primitive?.type === PrimitiveType.Polygon;
  });

  /** Check if a polyline point is selected and can be deleted */
  readonly canDeletePolyPoint = computed(() => {
    const selected = this._selectedPolyPoint();
    if (!selected) return false;
    const diagram = this._diagram();
    const primitive = (diagram.primitives ?? []).find(p => p.id === selected.primitiveId);
    if (!primitive) return false;
    const polyPrim = primitive as unknown as { config: { points: Position[] } };
    const minPoints = primitive.type === PrimitiveType.Polygon ? 3 : 2;
    return polyPrim.config.points.length > minPoints;
  });

  // Context menu items based on current selection
  readonly contextMenuItems = computed<ContextMenuItem[]>(() => {
    const hasSelection = this.hasSelection();
    const hasClipboard = this.hasClipboardContent();
    const canGroup = this.canGroup();
    const canUngroup = this.canUngroup();
    const canEditPath = this.canEditPath();
    const isPolylineSelected = this.isPolylineSelected();
    const canDeletePolyPoint = this.canDeletePolyPoint();
    const selectedCount = this.selectionService.selection().elements.size;

    const items: ContextMenuItem[] = [
      { id: 'copy', label: 'Copy', icon: '📋', shortcut: 'Ctrl+C', disabled: !hasSelection },
      { id: 'paste', label: 'Paste', icon: '📄', shortcut: 'Ctrl+V', disabled: !hasClipboard },
      { id: 'separator1', label: '', separator: true }
    ];

    // Add Edit Path option when a path primitive is selected
    if (canEditPath) {
      items.push({ id: 'editPath', label: 'Edit Path', icon: '✏️' });
      items.push({ id: 'separatorPath', label: '', separator: true });
    }

    // Add polyline point options
    if (isPolylineSelected) {
      items.push({ id: 'addPolyPoint', label: 'Add Point', icon: '➕' });
      items.push({ id: 'deletePolyPoint', label: 'Delete Point', icon: '➖', disabled: !canDeletePolyPoint });
      items.push({ id: 'separatorPoly', label: '', separator: true });
    }

    items.push(
      { id: 'group', label: 'Group', icon: '⊞', shortcut: 'Ctrl+G', disabled: !canGroup },
      { id: 'ungroup', label: 'Ungroup', icon: '⊟', shortcut: 'Ctrl+Shift+G', disabled: !canUngroup },
      { id: 'separator2', label: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '🗑️', shortcut: 'Del', disabled: !hasSelection },
      { id: 'separator3', label: '', separator: true },
      { id: 'bringToFront', label: 'Bring to Front', icon: '⏫', disabled: !hasSelection },
      { id: 'bringForward', label: 'Bring Forward', icon: '🔼', disabled: !hasSelection },
      { id: 'sendBackward', label: 'Send Backward', icon: '🔽', disabled: !hasSelection },
      { id: 'sendToBack', label: 'Send to Back', icon: '⏬', disabled: !hasSelection },
      { id: 'separator4', label: '', separator: true }
    );

    // Alignment options (require 2+ items)
    items.push(
      { id: 'alignLeft', label: 'Align Left', icon: '⫷', disabled: selectedCount < 2 },
      { id: 'alignRight', label: 'Align Right', icon: '⫸', disabled: selectedCount < 2 },
      { id: 'alignTop', label: 'Align Top', icon: '⊤', disabled: selectedCount < 2 },
      { id: 'alignBottom', label: 'Align Bottom', icon: '⊥', disabled: selectedCount < 2 },
      { id: 'alignHorizontalCenter', label: 'Align H-Center', icon: '⫿', disabled: selectedCount < 2 },
      { id: 'alignVerticalCenter', label: 'Align V-Center', icon: '⫾', disabled: selectedCount < 2 },
      { id: 'separator5', label: '', separator: true }
    );

    // Distribution options (require 3+ items)
    items.push(
      { id: 'distributeHorizontally', label: 'Distribute H', icon: '⇿', disabled: selectedCount < 3 },
      { id: 'distributeVertically', label: 'Distribute V', icon: '⇵', disabled: selectedCount < 3 },
      { id: 'separator6', label: '', separator: true }
    );

    items.push(
      { id: 'selectAll', label: 'Select All', icon: '☐', shortcut: 'Ctrl+A' }
    );

    return items;
  });

  // Public readonly signals - delegated to DesignerStateService
  get mode() { return this.stateService.mode; }
  get zoom() { return this.stateService.zoom; }
  get showGrid() { return this.stateService.showGrid; }
  get snapToGrid() { return this.stateService.snapToGrid; }
  get gridSize() { return this.stateService.gridSize; }
  get showElementNames() { return this.stateService.showElementNames; }
  // Selection is delegated to DesignerSelectionService
  get selection() { return this.selectionService.selection; }
  // Drag state is delegated to DesignerDragService - adapter for legacy interface
  readonly dragState = computed<DragState>(() => {
    const state = this.dragService.state();
    return {
      isDragging: state.isDragging,
      elementId: state.itemId,
      startPosition: state.startPosition,
      startMousePosition: state.startMousePosition,
      isPrimitive: state.itemType === 'primitive' || state.itemType === 'group',
      isGroup: state.itemType === 'group'
    };
  });
  get selectionRect() { return this.selectionService.selectionRect; }
  get hasChanges() { return this.stateService.hasChanges; }
  /** Clear the hasChanges flag (e.g., after external save) */
  clearChanges(): void { this.stateService.clearChanges(); }
  readonly showLeftPanel = this._showLeftPanel.asReadonly();
  readonly showRightPanel = this._showRightPanel.asReadonly();

  /**
   * Public readonly signal for the current diagram state.
   * Used by the template and by parent components (like SymbolEditor) to get the latest state.
   */
  readonly diagram = this.diagramService.diagram;

  // Computed values - delegated to DesignerStateService
  get zoomPercentage() { return this.stateService.zoomPercentage; }

  readonly canvasConfig = computed((): ProcessCanvasConfig => {
    return this._diagram().canvas;
  });

  /**
   * ViewBox is now fixed to canvas dimensions.
   * Zoom is handled by scaling the SVG element itself (Figma-style zoom).
   */
  readonly viewBox = computed(() => {
    const canvas = this.canvasConfig();
    return `0 0 ${canvas.width} ${canvas.height}`;
  });

  /**
   * Scaled canvas width based on zoom level.
   * At zoom 2.0, a 500px canvas becomes 1000px on screen.
   */
  readonly scaledCanvasWidth = computed(() => {
    return this.canvasConfig().width * this.stateService.zoom();
  });

  /**
   * Scaled canvas height based on zoom level.
   * At zoom 2.0, a 300px canvas becomes 600px on screen.
   */
  readonly scaledCanvasHeight = computed(() => {
    return this.canvasConfig().height * this.stateService.zoom();
  });

  readonly canvasCursor = computed(() => {
    // Show grabbing cursor when actively panning
    if (this._panState().isPanning) {
      return 'grabbing';
    }

    switch (this.stateService.mode()) {
      case 'pan': return 'grab';
      case 'connect': return 'crosshair';
      default: return 'default';
    }
  });

  // ============================================================================
  // Zoom-Scaled UI Element Sizes
  // These ensure UI elements (handles, strokes) maintain constant screen size
  // ============================================================================

  /**
   * Effective zoom factor - with Figma-style zoom, this equals the user zoom.
   * The SVG element is directly scaled, so 1 canvas unit = zoom screen pixels.
   */
  readonly effectiveZoom = computed(() => {
    return Math.max(this.stateService.zoom(), 0.1);
  });

  /** Size of resize handles in canvas units (constant screen size) */
  readonly handleSize = computed(() => 8 / this.effectiveZoom());

  /** Offset for resize handles (half of handleSize) */
  readonly handleOffset = computed(() => 4 / this.effectiveZoom());

  /** Stroke width for selection indicators */
  readonly selectionStrokeWidth = computed(() => 1 / this.effectiveZoom());

  /** Stroke width for selection highlights (thicker) */
  readonly selectionHighlightWidth = computed(() => 1.5 / this.effectiveZoom());

  /** Dash array for selection indicators */
  readonly selectionDashArray = computed(() => {
    const scale = 1 / this.effectiveZoom();
    return `${4 * scale} ${2 * scale}`;
  });

  /** Radius for connection ports and point handles */
  readonly portRadius = computed(() => 5 / this.effectiveZoom());

  /** Padding around selection boxes */
  readonly selectionPadding = computed(() => 2 / this.effectiveZoom());

  /** Stroke width for alignment guide lines */
  readonly guideStrokeWidth = computed(() => 1 / this.effectiveZoom());

  /** Active alignment guides from the alignment guide service */
  readonly alignmentGuides = this.alignmentGuideService.guides;

  readonly selectedElements = computed(() => {
    return this.selectionService.getSelectedElements(this._diagram());
  });

  readonly selectedConnections = computed(() => {
    return this.selectionService.getSelectedConnections(this._diagram());
  });

  readonly selectedPrimitives = computed(() => {
    return this.selectionService.getSelectedPrimitives(this._diagram());
  });

  /**
   * ID of the first selected primitive (for animations panel).
   */
  readonly firstSelectedPrimitiveId = computed(() => {
    const primitives = this.selectedPrimitives();
    return primitives.length > 0 ? primitives[0].id : '';
  });

  /**
   * Animations of the first selected primitive (for animations panel).
   */
  readonly firstSelectedPrimitiveAnimations = computed(() => {
    const primitives = this.selectedPrimitives();
    if (primitives.length === 0) return [];
    return primitives[0].animations ?? [];
  });

  /**
   * Primitive types that support animations.
   * Image and text primitives don't have animation rendering support.
   */
  private readonly animationSupportedTypes = new Set([
    'rectangle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'group'
  ]);

  /**
   * Whether the first selected primitive supports animations.
   * Used to show/hide the animations panel editor.
   */
  readonly firstSelectedPrimitiveSupportsAnimations = computed(() => {
    const primitives = this.selectedPrimitives();
    if (primitives.length === 0) return false;
    return this.animationSupportedTypes.has(primitives[0].type);
  });

  /**
   * Available transform properties for animation property linking.
   * In diagram mode, returns diagram-level properties.
   * In symbol mode, returns the transformProperties input (set by parent component like symbol-editor).
   */
  readonly availableTransformProperties = computed<TransformProperty[]>(() => {
    if (this.editorMode === 'diagram') {
      return this._diagramTransformProperties();
    }
    // Use the signal directly for reactive tracking
    return this._transformPropertiesInput();
  });

  /**
   * Effective property bindings for the current mode.
   * In diagram mode, returns diagram-level bindings.
   * In symbol mode, returns the external input bindings.
   */
  readonly effectivePropertyBindings = computed<PropertyBinding[]>(() => {
    if (this.editorMode === 'diagram') {
      return this._diagramPropertyBindings();
    }
    return this._propertyBindings();
  });

  /**
   * Effective simulation values for the current mode.
   * In diagram mode, returns diagram-level simulation values.
   * In symbol mode, returns the external input simulation values.
   */
  readonly effectiveSimulationValues = computed<Record<string, unknown>>(() => {
    if (this.editorMode === 'diagram') {
      return this._diagramSimulationValues();
    }
    return this._simulationPropertyValues();
  });

  /**
   * Computed animation enabled states.
   * Reactively evaluates animation bindings when simulation values or bindings change.
   */
  readonly animationEnabledStates = computed<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};

    // Read signals to track dependencies - use effective values for mode-aware behavior
    const bindings = this.effectivePropertyBindings();
    const simValues = this.effectiveSimulationValues();
    const properties = this.availableTransformProperties();

    // Filter bindings that control animations
    const animationBindings = bindings.filter(
      b => b.effectType === 'animation.enabled' && b.animationId
    );

    if (animationBindings.length === 0) {
      return states;
    }

    // Build context with property values (simulation values override defaults)
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of properties) {
      const simValue = simValues[prop.id];
      const val = simValue !== undefined ? simValue : prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Evaluate each animation binding
    for (const binding of animationBindings) {
      const property = properties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Set 'value' to the current property value (simulation or default)
      const simValue = simValues[property.id];
      const propValue = simValue !== undefined ? simValue : property.defaultValue;
      if (typeof propValue === 'number') context['value'] = propValue;
      else if (typeof propValue === 'string') context['value'] = propValue;
      else if (typeof propValue === 'boolean') context['value'] = propValue;

      // Evaluate the expression
      const result = this.expressionEvaluator.evaluate(binding.expression, context);
      if (result.success) {
        const key = `${binding.targetId}:${binding.animationId}`;
        states[key] = Boolean(result.value);
      }
    }

    return states;
  });

  /**
   * Computed property values for symbol instances.
   * Evaluates "Pass to child property" bindings and returns a map of
   * symbolInstanceId -> { propertyId -> value }.
   * Used to pass values from parent symbol properties to nested symbol instances.
   */
  readonly symbolInstancePropertyValues = computed<Map<string, Record<string, unknown>>>(() => {
    const result = new Map<string, Record<string, unknown>>();

    // Read signals to track dependencies - use effective values for mode-aware behavior
    const bindings = this.effectivePropertyBindings();
    const simValues = this.effectiveSimulationValues();
    const properties = this.availableTransformProperties();

    // Filter bindings that pass values to symbol instances
    const propertyBindings = bindings.filter(
      b => b.targetType === 'symbolInstance' && b.effectType === 'property' && b.targetPropertyId
    );

    if (propertyBindings.length === 0) {
      return result;
    }

    // Build context with property values (simulation values override defaults)
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of properties) {
      const simValue = simValues[prop.id];
      const val = simValue !== undefined ? simValue : prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Evaluate each property binding
    for (const binding of propertyBindings) {
      const property = properties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Set 'value' to the current property value (simulation or default)
      const simValue = simValues[property.id];
      const propValue = simValue !== undefined ? simValue : property.defaultValue;
      if (typeof propValue === 'number') context['value'] = propValue;
      else if (typeof propValue === 'string') context['value'] = propValue;
      else if (typeof propValue === 'boolean') context['value'] = propValue;

      // Evaluate the expression
      const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
      if (evalResult.success && binding.targetPropertyId) {
        // Get or create the property values map for this symbol instance
        if (!result.has(binding.targetId)) {
          result.set(binding.targetId, {});
        }
        const instanceValues = result.get(binding.targetId)!;
        instanceValues[binding.targetPropertyId] = evalResult.value;
      }
    }

    return result;
  });

  /**
   * Computed direct effects for symbol instances.
   * Evaluates bindings that target symbol instances with direct effects like fillLevel, style changes, etc.
   * Returns a map of symbolInstanceId -> { effectType -> value }.
   * Used to apply diagram-level bindings to symbol instances during rendering.
   */
  readonly symbolInstanceDirectEffects = computed<Map<string, Record<string, unknown>>>(() => {
    const result = new Map<string, Record<string, unknown>>();

    // Read signals to track dependencies - use effective values for mode-aware behavior
    const bindings = this.effectivePropertyBindings();
    const simValues = this.effectiveSimulationValues();
    const properties = this.availableTransformProperties();

    // Filter bindings that target symbol instances with direct effects (not 'property' effect type)
    const directEffectBindings = bindings.filter(
      b => b.targetType === 'symbolInstance' && b.effectType !== 'property' && b.effectType !== 'animation.enabled'
    );

    if (directEffectBindings.length === 0) {
      return result;
    }

    // Build context with property values (simulation values override defaults)
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of properties) {
      const simValue = simValues[prop.id];
      const val = simValue !== undefined ? simValue : prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Evaluate each direct effect binding
    for (const binding of directEffectBindings) {
      const property = properties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Set 'value' to the current property value (simulation or default)
      const simValue = simValues[property.id];
      const propValue = simValue !== undefined ? simValue : property.defaultValue;
      if (typeof propValue === 'number') context['value'] = propValue;
      else if (typeof propValue === 'string') context['value'] = propValue;
      else if (typeof propValue === 'boolean') context['value'] = propValue;

      // Evaluate the expression
      const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
      if (evalResult.success) {
        // Get or create the effects map for this symbol instance
        if (!result.has(binding.targetId)) {
          result.set(binding.targetId, {});
        }
        const instanceEffects = result.get(binding.targetId)!;
        instanceEffects[binding.effectType] = evalResult.value;
      }
    }

    return result;
  });

  /**
   * Available path primitives for motion animation.
   * Extracts path data from lines, polylines, and path primitives.
   */
  readonly availablePathPrimitives = computed(() => {
    const diagram = this._diagram();
    if (!diagram?.primitives) return [];

    return diagram.primitives
      .filter(p => p.type === 'path' || p.type === 'line' || p.type === 'polyline')
      .map(p => ({
        id: p.id,
        name: p.name || p.id,
        pathData: this.extractPathData(p)
      }))
      .filter(p => p.pathData); // Only include primitives with valid path data
  });

  /**
   * All elements in their actual z-order (no sorting by selection).
   * Selection is shown via the overlay layer, not by rendering order.
   */
  readonly orderedElements = computed(() => {
    return this._diagram().elements;
  });

  /**
   * IDs of children that belong to animated groups.
   * These are rendered inside the group's animation wrapper, not separately.
   */
  private readonly childrenOfAnimatedGroups = computed(() => {
    const primitives = this._diagram().primitives ?? [];
    const childIds = new Set<string>();
    for (const p of primitives) {
      if (p.type === 'group' && p.animations && p.animations.length > 0) {
        const groupConfig = (p as GroupPrimitive).config;
        for (const childId of groupConfig.childIds) {
          childIds.add(childId);
        }
      }
    }
    return childIds;
  });

  /**
   * All primitives in their actual z-order (no sorting by selection).
   * Selection is shown via the overlay layer, not by rendering order.
   * Excludes children of animated groups (they're rendered inside the group).
   * In diagram mode with simulation, applies property bindings to primitives.
   */
  readonly orderedPrimitives = computed(() => {
    let primitives = this._diagram().primitives ?? [];
    const excludeIds = this.childrenOfAnimatedGroups();

    if (excludeIds.size > 0) {
      primitives = primitives.filter(p => !excludeIds.has(p.id));
    }

    // Apply diagram-level bindings during simulation (diagram mode only)
    if (this.editorMode === 'diagram') {
      const simValues = this._diagramSimulationValues();
      const hasSimulation = Object.keys(simValues).length > 0;

      if (hasSimulation) {
        primitives = this.applyDiagramBindingsToPrimitives(primitives);
      }
    }

    return primitives;
  });

  /**
   * All symbol instances in their z-order.
   * Excludes symbols that are children of animated groups.
   */
  readonly orderedSymbols = computed(() => {
    const symbols = this._diagram().symbolInstances ?? [];
    const excludeIds = this.childrenOfAnimatedGroups();

    if (excludeIds.size > 0) {
      return symbols.filter(s => !excludeIds.has(s.id));
    }

    return symbols;
  });

  /**
   * Currently selected symbol instances.
   */
  readonly selectedSymbols = computed(() => {
    return this.selectionService.getSelectedSymbols(this._diagram());
  });

  /**
   * Cached symbol definitions for rendering (mapped by rtId).
   */
  private readonly _symbolDefinitions = signal<Map<string, SymbolDefinition>>(new Map());

  /**
   * Public accessor for symbol definitions map (used by binding editor dialog).
   */
  readonly symbolDefinitionsMap = this._symbolDefinitions.asReadonly();

  // Flag to skip emissions during input updates (prevents infinite loops)
  private _initialized = false;
  private _updatingFromInput = false;

  constructor() {
    // Effect to emit diagram changes to parent components
    // Only emit when changes are from user actions, not from input updates
    effect(() => {
      const diagram = this._diagram();
      if (this._initialized && !this._updatingFromInput) {
        this.diagramChange.emit(diagram);
      }
    });

    // Effect to update dockview panel titles with counts
    effect(() => {
      const animationsCount = this.firstSelectedPrimitiveAnimations().length;
      const transformCount = this.availableTransformProperties().length;

      if (this.dockviewApi) {
        // Update Animations panel title
        const animationsPanel = this.dockviewApi.getPanel('animations');
        if (animationsPanel) {
          const title = animationsCount > 0 ? `Animations (${animationsCount})` : 'Animations';
          animationsPanel.setTitle(title);
        }

        // Update Exposures panel title
        const transformPanel = this.dockviewApi.getPanel('transform');
        if (transformPanel) {
          const title = transformCount > 0 ? `Exposures (${transformCount})` : 'Exposures';
          transformPanel.setTitle(title);
        }
      }
    });
  }

  // Bound event handlers for document listeners
  private readonly boundOnDocumentMouseMove = this.onDocumentMouseMove.bind(this);
  private readonly boundOnDocumentMouseUp = this.onDocumentMouseUp.bind(this);

  ngOnInit(): void {
    // Initialize history with current diagram state
    this.historyService.initialize(this._diagram());
    // Mark as initialized after initial setup to start emitting diagram changes
    this._initialized = true;
    // Add document-level listeners for reliable drag/resize handling
    // Run outside Angular zone to prevent change detection on every mouse move
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.boundOnDocumentMouseMove);
      document.addEventListener('mouseup', this.boundOnDocumentMouseUp);
    });
  }

  ngAfterViewInit(): void {
    // Set SVG element in coordinate service for proper coordinate transformations
    this.updateSvgReference();

    // Set up ResizeObserver to track container dimensions for effective zoom calculation
    this.setupContainerResizeObserver();
  }

  /**
   * Sets up a ResizeObserver to track the canvas container dimensions.
   * This is needed to calculate the effective zoom for UI element scaling.
   */
  private setupContainerResizeObserver(): void {
    const container = this.canvasContainerRef?.nativeElement;
    if (!container) return;

    // Initial measurement
    this._containerDimensions.set({
      width: container.clientWidth || 1,
      height: container.clientHeight || 1
    });

    // Observe size changes
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this._containerDimensions.set({
          width: width || 1,
          height: height || 1
        });
      }
    });

    this.resizeObserver.observe(container);
  }

  /**
   * Update the SVG reference in the coordinate service.
   * Called after view init and when the canvas container changes.
   */
  private updateSvgReference(): void {
    const container = this.canvasContainerRef?.nativeElement;
    if (container) {
      const svg = container.querySelector('svg') as SVGSVGElement;
      this.coordinateService.setSvgElement(svg);
    }
  }

  ngOnDestroy(): void {
    // Remove document listeners
    document.removeEventListener('mousemove', this.boundOnDocumentMouseMove);
    document.removeEventListener('mouseup', this.boundOnDocumentMouseUp);

    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up dockview - wrap in try-catch as DOM nodes may already be removed
    if (this.dockviewApi) {
      try {
        this.dockviewApi.dispose();
      } catch (_e) {
        // Dockview may throw if DOM nodes are already removed during Angular cleanup
        // This is expected behavior and can be safely ignored
      }
      this.dockviewApi = null;
    }
  }

  /**
   * Dockview ready handler - called when dockview is initialized
   */
  onDockviewReady(event: DockviewReadyEvent): void {
    this.dockviewApi = event.api;
    this._dockviewReady.set(true);

    // Clear any potentially corrupted saved layout and create fresh default
    // TODO: Re-enable saved layout loading once layout issues are resolved
    this.layoutService.clearLayout('default', this.editorMode === 'symbol');
    this.createDefaultDockviewLayout(event.api);

    // Force layout recalculation after DOM settles
    setTimeout(() => {
      if (this.dockviewApi) {
        // Get container dimensions and force layout
        const container = document.querySelector('.dockview-panels-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          this.dockviewApi.layout(rect.width, rect.height);
        }
      }
    }, 0);

    // Listen for layout changes to persist them
    event.api.onDidLayoutChange(() => {
      if (this.dockviewApi) {
        const layout = this.dockviewApi.toJSON();
        this.layoutService.saveLayout(layout, 'default', this.editorMode === 'symbol');
      }
    });

    // Listen for panel removal to sync visibility state
    event.api.onDidRemovePanel((removedPanel) => {
      const panelId = removedPanel.id;
      if (this._panelVisibility()[panelId] !== undefined) {
        this._panelVisibility.update(v => ({ ...v, [panelId]: false }));
      }
    });

    // Listen for panel addition to sync visibility state
    event.api.onDidAddPanel((addedPanel) => {
      const panelId = addedPanel.id;
      if (this._panelVisibility()[panelId] !== undefined) {
        this._panelVisibility.update(v => ({ ...v, [panelId]: true }));
      }
    });
  }

  /**
   * Start resizing the dockview panel width
   */
  onDockviewResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this._isResizingDockview = true;
    this._resizeStartX = event.clientX;
    this._resizeStartWidth = this._dockviewPanelWidth();
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Create the default dockview panel layout
   * Layout: Two groups stacked vertically
   * - Upper group: Elements/Primitives + Symbols (as tabs)
   * - Lower group: Properties + Transform + Animations + Simulation (as tabs)
   */
  private createDefaultDockviewLayout(api: DockviewApi): void {
    // Upper group: Elements/Primitives + Symbols as tabs
    api.addPanel({
      id: 'elements',
      component: 'elements',
      title: this.editorMode === 'symbol' ? 'Primitives' : 'Elements',
      params: {
        onElementDragStart: (item: PaletteItem) => this.onPaletteDragStart(item),
        onElementDragEnd: (item: PaletteItem) => this.onPaletteDragEnd(item)
      }
    });

    // Symbols as tab next to Elements (same group)
    api.addPanel({
      id: 'symbols',
      component: 'symbols',
      title: 'Symbols',
      position: { referencePanel: 'elements' },
      params: {
        onSymbolDragStart: (item: SymbolPaletteItem) => this.onSymbolDragStart(item),
        onSymbolDragEnd: () => this.onSymbolDragEnd()
      }
    });

    // Lower group: Properties as first tab
    api.addPanel({
      id: 'properties',
      component: 'properties',
      title: 'Properties',
      position: { referencePanel: 'elements', direction: 'below' },
      params: {
        selectedElements: this.selectedElements,
        selectedConnections: this.selectedConnections,
        selectedPrimitives: this.selectedPrimitives,
        selectedSymbolInstances: this.selectedSymbols,
        symbolDefinitions: this.symbolDefinitionsMap,
        availableStyleClasses: this.styleClassesSignal,
        onPropertyChange: (event: unknown) => this.onPropertyChange(event as Parameters<typeof this.onPropertyChange>[0])
      }
    });

    // Exposures panel - available in both symbol and diagram modes
    // Exposures as tab in Properties group (same group, not below)
    api.addPanel({
      id: 'transform',
      component: 'transform',
      title: 'Exposures',
      position: { referencePanel: 'properties' },
      params: {
        transformProperties: this.availableTransformProperties,
        propertyBindings: this.effectivePropertyBindings,
        primitives: this.selectedPrimitives,
        symbolInstances: this.selectedSymbols,
        onPropertyChange: (event: TransformPropertyChangeEvent) => {
          this.handleTransformPropertyChange(event);
        },
        onOpenBindings: (property: TransformProperty) => {
          this.openBindingEditor(property);
        }
      }
    });

    // Animations as tab in Properties group
    api.addPanel({
      id: 'animations',
      component: 'animations',
      title: 'Animations',
      position: { referencePanel: 'properties' },
      params: {
        primitiveId: this.firstSelectedPrimitiveId,
        animations: this.firstSelectedPrimitiveAnimations,
        availableProperties: this.availableTransformProperties,
        availablePaths: this.availablePathPrimitives,
        supportsAnimations: this.firstSelectedPrimitiveSupportsAnimations,
        onAnimationsChange: (event: AnimationChangeEvent) => {
          this.onAnimationsChange(event);
        }
      }
    });

    // Simulation as tab in Properties group
    api.addPanel({
      id: 'simulation',
      component: 'simulation',
      title: 'Simulation',
      position: { referencePanel: 'properties' },
      params: {
        properties: this.availableTransformProperties,
        values: () => this.effectiveSimulationValues(),
        onValueChange: (event: SimulationValueChange) => {
          this.handleSimulationValueChange(event);
        },
        onResetValues: () => {
          this.handleSimulationReset();
        }
      }
    });

    if (this.editorMode === 'symbol') {

      // Settings panel as tab in Elements group (only in symbol mode)
      if (this.symbolSettings) {
        api.addPanel({
          id: 'settings',
          component: 'settings',
          title: 'Settings',
          position: { referencePanel: 'elements' },
          params: {
            settings: () => this.symbolSettings,
            onSettingsChange: (key: string, value: string | number) => {
              this.symbolSettingsChange.emit({ key, value });
            }
          }
        });
      }

      // Styles panel as tab in Elements group (only in symbol mode)
      api.addPanel({
        id: 'styles',
        component: 'styles',
        title: 'Styles',
        position: { referencePanel: 'elements' },
        params: {
          styleClasses: this.styleClassesSignal,
          onStyleClassesChange: (classes: StyleClass[]) => {
            this._styleClasses.set(classes);  // Update local signal
            this.styleClassesChange.emit(classes);
          },
          onApplyStyleToSelection: (styleClassId: string) => {
            this.applyStyleToSelection(styleClassId);
          }
        }
      });
    }

    // Set active panels: Elements/Primitives and Properties should be selected
    const elementsPanel = api.getPanel('elements');
    const propertiesPanel = api.getPanel('properties');
    if (elementsPanel) {
      elementsPanel.api.setActive();
    }
    if (propertiesPanel) {
      propertiesPanel.api.setActive();
    }
  }

  /**
   * Get the component map for dockview panel registration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dockview panels use structural typing at runtime
  readonly panelComponents: Record<string, Type<any>> = {
    elements: ElementsPanelComponent,
    symbols: SymbolsPanelComponent,
    properties: PropertiesPanelComponent,
    transform: TransformPanelComponent,
    animations: AnimationsPanelComponent,
    simulation: SimulationPanelWrapperComponent,
    settings: SettingsPanelComponent,
    styles: StylesPanelComponent
  };

  /**
   * Base panel configuration
   */
  private readonly basePanelConfig = [
    { id: 'elements', label: 'Elements', shortcut: 'Alt+1' },
    { id: 'symbols', label: 'Symbols', shortcut: 'Alt+2' },
    { id: 'properties', label: 'Properties', shortcut: 'Alt+3' },
    { id: 'transform', label: 'Exposures', shortcut: 'Alt+4' },
    { id: 'animations', label: 'Animations', shortcut: 'Alt+5' },
    { id: 'simulation', label: 'Simulation', shortcut: 'Alt+6' }
  ];

  /**
   * Panel configuration for View menu (includes Settings and Styles when in symbol mode)
   */
  get panelConfig() {
    const panels = [...this.basePanelConfig];
    if (this.symbolSettings) {
      panels.push({ id: 'settings', label: 'Settings', shortcut: 'Alt+7' });
      panels.push({ id: 'styles', label: 'Styles', shortcut: 'Alt+8' });
    }
    return panels;
  }

  /**
   * Toggle View menu visibility
   */
  toggleViewMenu(): void {
    this._viewMenuOpen.update(v => !v);
  }

  /**
   * Close View menu
   */
  closeViewMenu(): void {
    this._viewMenuOpen.set(false);
  }

  /**
   * Toggle panel visibility in dockview
   */
  togglePanelVisibility(panelId: string): void {
    if (!this.dockviewApi) return;

    const panel = this.dockviewApi.getPanel(panelId);
    if (panel) {
      panel.api.close();
      this._panelVisibility.update(v => ({ ...v, [panelId]: false }));
    } else {
      this.showPanel(panelId);
    }
  }

  /**
   * Show a panel that was previously hidden
   */
  private showPanel(panelId: string): void {
    if (!this.dockviewApi) return;

    // Panel configs for re-adding
    const panelConfigs: Record<string, { title: string; component: string; params?: object }> = {
      elements: {
        title: this.editorMode === 'symbol' ? 'Primitives' : 'Elements',
        component: 'elements',
        params: {
          onElementDragStart: (item: PaletteItem) => this.onPaletteDragStart(item),
          onElementDragEnd: (item: PaletteItem) => this.onPaletteDragEnd(item)
        }
      },
      symbols: {
        title: 'Symbols',
        component: 'symbols',
        params: {
          onSymbolDragStart: (item: SymbolPaletteItem) => this.onSymbolDragStart(item),
          onSymbolDragEnd: () => this.onSymbolDragEnd()
        }
      },
      properties: {
        title: 'Properties',
        component: 'properties',
        params: {
          selectedElements: this.selectedElements,
          selectedConnections: this.selectedConnections,
          selectedPrimitives: this.selectedPrimitives,
          selectedSymbolInstances: this.selectedSymbols,
          symbolDefinitions: this.symbolDefinitionsMap,
          availableStyleClasses: this.styleClassesSignal,
          onPropertyChange: (event: unknown) => this.onPropertyChange(event as Parameters<typeof this.onPropertyChange>[0])
        }
      },
      transform: {
        title: 'Exposures',
        component: 'transform',
        params: {
          transformProperties: this.availableTransformProperties,
          propertyBindings: this.effectivePropertyBindings,
          primitives: this.selectedPrimitives,
          symbolInstances: this.selectedSymbols,
          onPropertyChange: (event: TransformPropertyChangeEvent) => {
            this.handleTransformPropertyChange(event);
          },
          onOpenBindings: (property: TransformProperty) => {
            this.openBindingEditor(property);
          }
        }
      },
      animations: {
        title: 'Animations',
        component: 'animations',
        params: {
          primitiveId: this.firstSelectedPrimitiveId,
          animations: this.firstSelectedPrimitiveAnimations,
          availableProperties: this.availableTransformProperties,
          availablePaths: this.availablePathPrimitives,
          supportsAnimations: this.firstSelectedPrimitiveSupportsAnimations,
          onAnimationsChange: (event: AnimationChangeEvent) => {
            this.onAnimationsChange(event);
          }
        }
      },
      simulation: {
        title: 'Simulation',
        component: 'simulation',
        params: {
          properties: this.availableTransformProperties,
          values: () => this.effectiveSimulationValues(),
          onValueChange: (event: SimulationValueChange) => {
            this.handleSimulationValueChange(event);
          },
          onResetValues: () => {
            this.handleSimulationReset();
          }
        }
      },
      settings: {
        title: 'Settings',
        component: 'settings',
        params: {
          settings: () => this.symbolSettings,
          onSettingsChange: (key: string, value: string | number) => {
            this.symbolSettingsChange.emit({ key, value });
          }
        }
      },
      styles: {
        title: 'Styles',
        component: 'styles',
        params: {
          styleClasses: this.styleClassesSignal,
          onStyleClassesChange: (classes: StyleClass[]) => {
            this._styleClasses.set(classes);  // Update local signal
            this.styleClassesChange.emit(classes);
          },
          onApplyStyleToSelection: (styleClassId: string) => {
            this.applyStyleToSelection(styleClassId);
          }
        }
      }
    };

    const config = panelConfigs[panelId];
    if (config) {
      // Determine position based on panel type
      let referencePanel: string | undefined;
      if (panelId === 'transform' || panelId === 'animations' || panelId === 'simulation') {
        // These panels go in the properties group
        const propertiesPanel = this.dockviewApi.getPanel('properties');
        if (propertiesPanel) {
          referencePanel = 'properties';
        }
      } else if (panelId === 'symbols' || panelId === 'settings' || panelId === 'styles') {
        // Symbols, Settings and Styles go with elements
        const elementsPanel = this.dockviewApi.getPanel('elements');
        if (elementsPanel) {
          referencePanel = 'elements';
        }
      }

      const panelOptions: Parameters<typeof this.dockviewApi.addPanel>[0] = {
        id: panelId,
        component: config.component,
        title: config.title,
        params: config.params
      };
      if (referencePanel) {
        panelOptions.position = { referencePanel };
      }
      this.dockviewApi.addPanel(panelOptions);
      this._panelVisibility.update(v => ({ ...v, [panelId]: true }));
    }
  }

  /**
   * Check if a panel is visible
   */
  isPanelVisible(panelId: string): boolean {
    return this._panelVisibility()[panelId] ?? false;
  }

  /**
   * Reset dockview layout to default
   */
  resetDockviewLayout(): void {
    if (!this.dockviewApi) return;

    // Clear saved layout
    this.layoutService.clearLayout('default', this.editorMode === 'symbol');

    // Close all panels
    this.dockviewApi.panels.forEach(panel => {
      panel.api.close();
    });

    // Recreate default layout
    this.createDefaultDockviewLayout(this.dockviewApi);

    // Reset visibility state
    this._panelVisibility.set({
      elements: true,
      symbols: true,
      properties: true,
      transform: true,
      animations: true,
      simulation: true,
      settings: true,
      styles: true
    });
  }

  /**
   * Document-level mouse move handler for drag/resize operations.
   * This ensures events are captured even when mouse moves fast outside elements.
   */
  private onDocumentMouseMove(event: MouseEvent): void {
    // Handle dockview panel resize - run inside zone for change detection
    if (this._isResizingDockview) {
      const deltaX = event.clientX - this._resizeStartX;
      const newWidth = Math.min(600, Math.max(280, this._resizeStartWidth + deltaX));
      this.ngZone.run(() => {
        this._dockviewPanelWidth.set(newWidth);
      });
      return;
    }

    // Check if any operation is active - if not, return early without triggering change detection
    const panState = this._panState();
    const isPanning = !!(panState.isPanning && panState.startMousePosition && panState.startPanOffset);
    const isMarqueeActive = !!(this.selectionService.isSelectionRectActive() && this._marqueeStart);
    const isResizing = this.resizeService.isResizing();
    const lineEndpointDrag = this._lineEndpointDrag();
    const isLineEndpointDragging = !!(lineEndpointDrag.isDragging && lineEndpointDrag.lineId && lineEndpointDrag.endpoint);
    const polyPointDrag = this._polyPointDrag();
    const isPolyPointDragging = !!(polyPointDrag.isDragging && polyPointDrag.primitiveId !== null && polyPointDrag.pointIndex !== null);
    const isDragging = this.dragService.isDragging();

    // Early exit if no operation is active - prevents unnecessary change detection
    if (!isPanning && !isMarqueeActive && !isResizing && !isLineEndpointDragging && !isPolyPointDragging && !isDragging) {
      return;
    }

    // Run state updates inside Angular zone for proper change detection
    this.ngZone.run(() => {
      // Handle panning
      if (isPanning) {
        this.handlePanning(event, {
          startMousePosition: panState.startMousePosition!,
          startPanOffset: panState.startPanOffset!
        });
        return;
      }

      // Handle marquee selection
      if (isMarqueeActive) {
        const coords = this.getCanvasCoordinates(event);
        if (coords) {
          // Update selection rectangle
          const startX = this._marqueeStart!.x;
          const startY = this._marqueeStart!.y;
          const x = Math.min(startX, coords.x);
          const y = Math.min(startY, coords.y);
          const width = Math.abs(coords.x - startX);
          const height = Math.abs(coords.y - startY);
          // Directly set the rect with proper bounds
          this.selectionService.setSelectionRect({ x, y, width, height });
        }
        return;
      }

      // Handle resizing
      if (isResizing) {
        this.handleResize(event);
        return;
      }

      // Handle line endpoint dragging
      if (isLineEndpointDragging) {
        const coords = this.getCanvasCoordinates(event);
        if (!coords) return;
        const snappedPos = this.snapPosition(coords);
        this.updateLineEndpoint(lineEndpointDrag.lineId!, lineEndpointDrag.endpoint!, snappedPos);
        return;
      }

      // Handle polyline/polygon point dragging
      if (isPolyPointDragging) {
        const coords = this.getCanvasCoordinates(event);
        if (!coords) return;
        const snappedPos = this.snapPosition(coords);
        this.updatePolyPoint(polyPointDrag.primitiveId!, polyPointDrag.pointIndex!, snappedPos);
        return;
      }

      // Handle dragging - using DragService
      if (isDragging) {
      const coords = this.getCanvasCoordinates(event);
      if (!coords) return;

      // Use DragService to calculate new position (with grid snap)
      const result = this.dragService.calculateDragPosition(coords, true);
      if (!result) return;

      const dragState = this.dragService.state();
      const itemId = dragState.itemId!;
      const itemType = dragState.itemType;
      const delta = result.delta;
      const newPosition = { ...result.newPosition };

      // Calculate alignment guides and apply snap
      const diagram = this._diagram();
      const selectedIds = this.selectionService.selection().elements;
      const draggedBounds = this.getBoundsAtPosition(itemId, itemType!, newPosition, diagram);

      if (draggedBounds) {
        const otherBounds = this.boundsService.getNonSelectedBounds(
          selectedIds,
          diagram,
          (symbol) => this.getSymbolDefinition(symbol) ?? null
        );
        const canvas = diagram.canvas;
        const guideState = this.alignmentGuideService.calculateGuides(
          draggedBounds,
          otherBounds,
          { width: canvas.width, height: canvas.height }
        );

        // Apply alignment snap
        // When grid snap is enabled, only apply alignment if it's on a grid position
        const gridSize = this.stateService.gridSize();
        const isOnGrid = (val: number) => Math.abs(val - Math.round(val / gridSize) * gridSize) < 0.1;

        if (guideState.snapX !== null) {
          if (!this.stateService.snapToGrid() || isOnGrid(guideState.snapX)) {
            newPosition.x = guideState.snapX;
          }
        }
        if (guideState.snapY !== null) {
          if (!this.stateService.snapToGrid() || isOnGrid(guideState.snapY)) {
            newPosition.y = guideState.snapY;
          }
        }
      }

      // Handle different item types
      // Check if we should move all selected items or just the dragged one
      const selectedPrimitiveIds = new Set([...selectedIds].filter(id =>
        (diagram.primitives ?? []).some(p => p.id === id)
      ));
      const selectedSymbolIds = new Set([...selectedIds].filter(id =>
        (diagram.symbolInstances ?? []).some(s => s.id === id)
      ));
      const selectedElementIds = new Set([...selectedIds].filter(id =>
        diagram.elements.some(e => e.id === id)
      ));

      if (itemType === 'group') {
        this.moveGroup(itemId, newPosition, delta.x, delta.y);
      } else if (itemType === 'primitive') {
        // Calculate the delta from the dragged item's movement
        const draggedPrimitive = (diagram.primitives ?? []).find(p => p.id === itemId);
        if (!draggedPrimitive) return;

        const currentBounds = this.primitiveService.getBounds(draggedPrimitive);
        const moveDelta = {
          x: newPosition.x - currentBounds.x,
          y: newPosition.y - currentBounds.y
        };

        // Move all selected primitives by the same delta
        this.diagramService.updateDiagram(d => ({
          ...d,
          primitives: (d.primitives ?? []).map(p => {
            if (!selectedPrimitiveIds.has(p.id)) return p;
            return this.primitiveService.move(p, moveDelta);
          }),
          // Also move selected symbols by the same delta
          symbolInstances: (d.symbolInstances ?? []).map(s => {
            if (!selectedSymbolIds.has(s.id)) return s;
            return { ...s, position: { x: s.position.x + moveDelta.x, y: s.position.y + moveDelta.y } };
          })
        }));
      } else if (itemType === 'symbol') {
        // Calculate the delta from the dragged symbol's movement
        const draggedSymbol = (diagram.symbolInstances ?? []).find(s => s.id === itemId);
        if (!draggedSymbol) return;

        const moveDelta = {
          x: newPosition.x - draggedSymbol.position.x,
          y: newPosition.y - draggedSymbol.position.y
        };

        // Move all selected symbols and primitives by the same delta
        this.diagramService.updateDiagram(d => ({
          ...d,
          symbolInstances: (d.symbolInstances ?? []).map(s => {
            if (!selectedSymbolIds.has(s.id)) return s;
            return { ...s, position: { x: s.position.x + moveDelta.x, y: s.position.y + moveDelta.y } };
          }),
          primitives: (d.primitives ?? []).map(p => {
            if (!selectedPrimitiveIds.has(p.id)) return p;
            return this.primitiveService.move(p, moveDelta);
          })
        }));
      } else {
        // element type - move all selected elements
        const draggedElement = diagram.elements.find(e => e.id === itemId);
        if (!draggedElement) return;

        const moveDelta = {
          x: newPosition.x - draggedElement.position.x,
          y: newPosition.y - draggedElement.position.y
        };

        this.diagramService.updateDiagram(d => ({
          ...d,
          elements: d.elements.map(e => {
            if (!selectedElementIds.has(e.id)) return e;
            return { ...e, position: { x: e.position.x + moveDelta.x, y: e.position.y + moveDelta.y } };
          })
        }));
      }
      this.stateService.markChanged();
      }
    });
  }

  /**
   * Move a group and all its children by the given delta
   */
  private moveGroup(groupId: string, newGroupPosition: Position, _deltaX: number, _deltaY: number): void {
    this.diagramService.updateDiagram(d => {
      // Find the group
      const group = (d.primitives ?? []).find(p => p.id === groupId && isGroupPrimitive(p)) as GroupPrimitive | undefined;
      if (!group) return d;

      // Calculate the actual movement delta from current group position
      const moveDeltaX = newGroupPosition.x - group.position.x;
      const moveDeltaY = newGroupPosition.y - group.position.y;

      // If no movement, return unchanged
      if (moveDeltaX === 0 && moveDeltaY === 0) return d;

      const childIds = new Set(group.config.childIds);

      return {
        ...d,
        // Move group and child primitives
        primitives: (d.primitives ?? []).map(p => {
          if (p.id === groupId) {
            // Move the group itself
            return { ...p, position: newGroupPosition };
          }
          if (childIds.has(p.id)) {
            // Move child primitive by the delta using type-aware service
            return this.primitiveService.move(p, { x: moveDeltaX, y: moveDeltaY });
          }
          return p;
        }),
        // Move child symbol instances
        symbolInstances: (d.symbolInstances ?? []).map(s => {
          if (childIds.has(s.id)) {
            return {
              ...s,
              position: {
                x: s.position.x + moveDeltaX,
                y: s.position.y + moveDeltaY
              }
            };
          }
          return s;
        })
      };
    });
  }

  /**
   * Document-level mouse up handler to end drag/resize operations.
   * Runs inside Angular zone since listener is registered outside.
   */
  private onDocumentMouseUp(event: MouseEvent): void {
    // End dockview panel resize
    if (this._isResizingDockview) {
      this._isResizingDockview = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    // Check if any operation was active
    const isMarqueeActive = this.selectionService.isSelectionRectActive();
    const isResizing = this.resizeService.isResizing();
    const isLineEndpointDragging = this._lineEndpointDrag().isDragging;
    const isPolyPointDragging = this._polyPointDrag().isDragging;
    const isDragging = this.dragService.isDragging();

    // Early exit if nothing was active
    if (!isMarqueeActive && !isResizing && !isLineEndpointDragging && !isPolyPointDragging && !isDragging) {
      return;
    }

    // Run state updates inside Angular zone for proper change detection
    this.ngZone.run(() => {
      // End marquee selection
      if (isMarqueeActive) {
        const rect = this.selectionService.endSelectionRect();
        this._marqueeStart = null;

        // Select items within the rectangle if it has meaningful size
        if (rect && rect.width > 5 && rect.height > 5) {
          const itemsInRect = this.findItemsInRect(rect);
          if (itemsInRect.length > 0) {
            // If Shift is held, add to existing selection
            const addToSelection = event.shiftKey;
            this.selectionService.selectElements(itemsInRect, addToSelection);
          }
        }
        this._pendingSingleSelection = null;
        return;
      }

      // End resizing - using ResizeService
      if (isResizing) {
        this.resizeService.endResize();
        this.pushToHistory();
      }

      // End line endpoint dragging
      if (isLineEndpointDragging) {
        this._lineEndpointDrag.set({ isDragging: false, lineId: null, endpoint: null });
        this.pushToHistory();
      }

      // End polyline/polygon point dragging
      if (isPolyPointDragging) {
        this._polyPointDrag.set({ isDragging: false, primitiveId: null, pointIndex: null });
        this.pushToHistory();
      }

      // End dragging - using DragService
      if (isDragging) {
        // Check if this was a click (no significant movement) vs a drag
        const wasDrag = this.dragService.hasMovedBeyondThreshold(3);

        this.dragService.endDrag();

        // If there's a pending single selection and no drag occurred,
        // reduce the multi-selection to just the clicked item.
        // This implements standard design tool behavior: clicking an item in
        // a multi-selection (without modifier, without dragging) selects only that item.
        if (this._pendingSingleSelection && !wasDrag) {
          this.selectionService.clearSelection();
          this.selectionService.selectElement(this._pendingSingleSelection);
        }

        // Only push to history if actual movement occurred
        if (wasDrag) {
          this.pushToHistory();
          // Note: We intentionally do NOT clear _lastClickedPrimitiveId here.
          // User might drag slightly then press Cmd+C to copy just the clicked item.
          // _lastClickedPrimitiveId is cleared after use in copySelected() or when
          // clicking elsewhere (onSvgMouseDown).
        }
      }

      // Clear pending selection
      this._pendingSingleSelection = null;
    });
  }

  // ============================================================================
  // Toolbar Actions
  // ============================================================================

  save(): void {
    // Build diagram with diagram-level properties if in diagram mode
    const diagramToSave = this.buildDiagramForSave();
    this.saveRequest.emit(diagramToSave);
    this.stateService.clearChanges();
  }

  /**
   * Build the diagram for saving, including diagram-level properties.
   * In diagram mode, includes transformProperties, propertyBindings, and animations.
   */
  private buildDiagramForSave(): ProcessDiagramConfig {
    const baseDiagram = this._diagram();

    if (this.editorMode === 'diagram') {
      // Include diagram-level property state
      return {
        ...baseDiagram,
        transformProperties: this._diagramTransformProperties(),
        propertyBindings: this._diagramPropertyBindings(),
        animations: this._diagramAnimations()
      };
    }

    return baseDiagram;
  }

  /**
   * Save diagram under a new name (creates a copy)
   */
  async saveAs(): Promise<void> {
    const currentDiagram = this.buildDiagramForSave();

    const result = await this.saveAsDialogService.showSaveAsDialog({
      title: 'Save Process Diagram As',
      nameLabel: 'Name',
      placeholder: 'Enter diagram name',
      suggestedName: `${currentDiagram.name} (Copy)`,
      saveButtonText: 'Save',
      cancelButtonText: 'Cancel',
      minLength: 1,
      maxLength: 255
    });

    if (result.confirmed && result.name) {
      // Create a new diagram with new ID and name
      const newDiagram: ProcessDiagramConfig = {
        ...currentDiagram,
        id: this.creationService.generateId(),
        name: result.name
      };

      this.diagramService.setDiagram(newDiagram);
      this.saveRequest.emit(newDiagram);
      this.stateService.clearChanges();
      this.pushToHistory();
    }
  }

  /**
   * Rename the current diagram
   */
  async rename(): Promise<void> {
    const currentDiagram = this._diagram();

    const result = await this.saveAsDialogService.showSaveAsDialog({
      title: 'Rename Process Diagram',
      nameLabel: 'New Name',
      placeholder: 'Enter new name',
      suggestedName: currentDiagram.name,
      saveButtonText: 'Rename',
      cancelButtonText: 'Cancel',
      minLength: 1,
      maxLength: 255
    });

    if (result.confirmed && result.name && result.name !== currentDiagram.name) {
      this.diagramService.updateDiagram(d => ({
        ...d,
        name: result.name!
      }));
      // Save immediately after rename
      this.saveRequest.emit(this._diagram());
      this.stateService.clearChanges();
    }
  }

  undo(): void {
    const previousState = this.historyService.undo();
    if (previousState) {
      this.diagramService.setDiagram(previousState);
      this.stateService.markChanged();
    }
  }

  redo(): void {
    const nextState = this.historyService.redo();
    if (nextState) {
      this.diagramService.setDiagram(nextState);
      this.stateService.markChanged();
    }
  }

  canUndo(): boolean {
    return this.historyService.canUndo();
  }

  canRedo(): boolean {
    return this.historyService.canRedo();
  }

  setMode(mode: DesignerMode): void {
    this.stateService.setMode(mode);
  }

  zoomIn(): void {
    this.stateService.zoomIn();
  }

  zoomOut(): void {
    this.stateService.zoomOut();
  }

  fitToView(): void {
    const container = this.canvasContainerRef?.nativeElement;
    if (!container) {
      this.stateService.resetZoom();
      return;
    }

    const canvas = this.canvasConfig();
    const containerPadding = 40; // Account for container padding

    // Calculate available space in container
    const availableWidth = container.clientWidth - containerPadding;
    const availableHeight = container.clientHeight - containerPadding;

    // Calculate zoom to fit entire canvas in viewport
    const zoomX = availableWidth / canvas.width;
    const zoomY = availableHeight / canvas.height;
    const zoom = Math.min(zoomX, zoomY, 2); // Cap at 2x zoom

    this.stateService.setZoom(zoom);

    // After zoom is applied, scroll to center the canvas
    // Use setTimeout to ensure the DOM has updated with new zoom
    setTimeout(() => {
      const scaledWidth = canvas.width * zoom;
      const scaledHeight = canvas.height * zoom;

      // Center the canvas in the container
      const scrollLeft = Math.max(0, (scaledWidth - container.clientWidth) / 2 + containerPadding / 2);
      const scrollTop = Math.max(0, (scaledHeight - container.clientHeight) / 2 + containerPadding / 2);

      container.scrollLeft = scrollLeft;
      container.scrollTop = scrollTop;
    }, 0);
  }

  /**
   * Resize the canvas to maximize the available container space.
   * This updates the diagram's canvas width and height to fill the container.
   */
  resizeCanvasToFit(): void {
    const container = this.canvasContainerRef?.nativeElement;
    if (!container) {
      return;
    }

    // Get full container dimensions (padding is outside the canvas via CSS box-sizing)
    // Subtract the padding that's applied to the container (20px on each side)
    const containerPadding = 40;
    const newWidth = Math.max(container.clientWidth - containerPadding, 200);
    const newHeight = Math.max(container.clientHeight - containerPadding, 200);

    // Update canvas config to fill the available space
    this.diagramService.updateDiagram(d => ({
      ...d,
      canvas: {
        ...d.canvas,
        width: newWidth,
        height: newHeight
      }
    }));

    // Reset zoom after resize
    this.stateService.resetZoom();

    // Reset scroll position to show canvas from top-left
    setTimeout(() => {
      container.scrollLeft = 0;
      container.scrollTop = 0;
    }, 0);
  }

  /**
   * Get the bounding box of all content (primitives, elements, symbols)
   */
  private getContentBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    return this.boundsService.getContentBounds(
      this._diagram(),
      (symbol) => this.getSymbolDefinition(symbol) ?? null
    );
  }

  toggleGrid(): void {
    this.stateService.toggleGrid();
  }

  toggleSnapToGrid(): void {
    this.stateService.toggleSnapToGrid();
  }

  toggleElementNames(): void {
    this.stateService.toggleElementNames();
  }

  toggleLeftPanel(): void {
    this._showLeftPanel.update(v => !v);
  }

  toggleRightPanel(): void {
    this._showRightPanel.update(v => !v);
  }

  deleteSelected(): void {
    // First check if a polyline point is selected - delete that instead
    const selectedPolyPoint = this._selectedPolyPoint();
    if (selectedPolyPoint) {
      this.deleteSelectedPolyPoint();
      return;
    }

    const sel = this.selectionService.selection();
    if (sel.elements.size === 0 && sel.connections.size === 0) return;

    const result = this.deletionService.deleteItems(
      this._diagram(),
      sel.elements,
      sel.connections
    );

    this.diagramService.updateDiagram(d => ({
      ...d,
      elements: result.elements,
      primitives: result.primitives,
      symbolInstances: result.symbolInstances,
      connections: result.connections
    }));

    this.clearSelection();
    this.pushToHistory();
    this.stateService.markChanged();
  }

  hasSelection(): boolean {
    return this.selectionService.hasSelection();
  }

  // ============================================================================
  // Grouping
  // ============================================================================

  /**
   * Check if selected items can be grouped (need at least 2 items)
   */
  canGroup(): boolean {
    const sel = this.selectionService.selection();
    return this.groupingService.canGroup(sel.elements);
  }

  /**
   * Check if selection contains groups that can be ungrouped
   */
  canUngroup(): boolean {
    const sel = this.selectionService.selection();
    return this.groupingService.canUngroup(this._diagram(), sel.elements);
  }

  /**
   * Group selected items into a new group
   */
  groupSelected(): void {
    if (!this.canGroup()) return;

    const sel = this.selectionService.selection();
    const symbolBoundsProvider = {
      getSymbolBounds: (symbol: SymbolInstance) => this.getSymbolBounds(symbol)
    };

    const result = this.groupingService.groupItems(
      this._diagram(),
      sel.elements,
      () => this.creationService.generateId(),
      symbolBoundsProvider
    );

    if (!result) return;

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: result.primitives
    }));

    // Select the new group
    this.selectionService.clearSelection();
    this.selectionService.selectElement(result.groupId);

    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Ungroup selected groups
   */
  ungroupSelected(): void {
    if (!this.canUngroup()) return;

    const sel = this.selectionService.selection();
    const result = this.groupingService.ungroupItems(this._diagram(), sel.elements);

    if (!result) return;

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: result.primitives
    }));

    // Select the former children
    this.selectionService.clearSelection();
    this.selectionService.selectElements(result.freedChildIds);

    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Get bounding box for a symbol instance
   */
  private getSymbolBounds(symbol: SymbolInstance): { x: number; y: number; width: number; height: number } {
    const symbolDef = this.symbolLibraryService.getCachedSymbol(symbol.symbolRtId);
    const scale = symbol.scale ?? 1;

    if (symbolDef) {
      return {
        x: symbol.position.x,
        y: symbol.position.y,
        width: symbolDef.bounds.width * scale,
        height: symbolDef.bounds.height * scale
      };
    }

    return { x: symbol.position.x, y: symbol.position.y, width: 100, height: 100 };
  }

  // ============================================================================
  // Copy/Paste
  // ============================================================================

  /**
   * Copy selected elements and primitives to clipboard
   */
  copySelected(): void {
    const diagram = this._diagram();
    const sel = this.selectionService.selection();

    // DEBUG: Log copy state
    console.log('[ProcessDesigner.copySelected] Called with:', {
      lastClickedPrimitiveId: this._lastClickedPrimitiveId,
      pendingSingleSelection: this._pendingSingleSelection,
      selectionSize: sel.elements.size,
      selectionIds: Array.from(sel.elements),
      primitivesCount: (diagram.primitives ?? []).length
    });

    // If there's a last clicked primitive ID, copy just that primitive.
    // This handles the case where user clicks on a primitive (even if in a group or multi-selection)
    // and wants to copy just that specific item.
    if (this._lastClickedPrimitiveId) {
      const clickedPrimitive = (diagram.primitives ?? []).find(p => p.id === this._lastClickedPrimitiveId);
      console.log('[ProcessDesigner.copySelected] Using _lastClickedPrimitiveId:', {
        id: this._lastClickedPrimitiveId,
        found: !!clickedPrimitive,
        primitiveName: clickedPrimitive?.name
      });

      if (clickedPrimitive) {
        // Clear pending selection since we're handling the copy directly
        this._pendingSingleSelection = null;

        // Update selection to just the clicked primitive
        this.selectionService.clearSelection();
        this.selectionService.selectElement(this._lastClickedPrimitiveId);

        // Copy just the clicked primitive
        const centerPosition = this.calculateSelectionCenter([], [clickedPrimitive]);
        this.clipboardService.copy({
          elements: [],
          primitives: [clickedPrimitive],
          symbolInstances: [],
          connections: [],
          centerPosition
        });

        console.log('[ProcessDesigner.copySelected] Copied single primitive:', clickedPrimitive.name);
        this._lastClickedPrimitiveId = null;
        return;
      }
    }

    // If there's a pending single selection (user clicked on item in multi-selection
    // but hasn't released mouse yet), apply it now before copying.
    // This ensures copy always uses the intended selection, not stale multi-selection.
    if (this._pendingSingleSelection) {
      console.log('[ProcessDesigner.copySelected] Applying pending single selection:', this._pendingSingleSelection);
      this.selectionService.clearSelection();
      this.selectionService.selectElement(this._pendingSingleSelection);
      this._pendingSingleSelection = null;
    }

    const updatedSel = this.selectionService.selection();
    if (updatedSel.elements.size === 0 && updatedSel.connections.size === 0) {
      console.log('[ProcessDesigner.copySelected] No selection, returning');
      return;
    }

    // Expand selection to include children of any selected groups
    const expandedIds = this.selectionService.expandSelectionWithGroupChildren(diagram);
    console.log('[ProcessDesigner.copySelected] Expanded selection:', {
      originalSize: updatedSel.elements.size,
      expandedSize: expandedIds.size,
      expandedIds: Array.from(expandedIds)
    });

    // Get selected elements, primitives, and symbol instances
    const selectedElements = diagram.elements.filter(e => expandedIds.has(e.id));
    const selectedPrimitives = (diagram.primitives ?? []).filter(p => expandedIds.has(p.id));
    const selectedSymbolInstances = (diagram.symbolInstances ?? []).filter(s => expandedIds.has(s.id));

    // Get connections that connect selected elements
    const selectedElementIds = new Set([
      ...selectedElements.map(e => e.id),
      ...selectedPrimitives.map(p => p.id),
      ...selectedSymbolInstances.map(s => s.id)
    ]);
    const selectedConnections = diagram.connections.filter(c =>
      sel.connections.has(c.id) ||
      (selectedElementIds.has(c.from.elementId) && selectedElementIds.has(c.to.elementId))
    );

    // Calculate center position of selection for paste offset
    const centerPosition = this.calculateSelectionCenter(selectedElements, selectedPrimitives);

    this.clipboardService.copy({
      elements: selectedElements,
      primitives: selectedPrimitives,
      symbolInstances: selectedSymbolInstances,
      connections: selectedConnections,
      centerPosition
    });
  }

  /**
   * Paste clipboard contents at optional position
   */
  paste(position?: Position): void {
    const result = this.clipboardService.paste(() => this.creationService.generateId(), position);
    if (!result) return;

    // Add to diagram
    this.diagramService.updateDiagram(d => ({
      ...d,
      elements: [...d.elements, ...result.elements],
      primitives: [...(d.primitives ?? []), ...result.primitives],
      symbolInstances: [...(d.symbolInstances ?? []), ...result.symbolInstances],
      connections: [...d.connections, ...result.connections]
    }));

    // Select only top-level pasted items (exclude children of groups)
    // This ensures that when a group is pasted, only the group is selected, not its children
    const groupChildIds = new Set<string>();
    for (const p of result.primitives) {
      if (p.type === 'group') {
        const groupConfig = (p as unknown as { config: { childIds: string[] } }).config;
        groupConfig.childIds.forEach(id => groupChildIds.add(id));
      }
    }
    const topLevelPrimitiveIds = result.primitives
      .filter(p => !groupChildIds.has(p.id))
      .map(p => p.id);

    this.selectionService.clearSelection();
    this.selectionService.selectElements([
      ...result.elements.map(e => e.id),
      ...topLevelPrimitiveIds,
      ...result.symbolInstances.map(s => s.id)
    ]);
    this.selectionService.selectConnections(result.connections.map(c => c.id), true);

    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Check if clipboard has content
   */
  hasClipboardContent(): boolean {
    return this.clipboardService.hasContent();
  }

  /**
   * Handle paste - checks clipboard for SVG content first, then falls back to regular paste
   */
  private async handlePaste(): Promise<void> {
    try {
      // Try to read text from system clipboard
      const text = await navigator.clipboard.readText();

      // Check if content looks like SVG
      if (text && this.isSvgContent(text)) {
        const centerPosition = this.getVisibleCanvasCenter();
        this.importSvgContent(text, centerPosition);
        return;
      }
    } catch {
      // Clipboard access failed or not available - fall through to regular paste
    }

    // Fall back to regular paste (uses internal clipboard service)
    this.paste();
  }

  /**
   * Check if text content is SVG
   */
  private isSvgContent(text: string): boolean {
    const trimmed = text.trim();
    // Check for SVG tag (with or without XML declaration)
    return trimmed.startsWith('<svg') ||
           (trimmed.startsWith('<?xml') && trimmed.includes('<svg'));
  }

  /**
   * Calculate center position of selected items
   */
  private calculateSelectionCenter(elements: ProcessElement[], primitives: PrimitiveBase[]): Position {
    const positions: Position[] = [];

    for (const element of elements) {
      positions.push({
        x: element.position.x + element.size.width / 2,
        y: element.position.y + element.size.height / 2
      });
    }

    for (const primitive of primitives) {
      const bbox = this.getPrimitiveBoundingBox(primitive);
      positions.push({
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2
      });
    }

    if (positions.length === 0) {
      return { x: 0, y: 0 };
    }

    const sumX = positions.reduce((sum, p) => sum + p.x, 0);
    const sumY = positions.reduce((sum, p) => sum + p.y, 0);

    return {
      x: sumX / positions.length,
      y: sumY / positions.length
    };
  }

  // ============================================================================
  // Selection (delegated to DesignerSelectionService)
  // ============================================================================

  isElementSelected(elementId: string): boolean {
    return this.selectionService.isElementSelected(elementId);
  }

  isConnectionSelected(connectionId: string): boolean {
    return this.selectionService.isConnectionSelected(connectionId);
  }

  selectElement(elementId: string, addToSelection = false): void {
    this.selectionService.selectElement(elementId, addToSelection);
  }

  selectConnection(connectionId: string, addToSelection = false): void {
    this.selectionService.selectConnection(connectionId, addToSelection);
  }

  clearSelection(): void {
    this.selectionService.clearSelection();
    // Also clear any selected polyline point
    this._selectedPolyPoint.set(null);
    // Note: We intentionally do NOT clear _lastClickedPrimitiveId here.
    // It should only be cleared after copy or after drag, not when clicking elsewhere.
  }

  // ============================================================================
  // Canvas Event Handlers
  // ============================================================================

  onCanvasMouseDown(event: MouseEvent): void {
    // Start panning if in pan mode
    if (this.stateService.mode() === 'pan') {
      this.startPanning(event);
      return;
    }

    if (event.target === this.canvasContainerRef?.nativeElement) {
      this.clearSelection();
    }
  }

  /**
   * Handle mousedown on SVG canvas to start marquee selection or clear selection.
   */
  onSvgMouseDown(event: MouseEvent): void {
    // Start panning if in pan mode
    if (this.stateService.mode() === 'pan') {
      this.startPanning(event);
      return;
    }

    // Only handle clicks on the canvas click layer (empty area)
    const target = event.target as SVGElement;
    if (target.classList.contains('canvas-click-layer')) {
      // Clear last clicked primitive since user clicked on empty canvas
      this._lastClickedPrimitiveId = null;

      // Get canvas coordinates for marquee start
      const coords = this.getCanvasCoordinates(event);
      if (!coords) {
        this.clearSelection();
        return;
      }

      // If Shift is held, don't clear existing selection
      if (!event.shiftKey) {
        this.clearSelection();
      }

      // Start marquee selection
      this.selectionService.startSelectionRect(coords.x, coords.y);
      // Store the start position for proper rectangle calculation
      this._marqueeStart = { x: coords.x, y: coords.y };
    }
  }

  // Store marquee start position (needed for proper rect calculation)
  private _marqueeStart: Position | null = null;

  // Pending single selection: stores the ID that should become the sole selection
  // if the user clicks on an already-selected item without dragging.
  // This enables the standard design tool behavior where clicking an item in a
  // multi-selection (without modifier) reduces selection to just that item.
  private _pendingSingleSelection: string | null = null;

  // Tracks the actual primitive ID that was last clicked (not the group ID).
  // Used by copySelected to copy just the clicked primitive, even if it's in a group.
  private _lastClickedPrimitiveId: string | null = null;

  /**
   * Start panning the canvas - stores container scroll position for Figma-style pan
   */
  private startPanning(event: MouseEvent): void {
    event.preventDefault();
    const container = this.canvasContainerRef?.nativeElement;
    this._panState.set({
      isPanning: true,
      startMousePosition: { x: event.clientX, y: event.clientY },
      // Store container scroll position (not pan offset)
      startPanOffset: {
        x: container?.scrollLeft ?? 0,
        y: container?.scrollTop ?? 0
      }
    });
  }

  /**
   * Handle panning movement - scrolls the container (Figma-style)
   */
  private handlePanning(
    event: MouseEvent,
    panState: { startMousePosition: Position; startPanOffset: Position }
  ): void {
    // Calculate delta in screen pixels
    const deltaX = event.clientX - panState.startMousePosition.x;
    const deltaY = event.clientY - panState.startMousePosition.y;

    // Scroll the container in the opposite direction of the drag
    const container = this.canvasContainerRef?.nativeElement;
    if (container) {
      container.scrollLeft = panState.startPanOffset.x - deltaX;
      container.scrollTop = panState.startPanOffset.y - deltaY;
    }
  }

  /**
   * End panning
   */
  private endPanning(): void {
    this._panState.set({
      isPanning: false,
      startMousePosition: null,
      startPanOffset: null
    });
  }

  /**
   * Find all items (primitives, symbols, elements) that intersect with a rectangle.
   * Returns array of item IDs.
   */
  private findItemsInRect(rect: { x: number; y: number; width: number; height: number }): string[] {
    const diagram = this._diagram();
    const symbolDefinitions = this._symbolDefinitions();
    const itemIds: string[] = [];

    // Check primitives (excluding children of animated groups since they're handled by parent)
    const primitives = this.orderedPrimitives();
    for (const primitive of primitives) {
      const bbox = this.getPrimitiveBoundingBox(primitive);
      if (this.rectIntersects(rect, bbox)) {
        // If this primitive is in a group, select the group instead
        const effectiveId = this.selectionService.getEffectiveSelectionId(primitive.id, diagram);
        if (!itemIds.includes(effectiveId)) {
          itemIds.push(effectiveId);
        }
      }
    }

    // Check symbol instances (excluding children of animated groups)
    const symbols = this.orderedSymbols();
    for (const symbol of symbols) {
      const symbolDef = symbolDefinitions.get(symbol.symbolRtId);
      if (symbolDef) {
        const bounds = this.getSymbolBounds(symbol);
        if (this.rectIntersects(rect, bounds)) {
          // If this symbol is in a group, select the group instead
          const effectiveId = this.selectionService.getEffectiveSelectionId(symbol.id, diagram);
          if (!itemIds.includes(effectiveId)) {
            itemIds.push(effectiveId);
          }
        }
      }
    }

    // Check elements (only in diagram mode)
    if (this.editorMode === 'diagram') {
      for (const element of diagram.elements) {
        const bbox = {
          x: element.position.x,
          y: element.position.y,
          width: element.size.width,
          height: element.size.height
        };
        if (this.rectIntersects(rect, bbox)) {
          itemIds.push(element.id);
        }
      }
    }

    return itemIds;
  }

  /**
   * Check if two rectangles intersect (overlap).
   */
  private rectIntersects(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  onCanvasMouseMove(_event: MouseEvent): void {
    // Note: All drag and resize handling is done in onDocumentMouseMove
    // for more reliable event capture (works even when mouse leaves canvas)
  }

  onCanvasMouseUp(_event: MouseEvent): void {
    // End panning
    if (this._panState().isPanning) {
      this.endPanning();
    }

    // End resizing - using ResizeService
    if (this.resizeService.isResizing()) {
      this.resizeService.endResize();
      this.pushToHistory();
    }

    // End dragging - using DragService
    if (this.dragService.isDragging()) {
      this.dragService.endDrag();
      this.alignmentGuideService.clearGuides();
      this.pushToHistory();
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();

    // Handle style class drops (apply to selected primitives)
    const styleClassId = event.dataTransfer?.getData('application/x-style-class');
    if (styleClassId) {
      this.applyStyleToSelection(styleClassId);
      return;
    }

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    const position = this.snapPosition(coords);

    // Handle file drops (SVG files)
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.includes('svg') || file.name.endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = () => {
          this.importSvgContent(reader.result as string, position);
        };
        reader.readAsText(file);
        return;
      }
    }

    // Try to read as JSON first (new primitive/symbol format)
    const jsonData = event.dataTransfer?.getData('application/json');
    if (jsonData) {
      try {
        const paletteData = JSON.parse(jsonData);

        // Handle primitive drop
        if (paletteData.type === 'primitive' && paletteData.primitiveType) {
          this.addPrimitive(paletteData.primitiveType as PrimitiveTypeValue, position);
          return;
        }

        // Handle symbol drop
        if (paletteData.type === 'symbol' && paletteData.libraryRtId && paletteData.symbolRtId) {
          void this.handleSymbolDrop(paletteData.libraryRtId, paletteData.symbolRtId, position);
          return;
        }
      } catch {
        // Invalid JSON, continue to legacy format
      }
    }

    // Legacy element type (for backward compatibility with text/plain)
    const textData = event.dataTransfer?.getData('text/plain');
    if (textData) {
      const elementType = textData as ProcessElementType;
      this.addElement(elementType, position);
    }
  }

  /**
   * Handle dropping a symbol onto the canvas
   */
  private async handleSymbolDrop(libraryRtId: string, symbolRtId: string, position: Position): Promise<void> {
    try {
      // Always load the latest symbol definition from the service (useCache = false)
      // This ensures we get the most recent version after any edits
      const symbolDef = await this.symbolLibraryService.loadSymbol(symbolRtId, false);

      // Update the local cache with the fresh definition
      const newCache = new Map(this._symbolDefinitions());
      newCache.set(symbolRtId, symbolDef);

      // Also load any nested symbol definitions recursively
      await this.loadNestedSymbolDefinitions(symbolDef, newCache);

      this._symbolDefinitions.set(newCache);

      // Add the symbol instance
      this.addSymbolInstance(libraryRtId, symbolRtId, position, {
        name: symbolDef.name
      });
    } catch (error) {
      console.error('Failed to add symbol instance:', error);
    }
  }

  /**
   * Recursively load nested symbol definitions
   */
  private async loadNestedSymbolDefinitions(
    symbolDef: SymbolDefinition,
    cache: Map<string, SymbolDefinition>
  ): Promise<void> {
    if (!symbolDef.symbolInstances || symbolDef.symbolInstances.length === 0) {
      return;
    }

    for (const nestedInst of symbolDef.symbolInstances) {
      // Skip if already cached
      if (cache.has(nestedInst.symbolRtId)) {
        continue;
      }

      try {
        const nestedDef = await this.symbolLibraryService.loadSymbol(nestedInst.symbolRtId, false);
        cache.set(nestedInst.symbolRtId, nestedDef);

        // Recursively load nested symbols
        await this.loadNestedSymbolDefinitions(nestedDef, cache);
      } catch (error) {
        console.error(`Failed to load nested symbol ${nestedInst.symbolRtId}:`, error);
      }
    }
  }

  // ============================================================================
  // Element Event Handlers
  // ============================================================================

  onElementMouseDown(event: MouseEvent, element: ProcessElement): void {
    event.stopPropagation();

    // In pan mode, start panning instead of selecting/dragging
    if (this.stateService.mode() === 'pan') {
      this.startPanning(event);
      return;
    }

    if (this.stateService.mode() === 'select') {
      const addToSelection = event.ctrlKey || event.metaKey || event.shiftKey;

      // Handle selection based on current state and modifier keys
      const alreadySelected = this.isElementSelected(element.id);
      const hasMultiSelection = this.selectionService.selection().elements.size > 1;

      // Clear any previous pending selection
      this._pendingSingleSelection = null;

      if (!alreadySelected) {
        // Item not selected - select it (replacing current selection unless modifier held)
        this.selectElement(element.id, addToSelection);
      } else if (addToSelection) {
        // Item already selected with modifier - toggle it off
        this.selectionService.deselectElement(element.id);
      } else if (hasMultiSelection) {
        // Item is part of a multi-selection, clicked without modifier.
        // Don't change selection yet (preserve multi-selection for potential drag).
        // Instead, mark this as pending - if no drag occurs, reduce to single selection.
        this._pendingSingleSelection = element.id;
      }
      // else: Item is the only selected item - no change needed

      // Start drag using DragService
      const coords = this.getCanvasCoordinates(event);
      if (coords) {
        this.dragService.startDrag(element.id, 'element', element.position, coords);
      }
    }
  }

  onConnectionClick(event: MouseEvent, connection: ProcessConnection): void {
    event.stopPropagation();
    const addToSelection = event.ctrlKey || event.metaKey || event.shiftKey;
    this.selectConnection(connection.id, addToSelection);
  }

  // ============================================================================
  // Resize Handlers
  // ============================================================================

  onResizeHandleMouseDown(event: MouseEvent, element: ProcessElement, handle: ResizeHandle): void {
    event.stopPropagation();
    event.preventDefault();

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    // Use ResizeService to start element resize
    this.resizeService.startElementResize(
      element.id,
      'element',
      handle,
      element.size,
      element.position,
      coords
    );
  }

  private handleResize(event: MouseEvent): void {
    const resizeState = this.resizeState();

    // Handle primitive resize
    if (resizeState.isPrimitive && resizeState.startBounds) {
      this.handlePrimitiveResize(event, resizeState);
      return;
    }

    // Handle element resize
    if (!resizeState.isResizing || !resizeState.elementId || !resizeState.startSize ||
        !resizeState.startPosition || !resizeState.startMousePosition || !resizeState.handle) {
      return;
    }

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    const deltaX = coords.x - resizeState.startMousePosition.x;
    const deltaY = coords.y - resizeState.startMousePosition.y;

    let newWidth = resizeState.startSize.width;
    let newHeight = resizeState.startSize.height;
    let newX = resizeState.startPosition.x;
    let newY = resizeState.startPosition.y;

    const minSize = 20;

    switch (resizeState.handle) {
      case 'se':
        newWidth = Math.max(minSize, resizeState.startSize.width + deltaX);
        newHeight = Math.max(minSize, resizeState.startSize.height + deltaY);
        break;
      case 'sw':
        newWidth = Math.max(minSize, resizeState.startSize.width - deltaX);
        newHeight = Math.max(minSize, resizeState.startSize.height + deltaY);
        newX = resizeState.startPosition.x + resizeState.startSize.width - newWidth;
        break;
      case 'ne':
        newWidth = Math.max(minSize, resizeState.startSize.width + deltaX);
        newHeight = Math.max(minSize, resizeState.startSize.height - deltaY);
        newY = resizeState.startPosition.y + resizeState.startSize.height - newHeight;
        break;
      case 'nw':
        newWidth = Math.max(minSize, resizeState.startSize.width - deltaX);
        newHeight = Math.max(minSize, resizeState.startSize.height - deltaY);
        newX = resizeState.startPosition.x + resizeState.startSize.width - newWidth;
        newY = resizeState.startPosition.y + resizeState.startSize.height - newHeight;
        break;
    }

    // Snap to grid if enabled
    if (this.stateService.snapToGrid()) {
      const grid = this.stateService.gridSize();
      newWidth = Math.round(newWidth / grid) * grid;
      newHeight = Math.round(newHeight / grid) * grid;
      newX = Math.round(newX / grid) * grid;
      newY = Math.round(newY / grid) * grid;
    }

    // Check if this is a symbol instance
    const isSymbol = (this._diagram().symbolInstances ?? []).some(s => s.id === resizeState.elementId);

    if (isSymbol) {
      // Handle symbol resize by updating scale
      this.handleSymbolResize(resizeState.elementId, newWidth, newHeight, newX, newY);
    } else {
      // Handle element resize
      this.diagramService.updateDiagram(d => ({
        ...d,
        elements: d.elements.map(e => {
          if (e.id === resizeState.elementId) {
            return {
              ...e,
              size: { width: newWidth, height: newHeight },
              position: { x: newX, y: newY }
            };
          }
          return e;
        })
      }));
    }
    this.stateService.markChanged();
  }

  /**
   * Handle resize for symbol instances by updating their scale
   */
  private handleSymbolResize(symbolId: string, newWidth: number, newHeight: number, newX: number, newY: number): void {
    const symbol = (this._diagram().symbolInstances ?? []).find(s => s.id === symbolId);
    if (!symbol) return;

    const symbolDef = this.getSymbolDefinition(symbol);
    if (!symbolDef) return;

    // Calculate new scale based on the new size
    // Use the larger scale factor to maintain aspect ratio
    const scaleX = newWidth / symbolDef.bounds.width;
    const scaleY = newHeight / symbolDef.bounds.height;
    const newScale = Math.max(0.1, Math.min(scaleX, scaleY)); // Clamp scale

    this.diagramService.updateDiagram(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).map(s => {
        if (s.id === symbolId) {
          return {
            ...s,
            scale: newScale,
            position: { x: newX, y: newY }
          };
        }
        return s;
      })
    }));
  }

  /**
   * Handle resize for primitives
   */
  private handlePrimitiveResize(event: MouseEvent, resizeState: ResizeState): void {
    if (!resizeState.elementId || !resizeState.startBounds || !resizeState.handle) {
      return;
    }

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    const startBounds = resizeState.startBounds;
    let newX = startBounds.x;
    let newY = startBounds.y;
    let newWidth = startBounds.width;
    let newHeight = startBounds.height;

    const minSize = 10;

    switch (resizeState.handle) {
      case 'se':
        newWidth = Math.max(minSize, coords.x - startBounds.x);
        newHeight = Math.max(minSize, coords.y - startBounds.y);
        break;
      case 'sw':
        newWidth = Math.max(minSize, startBounds.x + startBounds.width - coords.x);
        newHeight = Math.max(minSize, coords.y - startBounds.y);
        newX = startBounds.x + startBounds.width - newWidth;
        break;
      case 'ne':
        newWidth = Math.max(minSize, coords.x - startBounds.x);
        newHeight = Math.max(minSize, startBounds.y + startBounds.height - coords.y);
        newY = startBounds.y + startBounds.height - newHeight;
        break;
      case 'nw':
        newWidth = Math.max(minSize, startBounds.x + startBounds.width - coords.x);
        newHeight = Math.max(minSize, startBounds.y + startBounds.height - coords.y);
        newX = startBounds.x + startBounds.width - newWidth;
        newY = startBounds.y + startBounds.height - newHeight;
        break;
    }

    // Snap to grid if enabled
    if (this.stateService.snapToGrid()) {
      const grid = this.stateService.gridSize();
      newWidth = Math.round(newWidth / grid) * grid;
      newHeight = Math.round(newHeight / grid) * grid;
      newX = Math.round(newX / grid) * grid;
      newY = Math.round(newY / grid) * grid;
    }

    const newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };

    // Handle group resize - scale all children proportionally
    if (resizeState.isGroup && resizeState.groupChildData) {
      this.resizeGroupWithChildren(resizeState.elementId, startBounds, newBounds, resizeState.groupChildData);
    } else {
      this.resizePrimitive(resizeState.elementId, newBounds);
    }
  }

  /**
   * Resize a group and scale all its children proportionally
   */
  private resizeGroupWithChildren(
    groupId: string,
    startBounds: { x: number; y: number; width: number; height: number },
    newBounds: { x: number; y: number; width: number; height: number },
    childData: NonNullable<ResizeState['groupChildData']>
  ): void {
    // Calculate scale factors
    const scaleX = newBounds.width / startBounds.width;
    const scaleY = newBounds.height / startBounds.height;

    this.diagramService.updateDiagram(d => {
      // Update the group's bounds
      const updatedPrimitives = (d.primitives ?? []).map(p => {
        if (p.id === groupId && p.type === 'group') {
          return {
            ...p,
            position: { x: newBounds.x, y: newBounds.y },
            config: {
              ...(p as GroupPrimitive).config,
              originalBounds: { ...newBounds }
            }
          } as PrimitiveBase;
        }

        // Scale child primitives
        const childInfo = childData.find(c => c.id === p.id && c.type === 'primitive');
        if (childInfo) {
          return this.scaleChildPrimitive(p, childInfo.startBounds, startBounds, newBounds, scaleX, scaleY);
        }

        return p;
      });

      // Scale child symbols
      const updatedSymbols = (d.symbolInstances ?? []).map(s => {
        const childInfo = childData.find(c => c.id === s.id && c.type === 'symbol');
        if (childInfo) {
          return this.scaleChildSymbol(s, childInfo.startBounds, startBounds, newBounds, scaleX, scaleY);
        }
        return s;
      });

      return {
        ...d,
        primitives: updatedPrimitives,
        symbolInstances: updatedSymbols
      };
    });

    this.stateService.markChanged();
  }

  /**
   * Scale a child primitive within a group resize operation
   */
  private scaleChildPrimitive(
    primitive: PrimitiveBase,
    childStartBounds: { x: number; y: number; width: number; height: number },
    groupStartBounds: { x: number; y: number; width: number; height: number },
    groupNewBounds: { x: number; y: number; width: number; height: number },
    scaleX: number,
    scaleY: number
  ): PrimitiveBase {
    return this.primitiveService.scaleInGroup(primitive, {
      childStartBounds,
      groupStartBounds,
      groupNewBounds,
      scaleX,
      scaleY
    });
  }

  /**
   * Scale a child symbol within a group resize operation
   */
  private scaleChildSymbol(
    symbol: SymbolInstance,
    childStartBounds: { x: number; y: number; width: number; height: number },
    groupStartBounds: { x: number; y: number; width: number; height: number },
    groupNewBounds: { x: number; y: number; width: number; height: number },
    scaleX: number,
    scaleY: number
  ): SymbolInstance {
    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;

    // Use average scale for uniform scaling
    const avgScale = (scaleX + scaleY) / 2;
    const currentScale = symbol.scale ?? 1;

    return {
      ...symbol,
      position: { x: newX, y: newY },
      scale: currentScale * avgScale
    };
  }

  // ============================================================================
  // Palette Drag Handlers
  // ============================================================================

  onPaletteDragStart(_item: PaletteItem): void {
    // Palette drag started
  }

  onPaletteDragEnd(_item: PaletteItem): void {
    // Palette drag ended without drop
  }

  // ============================================================================
  // Symbol Palette Events
  // ============================================================================

  onSymbolDragStart(_item: SymbolPaletteItem): void {
    // Symbol drag start event - item parameter available for future use
  }

  onSymbolDragEnd(): void {
    // Symbol drag end event
  }

  // ============================================================================
  // Sidebar Tab
  // ============================================================================

  setActiveSidebarTab(tab: 'elements' | 'symbols'): void {
    this._activeSidebarTab.set(tab);
  }

  // ============================================================================
  // Property Changes
  // ============================================================================

  onPropertyChange(change: { elementId?: string; connectionId?: string; primitiveId?: string; symbolInstanceId?: string; property: string; value: unknown }): void {
    if (change.elementId) {
      this.updateElementProperty(change.elementId, change.property, change.value);
    } else if (change.connectionId) {
      this.updateConnectionProperty(change.connectionId, change.property, change.value);
    } else if (change.primitiveId) {
      this.updatePrimitiveProperty(change.primitiveId, change.property, change.value);
    } else if (change.symbolInstanceId) {
      this.updateSymbolInstanceProperty(change.symbolInstanceId, change.property, change.value);
    }
  }

  /**
   * Handle animation changes from the animation editor
   */
  onAnimationsChange(event: AnimationChangeEvent): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== event.primitiveId) return p;
        return {
          ...p,
          animations: event.animations
        };
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  // ============================================================================
  // Diagram-level Property Handlers
  // ============================================================================

  /**
   * Handle transform property changes.
   * In diagram mode, updates diagram-level properties.
   * In symbol mode, emits to parent component.
   */
  handleTransformPropertyChange(event: TransformPropertyChangeEvent): void {
    if (this.editorMode === 'diagram') {
      // Update diagram-level properties
      this._diagramTransformProperties.set(event.properties);
      if (event.bindings) {
        this._diagramPropertyBindings.set(event.bindings);
      }
      this.stateService.markChanged();
    } else {
      // Symbol mode - emit to parent
      this.transformPropertiesChange.emit(event);
    }
  }

  /**
   * Handle simulation value changes.
   * In diagram mode, updates diagram-level simulation values.
   * In symbol mode, emits to parent component.
   */
  handleSimulationValueChange(event: SimulationValueChange): void {
    if (this.editorMode === 'diagram') {
      // Update diagram-level simulation values
      this._diagramSimulationValues.update(values => ({
        ...values,
        [event.propertyId]: event.value
      }));
      // Apply simulation to diagram primitives
      this.applyDiagramSimulation();
    } else {
      // Symbol mode - emit to parent
      this.simulationValueChange.emit(event);
    }
  }

  /**
   * Handle simulation reset.
   * In diagram mode, clears diagram-level simulation values.
   * In symbol mode, emits to parent component.
   */
  handleSimulationReset(): void {
    if (this.editorMode === 'diagram') {
      // Clear diagram-level simulation values
      this._diagramSimulationValues.set({});
    } else {
      // Symbol mode - emit to parent
      this.simulationReset.emit();
    }
  }

  /**
   * Apply simulation values to diagram primitives.
   * Evaluates property bindings and applies effects to primitives.
   */
  private applyDiagramSimulation(): void {
    // The effectivePropertyBindings and effectiveSimulationValues computed signals
    // will automatically be used by animationEnabledStates and symbolInstancePropertyValues
    // which are already connected to the rendering pipeline.
    // No additional action needed here as the computed signals handle reactivity.
  }

  // Binding Editor Methods

  /**
   * Open the binding editor dialog for a property
   */
  openBindingEditor(property: TransformProperty): void {
    this._editingBindingProperty.set(property);
    this._showBindingEditor.set(true);
  }

  /**
   * Close the binding editor dialog
   */
  closeBindingEditor(): void {
    this._showBindingEditor.set(false);
    this._editingBindingProperty.set(null);
  }

  /**
   * Handle bindings saved from the binding editor
   */
  onBindingsSaved(bindings: PropertyBinding[]): void {
    // Use the mode-aware handler
    this.handleTransformPropertyChange({
      properties: this.availableTransformProperties(),
      bindings
    });
    this.closeBindingEditor();
  }

  /**
   * Apply a style class to all selected primitives.
   * Removes inline style when applying a class.
   */
  applyStyleToSelection(styleClassId: string): void {
    const selection = this.selectionService.selection();
    const selectedIds = Array.from(selection.elements);

    if (selectedIds.length === 0) {
      return;
    }

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (!selectedIds.includes(p.id)) return p;
        return {
          ...p,
          styleClassId,
          style: undefined // Clear inline style when applying a class
        };
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  // ============================================================================
  // Keyboard Handlers
  // ============================================================================

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore keyboard events from input elements to allow normal text editing
    const target = event.target as HTMLElement;
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )) {
      // Allow only specific shortcuts while in input fields
      const isModifierKey = event.ctrlKey || event.metaKey;
      const isSaveShortcut = isModifierKey && event.key.toLowerCase() === 's';

      // If it's a save shortcut, process it; otherwise let the input handle it
      if (!isSaveShortcut) {
        return;
      }
    }

    // Process keyboard event through the service
    const result = this.keyboardService.processKeyEvent(event);

    if (result.preventDefault) {
      event.preventDefault();
    }

    if (!result.handled || !result.actionId) {
      return;
    }

    // Dispatch action based on actionId
    this.executeKeyboardAction(result.actionId);
  }

  /**
   * Execute a keyboard action by its ID
   */
  private executeKeyboardAction(actionId: string): void {
    switch (actionId) {
      // Mode shortcuts
      case 'mode-select':
        this.setMode('select');
        break;
      case 'mode-pan':
        this.setMode('pan');
        break;
      case 'mode-connect':
        this.setMode('connect');
        break;

      // Delete
      case 'delete':
      case 'delete-backspace':
        this.deleteSelected();
        break;

      // Undo/Redo
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;

      // Select all
      case 'select-all':
        this.selectionService.selectAll(this._diagram());
        break;

      // Save
      case 'save':
        if (this.hasChanges()) {
          this.save();
        }
        break;

      // Copy/Paste
      case 'copy':
        console.log('[ProcessDesigner.executeKeyboardAction] Copy triggered via keyboard');
        this.copySelected();
        break;
      case 'paste':
        console.log('[ProcessDesigner.executeKeyboardAction] Paste triggered via keyboard');
        this.handlePaste();
        break;

      // Group/Ungroup
      case 'group':
        if (this.canGroup()) {
          this.groupSelected();
        }
        break;
      case 'ungroup':
        if (this.canUngroup()) {
          this.ungroupSelected();
        }
        break;

      // Panel toggles (legacy layout)
      case 'toggle-left-panel':
        if (!this.useDockview) {
          this.toggleLeftPanel();
        }
        break;
      case 'toggle-right-panel':
        if (!this.useDockview) {
          this.toggleRightPanel();
        }
        break;

      // Panel toggles (dockview layout)
      case 'toggle-panel-elements':
        if (this.useDockview) {
          this.togglePanelVisibility('elements');
        } else {
          this.toggleLeftPanel();
        }
        break;
      case 'toggle-panel-symbols':
        if (this.useDockview) {
          this.togglePanelVisibility('symbols');
        } else {
          this.toggleLeftPanel();
        }
        break;
      case 'toggle-panel-properties':
        if (this.useDockview) {
          this.togglePanelVisibility('properties');
        } else {
          this.toggleRightPanel();
        }
        break;
      case 'toggle-panel-transform':
        if (this.useDockview) {
          this.togglePanelVisibility('transform');
        }
        break;
      case 'toggle-panel-animations':
        if (this.useDockview) {
          this.togglePanelVisibility('animations');
        }
        break;
      case 'toggle-panel-simulation':
        if (this.useDockview) {
          this.togglePanelVisibility('simulation');
        }
        break;
      case 'toggle-panel-settings':
        if (this.useDockview) {
          this.togglePanelVisibility('settings');
        }
        break;
      case 'toggle-panel-styles':
        if (this.useDockview) {
          this.togglePanelVisibility('styles');
        }
        break;

      // Reset layout (dockview)
      case 'reset-layout':
        if (this.useDockview) {
          this.resetDockviewLayout();
        }
        break;

      // Escape
      case 'escape':
        if (this.contextMenuService.isVisible()) {
          this.closeContextMenu();
        } else {
          this.clearSelection();
        }
        break;

      // Z-Order
      case 'bring-to-front':
        this.bringToFront();
        break;
      case 'bring-forward':
        this.bringForward();
        break;
      case 'send-backward':
        this.sendBackward();
        break;
      case 'send-to-back':
        this.sendToBack();
        break;
    }
  }

  // ============================================================================
  // Context Menu
  // ============================================================================

  /**
   * Show context menu on right-click
   */
  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const canvasCoords = this.getCanvasCoordinates(event);
    this.contextMenuService.show({ x: event.clientX, y: event.clientY }, canvasCoords);
  }

  /**
   * Show context menu on right-click on element
   */
  onElementContextMenu(event: MouseEvent, element: ProcessElement): void {
    event.preventDefault();
    event.stopPropagation();

    // Select element if not already selected
    if (!this.isElementSelected(element.id)) {
      this.selectElement(element.id, event.ctrlKey || event.metaKey || event.shiftKey);
    }

    const canvasCoords = this.getCanvasCoordinates(event);
    this.contextMenuService.show({ x: event.clientX, y: event.clientY }, canvasCoords);
  }

  /**
   * Show context menu on right-click on primitive
   */
  onPrimitiveContextMenu(event: MouseEvent, primitive: PrimitiveBase): void {
    event.preventDefault();
    event.stopPropagation();

    // Track the actual clicked primitive ID (for copy operations)
    this._lastClickedPrimitiveId = primitive.id;

    // Select primitive if not already selected
    if (!this.isPrimitiveSelected(primitive.id)) {
      this.selectPrimitive(primitive.id, event.ctrlKey || event.metaKey || event.shiftKey);
    }

    const canvasCoords = this.getCanvasCoordinates(event);
    this.contextMenuService.show({ x: event.clientX, y: event.clientY }, canvasCoords);
  }

  /**
   * Handle context menu action
   */
  onContextMenuAction(action: ContextMenuAction): void {
    // Save canvas position before closing menu (closing resets it)
    const canvasPosition = this.contextMenuService.getCanvasPosition();
    this.closeContextMenu();

    switch (action.action) {
      case 'copy':
        console.log('[ProcessDesigner.onContextMenuAction] Copy triggered via context menu');
        this.copySelected();
        break;
      case 'paste':
        console.log('[ProcessDesigner.onContextMenuAction] Paste triggered via context menu');
        // Paste at context menu position if available
        if (canvasPosition) {
          this.paste(canvasPosition);
        } else {
          this.paste();
        }
        break;
      case 'editPath':
        this.openPathEditor();
        break;
      case 'addPolyPoint':
        // Add a new point at the context menu position
        if (canvasPosition) {
          this.addPolyPointAtPosition(canvasPosition);
        }
        break;
      case 'deletePolyPoint':
        this.deleteSelectedPolyPoint();
        break;
      case 'group':
        this.groupSelected();
        break;
      case 'ungroup':
        this.ungroupSelected();
        break;
      case 'delete':
        this.deleteSelected();
        break;
      case 'bringToFront':
        this.bringToFront();
        break;
      case 'bringForward':
        this.bringForward();
        break;
      case 'sendBackward':
        this.sendBackward();
        break;
      case 'sendToBack':
        this.sendToBack();
        break;
      case 'selectAll':
        this.selectionService.selectAll(this._diagram());
        break;

      // Alignment actions
      case 'alignLeft':
        this.alignLeft();
        break;
      case 'alignRight':
        this.alignRight();
        break;
      case 'alignTop':
        this.alignTop();
        break;
      case 'alignBottom':
        this.alignBottom();
        break;
      case 'alignHorizontalCenter':
        this.alignHorizontalCenter();
        break;
      case 'alignVerticalCenter':
        this.alignVerticalCenter();
        break;
      case 'distributeHorizontally':
        this.distributeHorizontally();
        break;
      case 'distributeVertically':
        this.distributeVertically();
        break;
    }
  }

  /**
   * Close context menu
   */
  closeContextMenu(): void {
    this.contextMenuService.hide();
  }

  /**
   * Bring selected elements/primitives to front (highest z-index)
   */
  bringToFront(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size === 0) return;

    const result = this.zOrderService.bringToFront(this._diagram(), sel.elements);
    this.diagramService.updateDiagram(d => ({ ...d, ...result }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Bring selected elements/primitives one level forward
   */
  bringForward(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size === 0) return;

    const result = this.zOrderService.bringForward(this._diagram(), sel.elements);
    this.diagramService.updateDiagram(d => ({ ...d, ...result }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Send selected elements/primitives one level backward
   */
  sendBackward(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size === 0) return;

    const result = this.zOrderService.sendBackward(this._diagram(), sel.elements);
    this.diagramService.updateDiagram(d => ({ ...d, ...result }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Send selected elements/primitives to back (lowest z-index)
   */
  sendToBack(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size === 0) return;

    const result = this.zOrderService.sendToBack(this._diagram(), sel.elements);
    this.diagramService.updateDiagram(d => ({ ...d, ...result }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  // ============================================================================
  // Alignment Operations
  // ============================================================================

  /**
   * Helper to get symbol definition lookup function for alignment service
   */
  private getSymbolDefinitionLookup(): (symbol: SymbolInstance) => SymbolDefinition | null {
    return (symbol) => this.getSymbolDefinition(symbol) ?? null;
  }

  /**
   * Align selected items to the left
   */
  alignLeft(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignLeft(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Align selected items to the right
   */
  alignRight(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignRight(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Align selected items to the top
   */
  alignTop(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignTop(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Align selected items to the bottom
   */
  alignBottom(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignBottom(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Align selected items to horizontal center
   */
  alignHorizontalCenter(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignHorizontalCenter(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Align selected items to vertical center
   */
  alignVerticalCenter(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 2) return;

    const result = this.alignmentService.alignVerticalCenter(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Distribute selected items evenly horizontally
   */
  distributeHorizontally(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 3) return;

    const result = this.alignmentService.distributeHorizontally(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  /**
   * Distribute selected items evenly vertically
   */
  distributeVertically(): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size < 3) return;

    const result = this.alignmentService.distributeVertically(
      sel.elements,
      this._diagram(),
      this.getSymbolDefinitionLookup()
    );
    if (result) {
      this.diagramService.setDiagram(result);
      this.pushToHistory();
      this.stateService.markChanged();
    }
  }

  // ============================================================================
  // Element Operations
  // ============================================================================

  addElement(type: ProcessElementType, position: Position): void {
    const newElement = this.creationService.createDefaultElement(type, this.snapPosition(position));

    this.diagramService.updateDiagram(d => ({
      ...d,
      elements: [...d.elements, newElement]
    }));

    this.selectElement(newElement.id);
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Add a new primitive to the canvas
   */
  addPrimitive(primitiveType: PrimitiveTypeValue, position: Position): void {
    const primitive = this.creationService.createDefaultPrimitive(primitiveType, this.snapPosition(position));

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: [...(d.primitives ?? []), primitive]
    }));

    this.selectPrimitive(primitive.id);
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Select a primitive
   */
  selectPrimitive(primitiveId: string, addToSelection = false): void {
    this.selectionService.selectPrimitive(primitiveId, addToSelection);
  }

  /**
   * Check if a primitive is selected (uses same selection set as elements)
   */
  isPrimitiveSelected(primitiveId: string): boolean {
    return this.selectionService.isPrimitiveSelected(primitiveId);
  }

  updateElementProperty(elementId: string, property: string, value: unknown): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      elements: d.elements.map(e => {
        if (e.id === elementId) {
          return this.setNestedProperty(e, property, value);
        }
        return e;
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  updateConnectionProperty(connectionId: string, property: string, value: unknown): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      connections: d.connections.map(c => {
        if (c.id === connectionId) {
          return this.setNestedProperty(c, property, value);
        }
        return c;
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  updatePrimitiveProperty(primitiveId: string, property: string, value: unknown): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id === primitiveId) {
          // When assigning a style class, clear inline styles so the class takes effect
          if (property === 'styleClassId' && value) {
            return {
              ...p,
              styleClassId: value as string,
              style: undefined  // Clear inline styles
            };
          }
          // When clearing style class (value is null/empty), keep inline styles
          if (property === 'styleClassId' && !value) {
            return {
              ...p,
              styleClassId: undefined
            };
          }
          return this.setNestedProperty(p, property, value) as PrimitiveBase;
        }
        return p;
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  updateSymbolInstanceProperty(symbolInstanceId: string, property: string, value: unknown): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).map(s => {
        if (s.id === symbolInstanceId) {
          return this.setNestedProperty(s, property, value) as SymbolInstance;
        }
        return s;
      })
    }));
    this.pushToHistory();
    this.stateService.markChanged();
  }

  // ============================================================================
  // Visual Helpers
  // ============================================================================

  getElementTransform(element: ProcessElement): string {
    let transform = `translate(${element.position.x}, ${element.position.y})`;
    if (element.rotation) {
      const cx = element.size.width / 2;
      const cy = element.size.height / 2;
      transform += ` rotate(${element.rotation}, ${cx}, ${cy})`;
    }
    return transform;
  }

  getElementFill(element: ProcessElement): string {
    // Use user-defined style fill color first (from Style section)
    if (element.style?.fillColor) {
      return element.style.fillColor;
    }

    // Check element-specific config fill colors (from element settings sections)
    // Use $any() pattern for accessing config.fillColor across different element types
    const anyElement = element as unknown as { config?: { fillColor?: string } };
    if (anyElement.config?.fillColor) {
      return anyElement.config.fillColor;
    }

    // Default colors per element type
    const typeColors: Record<ProcessElementType, string> = {
      tank: '#e3f2fd',
      silo: '#e8f5e9',
      vessel: '#e3f2fd',
      pipe: '#f5f5f5',
      valve: '#fff3e0',
      pump: '#e8f5e9',
      motor: '#fff3e0',
      gauge: '#f3e5f5',
      digitalDisplay: '#e0e0e0',
      statusLight: '#ffebee',
      label: '#fafafa',
      image: '#f5f5f5',
      shape: '#f5f5f5',
      customSvg: '#f5f5f5'
    };
    return typeColors[element.type] ?? '#f5f5f5';
  }

  getElementStroke(element: ProcessElement): string {
    // Use user-defined stroke color if available
    return element.style?.strokeColor ?? '#666666';
  }

  getElementRadius(element: ProcessElement): number {
    if (element.type === 'tank' || element.type === 'vessel') return 8;
    if (element.type === 'pump' || element.type === 'motor' || element.type === 'statusLight') return 20;
    return 4;
  }

  getElementTypeLabel(element: ProcessElement): string {
    const labels: Record<ProcessElementType, string> = {
      tank: 'Tank',
      silo: 'Silo',
      vessel: 'Vessel',
      pipe: 'Pipe',
      valve: 'Valve',
      pump: 'Pump',
      motor: 'Motor',
      gauge: 'Gauge',
      digitalDisplay: 'Display',
      statusLight: 'Light',
      label: 'Label',
      image: 'Image',
      shape: 'Shape',
      customSvg: 'SVG'
    };
    return labels[element.type] ?? element.type;
  }

  getConnectionPath(connection: ProcessConnection): string {
    return this.renderingService.getConnectionPath(connection, this._diagram());
  }

  // ============================================================================
  // Primitive Rendering
  // ============================================================================

  /**
   * Get the bounding box of a primitive
   */
  getPrimitiveBoundingBox(primitive: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    // Handle groups specially - use stored bounds
    if (primitive.type === 'group') {
      const groupConfig = (primitive as GroupPrimitive).config;
      return {
        x: primitive.position.x,
        y: primitive.position.y,
        width: groupConfig.originalBounds?.width ?? 100,
        height: groupConfig.originalBounds?.height ?? 100
      };
    }

    return this.primitiveRendererRegistry.getBoundingBox(primitive) ?? {
      x: primitive.position.x,
      y: primitive.position.y,
      width: 100,
      height: 100
    };
  }

  /**
   * Get bounds of an item at a hypothetical position.
   * Used for alignment guide calculation during drag.
   */
  private getBoundsAtPosition(
    itemId: string,
    itemType: 'element' | 'primitive' | 'symbol' | 'group',
    position: Position,
    diagram: ProcessDiagramConfig
  ): { x: number; y: number; width: number; height: number } | null {
    if (itemType === 'primitive' || itemType === 'group') {
      const primitive = (diagram.primitives ?? []).find(p => p.id === itemId);
      if (!primitive) return null;

      // Get current bounds and adjust for new position
      const currentBounds = this.getPrimitiveBoundingBox(primitive);
      return {
        x: position.x,
        y: position.y,
        width: currentBounds.width,
        height: currentBounds.height
      };
    }

    if (itemType === 'symbol') {
      const symbol = (diagram.symbolInstances ?? []).find(s => s.id === itemId);
      if (!symbol) return null;

      const symbolDef = this.getSymbolDefinition(symbol);
      if (!symbolDef) return null;

      const scale = symbol.scale ?? 1;
      return {
        x: position.x,
        y: position.y,
        width: symbolDef.bounds.width * scale,
        height: symbolDef.bounds.height * scale
      };
    }

    if (itemType === 'element') {
      const element = diagram.elements.find(e => e.id === itemId);
      if (!element) return null;

      return {
        x: position.x,
        y: position.y,
        width: element.size.width,
        height: element.size.height
      };
    }

    return null;
  }

  /**
   * Handle mousedown on a primitive
   */
  onPrimitiveMouseDown(event: MouseEvent, primitive: PrimitiveBase): void {
    event.stopPropagation();

    // In pan mode, start panning instead of selecting/dragging
    if (this.stateService.mode() === 'pan') {
      this.startPanning(event);
      return;
    }

    if (this.stateService.mode() === 'select') {
      const addToSelection = event.ctrlKey || event.metaKey || event.shiftKey;
      const diagram = this._diagram();

      // Track the actual clicked primitive ID (for copy operations)
      this._lastClickedPrimitiveId = primitive.id;
      console.log('[ProcessDesigner.onPrimitiveMouseDown] Set _lastClickedPrimitiveId:', primitive.id, primitive.name);

      // Check if primitive is in a group - if so, select the group instead
      const group = this.selectionService.findGroupForItem(primitive.id, diagram);
      console.log('[ProcessDesigner.onPrimitiveMouseDown] Group check:', { primitiveId: primitive.id, groupFound: !!group, groupId: group?.id });
      const effectiveId = group ? group.id : primitive.id;

      // For primitives like lines that use config coordinates instead of position,
      // use the bounds origin as the effective position for dragging
      let effectivePosition: Position;
      if (group) {
        effectivePosition = group.position;
      } else {
        const bounds = this.getPrimitiveBoundingBox(primitive);
        effectivePosition = { x: bounds.x, y: bounds.y };
      }

      // Check if the clicked primitive itself is a group, or if it's inside a group
      const isGroupItem = !!group || primitive.type === 'group';

      // Handle selection based on current state and modifier keys
      const alreadySelected = this.isPrimitiveSelected(effectiveId);
      const hasMultiSelection = this.selectionService.selection().elements.size > 1;

      // Clear any previous pending selection
      this._pendingSingleSelection = null;

      if (!alreadySelected) {
        // Item not selected - select it (replacing current selection unless modifier held)
        this.selectPrimitive(effectiveId, addToSelection);
      } else if (addToSelection) {
        // Item already selected with modifier - toggle it off
        this.selectionService.deselectElement(effectiveId);
      } else if (hasMultiSelection) {
        // Item is part of a multi-selection, clicked without modifier.
        // Don't change selection yet (preserve multi-selection for potential drag).
        // Instead, mark this as pending - if no drag occurs, reduce to single selection.
        this._pendingSingleSelection = effectiveId;
      }
      // else: Item is the only selected item - no change needed

      // Start drag using DragService
      const coords = this.getCanvasCoordinates(event);
      if (coords) {
        const itemType = isGroupItem ? 'group' : 'primitive';
        this.dragService.startDrag(effectiveId, itemType, effectivePosition, coords);
      }
    }
  }

  /**
   * Get polygon points as SVG points string
   */
  getPolygonPoints(primitive: { position: Position; config: { points: Position[] } }): string {
    return primitive.config.points
      .map(p => `${p.x + primitive.position.x},${p.y + primitive.position.y}`)
      .join(' ');
  }

  /**
   * Get polyline points as SVG points string
   */
  getPolylinePoints(primitive: { position: Position; config: { points: Position[] } }): string {
    return primitive.config.points
      .map(p => `${p.x + primitive.position.x},${p.y + primitive.position.y}`)
      .join(' ');
  }

  /**
   * Get stroke dash array as SVG string
   */
  getStrokeDashArray(dashArray: number[] | undefined): string {
    if (!dashArray || dashArray.length === 0) {
      return '';
    }
    return dashArray.join(' ');
  }

  /**
   * Resolves the effective style for a primitive, considering style class inheritance.
   * Priority order: inline style > style class > defaults
   *
   * @param primitive The primitive to resolve style for
   * @returns Resolved style with fill and stroke properties
   */
  resolveStyle(primitive: PrimitiveBase): {
    fill?: { color?: string; opacity?: number };
    stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
  } {
    // Start with empty resolved style
    const resolved: {
      fill?: { color?: string; opacity?: number };
      stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
    } = {};

    // If primitive has a style class, look it up and use its styles as base
    if (primitive.styleClassId && this.styleClasses.length > 0) {
      const styleClass = this.styleClasses.find(s => s.id === primitive.styleClassId);
      if (styleClass?.style) {
        // Deep copy style class properties
        if (styleClass.style.fill) {
          resolved.fill = { ...styleClass.style.fill };
        }
        if (styleClass.style.stroke) {
          resolved.stroke = { ...styleClass.style.stroke };
        }
      }
    }

    // Merge inline styles on top (inline overrides class)
    if (primitive.style) {
      if (primitive.style.fill) {
        resolved.fill = {
          ...resolved.fill,
          ...primitive.style.fill
        };
      }
      if (primitive.style.stroke) {
        resolved.stroke = {
          ...resolved.stroke,
          ...primitive.style.stroke
        };
      }
    }

    return resolved;
  }

  /**
   * Resolves style for a primitive using a provided styleClasses array.
   * Used for symbol instances where styleClasses come from the symbol definition.
   *
   * @param primitive The primitive to resolve style for
   * @param styleClasses The style classes to look up from
   * @returns Resolved style
   */
  resolveStyleWithClasses(
    primitive: PrimitiveBase,
    styleClasses: StyleClass[] | undefined
  ): {
    fill?: { color?: string; opacity?: number };
    stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
  } {
    const resolved: {
      fill?: { color?: string; opacity?: number };
      stroke?: { color?: string; opacity?: number; width?: number; dashArray?: number[] };
    } = {};

    // If primitive has a style class, look it up
    if (primitive.styleClassId && styleClasses && styleClasses.length > 0) {
      const styleClass = styleClasses.find(s => s.id === primitive.styleClassId);
      if (styleClass?.style) {
        if (styleClass.style.fill) {
          resolved.fill = { ...styleClass.style.fill };
        }
        if (styleClass.style.stroke) {
          resolved.stroke = { ...styleClass.style.stroke };
        }
      }
    }

    // Merge inline styles on top (inline overrides class)
    if (primitive.style) {
      if (primitive.style.fill) {
        resolved.fill = { ...resolved.fill, ...primitive.style.fill };
      }
      if (primitive.style.stroke) {
        resolved.stroke = { ...resolved.stroke, ...primitive.style.stroke };
      }
    }

    return resolved;
  }

  /**
   * Render SVG for group children, transformed to local coordinates.
   * The group is centered at (cx, cy), so children need to be offset by (-cx, -cy).
   *
   * @param childIds Array of child IDs (primitives or symbols)
   * @param groupCenterX Center X of the group in absolute coordinates
   * @param groupCenterY Center Y of the group in absolute coordinates
   * @returns SVG string containing all children
   */
  private renderGroupChildrenSvg(childIds: string[], groupCenterX: number, groupCenterY: number): string {
    const diagram = this._diagram();
    const symbolDefinitions = this._symbolDefinitions();
    const svgParts: string[] = [];

    for (const childId of childIds) {
      // Check if child is a primitive
      const primitive = (diagram.primitives ?? []).find(p => p.id === childId);
      if (primitive) {
        const childSvg = this.renderPrimitiveForGroup(primitive, groupCenterX, groupCenterY);
        if (childSvg) {
          svgParts.push(childSvg);
        }
        continue;
      }

      // Check if child is a symbol instance
      const symbol = (diagram.symbolInstances ?? []).find(s => s.id === childId);
      if (symbol) {
        const symbolDef = symbolDefinitions.get(symbol.symbolRtId);
        if (symbolDef) {
          const childSvg = this.renderSymbolForGroup(symbol, symbolDef, groupCenterX, groupCenterY);
          if (childSvg) {
            svgParts.push(childSvg);
          }
        }
      }
    }

    return svgParts.join('');
  }

  /**
   * Render a primitive for inclusion in a group, with transformed coordinates.
   * @param primitive The primitive to render
   * @param offsetX X offset for coordinate transformation
   * @param offsetY Y offset for coordinate transformation
   * @param styleClasses Optional style classes for resolving styleClassId references (for symbols)
   */
  private renderPrimitiveForGroup(
    primitive: PrimitiveBase,
    offsetX: number,
    offsetY: number,
    styleClasses?: StyleClass[]
  ): string {
    const localX = primitive.position.x - offsetX;
    const localY = primitive.position.y - offsetY;

    // Resolve style using styleClasses if provided, otherwise use component's styleClasses
    const resolvedStyle = styleClasses
      ? this.resolveStyleWithClasses(primitive, styleClasses)
      : this.resolveStyle(primitive);

    const fill = resolvedStyle?.fill?.color ?? 'none';
    const fillOpacity = resolvedStyle?.fill?.opacity ?? 1;
    const stroke = resolvedStyle?.stroke?.color ?? 'none';
    const strokeOpacity = resolvedStyle?.stroke?.opacity ?? 1;
    const strokeWidth = resolvedStyle?.stroke?.width ?? 1;
    const strokeDashArray = this.getStrokeDashArray(resolvedStyle?.stroke?.dashArray);

    switch (primitive.type) {
      case 'rectangle': {
        const config = (primitive as RectanglePrimitive).config;
        const rx = config.cornerRadiusX ?? config.cornerRadius ?? 0;
        const ry = config.cornerRadiusY ?? config.cornerRadius ?? 0;
        const fillLevel = primitive.fillLevel;

        // Check if fillLevel is set (0-1 range for tank/battery visualization)
        if (fillLevel !== undefined && fillLevel >= 0 && fillLevel <= 1) {
          const clipId = `fill-clip-${primitive.id}`;
          const clipY = localY + config.height * (1 - fillLevel);
          const clipHeight = config.height * fillLevel;
          return `<g>` +
            `<defs><clipPath id="${clipId}"><rect x="${localX}" y="${clipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
            `<rect x="${localX}" y="${localY}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})"/></g>`;
        }
        return `<rect x="${localX}" y="${localY}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}/>`;
      }
      case 'ellipse': {
        const config = (primitive as EllipsePrimitive).config;
        return `<ellipse cx="${localX}" cy="${localY}" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}/>`;
      }
      case 'line': {
        const config = (primitive as LinePrimitive).config;
        const x1 = config.start.x + localX;
        const y1 = config.start.y + localY;
        const x2 = config.end.x + localX;
        const y2 = config.end.y + localY;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}/>`;
      }
      case 'text': {
        const config = (primitive as TextPrimitive).config;
        const textStyle = config.textStyle ?? {};
        const fontSize = textStyle.fontSize ?? 14;
        const fontFamily = textStyle.fontFamily ?? 'sans-serif';
        const fontWeight = textStyle.fontWeight ?? 'normal';
        const textAnchor = textStyle.textAnchor ?? 'start';
        const fillColor = textStyle.color ?? resolvedStyle?.fill?.color ?? '#000000';
        return `<text x="${localX}" y="${localY}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${textAnchor}" fill="${fillColor}">${this.escapeXml(config.content ?? '')}</text>`;
      }
      case 'path': {
        const config = (primitive as PathPrimitive).config;
        return `<path d="${config.d}" transform="translate(${localX},${localY})" fill="${fill}" fill-opacity="${fillOpacity}"${config.fillRule ? ` fill-rule="${config.fillRule}"` : ''} stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}/>`;
      }
      case 'polygon': {
        const config = (primitive as PolygonPrimitive).config;
        if (config.points && Array.isArray(config.points)) {
          const points = config.points.map((pt: Position) =>
            `${pt.x + localX},${pt.y + localY}`
          ).join(' ');
          return `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}/>`;
        }
        return '';
      }
      case 'polyline': {
        const config = (primitive as PolylinePrimitive).config;
        if (config.points && Array.isArray(config.points)) {
          const points = config.points.map((pt: Position) =>
            `${pt.x + localX},${pt.y + localY}`
          ).join(' ');
          return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}/>`;
        }
        return '';
      }
      case 'image': {
        const config = (primitive as ImagePrimitive).config;
        const width = config.width ?? 100;
        const height = config.height ?? 100;
        const src = config.src;

        // If we have a valid source, render the actual image
        if (src) {
          const preserveAspectRatio = config.preserveAspectRatio !== false ? 'xMidYMid meet' : 'none';
          // For data URLs, we need to be careful with escaping - only escape non-data URLs
          const safeSrc = src.startsWith('data:') ? src : this.escapeXml(src);
          return `<image x="${localX}" y="${localY}" width="${width}" height="${height}" href="${safeSrc}" preserveAspectRatio="${preserveAspectRatio}"/>`;
        }

        // Fallback: render placeholder if no source
        const labelX = localX + width / 2;
        const labelY = localY + height / 2;
        return `<g>` +
          `<rect x="${localX}" y="${localY}" width="${width}" height="${height}" fill="#f5f5f5" stroke="#ccc" stroke-width="1" stroke-dasharray="4 2"/>` +
          `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#999">Image</text>` +
          `</g>`;
      }
      case 'group': {
        // Handle nested groups - recursively render children
        const groupConfig = (primitive as GroupPrimitive).config;
        const childBounds = this.getPrimitiveBoundingBox(primitive);
        const nestedCx = childBounds.x + childBounds.width / 2;
        const nestedCy = childBounds.y + childBounds.height / 2;
        const nestedLocalX = nestedCx - offsetX;
        const nestedLocalY = nestedCy - offsetY;
        const childrenSvg = this.renderGroupChildrenSvg(groupConfig.childIds, nestedCx, nestedCy);
        // Render nested group with its children
        return `<g transform="translate(${nestedLocalX}, ${nestedLocalY})">` +
          `<rect x="${-childBounds.width / 2}" y="${-childBounds.height / 2}" width="${childBounds.width}" height="${childBounds.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" pointer-events="all"/>` +
          `${childrenSvg}` +
          `</g>`;
      }
      default:
        // Log warning for unhandled primitive types in development
        console.warn(`renderPrimitiveForGroup: Unhandled primitive type '${primitive.type}'`);
        return '';
    }
  }

  /**
   * Render a symbol instance for inclusion in a group, with transformed coordinates.
   */
  private renderSymbolForGroup(symbol: SymbolInstance, definition: SymbolDefinition, offsetX: number, offsetY: number): string {
    const localX = symbol.position.x - offsetX;
    const localY = symbol.position.y - offsetY;
    const scale = symbol.scale ?? 1;
    const rotation = symbol.rotation ?? 0;

    // Render symbol primitives manually
    const svgParts: string[] = [];
    // Get property values from computed signal or symbol instance
    const propValues = this.symbolInstancePropertyValues().get(symbol.id) ?? symbol.propertyValues ?? {};
    // Use getSymbolPrimitivesWithDirectEffects to apply diagram-level bindings
    const primitives = this.getSymbolPrimitivesWithDirectEffects(symbol, definition, propValues);
    const symbolStyleClasses = definition.styleClasses;
    for (const prim of primitives) {
      // Render each primitive at its position within the symbol, passing symbol's styleClasses
      const primSvg = this.renderPrimitiveForGroup(prim, 0, 0, symbolStyleClasses);
      if (primSvg) {
        svgParts.push(primSvg);
      }
    }
    const innerSvg = svgParts.join('');

    // Wrap in a group with transform
    let transform = `translate(${localX}, ${localY})`;
    if (scale !== 1) {
      transform += ` scale(${scale})`;
    }
    if (rotation !== 0) {
      const bounds = getSymbolInstanceBounds(symbol, definition);
      const cx = bounds.width / 2;
      const cy = bounds.height / 2;
      transform += ` rotate(${rotation}, ${cx}, ${cy})`;
    }

    return `<g transform="${transform}">${innerSvg}</g>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get safe HTML for SVG content (used in templates)
   */
  getSafeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  /**
   * Check if a primitive has animations defined
   */
  primitiveHasAnimations(primitive: PrimitiveBase): boolean {
    return !!(primitive.animations && primitive.animations.length > 0);
  }

  /**
   * Check if a primitive has a fillLevel set (for tank/battery visualization).
   * fillLevel is applied via property bindings during simulation.
   */
  hasFillLevel(primitive: PrimitiveBase): boolean {
    const hasFill = primitive.fillLevel !== undefined && primitive.fillLevel >= 0 && primitive.fillLevel <= 1;
    if (hasFill) {
      console.log('[ProcessDesigner.hasFillLevel]', primitive.id, 'fillLevel:', primitive.fillLevel);
    }
    return hasFill;
  }

  /**
   * Get the animation origin point for a primitive.
   * Used to display a visual indicator of where rotation/scale animations pivot from.
   * Returns null if no transform animations exist.
   */
  getAnimationOrigin(primitive: PrimitiveBase): { x: number; y: number } | null {
    if (!primitive.animations || primitive.animations.length === 0) {
      return null;
    }

    // Check if there are any transform animations (rotation or scale)
    const hasTransformAnimation = primitive.animations.some(anim => {
      const animation = anim.animation;
      return animation.type === 'animateTransform';
    });

    if (!hasTransformAnimation) {
      return null;
    }

    // Get bounding box and calculate center (default pivot point)
    const bbox = this.getPrimitiveBoundingBox(primitive);
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // For now, return center. Could be extended to respect anchor property.
    // Find first rotation animation to check for custom anchor
    const rotationAnim = primitive.animations.find(anim => {
      const animation = anim.animation;
      return animation.type === 'animateTransform' &&
             (animation as TransformAnimation).transformType === 'rotate';
    });

    if (rotationAnim?.anchor && rotationAnim.anchor !== 'center') {
      // Calculate based on anchor
      const anchor = rotationAnim.anchor;
      switch (anchor) {
        case 'top-left': return { x: bbox.x, y: bbox.y };
        case 'top': return { x: centerX, y: bbox.y };
        case 'top-right': return { x: bbox.x + bbox.width, y: bbox.y };
        case 'left': return { x: bbox.x, y: centerY };
        case 'right': return { x: bbox.x + bbox.width, y: centerY };
        case 'bottom-left': return { x: bbox.x, y: bbox.y + bbox.height };
        case 'bottom': return { x: centerX, y: bbox.y + bbox.height };
        case 'bottom-right': return { x: bbox.x + bbox.width, y: bbox.y + bbox.height };
        case 'custom':
          if (rotationAnim.customAnchor) {
            const px = rotationAnim.customAnchor.x <= 1
              ? bbox.x + bbox.width * rotationAnim.customAnchor.x
              : rotationAnim.customAnchor.x;
            const py = rotationAnim.customAnchor.y <= 1
              ? bbox.y + bbox.height * rotationAnim.customAnchor.y
              : rotationAnim.customAnchor.y;
            return { x: px, y: py };
          }
          break;
      }
    }

    return { x: centerX, y: centerY };
  }

  /**
   * Check if a primitive has scale animations
   */
  private hasScaleAnimations(primitive: PrimitiveBase): boolean {
    if (!primitive.animations) return false;
    return primitive.animations.some(anim => {
      const animation = anim.animation;
      return animation.type === 'animateTransform' &&
             (animation as TransformAnimation).transformType === 'scale';
    });
  }

  /**
   * Check if an animation is enabled based on bindings.
   * Returns true if:
   * - There are no animation bindings (previewMode)
   * - There is no binding for this specific animation
   * - The binding evaluates to true
   */
  private isAnimationEnabled(
    primitiveId: string,
    animationId: string | undefined,
    animationStates: Record<string, boolean>,
    hasAnimationBindings: boolean
  ): boolean {
    // If there are no animation bindings, all animations are enabled (preview mode)
    if (!hasAnimationBindings) {
      return true;
    }
    // If animation has no ID, can't be controlled by binding, so enabled
    if (!animationId) {
      return true;
    }
    // Check the binding state
    const key = `${primitiveId}:${animationId}`;
    if (key in animationStates) {
      return animationStates[key];
    }
    // No binding for this animation, so it's enabled by default
    return true;
  }

  /**
   * Get complete SVG for a primitive including animations.
   * Used for primitives with animations since SVG animations must be child elements.
   */
  getPrimitiveWithAnimationsSvg(primitive: PrimitiveBase): SafeHtml {
    const bbox = this.getPrimitiveBoundingBox(primitive);
    const isSelected = this.isPrimitiveSelected(primitive.id);

    // Get animation enabled states from computed signal (reactive to simulation values)
    const animationStates = this.animationEnabledStates();
    const hasAnimationBindings = Object.keys(animationStates).length > 0;

    // Check if we have scale animations (need special handling for center-based scaling)
    const hasScale = this.hasScaleAnimations(primitive);

    // Generate animation content if animations exist
    let animationContent = '';
    if (primitive.animations && primitive.animations.length > 0) {
      const animContext: AnimationRenderContext = {
        bounds: bbox,
        animationsEnabled: true,
        propertyValues: {},
        // Use previewMode only if there are NO animation bindings
        // Otherwise, use the evaluated animationStates
        previewMode: !hasAnimationBindings,
        primitiveId: primitive.id,
        animationEnabledStates: hasAnimationBindings ? animationStates : undefined
      };
      animationContent = renderAnimations(primitive.animations, animContext);
    }

    // Generate the shape SVG based on type
    let shapeSvg = '';
    // Use resolveStyle to merge style class with inline styles
    const resolvedStyle = this.resolveStyle(primitive);
    const fill = resolvedStyle?.fill?.color ?? 'none';
    const fillOpacity = resolvedStyle?.fill?.opacity ?? 1;
    const stroke = isSelected ? '#1976d2' : (resolvedStyle?.stroke?.color ?? 'none');
    const strokeOpacity = resolvedStyle?.stroke?.opacity ?? 1;
    const strokeWidth = isSelected ? this.selectionHighlightWidth() : (resolvedStyle?.stroke?.width ?? 1);
    const strokeDashArray = this.getStrokeDashArray(resolvedStyle?.stroke?.dashArray);

    switch (primitive.type) {
      case 'rectangle': {
        const config = (primitive as RectanglePrimitive).config;
        const rx = config.cornerRadiusX ?? config.cornerRadius ?? 0;
        const ry = config.cornerRadiusY ?? config.cornerRadius ?? 0;
        const fillLevel = primitive.fillLevel;

        // Check if fillLevel is set (0-1 range for tank/battery visualization)
        if (fillLevel !== undefined && fillLevel >= 0 && fillLevel <= 1) {
          // Render with clip-path for fill level effect
          const clipId = `fill-clip-${primitive.id}`;
          const clipY = primitive.position.y + config.height * (1 - fillLevel);
          const clipHeight = config.height * fillLevel;
          console.log('[ProcessDesigner.fillLevel] Rendering fillLevel:', {
            primitiveId: primitive.id,
            fillLevel,
            position: primitive.position,
            configHeight: config.height,
            clipY,
            clipHeight
          });

          if (hasScale) {
            const cx = primitive.position.x + config.width / 2;
            const cy = primitive.position.y + config.height / 2;
            const localClipY = -config.height / 2 + config.height * (1 - fillLevel);
            shapeSvg = `<g transform="translate(${cx}, ${cy})">` +
              `<defs><clipPath id="${clipId}"><rect x="${-config.width / 2}" y="${localClipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          } else {
            shapeSvg = `<g>` +
              `<defs><clipPath id="${clipId}"><rect x="${primitive.position.x}" y="${clipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          }
        } else if (hasScale) {
          // For scale animations: wrap in group positioned at center, draw rect offset from center
          // This makes the scale animation scale from center (0,0) instead of top-left
          const cx = primitive.position.x + config.width / 2;
          const cy = primitive.position.y + config.height / 2;
          shapeSvg = `<g transform="translate(${cx}, ${cy})"><rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect></g>`;
        } else {
          shapeSvg = `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect>`;
        }
        break;
      }
      case 'ellipse': {
        const config = (primitive as EllipsePrimitive).config;
        if (hasScale) {
          // For scale animations: wrap in group at ellipse center, draw ellipse at origin
          // Ellipse position is already the center (cx, cy), so translate there and draw at (0,0)
          shapeSvg = `<g transform="translate(${primitive.position.x}, ${primitive.position.y})"><ellipse cx="0" cy="0" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse></g>`;
        } else {
          shapeSvg = `<ellipse cx="${primitive.position.x}" cy="${primitive.position.y}" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse>`;
        }
        break;
      }
      case 'path': {
        const pathConfig = (primitive as PathPrimitive).config;
        const pathShape = `<path d="${pathConfig.d}" transform="translate(${primitive.position.x},${primitive.position.y})" fill="${fill}" fill-opacity="${fillOpacity}"${pathConfig.fillRule ? ` fill-rule="${pathConfig.fillRule}"` : ''} stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</path>`;

        // Check for flow particles animation
        const flowParticlesPath = getFlowParticlesAnimation(primitive.animations);
        // Check if flow particles animation is enabled via bindings
        const flowParticlesPathEnabled = flowParticlesPath && this.isAnimationEnabled(
          primitive.id, flowParticlesPath.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesPathEnabled && flowParticlesPath) {
          // For path, we need to offset the path data by position
          const particlesContentPath = renderFlowParticles(
            flowParticlesPath.animation,
            pathConfig.d,
            stroke,
            true
          );
          // Wrap particles in a group with same transform as the path
          shapeSvg = `<g>${pathShape}<g transform="translate(${primitive.position.x},${primitive.position.y})">${particlesContentPath}</g></g>`;
        } else {
          shapeSvg = pathShape;
        }
        break;
      }
      case 'polygon': {
        const points = this.getPolygonPoints(primitive as PolygonPrimitive);
        shapeSvg = `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</polygon>`;
        break;
      }
      case 'line': {
        const config = (primitive as LinePrimitive).config;
        const x1 = config.start.x + primitive.position.x;
        const y1 = config.start.y + primitive.position.y;
        const x2 = config.end.x + primitive.position.x;
        const y2 = config.end.y + primitive.position.y;
        // For flow animations (stroke-dashoffset), we need a stroke-dasharray
        // If none is defined, use a default dash pattern
        const hasFlowAnimation = primitive.animations?.some(a =>
          a.animation.type === 'animate' && (a.animation as AttributeAnimation).attributeName === 'stroke-dashoffset'
        );
        const effectiveDashArray = strokeDashArray || (hasFlowAnimation ? '10 5' : '');
        const lineShape = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${effectiveDashArray ? ` stroke-dasharray="${effectiveDashArray}"` : ''}>${animationContent}</line>`;

        // Check for flow particles animation
        const flowParticles = getFlowParticlesAnimation(primitive.animations);
        // Check if flow particles animation is enabled via bindings
        const flowParticlesEnabled = flowParticles && this.isAnimationEnabled(
          primitive.id, flowParticles.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesEnabled && flowParticles) {
          const pathData = `M ${x1},${y1} L ${x2},${y2}`;
          const particlesContent = renderFlowParticles(flowParticles.animation, pathData, stroke, true);
          shapeSvg = `<g>${lineShape}${particlesContent}</g>`;
        } else {
          shapeSvg = lineShape;
        }
        break;
      }
      case 'polyline': {
        const polylinePoints = this.getPolylinePoints(primitive as PolylinePrimitive);
        // For flow animations (stroke-dashoffset), we need a stroke-dasharray
        const hasFlowAnimationPolyline = primitive.animations?.some(a =>
          a.animation.type === 'animate' && (a.animation as AttributeAnimation).attributeName === 'stroke-dashoffset'
        );
        const effectiveDashArrayPolyline = strokeDashArray || (hasFlowAnimationPolyline ? '10 5' : '');
        const polylineShape = `<polyline points="${polylinePoints}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${effectiveDashArrayPolyline ? ` stroke-dasharray="${effectiveDashArrayPolyline}"` : ''}>${animationContent}</polyline>`;

        // Check for flow particles animation
        const flowParticlesPolyline = getFlowParticlesAnimation(primitive.animations);
        // Check if flow particles animation is enabled via bindings
        const flowParticlesPolylineEnabled = flowParticlesPolyline && this.isAnimationEnabled(
          primitive.id, flowParticlesPolyline.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesPolylineEnabled && flowParticlesPolyline) {
          // Convert polyline points to path data
          const polyConfig = (primitive as PolylinePrimitive).config;
          const polyPoints = polyConfig.points as Position[];
          const pathDataPolyline = 'M ' + polyPoints.map((p: Position) =>
            `${p.x + primitive.position.x},${p.y + primitive.position.y}`
          ).join(' L ');
          const particlesContentPolyline = renderFlowParticles(flowParticlesPolyline.animation, pathDataPolyline, stroke, true);
          shapeSvg = `<g>${polylineShape}${particlesContentPolyline}</g>`;
        } else {
          shapeSvg = polylineShape;
        }
        break;
      }
      case 'group': {
        // For groups: wrap in <g> positioned at center for rotation around center
        const groupBounds = this.getPrimitiveBoundingBox(primitive);
        const cx = groupBounds.x + groupBounds.width / 2;
        const cy = groupBounds.y + groupBounds.height / 2;

        // Regenerate animation content with LOCAL bounds (centered at origin)
        // This is necessary because we use translate(cx, cy) to center the group
        let groupAnimContent = '';
        if (primitive.animations && primitive.animations.length > 0) {
          const localBounds: BoundingBox = {
            x: -groupBounds.width / 2,
            y: -groupBounds.height / 2,
            width: groupBounds.width,
            height: groupBounds.height
          };
          const animContext: AnimationRenderContext = {
            bounds: localBounds,
            animationsEnabled: true,
            propertyValues: {},
            previewMode: !hasAnimationBindings,
            primitiveId: primitive.id,
            animationEnabledStates: hasAnimationBindings ? animationStates : undefined
          };
          groupAnimContent = renderAnimations(primitive.animations, animContext);
        }

        // Render children inside the group so they rotate with it
        const groupConfig = (primitive as GroupPrimitive).config;
        const childrenSvg = this.renderGroupChildrenSvg(groupConfig.childIds, cx, cy);

        // Draw group boundary rect centered at origin, with children inside
        shapeSvg = `<g transform="translate(${cx}, ${cy})">` +
          `<rect x="${-groupBounds.width / 2}" y="${-groupBounds.height / 2}" width="${groupBounds.width}" height="${groupBounds.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${isSelected ? '#1976d2' : stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${isSelected ? 1.5 : strokeWidth}"${isSelected ? ' stroke-dasharray="6 3"' : (strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : '')} pointer-events="all"/>` +
          `${childrenSvg}` +
          `${groupAnimContent}` +
          `</g>`;
        break;
      }
      default:
        // For unsupported types, return empty - template will handle them
        return '';
    }

    return this.sanitizer.bypassSecurityTrustHtml(shapeSvg);
  }

  /**
   * Get SVG transform string for a primitive
   * Applies rotation, scale, and offset transforms from primitive.transform
   */
  getPrimitiveTransform(primitive: PrimitiveBase): string | null {
    const transform = primitive.transform;
    if (!transform) {
      return null;
    }

    const transforms: string[] = [];
    const bbox = this.getPrimitiveBoundingBox(primitive);
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Apply offset
    if (transform.offsetX || transform.offsetY) {
      transforms.push(`translate(${transform.offsetX ?? 0}, ${transform.offsetY ?? 0})`);
    }

    // Apply rotation around center
    if (transform.rotation && transform.rotation !== 0) {
      transforms.push(`rotate(${transform.rotation}, ${centerX}, ${centerY})`);
    }

    // Apply scale around center
    const scaleX = transform.scaleX ?? transform.scale ?? 1;
    const scaleY = transform.scaleY ?? transform.scale ?? 1;
    if (scaleX !== 1 || scaleY !== 1) {
      // Scale around center: translate to center, scale, translate back
      transforms.push(`translate(${centerX}, ${centerY})`);
      transforms.push(`scale(${scaleX}, ${scaleY})`);
      transforms.push(`translate(${-centerX}, ${-centerY})`);
    }

    return transforms.length > 0 ? transforms.join(' ') : null;
  }

  /**
   * Handle resize handle mousedown on a primitive
   */
  onPrimitiveResizeHandleMouseDown(event: MouseEvent, primitive: PrimitiveBase, handle: ResizeHandle): void {
    event.stopPropagation();
    event.preventDefault();

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    const bbox = this.getPrimitiveBoundingBox(primitive);
    const isGroup = primitive.type === 'group';
    const itemType: 'primitive' | 'group' = isGroup ? 'group' : 'primitive';
    let groupChildData: { id: string; type: 'primitive' | 'symbol'; startBounds: { x: number; y: number; width: number; height: number } }[] | undefined;

    // If resizing a group, capture all child bounds
    if (isGroup) {
      const groupConfig = (primitive as GroupPrimitive).config;
      const diagram = this._diagram();
      groupChildData = [];

      for (const childId of groupConfig.childIds) {
        // Check if it's a primitive
        const childPrimitive = (diagram.primitives ?? []).find(p => p.id === childId);
        if (childPrimitive) {
          const childBounds = this.getPrimitiveBoundingBox(childPrimitive);
          groupChildData.push({
            id: childId,
            type: 'primitive',
            startBounds: { ...childBounds }
          });
          continue;
        }

        // Check if it's a symbol
        const childSymbol = (diagram.symbolInstances ?? []).find(s => s.id === childId);
        if (childSymbol) {
          const childBounds = this.getSymbolBounds(childSymbol);
          groupChildData.push({
            id: childId,
            type: 'symbol',
            startBounds: { ...childBounds }
          });
        }
      }
    }

    // Use ResizeService to start primitive/group resize
    this.resizeService.startPrimitiveResize(
      primitive.id,
      itemType,
      handle,
      bbox,
      coords,
      groupChildData
    );
  }

  /**
   * Handle mousedown on a line endpoint handle
   */
  onLineEndpointMouseDown(event: MouseEvent, primitive: PrimitiveBase, endpoint: 'start' | 'end'): void {
    event.stopPropagation();
    event.preventDefault();

    this._lineEndpointDrag.set({
      isDragging: true,
      lineId: primitive.id,
      endpoint
    });
  }

  /**
   * Update a line endpoint position
   */
  private updateLineEndpoint(lineId: string, endpoint: 'start' | 'end', newPosition: Position): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== lineId || p.type !== PrimitiveType.Line) return p;
        const linePrim = p as unknown as { config: { start: Position; end: Position } };
        return {
          ...p,
          config: {
            ...linePrim.config,
            [endpoint]: {
              x: Math.round(newPosition.x - p.position.x),
              y: Math.round(newPosition.y - p.position.y)
            }
          }
        } as PrimitiveBase;
      })
    }));
    this.stateService.markChanged();
  }

  /**
   * Handle mousedown on a polyline/polygon point handle
   */
  onPolyPointMouseDown(event: MouseEvent, primitive: PrimitiveBase, pointIndex: number): void {
    event.stopPropagation();
    event.preventDefault();

    this._polyPointDrag.set({
      isDragging: true,
      primitiveId: primitive.id,
      pointIndex
    });

    // Also select this point for potential deletion
    this._selectedPolyPoint.set({
      primitiveId: primitive.id,
      pointIndex
    });
  }

  /**
   * Update a polyline/polygon point position
   */
  private updatePolyPoint(primitiveId: string, pointIndex: number, newPosition: Position): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== primitiveId) return p;
        if (p.type !== PrimitiveType.Polyline && p.type !== PrimitiveType.Polygon) return p;

        const polyPrim = p as unknown as { config: { points: Position[] } };
        const newPoints = [...polyPrim.config.points];
        newPoints[pointIndex] = {
          x: newPosition.x - p.position.x,
          y: newPosition.y - p.position.y
        };

        return {
          ...p,
          config: {
            ...polyPrim.config,
            points: newPoints
          }
        } as PrimitiveBase;
      })
    }));
    this.stateService.markChanged();
  }

  /**
   * Add a new point to a polyline/polygon at a specific index
   */
  addPolyPoint(primitiveId: string, afterIndex: number, position: Position): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== primitiveId) return p;
        if (p.type !== PrimitiveType.Polyline && p.type !== PrimitiveType.Polygon) return p;

        const polyPrim = p as unknown as { config: { points: Position[] } };
        const newPoints = [...polyPrim.config.points];
        const newPoint = {
          x: position.x - p.position.x,
          y: position.y - p.position.y
        };
        newPoints.splice(afterIndex + 1, 0, newPoint);

        return {
          ...p,
          config: {
            ...polyPrim.config,
            points: newPoints
          }
        } as PrimitiveBase;
      })
    }));
    this.stateService.markChanged();
    this.pushToHistory();
  }

  /**
   * Delete a point from a polyline/polygon
   */
  deletePolyPoint(primitiveId: string, pointIndex: number): void {
    const diagram = this._diagram();
    const primitive = (diagram.primitives ?? []).find(p => p.id === primitiveId);
    if (!primitive) return;

    const polyPrim = primitive as unknown as { config: { points: Position[] } };
    // Need at least 2 points for a polyline, 3 for a polygon
    const minPoints = primitive.type === PrimitiveType.Polygon ? 3 : 2;
    if (polyPrim.config.points.length <= minPoints) return;

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== primitiveId) return p;

        const prim = p as unknown as { config: { points: Position[] } };
        const newPoints = prim.config.points.filter((_, i) => i !== pointIndex);

        return {
          ...p,
          config: {
            ...prim.config,
            points: newPoints
          }
        } as PrimitiveBase;
      })
    }));

    // Clear selection if we deleted the selected point
    const selectedPoint = this._selectedPolyPoint();
    if (selectedPoint && selectedPoint.primitiveId === primitiveId && selectedPoint.pointIndex === pointIndex) {
      this._selectedPolyPoint.set(null);
    }

    this.stateService.markChanged();
    this.pushToHistory();
  }

  /**
   * Delete the currently selected polyline point
   */
  deleteSelectedPolyPoint(): void {
    const selected = this._selectedPolyPoint();
    if (selected) {
      this.deletePolyPoint(selected.primitiveId, selected.pointIndex);
    }
  }

  /**
   * Add a new point to the selected polyline at the given position.
   * Finds the closest segment and inserts the point there.
   */
  addPolyPointAtPosition(position: Position): void {
    const sel = this.selectionService.selection();
    if (sel.elements.size !== 1) return;

    const primitiveId = Array.from(sel.elements)[0];
    const diagram = this._diagram();
    const primitive = (diagram.primitives ?? []).find(p => p.id === primitiveId);
    if (!primitive) return;
    if (primitive.type !== PrimitiveType.Polyline && primitive.type !== PrimitiveType.Polygon) return;

    const polyPrim = primitive as unknown as { config: { points: Position[] } };
    const points = polyPrim.config.points;
    if (points.length < 2) return;

    // Convert click position to be relative to primitive's position
    const relativePos = {
      x: position.x - primitive.position.x,
      y: position.y - primitive.position.y
    };

    // Find the closest segment using geometry service
    const isPolygon = primitive.type === PrimitiveType.Polygon;
    const closestSegmentIndex = this.geometryService.findClosestSegmentIndex(relativePos, points, isPolygon);

    // Add point after the first point of the closest segment
    this.addPolyPoint(primitiveId, closestSegmentIndex, position);
  }

  /**
   * Get the points of a polyline/polygon for rendering handles
   */
  getPolyPoints(primitive: PrimitiveBase): { x: number; y: number; index: number }[] {
    if (primitive.type !== PrimitiveType.Polyline && primitive.type !== PrimitiveType.Polygon) {
      return [];
    }
    const polyPrim = primitive as unknown as { config: { points: Position[] } };
    return polyPrim.config.points.map((pt, index) => ({
      x: pt.x + primitive.position.x,
      y: pt.y + primitive.position.y,
      index
    }));
  }

  /**
   * Check if a polyline point is selected
   */
  isPolyPointSelected(primitiveId: string, pointIndex: number): boolean {
    const selected = this._selectedPolyPoint();
    return selected?.primitiveId === primitiveId && selected?.pointIndex === pointIndex;
  }

  /**
   * Resize a primitive based on new bounds
   */
  resizePrimitive(primitiveId: string, newBounds: { x: number; y: number; width: number; height: number }): void {
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id !== primitiveId) return p;
        return this.primitiveService.resize(p, newBounds);
      })
    }));
    this.stateService.markChanged();
  }

  // ============================================================================
  // SVG Import
  // ============================================================================

  /**
   * Open file picker for SVG import
   */
  onImportSvgClick(): void {
    this.svgFileInputRef?.nativeElement?.click();
  }

  /**
   * Handle file selection from file picker
   */
  onSvgFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      console.warn('Invalid file type. Please select an SVG file.');
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = () => {
      const svgContent = reader.result as string;
      this.importSvgContent(svgContent);

      // Reset input for re-selection of same file
      input.value = '';
    };
    reader.onerror = () => {
      console.error('Error reading SVG file');
    };
    reader.readAsText(file);
  }

  /**
   * Import SVG content and add to diagram
   */
  importSvgContent(svgContent: string, targetPosition?: Position): void {
    // Calculate import position (center of visible canvas if not specified)
    const importPosition = targetPosition ?? this.getVisibleCanvasCenter();

    // Import SVG without position offset - we'll normalize and position manually
    const result = this.svgImportService.importSvg(svgContent, {
      targetPosition: { x: 0, y: 0 },
      idGenerator: () => this.creationService.generateId(),
      namePrefix: 'svg'
    });

    if (result.primitives.length === 0) {
      console.warn('No importable elements found in SVG', result.warnings);
      return;
    }

    // Normalize primitives to start at (0,0) then position at target
    const normalizedPrimitives = this.normalizeSvgPrimitives(result.primitives, importPosition);

    // Log warnings
    if (result.warnings.length > 0) {
      console.warn('SVG import warnings:', result.warnings);
    }

    // Add primitives to diagram
    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: [...(d.primitives ?? []), ...normalizedPrimitives]
    }));

    // Add style classes if any were extracted
    if (result.styleClasses.length > 0) {
      const existingClasses = this._styleClasses();
      const existingNames = new Set(existingClasses.map(c => c.name));

      // Only add classes that don't already exist (by name)
      const newClasses = result.styleClasses.filter(c => !existingNames.has(c.name));

      if (newClasses.length > 0) {
        const mergedClasses = [...existingClasses, ...newClasses];
        this._styleClasses.set(mergedClasses);
        this.styleClassesChange.emit(mergedClasses);
        console.log('Added style classes from SVG import:', newClasses.map(c => c.name));
      }
    }

    // Select imported primitives
    this.selectionService.clearSelection();
    this.selectionService.selectElements(normalizedPrimitives.map(p => p.id));

    // Push to history
    this.pushToHistory();
    this.stateService.markChanged();
  }

  /**
   * Normalize SVG primitives to start at (0,0) then offset to target position
   */
  private normalizeSvgPrimitives(primitives: PrimitiveBase[], targetPosition: Position): PrimitiveBase[] {
    if (primitives.length === 0) return primitives;

    // Calculate current bounds
    let minX = Infinity, minY = Infinity;

    for (const prim of primitives) {
      const bounds = this.boundsService.getPrimitiveBounds(prim);
      console.log('Primitive bounds:', prim.type, prim.id, bounds);
      if (bounds) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
      }
    }

    console.log('Min bounds found:', { minX, minY });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
    }

    // Calculate offset: move to (0,0) then to target
    // Use a fixed small position instead of canvas center for reliability
    const finalTarget = { x: 20, y: 20 };
    const offsetX = finalTarget.x - minX;
    const offsetY = finalTarget.y - minY;

    console.log('Offset to apply:', { offsetX, offsetY, targetPosition, finalTarget });

    // Apply offset to all primitives
    const result = primitives.map(prim => this.offsetPrimitive(prim, offsetX, offsetY));

    console.log('First primitive after offset:', result[0]?.position);

    return result;
  }

  /**
   * Offset a single primitive by dx, dy
   */
  private offsetPrimitive(prim: PrimitiveBase, dx: number, dy: number): PrimitiveBase {
    if (prim.type === 'path') {
      // For paths, transform the d attribute
      const pathPrim = prim as PathPrimitive;
      const transformedD = offsetPathData(pathPrim.config.d, dx, dy);
      return {
        ...pathPrim,
        position: { x: 0, y: 0 },
        config: {
          ...pathPrim.config,
          d: transformedD
        }
      } as PrimitiveBase;
    }

    if (prim.type === 'line') {
      // For lines, offset both start and end
      const linePrim = prim as LinePrimitive;
      return {
        ...linePrim,
        config: {
          ...linePrim.config,
          start: {
            x: linePrim.config.start.x + dx,
            y: linePrim.config.start.y + dy
          },
          end: {
            x: linePrim.config.end.x + dx,
            y: linePrim.config.end.y + dy
          }
        }
      } as PrimitiveBase;
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

  /**
   * Get the center of the visible canvas area
   */
  private getVisibleCanvasCenter(): Position {
    const container = this.canvasContainerRef?.nativeElement;
    if (!container) {
      return { x: 100, y: 100 };
    }

    const zoom = this.stateService.zoom();
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Convert visible center screen position to canvas coordinates
    return {
      x: (scrollLeft + containerWidth / 2) / zoom,
      y: (scrollTop + containerHeight / 2) / zoom
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Convert mouse/drag event coordinates to SVG canvas coordinates.
   * Delegates to DesignerCoordinateService.
   */
  private getCanvasCoordinates(event: { clientX: number; clientY: number }): Position | null {
    // Ensure SVG reference is up to date
    if (!this.coordinateService.hasSvgElement()) {
      this.updateSvgReference();
    }
    return this.coordinateService.getCanvasCoordinates(event);
  }

  /**
   * Snap position to grid if snapping is enabled.
   * Delegates to DesignerCoordinateService.
   */
  private snapPosition(position: Position): Position {
    return this.coordinateService.snapToGrid(position);
  }

  private pushToHistory(): void {
    this.historyService.push(this._diagram());
  }

  private setNestedProperty<T>(obj: T, path: string, value: unknown): T {
    const parts = path.split('.');
    const result = { ...obj } as Record<string, unknown>;
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      // Create empty object if property doesn't exist or is null/undefined
      const existing = current[key];
      if (existing === null || existing === undefined) {
        current[key] = {};
      } else {
        current[key] = { ...(existing as Record<string, unknown>) };
      }
      current = current[key] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return result as T;
  }

  // ============================================================================
  // Symbol Handling Methods
  // ============================================================================

  /**
   * Get the symbol definition for a symbol instance from the cache.
   * Returns undefined if not loaded yet.
   */
  getSymbolDefinition(instance: SymbolInstance): SymbolDefinition | undefined {
    const cached = this._symbolDefinitions();
    return cached.get(instance.symbolRtId);
  }

  /**
   * Get all primitives for a symbol, including primitives from nested symbol instances.
   * Returns primitives with positions already transformed.
   *
   * @param symbolDef - The symbol definition
   * @param instancePropertyValues - Optional property values passed to the symbol instance.
   *                                 Used for "Pass to child property" bindings.
   */
  getSymbolPrimitives(symbolDef: SymbolDefinition, instancePropertyValues?: Record<string, unknown>): PrimitiveBase[] {
    const result: PrimitiveBase[] = [];

    // Apply property bindings to primitives if we have property values
    let primitives = symbolDef.primitives ?? [];
    if (instancePropertyValues && symbolDef.propertyBindings && symbolDef.transformProperties) {
      primitives = this.applyPropertyBindingsToPrimitives(primitives, symbolDef, instancePropertyValues);
    }

    // Add direct primitives
    result.push(...primitives);

    // Add primitives from nested symbol instances (recursively)
    if (symbolDef.symbolInstances) {
      // Calculate property values for each nested symbol instance
      const nestedPropertyValues = this.calculateNestedSymbolPropertyValues(symbolDef, instancePropertyValues);

      for (const nestedInst of symbolDef.symbolInstances) {
        const nestedDef = this._symbolDefinitions().get(nestedInst.symbolRtId);
        if (nestedDef) {
          const scale = nestedInst.scale ?? 1;

          // Merge instance's own propertyValues with calculated pass-through values
          const mergedPropertyValues = {
            ...nestedInst.propertyValues,
            ...nestedPropertyValues.get(nestedInst.id)
          };

          // Get primitives from nested symbol (recursively), passing property values
          const nestedPrimitives = this.getSymbolPrimitives(nestedDef, mergedPropertyValues);

          for (const prim of nestedPrimitives) {
            // Create a transformed copy
            const transformedPrim: PrimitiveBase & { _instanceScale?: number } = {
              ...prim,
              id: `${nestedInst.id}_${prim.id}`,
              position: {
                x: nestedInst.position.x + prim.position.x * scale,
                y: nestedInst.position.y + prim.position.y * scale
              },
              _instanceScale: scale
            };

            // Transform polygon/polyline points if needed
            if ((prim.type === 'polygon' || prim.type === 'polyline') && (prim as PolygonPrimitive).config?.points) {
              (transformedPrim as PolygonPrimitive).config = {
                ...(prim as PolygonPrimitive).config,
                points: (prim as PolygonPrimitive).config.points.map(p => ({
                  x: p.x * scale,
                  y: p.y * scale
                }))
              };
            }

            // Transform line start/end if needed
            if (prim.type === 'line' && (prim as LinePrimitive).config) {
              (transformedPrim as LinePrimitive).config = {
                ...(prim as LinePrimitive).config,
                start: {
                  x: ((prim as LinePrimitive).config.start?.x ?? 0) * scale,
                  y: ((prim as LinePrimitive).config.start?.y ?? 0) * scale
                },
                end: {
                  x: ((prim as LinePrimitive).config.end?.x ?? 0) * scale,
                  y: ((prim as LinePrimitive).config.end?.y ?? 0) * scale
                }
              };
            }

            // Scale rectangle/ellipse dimensions if needed
            if (prim.type === 'rectangle' && (prim as RectanglePrimitive).config) {
              (transformedPrim as RectanglePrimitive).config = {
                ...(prim as RectanglePrimitive).config,
                width: ((prim as RectanglePrimitive).config.width ?? 100) * scale,
                height: ((prim as RectanglePrimitive).config.height ?? 80) * scale,
                cornerRadius: ((prim as RectanglePrimitive).config.cornerRadius ?? 0) * scale
              };
            }

            if (prim.type === 'ellipse' && (prim as EllipsePrimitive).config) {
              (transformedPrim as EllipsePrimitive).config = {
                ...(prim as EllipsePrimitive).config,
                radiusX: ((prim as EllipsePrimitive).config.radiusX ?? 50) * scale,
                radiusY: ((prim as EllipsePrimitive).config.radiusY ?? 40) * scale
              };
            }

            // Scale text font size if needed
            if (prim.type === 'text' && (prim as TextPrimitive).config?.textStyle) {
              (transformedPrim as TextPrimitive).config = {
                ...(prim as TextPrimitive).config,
                textStyle: {
                  ...(prim as TextPrimitive).config.textStyle,
                  fontSize: ((prim as TextPrimitive).config.textStyle!.fontSize ?? 14) * scale
                }
              };
            }

            result.push(transformedPrim);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get symbol primitives with direct effects applied from diagram-level bindings.
   * This wraps getSymbolPrimitives and applies effects like fillLevel, style changes, etc.
   * that were bound to the symbol instance via diagram-level property bindings.
   *
   * @param symbolInstance - The symbol instance being rendered
   * @param symbolDef - The symbol definition
   * @param instancePropertyValues - Property values passed to the symbol instance
   */
  getSymbolPrimitivesWithDirectEffects(
    symbolInstance: SymbolInstance,
    symbolDef: SymbolDefinition,
    instancePropertyValues?: Record<string, unknown>
  ): PrimitiveBase[] {
    // Get the base primitives
    let primitives = this.getSymbolPrimitives(symbolDef, instancePropertyValues);

    // Get direct effects for this symbol instance
    const directEffects = this.symbolInstanceDirectEffects().get(symbolInstance.id);
    if (!directEffects || Object.keys(directEffects).length === 0) {
      return primitives;
    }

    // Apply direct effects to all applicable primitives
    primitives = primitives.map(prim => {
      // Clone the primitive
      let modified = JSON.parse(JSON.stringify(prim)) as PrimitiveBase;

      // Apply each effect
      for (const [effectType, value] of Object.entries(directEffects)) {
        modified = this.applyBindingEffect(modified, effectType, value);
      }

      return modified;
    });

    return primitives;
  }

  /**
   * Evaluate animation.enabled bindings for a symbol definition given property values.
   * Returns a map of "targetId:animationId" -> enabled state.
   *
   * @param symbolDef - The symbol definition containing propertyBindings and transformProperties
   * @param propertyValues - The property values (passed from parent or simulation)
   */
  evaluateSymbolAnimationEnabledStates(
    symbolDef: SymbolDefinition,
    propertyValues: Record<string, unknown>
  ): Record<string, boolean> {
    const states: Record<string, boolean> = {};

    if (!symbolDef.propertyBindings || !symbolDef.transformProperties) {
      return states;
    }

    // Filter bindings that control animations
    const animationBindings = symbolDef.propertyBindings.filter(
      b => b.effectType === 'animation.enabled' && b.animationId
    );

    if (animationBindings.length === 0) {
      return states;
    }

    // Build context with property values
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of symbolDef.transformProperties) {
      const val = propertyValues[prop.id] ?? prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Evaluate each animation binding
    for (const binding of animationBindings) {
      const property = symbolDef.transformProperties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Set 'value' to the current property value
      const propValue = propertyValues[property.id] ?? property.defaultValue;
      if (typeof propValue === 'number') context['value'] = propValue;
      else if (typeof propValue === 'string') context['value'] = propValue;
      else if (typeof propValue === 'boolean') context['value'] = propValue;

      // Evaluate the expression
      const result = this.expressionEvaluator.evaluate(binding.expression, context);
      if (result.success && binding.animationId) {
        const key = `${binding.targetId}:${binding.animationId}`;
        states[key] = Boolean(result.value);
      }
    }

    return states;
  }

  /**
   * Get SVG for a symbol primitive including animations.
   * Used for symbol primitives with animations, evaluating animation.enabled bindings using passed property values.
   *
   * @param primitive - The primitive to render
   * @param symbolDef - The symbol definition (for evaluating animation bindings)
   * @param propertyValues - The property values passed to the symbol instance
   * @param styleClasses - Optional style classes from the symbol
   * @param allPrimitives - Optional array of all processed primitives (for finding group children)
   */
  getSymbolPrimitiveWithAnimationsSvg(
    primitive: PrimitiveBase,
    symbolDef: SymbolDefinition,
    propertyValues: Record<string, unknown>,
    styleClasses?: StyleClass[],
    allPrimitives?: PrimitiveBase[]
  ): SafeHtml {
    const bbox = this.getPrimitiveBoundingBox(primitive);

    // Evaluate animation states using the symbol's bindings and passed property values
    const animationStates = this.evaluateSymbolAnimationEnabledStates(symbolDef, propertyValues);
    const hasAnimationBindings = Object.keys(animationStates).length > 0;

    // Check if we have scale animations
    const hasScale = this.hasScaleAnimations(primitive);

    // Generate animation content if animations exist
    let animationContent = '';
    if (primitive.animations && primitive.animations.length > 0) {
      const animContext: AnimationRenderContext = {
        bounds: bbox,
        animationsEnabled: true,
        propertyValues: {},
        // Use previewMode only if there are NO animation bindings
        previewMode: !hasAnimationBindings,
        primitiveId: primitive.id,
        animationEnabledStates: hasAnimationBindings ? animationStates : undefined
      };
      animationContent = renderAnimations(primitive.animations, animContext);
    }

    // Generate the shape SVG based on type
    let shapeSvg = '';
    // Resolve style using symbol's styleClasses
    const resolvedStyle = this.resolveStyleWithClasses(primitive, styleClasses);
    const fill = resolvedStyle?.fill?.color ?? 'none';
    const fillOpacity = resolvedStyle?.fill?.opacity ?? 1;
    const stroke = resolvedStyle?.stroke?.color ?? 'none';
    const strokeOpacity = resolvedStyle?.stroke?.opacity ?? 1;
    const strokeWidth = resolvedStyle?.stroke?.width ?? 1;
    const strokeDashArray = this.getStrokeDashArray(resolvedStyle?.stroke?.dashArray);

    switch (primitive.type) {
      case 'rectangle': {
        const config = (primitive as RectanglePrimitive).config;
        const rx = config.cornerRadiusX ?? config.cornerRadius ?? 0;
        const ry = config.cornerRadiusY ?? config.cornerRadius ?? 0;
        const fillLevel = primitive.fillLevel;

        if (fillLevel !== undefined && fillLevel >= 0 && fillLevel <= 1) {
          const clipId = `sym-fill-clip-${primitive.id}`;
          const clipY = primitive.position.y + config.height * (1 - fillLevel);
          const clipHeight = config.height * fillLevel;

          if (hasScale) {
            const cx = primitive.position.x + config.width / 2;
            const cy = primitive.position.y + config.height / 2;
            const localClipY = -config.height / 2 + config.height * (1 - fillLevel);
            shapeSvg = `<g transform="translate(${cx}, ${cy})">` +
              `<defs><clipPath id="${clipId}"><rect x="${-config.width / 2}" y="${localClipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          } else {
            shapeSvg = `<g>` +
              `<defs><clipPath id="${clipId}"><rect x="${primitive.position.x}" y="${clipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          }
        } else if (hasScale) {
          const cx = primitive.position.x + config.width / 2;
          const cy = primitive.position.y + config.height / 2;
          shapeSvg = `<g transform="translate(${cx}, ${cy})"><rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect></g>`;
        } else {
          shapeSvg = `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect>`;
        }
        break;
      }
      case 'ellipse': {
        const config = (primitive as EllipsePrimitive).config;
        if (hasScale) {
          shapeSvg = `<g transform="translate(${primitive.position.x}, ${primitive.position.y})"><ellipse cx="0" cy="0" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse></g>`;
        } else {
          shapeSvg = `<ellipse cx="${primitive.position.x}" cy="${primitive.position.y}" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse>`;
        }
        break;
      }
      case 'path': {
        const pathConfig = (primitive as PathPrimitive).config;
        const pathShape = `<path d="${pathConfig.d}" transform="translate(${primitive.position.x},${primitive.position.y})" fill="${fill}" fill-opacity="${fillOpacity}"${pathConfig.fillRule ? ` fill-rule="${pathConfig.fillRule}"` : ''} stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</path>`;

        // Check for flow particles animation
        const flowParticlesPath = getFlowParticlesAnimation(primitive.animations);
        const flowParticlesPathEnabled = flowParticlesPath && this.isAnimationEnabled(
          primitive.id, flowParticlesPath.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesPathEnabled && flowParticlesPath) {
          const particlesContentPath = renderFlowParticles(flowParticlesPath.animation, pathConfig.d, stroke, true);
          shapeSvg = `<g>${pathShape}<g transform="translate(${primitive.position.x},${primitive.position.y})">${particlesContentPath}</g></g>`;
        } else {
          shapeSvg = pathShape;
        }
        break;
      }
      case 'polygon': {
        const points = this.getPolygonPoints(primitive as PolygonPrimitive);
        shapeSvg = `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</polygon>`;
        break;
      }
      case 'line': {
        const config = (primitive as LinePrimitive).config;
        const x1 = config.start.x + primitive.position.x;
        const y1 = config.start.y + primitive.position.y;
        const x2 = config.end.x + primitive.position.x;
        const y2 = config.end.y + primitive.position.y;
        const hasFlowAnimation = primitive.animations?.some(a =>
          a.animation.type === 'animate' && (a.animation as AttributeAnimation).attributeName === 'stroke-dashoffset'
        );
        const effectiveDashArray = strokeDashArray || (hasFlowAnimation ? '10 5' : '');
        const lineShape = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${effectiveDashArray ? ` stroke-dasharray="${effectiveDashArray}"` : ''}>${animationContent}</line>`;

        const flowParticles = getFlowParticlesAnimation(primitive.animations);
        const flowParticlesEnabled = flowParticles && this.isAnimationEnabled(
          primitive.id, flowParticles.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesEnabled && flowParticles) {
          const pathData = `M ${x1},${y1} L ${x2},${y2}`;
          const particlesContent = renderFlowParticles(flowParticles.animation, pathData, stroke, true);
          shapeSvg = `<g>${lineShape}${particlesContent}</g>`;
        } else {
          shapeSvg = lineShape;
        }
        break;
      }
      case 'polyline': {
        const polylinePoints = this.getPolylinePoints(primitive as PolylinePrimitive);
        const hasFlowAnimationPolyline = primitive.animations?.some(a =>
          a.animation.type === 'animate' && (a.animation as AttributeAnimation).attributeName === 'stroke-dashoffset'
        );
        const effectiveDashArrayPolyline = strokeDashArray || (hasFlowAnimationPolyline ? '10 5' : '');
        const polylineShape = `<polyline points="${polylinePoints}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${effectiveDashArrayPolyline ? ` stroke-dasharray="${effectiveDashArrayPolyline}"` : ''}>${animationContent}</polyline>`;

        const flowParticlesPolyline = getFlowParticlesAnimation(primitive.animations);
        const flowParticlesPolylineEnabled = flowParticlesPolyline && this.isAnimationEnabled(
          primitive.id, flowParticlesPolyline.definition.id, animationStates, hasAnimationBindings
        );
        if (flowParticlesPolylineEnabled && flowParticlesPolyline) {
          const polyConfig = (primitive as PolylinePrimitive).config;
          const polyPoints = polyConfig.points as Position[];
          const pathDataPolyline = 'M ' + polyPoints.map((p: Position) =>
            `${p.x + primitive.position.x},${p.y + primitive.position.y}`
          ).join(' L ');
          const particlesContentPolyline = renderFlowParticles(flowParticlesPolyline.animation, pathDataPolyline, stroke, true);
          shapeSvg = `<g>${polylineShape}${particlesContentPolyline}</g>`;
        } else {
          shapeSvg = polylineShape;
        }
        break;
      }
      case 'text': {
        const textConfig = (primitive as TextPrimitive).config;
        const textColor = textConfig.textStyle?.color ?? '#333';
        const fontSize = textConfig.textStyle?.fontSize ?? 14;
        const fontFamily = textConfig.textStyle?.fontFamily ?? 'Arial, sans-serif';
        const content = this.escapeXml(textConfig.content ?? '');
        shapeSvg = `<text x="${primitive.position.x}" y="${primitive.position.y}" fill="${textColor}" font-size="${fontSize}" font-family="${fontFamily}">${content}${animationContent}</text>`;
        break;
      }
      case 'group': {
        // For groups: wrap children in <g> positioned at center for rotation/scale around center
        const groupBounds = bbox;
        const cx = groupBounds.x + groupBounds.width / 2;
        const cy = groupBounds.y + groupBounds.height / 2;

        // Regenerate animation content with LOCAL bounds (centered at origin)
        // This is necessary because we use translate(cx, cy) to center the group
        let groupAnimContent = '';
        if (primitive.animations && primitive.animations.length > 0) {
          const localBounds: BoundingBox = {
            x: -groupBounds.width / 2,
            y: -groupBounds.height / 2,
            width: groupBounds.width,
            height: groupBounds.height
          };
          const animContext: AnimationRenderContext = {
            bounds: localBounds,
            animationsEnabled: true,
            propertyValues: {},
            previewMode: !hasAnimationBindings,
            primitiveId: primitive.id,
            animationEnabledStates: hasAnimationBindings ? animationStates : undefined
          };
          groupAnimContent = renderAnimations(primitive.animations, animContext);
        }

        // Get children from the group and render them inside the animated container
        const groupConfig = (primitive as GroupPrimitive).config;
        const childIds = new Set<string>(groupConfig?.childIds ?? []);
        let childrenSvg = '';

        if (childIds.size > 0) {
          // Use allPrimitives if provided, otherwise fall back to symbolDef.primitives with effects applied
          const primitivesToSearch = allPrimitives ??
            this.applyPropertyBindingsToPrimitives(symbolDef?.primitives ?? [], symbolDef, propertyValues);

          // Render each child primitive
          for (const childPrimitive of primitivesToSearch) {
            if (childIds.has(childPrimitive.id) && childPrimitive.visible !== false) {
              const childSvg = this.renderSymbolPrimitiveInternalSvg(
                childPrimitive,
                symbolDef,
                propertyValues,
                styleClasses,
                animationStates,
                hasAnimationBindings
              );
              childrenSvg += childSvg;
            }
          }
        }

        // Structure: outer container at center -> animation content -> children offset back to original coords
        shapeSvg = `<g transform="translate(${cx}, ${cy})">` +
          `${groupAnimContent}` +
          `<g transform="translate(${-cx}, ${-cy})">${childrenSvg}</g>` +
          `</g>`;
        break;
      }
      default: {
        shapeSvg = '';
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(shapeSvg);
  }

  /**
   * Check if a symbol primitive has animations.
   */
  symbolPrimitiveHasAnimations(primitive: PrimitiveBase): boolean {
    return !!(primitive.animations && primitive.animations.length > 0);
  }

  /**
   * Get the set of primitive IDs that are children of animated groups in a symbol.
   * These should be skipped in the top-level rendering since they're rendered inside their group.
   */
  getAnimatedGroupChildIds(symbolDef: SymbolDefinition): Set<string> {
    const childIds = new Set<string>();
    if (!symbolDef?.primitives) return childIds;

    for (const primitive of symbolDef.primitives) {
      if (primitive.type === 'group' && primitive.animations && primitive.animations.length > 0) {
        const groupConfig = (primitive as GroupPrimitive).config;
        if (groupConfig?.childIds) {
          for (const childId of groupConfig.childIds) {
            childIds.add(childId);
          }
        }
      }
    }
    return childIds;
  }

  /**
   * Render a symbol primitive to raw SVG string (for recursion inside groups).
   * This is an internal method used by getSymbolPrimitiveWithAnimationsSvg.
   */
  private renderSymbolPrimitiveInternalSvg(
    primitive: PrimitiveBase,
    symbolDef: SymbolDefinition,
    propertyValues: Record<string, unknown>,
    styleClasses?: StyleClass[],
    animationStates?: Record<string, boolean>,
    hasAnimationBindings?: boolean
  ): string {
    const bbox = this.getPrimitiveBoundingBox(primitive);

    // Use provided animation states or evaluate them
    const states = animationStates ?? this.evaluateSymbolAnimationEnabledStates(symbolDef, propertyValues);
    const hasBindings = hasAnimationBindings ?? Object.keys(states).length > 0;

    // Check if we have scale animations
    const hasScale = this.hasScaleAnimations(primitive);

    // Generate animation content if animations exist
    let animationContent = '';
    if (primitive.animations && primitive.animations.length > 0) {
      const animContext: AnimationRenderContext = {
        bounds: bbox,
        animationsEnabled: true,
        propertyValues: {},
        previewMode: !hasBindings,
        primitiveId: primitive.id,
        animationEnabledStates: hasBindings ? states : undefined
      };
      animationContent = renderAnimations(primitive.animations, animContext);
    }

    // Resolve style using symbol's styleClasses
    const resolvedStyle = this.resolveStyleWithClasses(primitive, styleClasses);
    const fill = resolvedStyle?.fill?.color ?? 'none';
    const fillOpacity = resolvedStyle?.fill?.opacity ?? 1;
    const stroke = resolvedStyle?.stroke?.color ?? 'none';
    const strokeOpacity = resolvedStyle?.stroke?.opacity ?? 1;
    const strokeWidth = resolvedStyle?.stroke?.width ?? 1;
    const strokeDashArray = this.getStrokeDashArray(resolvedStyle?.stroke?.dashArray);

    let shapeSvg = '';
    switch (primitive.type) {
      case 'rectangle': {
        const config = (primitive as RectanglePrimitive).config;
        const rx = config.cornerRadiusX ?? config.cornerRadius ?? 0;
        const ry = config.cornerRadiusY ?? config.cornerRadius ?? 0;
        const fillLevel = primitive.fillLevel;

        if (fillLevel !== undefined && fillLevel >= 0 && fillLevel <= 1) {
          const clipId = `sym-fill-clip-int-${primitive.id}`;
          const clipY = primitive.position.y + config.height * (1 - fillLevel);
          const clipHeight = config.height * fillLevel;

          if (hasScale) {
            const cx = primitive.position.x + config.width / 2;
            const cy = primitive.position.y + config.height / 2;
            const localClipY = -config.height / 2 + config.height * (1 - fillLevel);
            shapeSvg = `<g transform="translate(${cx}, ${cy})">` +
              `<defs><clipPath id="${clipId}"><rect x="${-config.width / 2}" y="${localClipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          } else {
            shapeSvg = `<g>` +
              `<defs><clipPath id="${clipId}"><rect x="${primitive.position.x}" y="${clipY}" width="${config.width}" height="${clipHeight}"/></clipPath></defs>` +
              `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''} clip-path="url(#${clipId})">${animationContent}</rect></g>`;
          }
        } else if (hasScale) {
          const cx = primitive.position.x + config.width / 2;
          const cy = primitive.position.y + config.height / 2;
          shapeSvg = `<g transform="translate(${cx}, ${cy})"><rect x="${-config.width / 2}" y="${-config.height / 2}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect></g>`;
        } else {
          shapeSvg = `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${config.width}" height="${config.height}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}${rx ? ` rx="${rx}"` : ''}${ry ? ` ry="${ry}"` : ''}>${animationContent}</rect>`;
        }
        break;
      }
      case 'ellipse': {
        const config = (primitive as EllipsePrimitive).config;
        if (hasScale) {
          shapeSvg = `<g transform="translate(${primitive.position.x}, ${primitive.position.y})"><ellipse cx="0" cy="0" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse></g>`;
        } else {
          shapeSvg = `<ellipse cx="${primitive.position.x}" cy="${primitive.position.y}" rx="${config.radiusX}" ry="${config.radiusY}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</ellipse>`;
        }
        break;
      }
      case 'path': {
        const pathConfig = (primitive as PathPrimitive).config;
        shapeSvg = `<path d="${pathConfig.d}" transform="translate(${primitive.position.x},${primitive.position.y})" fill="${fill}" fill-opacity="${fillOpacity}"${pathConfig.fillRule ? ` fill-rule="${pathConfig.fillRule}"` : ''} stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</path>`;
        break;
      }
      case 'line': {
        const lineConfig = (primitive as LinePrimitive).config;
        shapeSvg = `<line x1="${lineConfig.start.x + primitive.position.x}" y1="${lineConfig.start.y + primitive.position.y}" x2="${lineConfig.end.x + primitive.position.x}" y2="${lineConfig.end.y + primitive.position.y}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</line>`;
        break;
      }
      case 'polygon': {
        const polyConfig = (primitive as PolygonPrimitive).config;
        const points = polyConfig.points.map((p: Position) =>
          `${p.x + primitive.position.x},${p.y + primitive.position.y}`
        ).join(' ');
        shapeSvg = `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</polygon>`;
        break;
      }
      case 'polyline': {
        const polyConfig = (primitive as PolylinePrimitive).config;
        const points = polyConfig.points.map((p: Position) =>
          `${p.x + primitive.position.x},${p.y + primitive.position.y}`
        ).join(' ');
        shapeSvg = `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}"${strokeDashArray ? ` stroke-dasharray="${strokeDashArray}"` : ''}>${animationContent}</polyline>`;
        break;
      }
      case 'text': {
        const textConfig = (primitive as TextPrimitive).config;
        const textColor = textConfig.textStyle?.color ?? '#333';
        const fontSize = textConfig.textStyle?.fontSize ?? 14;
        const fontFamily = textConfig.textStyle?.fontFamily ?? 'Arial, sans-serif';
        const content = this.escapeXml(textConfig.content ?? '');
        shapeSvg = `<text x="${primitive.position.x}" y="${primitive.position.y}" fill="${textColor}" font-size="${fontSize}" font-family="${fontFamily}">${content}${animationContent}</text>`;
        break;
      }
      case 'image': {
        const imgConfig = (primitive as ImagePrimitive).config;
        const width = imgConfig.width ?? 100;
        const height = imgConfig.height ?? 100;
        const src = imgConfig.src;
        const sourceType = imgConfig.sourceType;

        if (src) {
          if (sourceType === 'svg') {
            // For SVG content, embed it using foreignObject
            shapeSvg = `<g transform="translate(${primitive.position.x}, ${primitive.position.y})">` +
              `<foreignObject x="0" y="0" width="${width}" height="${height}">${src}</foreignObject>` +
              `${animationContent}` +
              `</g>`;
          } else {
            // For URL or data URL, use image element
            const preserveAspectRatio = imgConfig.preserveAspectRatio !== false ? 'xMidYMid meet' : 'none';
            const safeSrc = src.startsWith('data:') ? src : this.escapeXml(src);
            shapeSvg = `<image x="${primitive.position.x}" y="${primitive.position.y}" width="${width}" height="${height}" href="${safeSrc}" preserveAspectRatio="${preserveAspectRatio}">${animationContent}</image>`;
          }
        } else {
          // Placeholder for missing image
          shapeSvg = `<rect x="${primitive.position.x}" y="${primitive.position.y}" width="${width}" height="${height}" fill="#f0f0f0" stroke="#ccc" stroke-width="1">${animationContent}</rect>`;
        }
        break;
      }
      default:
        shapeSvg = '';
    }
    return shapeSvg;
  }

  /**
   * Apply property bindings to primitives based on property values.
   * This evaluates bindings and modifies primitives accordingly.
   */
  private applyPropertyBindingsToPrimitives(
    primitives: PrimitiveBase[],
    symbolDef: SymbolDefinition,
    propertyValues: Record<string, unknown>
  ): PrimitiveBase[] {
    if (!symbolDef.propertyBindings || !symbolDef.transformProperties) {
      return primitives;
    }

    // Build expression context with all property values
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of symbolDef.transformProperties) {
      const val = propertyValues[prop.id] ?? prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Filter primitive bindings (not symbolInstance bindings)
    const primitiveBindings = symbolDef.propertyBindings.filter(
      b => b.targetType === 'primitive'
    );

    if (primitiveBindings.length === 0) {
      return primitives;
    }

    // Clone and modify primitives
    return primitives.map(prim => {
      const relevantBindings = primitiveBindings.filter(b => b.targetId === prim.id);
      if (relevantBindings.length === 0) {
        return prim;
      }

      // Clone the primitive
      let modified = JSON.parse(JSON.stringify(prim)) as PrimitiveBase;

      for (const binding of relevantBindings) {
        const property = symbolDef.transformProperties!.find(p => p.id === binding.propertyId);
        if (!property) {
          continue;
        }

        // Set 'value' to the current property value
        const propValue = propertyValues[property.id] ?? property.defaultValue;
        if (typeof propValue === 'number') context['value'] = propValue;
        else if (typeof propValue === 'string') context['value'] = propValue;
        else if (typeof propValue === 'boolean') context['value'] = propValue;

        // Evaluate the expression
        const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
        if (evalResult.success) {
          modified = this.applyBindingEffect(modified, binding.effectType, evalResult.value);
        }
      }

      return modified;
    });
  }

  /**
   * Apply diagram-level property bindings to primitives based on simulation values.
   * Used for diagram mode simulation to preview binding effects.
   */
  private applyDiagramBindingsToPrimitives(primitives: PrimitiveBase[]): PrimitiveBase[] {
    const properties = this._diagramTransformProperties();
    const bindings = this._diagramPropertyBindings();
    const simValues = this._diagramSimulationValues();

    if (!properties.length || !bindings.length) {
      return primitives;
    }

    // Build expression context with all property values
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of properties) {
      const val = simValues[prop.id] ?? prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Filter primitive bindings (not symbolInstance bindings)
    const primitiveBindings = bindings.filter(
      b => b.targetType === 'primitive'
    );

    if (primitiveBindings.length === 0) {
      return primitives;
    }

    // Clone and modify primitives
    return primitives.map(prim => {
      const relevantBindings = primitiveBindings.filter(b => b.targetId === prim.id);
      if (relevantBindings.length === 0) {
        return prim;
      }

      // Clone the primitive
      let modified = JSON.parse(JSON.stringify(prim)) as PrimitiveBase;

      for (const binding of relevantBindings) {
        const property = properties.find(p => p.id === binding.propertyId);
        if (!property) {
          continue;
        }

        // Set 'value' to the current property value
        const propValue = simValues[property.id] ?? property.defaultValue;
        if (typeof propValue === 'number') context['value'] = propValue;
        else if (typeof propValue === 'string') context['value'] = propValue;
        else if (typeof propValue === 'boolean') context['value'] = propValue;

        // Evaluate the expression
        const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
        if (evalResult.success) {
          modified = this.applyBindingEffect(modified, binding.effectType, evalResult.value);
        }
      }

      return modified;
    });
  }

  /**
   * Calculate property values for nested symbol instances based on "Pass to child property" bindings.
   */
  private calculateNestedSymbolPropertyValues(
    symbolDef: SymbolDefinition,
    parentPropertyValues?: Record<string, unknown>
  ): Map<string, Record<string, unknown>> {
    const result = new Map<string, Record<string, unknown>>();

    if (!symbolDef.propertyBindings || !symbolDef.transformProperties || !parentPropertyValues) {
      return result;
    }

    // Build expression context
    const context: Record<string, number | string | boolean> = { value: 0 };
    for (const prop of symbolDef.transformProperties) {
      const val = parentPropertyValues[prop.id] ?? prop.defaultValue;
      if (typeof val === 'number') context[prop.id] = val;
      else if (typeof val === 'string') context[prop.id] = val;
      else if (typeof val === 'boolean') context[prop.id] = val;
      else context[prop.id] = 0;
    }

    // Filter pass-through bindings
    const propertyBindings = symbolDef.propertyBindings.filter(
      b => b.targetType === 'symbolInstance' && b.effectType === 'property' && b.targetPropertyId
    );

    for (const binding of propertyBindings) {
      const property = symbolDef.transformProperties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Set 'value' to the current property value
      const propValue = parentPropertyValues[property.id] ?? property.defaultValue;
      if (typeof propValue === 'number') context['value'] = propValue;
      else if (typeof propValue === 'string') context['value'] = propValue;
      else if (typeof propValue === 'boolean') context['value'] = propValue;

      const evalResult = this.expressionEvaluator.evaluate(binding.expression, context);
      if (evalResult.success && binding.targetPropertyId) {
        if (!result.has(binding.targetId)) {
          result.set(binding.targetId, {});
        }
        result.get(binding.targetId)![binding.targetPropertyId] = evalResult.value;
      }
    }

    return result;
  }

  /**
   * Apply a single binding effect to a primitive.
   * Similar to SymbolRenderer.applyBindingEffect but used for editor preview.
   */
  private applyBindingEffect(
    primitive: PrimitiveBase,
    effectType: string,
    value: unknown
  ): PrimitiveBase {
    // Ensure nested objects exist
    if (!primitive.transform) {
      primitive.transform = {};
    }
    if (!primitive.style) {
      primitive.style = {};
    }
    if (!primitive.style.fill) {
      primitive.style.fill = {};
    }
    if (!primitive.style.stroke) {
      primitive.style.stroke = {};
    }

    switch (effectType) {
      case 'transform.rotation':
        primitive.transform.rotation = Number(value);
        break;
      case 'transform.offsetX':
        primitive.transform.offsetX = Number(value);
        break;
      case 'transform.offsetY':
        primitive.transform.offsetY = Number(value);
        break;
      case 'transform.scale':
        primitive.transform.scale = Number(value);
        break;
      case 'transform.scaleX':
        primitive.transform.scaleX = Number(value);
        break;
      case 'transform.scaleY':
        primitive.transform.scaleY = Number(value);
        break;
      case 'style.fill.color':
        primitive.style.fill.color = String(value);
        break;
      case 'style.fill.opacity':
        primitive.style.fill.opacity = Number(value);
        break;
      case 'style.stroke.color':
        primitive.style.stroke.color = String(value);
        break;
      case 'style.stroke.opacity':
        primitive.style.stroke.opacity = Number(value);
        break;
      case 'style.opacity':
        primitive.style.opacity = Number(value);
        break;
      case 'visible':
        primitive.visible = Boolean(value);
        break;
      case 'fillLevel':
        primitive.fillLevel = Math.max(0, Math.min(1, Number(value)));
        break;
    }

    return primitive;
  }

  /**
   * Check if a symbol instance is selected
   */
  isSymbolSelected(symbolId: string): boolean {
    return this.selectionService.isSymbolSelected(symbolId);
  }

  /**
   * Select a symbol instance
   */
  selectSymbol(symbolId: string, addToSelection = false): void {
    this.selectionService.selectSymbol(symbolId, addToSelection);
  }

  /**
   * Handle mouse down on a symbol instance
   */
  onSymbolMouseDown(event: MouseEvent, symbol: SymbolInstance): void {
    event.stopPropagation();

    // In pan mode, start panning instead of selecting/dragging
    if (this.stateService.mode() === 'pan') {
      this.startPanning(event);
      return;
    }

    if (this.stateService.mode() === 'select') {
      const addToSelection = event.ctrlKey || event.metaKey || event.shiftKey;
      const diagram = this._diagram();

      // Check if symbol is in a group - if so, select the group instead
      const group = this.selectionService.findGroupForItem(symbol.id, diagram);
      const effectiveId = group ? group.id : symbol.id;
      const effectivePosition = group ? group.position : symbol.position;

      // Handle selection based on current state and modifier keys
      const alreadySelected = group
        ? this.isPrimitiveSelected(effectiveId)
        : this.isSymbolSelected(symbol.id);
      const hasMultiSelection = this.selectionService.selection().elements.size > 1;

      // Clear any previous pending selection
      this._pendingSingleSelection = null;

      if (!alreadySelected) {
        // Item not selected - select it (replacing current selection unless modifier held)
        if (group) {
          this.selectPrimitive(effectiveId, addToSelection);
        } else {
          this.selectSymbol(symbol.id, addToSelection);
        }
      } else if (addToSelection) {
        // Item already selected with modifier - toggle it off
        this.selectionService.deselectElement(effectiveId);
      } else if (hasMultiSelection) {
        // Item is part of a multi-selection, clicked without modifier.
        // Don't change selection yet (preserve multi-selection for potential drag).
        // Instead, mark this as pending - if no drag occurs, reduce to single selection.
        this._pendingSingleSelection = effectiveId;
      }
      // else: Item is the only selected item - no change needed

      // Start drag using DragService
      const coords = this.getCanvasCoordinates(event);
      if (coords) {
        const itemType = group ? 'group' : 'symbol';
        this.dragService.startDrag(effectiveId, itemType, effectivePosition, coords);
      }
    }
  }

  /**
   * Handle context menu on a symbol instance
   */
  onSymbolContextMenu(event: MouseEvent, symbol: SymbolInstance): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isSymbolSelected(symbol.id)) {
      this.selectSymbol(symbol.id, event.ctrlKey || event.metaKey || event.shiftKey);
    }

    const canvasCoords = this.getCanvasCoordinates(event);
    this.contextMenuService.show({ x: event.clientX, y: event.clientY }, canvasCoords);
  }

  /**
   * Handle resize handle mouse down on a symbol instance
   */
  onSymbolResizeHandleMouseDown(event: MouseEvent, symbol: SymbolInstance, handle: ResizeHandle): void {
    event.stopPropagation();

    const symbolDef = this.getSymbolDefinition(symbol);
    if (!symbolDef) return;

    const coords = this.getCanvasCoordinates(event);
    if (!coords) return;

    const scale = symbol.scale ?? 1;
    const width = symbolDef.bounds.width * scale;
    const height = symbolDef.bounds.height * scale;

    // Use ResizeService to start symbol resize
    this.resizeService.startElementResize(
      symbol.id,
      'symbol',
      handle,
      { width, height },
      symbol.position,
      coords
    );
  }

  /**
   * Get the transform string for a symbol instance
   */
  getSymbolTransform(instance: SymbolInstance, definition: SymbolDefinition): string {
    return this.symbolRenderer.buildTransform(instance, definition);
  }

  /**
   * Get the bounding box of a symbol instance
   */
  getSymbolBoundingBox(instance: SymbolInstance, definition: SymbolDefinition): { x: number; y: number; width: number; height: number } {
    return getSymbolInstanceBounds(instance, definition);
  }

  /**
   * Load symbol definitions for all symbol instances in the diagram.
   * This should be called when the diagram is loaded.
   */
  async loadSymbolDefinitions(): Promise<void> {
    const instances = this._diagram().symbolInstances ?? [];
    if (instances.length === 0) return;

    // Collect unique symbol rtIds
    const symbolRtIds = new Set(instances.map(i => i.symbolRtId));

    // Load each symbol definition
    const definitions = new Map<string, SymbolDefinition>();
    for (const rtId of symbolRtIds) {
      try {
        const symbol = await this.symbolLibraryService.loadSymbol(rtId);
        definitions.set(rtId, symbol);

        // Also load nested symbol definitions recursively
        await this.loadNestedSymbolDefinitions(symbol, definitions);
      } catch (error) {
        console.error(`Failed to load symbol definition ${rtId}:`, error);
      }
    }

    this._symbolDefinitions.set(definitions);
  }

  /**
   * Add a new symbol instance to the diagram
   */
  addSymbolInstance(
    libraryRtId: string,
    symbolRtId: string,
    position: Position,
    options?: { name?: string; scale?: number; rotation?: number }
  ): SymbolInstance {
    const instance: SymbolInstance = {
      id: this.creationService.generateId(),
      type: 'symbol',
      libraryRtId,
      symbolRtId,
      position: this.snapPosition(position),
      scale: options?.scale ?? 1,
      rotation: options?.rotation ?? 0,
      name: options?.name,
      visible: true,
      locked: false
    };

    this.diagramService.updateDiagram(d => ({
      ...d,
      symbolInstances: [...(d.symbolInstances ?? []), instance]
    }));

    this.selectSymbol(instance.id);
    this.pushToHistory();
    this.stateService.markChanged();

    return instance;
  }

  // ============================================================================
  // Path Editor
  // ============================================================================

  /**
   * Open the path editor for the selected path primitive
   */
  openPathEditor(): void {
    if (!this.canEditPath()) return;

    const sel = this.selectionService.selection();
    const selectedId = Array.from(sel.elements)[0];

    // Bake position into path coordinates before opening editor
    // This ensures the editor shows the path at its actual visual position
    this.bakePathPosition(selectedId);

    this._editingPathId.set(selectedId);
    this._pathEditorVisible.set(true);
  }

  /**
   * Bake the primitive's position into the path coordinates
   * and reset position to (0,0)
   */
  private bakePathPosition(pathId: string): void {
    const diagram = this._diagram();
    const primitive = (diagram.primitives ?? []).find(p => p.id === pathId);

    if (!primitive || primitive.type !== PrimitiveType.Path) return;

    const pathConfig = (primitive as unknown as { config: { d: string } }).config;
    const currentPos = primitive.position;

    // Only bake if position is not (0,0)
    if (currentPos.x === 0 && currentPos.y === 0) return;

    const pathEditorService = new PathEditorService();
    const parsed = pathEditorService.parse(pathConfig.d);

    if (parsed.segments.length === 0) return;

    // Shift all path coordinates by the current position
    const shiftedSegments = parsed.segments.map(segment =>
      pathEditorService.shiftSegment(segment, currentPos.x, currentPos.y)
    );
    const newPathData = pathEditorService.serialize(shiftedSegments);

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id === pathId) {
          return {
            ...p,
            position: { x: 0, y: 0 },
            config: {
              ...(p as unknown as { config: Record<string, unknown> }).config,
              d: newPathData
            }
          };
        }
        return p;
      })
    }));
  }

  /**
   * Close the path editor dialog
   */
  closePathEditor(): void {
    const pathId = this._editingPathId();

    if (pathId) {
      this.pushToHistory();
    }

    this._pathEditorVisible.set(false);
    this._editingPathId.set(null);
  }

  /**
   * Handle path data change from the path editor.
   * Just updates the path data - normalization happens when closing.
   */
  onPathEditorChange(newPathData: string): void {
    const pathId = this._editingPathId();
    if (!pathId) return;

    this.diagramService.updateDiagram(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p => {
        if (p.id === pathId && p.type === PrimitiveType.Path) {
          return {
            ...p,
            config: {
              ...(p as unknown as { config: Record<string, unknown> }).config,
              d: newPathData
            }
          };
        }
        return p;
      })
    }));

    this.stateService.markChanged();
  }

  /**
   * Handle double-click on a primitive (opens path editor for paths)
   */
  onPrimitiveDoubleClick(primitive: PrimitiveBase): void {
    if (primitive.type === PrimitiveType.Path) {
      this.selectionService.selectPrimitive(primitive.id, false);
      // Bake position into path coordinates before opening editor
      // This ensures the path editor works with coordinates relative to the path's visual position
      this.bakePathPosition(primitive.id);
      this._editingPathId.set(primitive.id);
      this._pathEditorVisible.set(true);
    }
  }

  /**
   * Extract SVG path data from a primitive for use in animateMotion.
   * Converts lines and polylines to path syntax.
   */
  private extractPathData(primitive: PrimitiveBase): string {
    switch (primitive.type) {
      case 'path': {
        const pathPrim = primitive as PathPrimitive;
        return pathPrim.config?.d ?? '';
      }
      case 'line': {
        const linePrim = primitive as LinePrimitive;
        const start = linePrim.config?.start;
        const end = linePrim.config?.end;
        if (!start || !end) return '';
        return `M ${start.x},${start.y} L ${end.x},${end.y}`;
      }
      case 'polyline': {
        const polyPrim = primitive as PolylinePrimitive;
        const points = polyPrim.config?.points;
        if (!points || points.length === 0) return '';
        return 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ');
      }
      default:
        return '';
    }
  }
}
