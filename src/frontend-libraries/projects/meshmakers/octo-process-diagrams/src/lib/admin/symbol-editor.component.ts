import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessDesignerComponent, SymbolSettings } from '../designer/process-designer.component';
import { ProcessDiagramConfig } from '../process-widget.models';
import { SymbolDefinition, SymbolInstance } from '../primitives/models/symbol.model';
import { PrimitiveBase, StyleClass } from '../primitives';
import { PathPrimitive, estimatePathBounds, offsetPathData } from '../primitives/models/path.model';
import { SymbolLibraryService } from '../services/symbol-library.service';
import {
  TransformPropertyEditorComponent,
  TransformPropertyChangeEvent
} from '../designer/transform-property-editor.component';
import { BindingEditorDialogComponent } from '../designer/binding-editor-dialog.component';
import { SimulationPanelComponent, SimulationValueChange } from '../designer/simulation-panel.component';
import { TransformProperty, PropertyBinding, BindingEffectType, TransformAnchor } from '../primitives/models/transform-property.models';
import { ExpressionEvaluatorService } from '../services/expression-evaluator.service';

/**
 * Symbol Editor Component
 *
 * A visual editor for creating and editing symbol definitions.
 * Uses the ProcessDesigner in 'symbol' mode for a consistent editing experience.
 *
 * Converts between SymbolDefinition and ProcessDiagramConfig internally.
 *
 * @example
 * ```html
 * <mm-symbol-editor
 *   [symbol]="currentSymbol"
 *   (symbolChange)="onSymbolChange($event)"
 *   (saveRequest)="onSave($event)">
 * </mm-symbol-editor>
 * ```
 */
@Component({
  selector: 'mm-symbol-editor',
  standalone: true,
  imports: [
    CommonModule,
    ProcessDesignerComponent,
    TransformPropertyEditorComponent,
    BindingEditorDialogComponent,
    SimulationPanelComponent
  ],
  template: `
    <div class="symbol-editor-container" [class.dockview-enabled]="useDockview">
      <div class="editor-main">
        <div class="editor-canvas">
          <mm-process-designer
            [diagramConfig]="diagramConfig()"
            [editorMode]="'symbol'"
            [showSaveButtons]="false"
            [useDockview]="useDockview"
            [transformProperties]="transformProperties()"
            [propertyBindings]="propertyBindings()"
            [simulationPropertyValues]="simulationValues()"
            [symbolSettings]="symbolSettings"
            [styleClasses]="styleClasses()"
            (diagramChange)="onDiagramChange($event)"
            (saveRequest)="onSaveRequest($event)"
            (transformPropertiesChange)="onPropertiesChange($event)"
            (simulationValueChange)="onSimulationValueChange($event)"
            (simulationReset)="onSimulationReset()"
            (symbolSettingsChange)="symbolSettingsChange.emit($event)"
            (styleClassesChange)="onStyleClassesChange($event)">
          </mm-process-designer>
        </div>

        <!-- Transform Properties Panel (right sidebar) - hidden when dockview is enabled -->
        @if (!useDockview) {
          @if (propertyPanelVisible()) {
            <div class="properties-panel">
              <div class="panel-header">
                <span class="panel-title">Transform Properties</span>
                <button class="panel-close" (click)="togglePropertyPanel()" title="Close panel">×</button>
              </div>
              <div class="panel-content">
                <mm-transform-property-editor
                  [transformProperties]="transformProperties()"
                  [propertyBindings]="propertyBindings()"
                  [primitives]="currentPrimitives()"
                  [symbolInstances]="currentSymbolInstances()"
                  (propertiesChange)="onPropertiesChange($event)"
                  (openBindings)="onOpenBindings($event)">
                </mm-transform-property-editor>
              </div>
            </div>
          } @else {
            <div class="panel-collapsed" (click)="togglePropertyPanel()" title="Show Transform Properties">
              <span class="collapsed-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </span>
              <span class="collapsed-label">Transform</span>
            </div>
          }
        }
      </div>

      <!-- Simulation Panel - hidden when dockview is enabled (included in dockview layout) -->
      @if (!useDockview && hasTransformProperties()) {
        <mm-simulation-panel
          [properties]="transformProperties()"
          [values]="simulationValues()"
          (valueChange)="onSimulationValueChange($event)"
          (resetValues)="onSimulationReset()">
        </mm-simulation-panel>
      }
    </div>

    <mm-binding-editor-dialog
      [show]="showBindingEditor()"
      [property]="editingProperty()"
      [existingBindings]="propertyBindings()"
      [primitives]="currentPrimitives()"
      [symbolInstances]="currentSymbolInstances()"
      [symbolDefinitions]="symbolDefinitionsMap()"
      (closed)="onBindingEditorClosed()"
      (saved)="onBindingsSaved($event)">
    </mm-binding-editor-dialog>
  `,
  styles: [`
    /* CSS Variables for theming - inherit from designer or use neutral defaults */
    :host {
      --editor-bg: var(--designer-bg, #f5f5f5);
      --editor-surface: var(--designer-surface, #ffffff);
      --editor-surface-alt: var(--designer-surface-alt, #f5f5f5);
      --editor-border: var(--designer-border, #e0e0e0);
      --editor-text: var(--designer-text, #333333);
      --editor-text-muted: var(--designer-text-muted, #666666);
      --editor-accent: var(--designer-accent, #1976d2);
      --editor-hover-bg: var(--designer-hover-bg, #eeeeee);

      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .symbol-editor-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: var(--editor-bg);
    }

    .editor-main {
      display: flex;
      flex: 1;
      height: 100%;
      min-height: 0;
      min-width: 0;
      position: relative;
      overflow: hidden;
    }

    .editor-canvas {
      display: flex;
      flex: 1;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    mm-process-designer {
      flex: 1;
      height: 100%;
      min-height: 0;
      min-width: 0;
    }

    /* Properties Panel (expanded state) */
    .properties-panel {
      width: 300px;
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--editor-border);
      background: var(--editor-surface);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--editor-surface-alt);
      border-bottom: 1px solid var(--editor-border);
      flex-shrink: 0;
    }

    .panel-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--editor-text);
    }

    .panel-close {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      color: var(--editor-text-muted);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .panel-close:hover {
      background: var(--editor-hover-bg);
      color: var(--editor-accent);
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    mm-transform-property-editor {
      display: block;
    }

    /* Collapsed state indicator */
    .panel-collapsed {
      width: 28px;
      background: var(--editor-surface-alt);
      border-left: 1px solid var(--editor-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 12px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .panel-collapsed:hover {
      background: var(--editor-hover-bg);
    }

    .collapsed-icon {
      color: var(--editor-text-muted);
      margin-bottom: 8px;
    }

    .collapsed-label {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 11px;
      font-weight: 500;
      color: var(--editor-text-muted);
      letter-spacing: 0.5px;
    }

    mm-simulation-panel {
      flex-shrink: 0;
    }

    /* Dockview-enabled mode */
    .symbol-editor-container.dockview-enabled {
      /* When dockview is enabled, editor-main takes full height */
      .editor-main {
        flex: 1;
      }

      .editor-canvas {
        /* Canvas takes full space, dockview manages panels */
        flex: 1;
      }
    }
  `]
})
export class SymbolEditorComponent implements OnChanges {

  @ViewChild(ProcessDesignerComponent) private processDesigner?: ProcessDesignerComponent;

  private readonly symbolLibraryService = inject(SymbolLibraryService);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  /**
   * The symbol definition to edit
   */
  @Input() symbol: SymbolDefinition | null = null;

  /**
   * Override canvas width (defaults to symbol bounds)
   */
  @Input() canvasWidth?: number;

  /**
   * Override canvas height (defaults to symbol bounds)
   */
  @Input() canvasHeight?: number;

  /**
   * Grid size in pixels (defaults to symbol's saved gridSize or 10)
   */
  @Input() gridSize?: number;

  /**
   * Emitted when the symbol changes (primitives, symbolInstances)
   */
  @Output() symbolChange = new EventEmitter<SymbolDefinition>();

  /**
   * Emitted when save is requested (Ctrl+S)
   */
  @Output() saveRequest = new EventEmitter<SymbolDefinition>();

  /**
   * Internal diagram config derived from symbol
   */
  readonly diagramConfig = signal<ProcessDiagramConfig | null>(null);

  /**
   * Initial visibility of the property editor panel
   */
  @Input() showPropertyEditorPanel = true;

  /**
   * Enable dockview-based flexible panel layout.
   * When true, panels are managed by ProcessDesignerComponent's dockview.
   * Transform and Simulation panels are included in the dockview layout.
   */
  @Input() useDockview = false;

  /**
   * Symbol settings for the settings panel (passed through to process-designer)
   */
  @Input() symbolSettings: SymbolSettings | null = null;

  /**
   * Emitted when symbol settings change in the settings panel
   */
  @Output() symbolSettingsChange = new EventEmitter<{ key: string; value: any }>();

  // Transform property editing state
  private _transformProperties = signal<TransformProperty[]>([]);
  private _propertyBindings = signal<PropertyBinding[]>([]);
  private _showBindingEditor = signal(false);
  private _editingProperty = signal<TransformProperty | null>(null);
  private _simulationValues = signal<Record<string, unknown>>({});
  private _propertyPanelVisible = signal(true);
  private _styleClasses = signal<StyleClass[]>([]);

  /**
   * Loaded symbol definitions for nested symbol instances.
   * This signal is updated when nested symbols are loaded from the backend.
   */
  private _loadedSymbolDefinitions = signal(new Map<string, SymbolDefinition>());

  /**
   * Base diagram config that tracks user edits (without simulation transforms).
   * This is updated when ProcessDesigner emits changes.
   */
  private _baseDiagramConfig = signal<ProcessDiagramConfig | null>(null);

  // Computed values for template
  transformProperties = computed(() => this._transformProperties());
  propertyBindings = computed(() => this._propertyBindings());
  showBindingEditor = computed(() => this._showBindingEditor());
  editingProperty = computed(() => this._editingProperty());
  simulationValues = computed(() => this._simulationValues());
  propertyPanelVisible = computed(() => this._propertyPanelVisible());
  hasTransformProperties = computed(() => this._transformProperties().length > 0);
  styleClasses = computed(() => this._styleClasses());

  currentPrimitives = computed<PrimitiveBase[]>(() => {
    // Use diagramConfig for the most current primitives (includes unsaved changes)
    // Fall back to base config if diagramConfig is empty
    const current = this.diagramConfig();
    const base = this._baseDiagramConfig();
    // Prefer current diagramConfig as it has the latest changes from process-designer
    return current?.primitives?.length ? current.primitives : (base?.primitives ?? []);
  });

  currentSymbolInstances = computed<SymbolInstance[]>(() => {
    // Use diagramConfig for the most current symbol instances (includes unsaved changes)
    const current = this.diagramConfig();
    const base = this._baseDiagramConfig();
    return current?.symbolInstances?.length ? current.symbolInstances : (base?.symbolInstances ?? []);
  });

  symbolDefinitionsMap = computed(() => {
    // Use loaded definitions signal - this makes the computed reactive to symbol loading
    const loadedDefs = this._loadedSymbolDefinitions();
    const map = new Map<string, SymbolDefinition>();
    for (const inst of this.currentSymbolInstances()) {
      // First check our loaded definitions, then fall back to service cache
      const def = loadedDefs.get(inst.symbolRtId) ??
                  this.symbolLibraryService.getCachedSymbol(inst.symbolRtId);
      if (def) {
        map.set(inst.symbolRtId, def);
      }
    }
    return map;
  });

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize panel visibility from input
    if (changes['showPropertyEditorPanel'] && changes['showPropertyEditorPanel'].isFirstChange()) {
      this._propertyPanelVisible.set(this.showPropertyEditorPanel);
    }

    // Handle symbol change
    if (this.symbol && changes['symbol']) {
      const previousSymbol = changes['symbol'].previousValue as SymbolDefinition | undefined;
      const isNewSymbol = !previousSymbol || previousSymbol.rtId !== this.symbol.rtId;

      if (isNewSymbol) {
        // Full rebuild for a truly new/different symbol
        const newDiagramConfig = this.symbolToDiagram(this.symbol);
        this.diagramConfig.set(newDiagramConfig);
        this._baseDiagramConfig.set(newDiagramConfig);

        // Sync transform properties, bindings, and style classes from symbol
        this._transformProperties.set(this.symbol.transformProperties ?? []);
        this._propertyBindings.set(this.symbol.propertyBindings ?? []);
        this._styleClasses.set(this.symbol.styleClasses ?? []);
        this._simulationValues.set({});

        // Load nested symbol definitions for symbol instances
        this.loadNestedSymbolDefinitions(this.symbol);
      } else {
        // Same symbol ID, just reference changed - update canvas properties only, preserve primitives
        this.updateCanvasProperties();
      }
    }

    // Handle canvas size changes from separate inputs (not via symbol change)
    if (this.symbol && !changes['symbol'] && (changes['canvasWidth'] || changes['canvasHeight'] || changes['gridSize'])) {
      this.updateCanvasProperties();
    }
  }

  /**
   * Load symbol definitions for all nested symbol instances.
   * This ensures the binding editor can display target properties for symbol instances.
   */
  private async loadNestedSymbolDefinitions(symbol: SymbolDefinition): Promise<void> {
    const symbolInstances = symbol.symbolInstances ?? [];
    if (symbolInstances.length === 0) {
      return;
    }

    const loadedDefs = new Map<string, SymbolDefinition>();

    // Load each symbol definition
    for (const inst of symbolInstances) {
      if (loadedDefs.has(inst.symbolRtId)) {
        continue; // Already loaded
      }

      try {
        const def = await this.symbolLibraryService.loadSymbol(inst.symbolRtId);
        loadedDefs.set(inst.symbolRtId, def);

        // Recursively load nested symbols within this definition
        if (def.symbolInstances && def.symbolInstances.length > 0) {
          await this.loadNestedSymbolsRecursive(def, loadedDefs);
        }
      } catch (error) {
        console.error(`Failed to load nested symbol ${inst.symbolRtId}:`, error);
      }
    }

    // Update the signal with all loaded definitions
    this._loadedSymbolDefinitions.set(loadedDefs);
  }

  /**
   * Recursively load symbol definitions for deeply nested symbol instances.
   */
  private async loadNestedSymbolsRecursive(
    symbolDef: SymbolDefinition,
    cache: Map<string, SymbolDefinition>
  ): Promise<void> {
    const symbolInstances = symbolDef.symbolInstances ?? [];
    if (symbolInstances.length === 0) {
      return;
    }

    for (const nestedInst of symbolInstances) {
      if (cache.has(nestedInst.symbolRtId)) {
        continue; // Already loaded
      }

      try {
        const nestedDef = await this.symbolLibraryService.loadSymbol(nestedInst.symbolRtId);
        cache.set(nestedInst.symbolRtId, nestedDef);

        // Continue recursively
        await this.loadNestedSymbolsRecursive(nestedDef, cache);
      } catch (error) {
        console.error(`Failed to load nested symbol ${nestedInst.symbolRtId}:`, error);
      }
    }
  }

  /**
   * Update only canvas properties while preserving existing primitives
   */
  private updateCanvasProperties(): void {
    const baseConfig = this._baseDiagramConfig();
    const currentConfig = this.diagramConfig();

    // Prefer baseConfig as it contains the latest user changes from ProcessDesigner
    // diagramConfig is only the initial state passed to ProcessDesigner
    const configToUpdate = baseConfig ?? currentConfig;
    if (configToUpdate && this.symbol) {
      // Use input overrides, then saved values, then defaults
      const width = this.canvasWidth ?? this.symbol.canvasSize?.width ?? this.symbol.bounds.width;
      const height = this.canvasHeight ?? this.symbol.canvasSize?.height ?? this.symbol.bounds.height;
      const gridSize = this.gridSize ?? this.symbol.gridSize ?? configToUpdate.canvas.gridSize ?? 10;

      const updatedCanvas = {
        ...configToUpdate.canvas,
        width,
        height,
        gridSize
      };

      const updatedConfig = {
        ...configToUpdate,
        canvas: updatedCanvas
      };

      this.diagramConfig.set(updatedConfig);
      this._baseDiagramConfig.set(updatedConfig);
    }
  }

  // ============================================================================
  // Transform Property Handlers
  // ============================================================================

  /**
   * Handle changes to transform properties
   */
  onPropertiesChange(event: TransformPropertyChangeEvent): void {
    this._transformProperties.set(event.properties);
    this._propertyBindings.set(event.bindings);

    // Emit updated symbol
    if (this.symbol) {
      const updatedSymbol: SymbolDefinition = {
        ...this.symbol,
        transformProperties: event.properties,
        propertyBindings: event.bindings
      };
      this.symbolChange.emit(updatedSymbol);
    }
  }

  /**
   * Open binding editor for a property
   */
  onOpenBindings(property: TransformProperty): void {
    this._editingProperty.set(property);
    this._showBindingEditor.set(true);
  }

  /**
   * Handle binding editor close
   */
  onBindingEditorClosed(): void {
    this._showBindingEditor.set(false);
    this._editingProperty.set(null);
  }

  /**
   * Handle saved bindings from binding editor.
   * The bindings parameter already contains all bindings (merged by the dialog).
   */
  onBindingsSaved(bindings: PropertyBinding[]): void {
    this._propertyBindings.set(bindings);
    this._showBindingEditor.set(false);
    this._editingProperty.set(null);

    // Emit updated symbol
    if (this.symbol) {
      const updatedSymbol: SymbolDefinition = {
        ...this.symbol,
        transformProperties: this._transformProperties(),
        propertyBindings: bindings
      };
      this.symbolChange.emit(updatedSymbol);
    }
  }

  // ============================================================================
  // Style Classes Handlers
  // ============================================================================

  /**
   * Handle changes to style classes from the Styles Panel
   */
  onStyleClassesChange(styleClasses: StyleClass[]): void {
    this._styleClasses.set(styleClasses);

    // Emit updated symbol
    if (this.symbol) {
      const updatedSymbol: SymbolDefinition = {
        ...this.symbol,
        styleClasses
      };
      this.symbolChange.emit(updatedSymbol);
    }
  }

  // ============================================================================
  // Simulation Handlers
  // ============================================================================

  /**
   * Handle simulation value change
   */
  onSimulationValueChange(event: SimulationValueChange): void {
    this._simulationValues.update(values => ({
      ...values,
      [event.propertyId]: event.value
    }));

    // Apply simulation values to the diagram preview
    this.applySimulationToDiagram();
  }

  /**
   * Handle simulation reset
   */
  onSimulationReset(): void {
    this._simulationValues.set({});
    // Re-apply (with no simulation values, this will use defaults)
    this.applySimulationToDiagram();
  }

  /**
   * Apply simulation values to the diagram primitives.
   * Uses _baseDiagramConfig (which includes user edits) as the source,
   * applies simulation transforms, and sets the result to diagramConfig.
   */
  private applySimulationToDiagram(): void {
    if (!this.symbol) return;

    // Use base config (with user edits) as the source
    const baseConfig = this._baseDiagramConfig();
    if (!baseConfig) return;

    const properties = this._transformProperties();
    const bindings = this._propertyBindings();
    const simValues = this._simulationValues();

    if (properties.length === 0 || bindings.length === 0) {
      // No simulation to apply, just use base config
      this.diagramConfig.set(baseConfig);
      return;
    }

    // Apply bindings to primitives
    const updatedPrimitives = (baseConfig.primitives ?? []).map(primitive => {
      return this.applyBindingsToPrimitive(primitive, properties, bindings, simValues);
    });

    // Update diagram config with transformed primitives
    this.diagramConfig.set({
      ...baseConfig,
      primitives: updatedPrimitives
    });
  }

  /**
   * Apply property bindings to a primitive
   */
  private applyBindingsToPrimitive(
    primitive: PrimitiveBase,
    properties: TransformProperty[],
    bindings: PropertyBinding[],
    simValues: Record<string, unknown>
  ): PrimitiveBase {
    // Find bindings that target this primitive
    const relevantBindings = bindings.filter(
      b => b.targetType === 'primitive' && b.targetId === primitive.id
    );

    if (relevantBindings.length === 0) {
      return primitive;
    }

    // Clone the primitive
    let modified = JSON.parse(JSON.stringify(primitive)) as PrimitiveBase;

    // Ensure transform object exists
    if (!modified.transform) {
      modified.transform = {};
    }
    if (!modified.style) {
      modified.style = {};
    }
    if (!modified.style.fill) {
      modified.style.fill = {};
    }
    if (!modified.style.stroke) {
      modified.style.stroke = {};
    }

    // Apply each binding
    for (const binding of relevantBindings) {
      const property = properties.find(p => p.id === binding.propertyId);
      if (!property) continue;

      // Get the input value (simulation value or default)
      const inputValue = simValues[binding.propertyId] ?? property.defaultValue;

      // Build expression context
      const context: Record<string, number | string | boolean> = {
        value: this.toPrimitiveValue(inputValue)
      };

      // Add all property values to context
      for (const prop of properties) {
        const val = simValues[prop.id] ?? prop.defaultValue;
        context[prop.id] = this.toPrimitiveValue(val);
      }

      // Evaluate expression
      const result = this.expressionEvaluator.evaluate(binding.expression, context);
      if (!result.success) continue;

      // Apply the effect with anchor
      modified = this.applyBindingEffect(modified, binding.effectType, result.value, binding.anchor);
    }

    return modified;
  }

  /**
   * Convert unknown value to primitive type
   */
  private toPrimitiveValue(value: unknown): number | string | boolean {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return 0;
    return String(value);
  }

  /**
   * Apply a binding effect to a primitive
   */
  private applyBindingEffect(
    primitive: PrimitiveBase,
    effectType: BindingEffectType,
    value: unknown,
    anchor?: TransformAnchor
  ): PrimitiveBase {
    const effectiveAnchor = anchor ?? 'center';

    switch (effectType) {
      case 'transform.rotation':
        // Store anchor for rotation pivot (used in getPrimitiveTransform)
        primitive.transform!.rotation = Number(value);
        primitive.transform!.anchor = effectiveAnchor;
        break;
      case 'transform.offsetX':
        primitive.transform!.offsetX = Number(value);
        break;
      case 'transform.offsetY':
        primitive.transform!.offsetY = Number(value);
        break;
      case 'transform.scale':
        primitive.transform!.scale = Number(value);
        primitive.transform!.anchor = effectiveAnchor;
        break;
      case 'transform.scaleX':
        primitive.transform!.scaleX = Number(value);
        primitive.transform!.anchor = effectiveAnchor;
        break;
      case 'transform.scaleY':
        primitive.transform!.scaleY = Number(value);
        primitive.transform!.anchor = effectiveAnchor;
        break;
      case 'style.fill.color':
        primitive.style!.fill!.color = String(value);
        break;
      case 'style.fill.opacity':
        primitive.style!.fill!.opacity = Number(value);
        break;
      case 'style.stroke.color':
        primitive.style!.stroke!.color = String(value);
        break;
      case 'style.stroke.opacity':
        primitive.style!.stroke!.opacity = Number(value);
        break;
      case 'style.opacity':
        primitive.style!.opacity = Number(value);
        break;
      case 'visible':
        primitive.visible = Boolean(value);
        break;
      case 'fillLevel':
        primitive.fillLevel = Math.max(0, Math.min(1, Number(value)));
        break;
      case 'dimension.width':
        this.applyDimensionWidth(primitive, Number(value), effectiveAnchor);
        break;
      case 'dimension.height':
        this.applyDimensionHeight(primitive, Number(value), effectiveAnchor);
        break;
    }
    return primitive;
  }

  /**
   * Get horizontal position adjustment factor for anchor
   * 0 = left edge fixed, 0.5 = center fixed, 1 = right edge fixed
   */
  private getAnchorXFactor(anchor: TransformAnchor): number {
    switch (anchor) {
      case 'top-left':
      case 'left':
      case 'bottom-left':
        return 0;
      case 'top':
      case 'center':
      case 'bottom':
        return 0.5;
      case 'top-right':
      case 'right':
      case 'bottom-right':
        return 1;
      default:
        return 0.5;
    }
  }

  /**
   * Get vertical position adjustment factor for anchor
   * 0 = top edge fixed, 0.5 = center fixed, 1 = bottom edge fixed
   */
  private getAnchorYFactor(anchor: TransformAnchor): number {
    switch (anchor) {
      case 'top-left':
      case 'top':
      case 'top-right':
        return 0;
      case 'left':
      case 'center':
      case 'right':
        return 0.5;
      case 'bottom-left':
      case 'bottom':
      case 'bottom-right':
        return 1;
      default:
        return 0.5;
    }
  }

  /**
   * Apply dimension width to a primitive
   * Directly modifies width without affecting stroke
   * Uses anchor to determine which edge/point stays fixed
   */
  private applyDimensionWidth(primitive: PrimitiveBase, width: number, anchor: TransformAnchor): void {
    const safeWidth = Math.max(1, width);
    const prim = primitive as { config?: { width?: number; radiusX?: number; end?: { x: number; y: number } } };
    const xFactor = this.getAnchorXFactor(anchor);

    switch (primitive.type) {
      case 'rectangle': {
        if (prim.config?.width !== undefined) {
          const oldWidth = prim.config.width;
          const diff = safeWidth - oldWidth;
          // Adjust position based on anchor
          primitive.position.x -= diff * xFactor;
          prim.config.width = safeWidth;
        }
        break;
      }
      case 'ellipse': {
        // Ellipse position is center, need to adjust for non-center anchors
        if (prim.config?.radiusX !== undefined) {
          const oldRadiusX = prim.config.radiusX;
          const newRadiusX = safeWidth / 2;
          const diff = (newRadiusX - oldRadiusX) * 2;
          // Adjust position based on anchor (relative to center)
          primitive.position.x -= diff * (xFactor - 0.5);
          prim.config.radiusX = newRadiusX;
        }
        break;
      }
      case 'line': {
        if (prim.config?.end) {
          // Line uses end.x/end.y relative to start
          const dx = prim.config.end.x;
          const dy = prim.config.end.y;
          const currentLength = Math.sqrt(dx * dx + dy * dy);
          if (currentLength > 0) {
            const angle = Math.atan2(dy, dx);
            prim.config.end.x = safeWidth * Math.cos(angle);
            prim.config.end.y = safeWidth * Math.sin(angle);
          } else {
            prim.config.end.x = safeWidth;
          }
        }
        break;
      }
      case 'image': {
        if (prim.config) {
          const imgConfig = prim.config as { width?: number };
          if (imgConfig.width !== undefined) {
            const oldWidth = imgConfig.width;
            const diff = safeWidth - oldWidth;
            primitive.position.x -= diff * xFactor;
          }
          imgConfig.width = safeWidth;
        }
        break;
      }
      case 'text': {
        // Text width is determined by content, not directly settable
        break;
      }
    }
  }

  /**
   * Apply dimension height to a primitive
   * Directly modifies height without affecting stroke
   * Uses anchor to determine which edge/point stays fixed
   */
  private applyDimensionHeight(primitive: PrimitiveBase, height: number, anchor: TransformAnchor): void {
    const safeHeight = Math.max(1, height);
    const prim = primitive as { config?: { height?: number; radiusY?: number; end?: { x: number; y: number } } };
    const yFactor = this.getAnchorYFactor(anchor);

    switch (primitive.type) {
      case 'rectangle': {
        if (prim.config?.height !== undefined) {
          const oldHeight = prim.config.height;
          const diff = safeHeight - oldHeight;
          // Adjust position based on anchor
          primitive.position.y -= diff * yFactor;
          prim.config.height = safeHeight;
        }
        break;
      }
      case 'ellipse': {
        // Ellipse position is center, need to adjust for non-center anchors
        if (prim.config?.radiusY !== undefined) {
          const oldRadiusY = prim.config.radiusY;
          const newRadiusY = safeHeight / 2;
          const diff = (newRadiusY - oldRadiusY) * 2;
          // Adjust position based on anchor (relative to center)
          primitive.position.y -= diff * (yFactor - 0.5);
          prim.config.radiusY = newRadiusY;
        }
        break;
      }
      case 'line': {
        if (prim.config?.end) {
          // Line uses end.x/end.y relative to start
          const dx = prim.config.end.x;
          const dy = prim.config.end.y;
          const currentLength = Math.sqrt(dx * dx + dy * dy);
          if (currentLength > 0) {
            const angle = Math.atan2(dy, dx);
            prim.config.end.x = safeHeight * Math.cos(angle);
            prim.config.end.y = safeHeight * Math.sin(angle);
          } else {
            prim.config.end.y = safeHeight;
          }
        }
        break;
      }
      case 'image': {
        if (prim.config) {
          const imgConfig = prim.config as { height?: number };
          if (imgConfig.height !== undefined) {
            const oldHeight = imgConfig.height;
            const diff = safeHeight - oldHeight;
            primitive.position.y -= diff * yFactor;
          }
          imgConfig.height = safeHeight;
        }
        break;
      }
      case 'text': {
        // Text height is determined by font size, not directly settable
        break;
      }
    }
  }

  // ============================================================================
  // Panel Toggle
  // ============================================================================

  /**
   * Toggle property panel visibility
   */
  togglePropertyPanel(): void {
    this._propertyPanelVisible.update(visible => !visible);
  }

  /**
   * Convert SymbolDefinition to ProcessDiagramConfig for editing
   */
  private symbolToDiagram(symbol: SymbolDefinition): ProcessDiagramConfig {
    // Use input overrides, then saved canvasSize, then fall back to bounds
    const canvasWidth = this.canvasWidth ?? symbol.canvasSize?.width ?? symbol.bounds.width;
    const canvasHeight = this.canvasHeight ?? symbol.canvasSize?.height ?? symbol.bounds.height;
    // Use input override, then symbol's saved gridSize, then default 10
    const gridSize = this.gridSize ?? symbol.gridSize ?? 10;

    return {
      id: symbol.rtId || `temp_${Date.now()}`,
      name: symbol.name,
      description: symbol.description,
      version: symbol.version,
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        gridSize: gridSize,
        showGrid: true
      },
      elements: [], // No elements in symbol mode
      connections: [], // No connections in symbol mode
      primitives: symbol.primitives ? [...symbol.primitives] : [],
      symbolInstances: symbol.symbolInstances ? [...symbol.symbolInstances] : []
    };
  }

  /**
   * Convert ProcessDiagramConfig back to SymbolDefinition.
   * Normalizes primitive and symbol instance positions so they start from (0,0).
   */
  private diagramToSymbol(diagram: ProcessDiagramConfig): SymbolDefinition {
    if (!this.symbol) {
      throw new Error('Cannot convert diagram to symbol: no symbol set');
    }

    const primitives = diagram.primitives ?? [];
    const symbolInstances = diagram.symbolInstances ?? [];

    // If nothing to render, use canvas dimensions
    if (primitives.length === 0 && symbolInstances.length === 0) {
      return {
        ...this.symbol,
        primitives: [],
        symbolInstances: [],
        bounds: {
          width: diagram.canvas.width,
          height: diagram.canvas.height
        },
        // Save canvas size and grid size with symbol
        canvasSize: {
          width: diagram.canvas.width,
          height: diagram.canvas.height
        },
        gridSize: diagram.canvas.gridSize,
        // Include current transform properties, bindings, and style classes
        transformProperties: this._transformProperties(),
        propertyBindings: this._propertyBindings(),
        styleClasses: this._styleClasses()
      };
    }

    // Calculate combined bounding box of primitives and symbol instances
    const bbox = this.calculateCombinedBounds(primitives, symbolInstances);

    // Normalize primitives so they start from (0,0)
    // For path primitives, we need to transform the path data itself
    const normalizedPrimitives = primitives.map(prim => {
      if (prim.type === 'path') {
        // For paths, transform the d attribute
        // The offset needs to account for the position being zeroed out:
        // - bbox.min includes the path's position offset (from estimatePathBounds)
        // - We need to: 1) bake current position into path coords, 2) subtract bbox.min for normalization
        // This simplifies to: pathPrim.position - bbox.min
        const pathPrim = prim as PathPrimitive;
        const transformedD = offsetPathData(
          pathPrim.config.d,
          pathPrim.position.x - bbox.minX,
          pathPrim.position.y - bbox.minY
        );
        return {
          ...pathPrim,
          position: { x: 0, y: 0 }, // Path coords are in the d string
          config: {
            ...pathPrim.config,
            d: transformedD
          }
        } as PrimitiveBase;
      }
      // For other primitives, just offset the position
      return {
        ...prim,
        position: {
          x: prim.position.x - bbox.minX,
          y: prim.position.y - bbox.minY
        }
      };
    });

    // Normalize symbol instances so they start from (0,0)
    const normalizedSymbolInstances = symbolInstances.map(inst => ({
      ...inst,
      position: {
        x: inst.position.x - bbox.minX,
        y: inst.position.y - bbox.minY
      }
    }));

    return {
      ...this.symbol,
      primitives: normalizedPrimitives,
      symbolInstances: normalizedSymbolInstances,
      bounds: {
        width: bbox.width,
        height: bbox.height
      },
      // Save canvas size and grid size with symbol
      canvasSize: {
        width: diagram.canvas.width,
        height: diagram.canvas.height
      },
      gridSize: diagram.canvas.gridSize,
      // Include current transform properties, bindings, and style classes
      transformProperties: this._transformProperties(),
      propertyBindings: this._propertyBindings(),
      styleClasses: this._styleClasses()
    };
  }

  /**
   * Calculate combined bounding box of primitives and symbol instances
   */
  private calculateCombinedBounds(
    primitives: PrimitiveBase[],
    symbolInstances: SymbolInstance[]
  ): {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Include primitives
    for (const prim of primitives) {
      const bounds = this.getPrimitiveBounds(prim);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    // Include symbol instances
    for (const inst of symbolInstances) {
      const bounds = this.getSymbolInstanceBounds(inst);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    // Handle empty case
    if (minX === Infinity) {
      return { minX: 0, minY: 0, width: 0, height: 0 };
    }

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get the bounding box of a symbol instance
   */
  private getSymbolInstanceBounds(instance: SymbolInstance): { x: number; y: number; width: number; height: number } {
    const symbolDef = this.symbolLibraryService.getCachedSymbol(instance.symbolRtId);
    const scale = instance.scale ?? 1;

    if (symbolDef) {
      return {
        x: instance.position.x,
        y: instance.position.y,
        width: symbolDef.bounds.width * scale,
        height: symbolDef.bounds.height * scale
      };
    }

    // Fallback if symbol not cached (shouldn't happen in normal use)
    return {
      x: instance.position.x,
      y: instance.position.y,
      width: 100 * scale,
      height: 100 * scale
    };
  }

  /**
   * Get the bounding box of a single primitive
   */
  private getPrimitiveBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const pos = prim.position;
    const config = (prim as { config?: Record<string, unknown> }).config ?? {};

    switch (prim.type) {
      case 'rectangle': {
        const width = (config['width'] as number) ?? 100;
        const height = (config['height'] as number) ?? 80;
        return { x: pos.x, y: pos.y, width, height };
      }
      case 'ellipse': {
        const radiusX = (config['radiusX'] as number) ?? 50;
        const radiusY = (config['radiusY'] as number) ?? 40;
        return {
          x: pos.x - radiusX,
          y: pos.y - radiusY,
          width: radiusX * 2,
          height: radiusY * 2
        };
      }
      case 'polygon': {
        const points = (config['points'] as { x: number; y: number }[]) ?? [];
        if (points.length === 0) {
          return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const p of points) {
          pMinX = Math.min(pMinX, p.x + pos.x);
          pMinY = Math.min(pMinY, p.y + pos.y);
          pMaxX = Math.max(pMaxX, p.x + pos.x);
          pMaxY = Math.max(pMaxY, p.y + pos.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
      }
      case 'line': {
        const start = (config['start'] as { x: number; y: number }) ?? { x: 0, y: 0 };
        const end = (config['end'] as { x: number; y: number }) ?? { x: 0, y: 0 };
        const x1 = start.x + pos.x;
        const y1 = start.y + pos.y;
        const x2 = end.x + pos.x;
        const y2 = end.y + pos.y;
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1) || 1,
          height: Math.abs(y2 - y1) || 1
        };
      }
      case 'text': {
        const fontSize = ((config['textStyle'] as Record<string, unknown>)?.['fontSize'] as number) ?? 14;
        const content = (config['content'] as string) ?? '';
        return {
          x: pos.x,
          y: pos.y - fontSize,
          width: content.length * fontSize * 0.6,
          height: fontSize * 1.2
        };
      }
      case 'path': {
        // Use the estimatePathBounds function from path model
        const pathBounds = estimatePathBounds(prim as PathPrimitive);
        return pathBounds;
      }
      case 'polyline': {
        const points = (config['points'] as { x: number; y: number }[]) ?? [];
        if (points.length === 0) {
          return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const p of points) {
          pMinX = Math.min(pMinX, p.x + pos.x);
          pMinY = Math.min(pMinY, p.y + pos.y);
          pMaxX = Math.max(pMaxX, p.x + pos.x);
          pMaxY = Math.max(pMaxY, p.y + pos.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
      }
      case 'image': {
        const width = (config['width'] as number) ?? 100;
        const height = (config['height'] as number) ?? 100;
        return { x: pos.x, y: pos.y, width, height };
      }
      case 'group': {
        // Group bounds are stored in config.originalBounds
        const originalBounds = (config['originalBounds'] as { x: number; y: number; width: number; height: number }) ?? { x: 0, y: 0, width: 100, height: 100 };
        return {
          x: pos.x,
          y: pos.y,
          width: originalBounds.width,
          height: originalBounds.height
        };
      }
      default:
        // Log warning for unknown types
        console.warn(`Unknown primitive type for bounds calculation: ${prim.type}`);
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }

  /**
   * Handle diagram changes from ProcessDesigner
   * Note: We do NOT update diagramConfig here to avoid circular updates.
   * ProcessDesigner already has the updated state internally.
   * However, we DO update the base config to preserve user edits for simulation.
   */
  onDiagramChange(diagram: ProcessDiagramConfig): void {
    // Store user edits in base config (used by simulation)
    this._baseDiagramConfig.set(diagram);

    if (this.symbol) {
      const updatedSymbol = this.diagramToSymbol(diagram);
      this.symbolChange.emit(updatedSymbol);
    }
    // Note: Do NOT call applySimulationToDiagram() here - it would cause
    // circular updates since setting diagramConfig triggers ProcessDesigner to reinitialize.
    // Simulation transforms are applied when simulation values change.
  }

  /**
   * Handle save request from ProcessDesigner
   */
  onSaveRequest(diagram: ProcessDiagramConfig): void {
    if (this.symbol) {
      const updatedSymbol = this.diagramToSymbol(diagram);
      this.saveRequest.emit(updatedSymbol);
    }
  }

  /**
   * Public method to get current primitives (for external access)
   * Reads directly from ProcessDesigner to get the latest state
   */
  getPrimitives(): PrimitiveBase[] {
    // MUST read from ProcessDesigner to get edited state
    if (!this.processDesigner) {
      console.warn('SymbolEditor: ProcessDesigner not available, returning original primitives');
      return this.diagramConfig()?.primitives ? [...this.diagramConfig()!.primitives!] : [];
    }
    const config = this.processDesigner.diagram();
    return config?.primitives ? [...config.primitives] : [];
  }

  /**
   * Public method to get current symbol state
   * Reads directly from ProcessDesigner to get the latest state
   */
  getSymbol(): SymbolDefinition | null {
    if (!this.symbol) return null;

    // MUST read from ProcessDesigner to get edited state
    if (!this.processDesigner) {
      console.warn('SymbolEditor: ProcessDesigner not available, returning original symbol');
      const config = this.diagramConfig();
      if (!config) return null;
      return this.diagramToSymbol(config);
    }

    const config = this.processDesigner.diagram();
    if (!config) return null;
    return this.diagramToSymbol(config);
  }

  /**
   * Clear the hasChanges flag in the ProcessDesigner.
   * Call this after successfully saving the symbol.
   */
  clearChanges(): void {
    this.processDesigner?.clearChanges();
  }
}
