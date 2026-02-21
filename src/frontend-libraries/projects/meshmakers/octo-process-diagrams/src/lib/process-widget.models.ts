/**
 * Process Widget Models
 *
 * Defines the configuration schema for the Process Visualization Widget.
 * This widget enables HMI-style process visualizations with:
 * - Industrial process elements (tanks, pipes, valves, pumps, etc.)
 * - Data binding to OctoMesh runtime entities
 * - Flow animations on connections
 * - Threshold-based color changes
 * - Custom SVG element support
 *
 * @example
 * ```typescript
 * const config: ProcessDiagramConfig = {
 *   canvas: { width: 800, height: 600 },
 *   elements: [
 *     {
 *       id: 'tank-1',
 *       type: 'tank',
 *       position: { x: 100, y: 100 },
 *       size: { width: 80, height: 120 },
 *       dataBinding: {
 *         sourceType: 'runtimeEntity',
 *         sourceConfig: { ckTypeId: 'Industry/Tank', rtId: '...' },
 *         attributePath: 'fillLevel'
 *       }
 *     }
 *   ],
 *   connections: []
 * };
 * ```
 */

// Import and re-export common types from primitives to avoid duplicates
import type { Position as PositionType, Size as SizeType } from './primitives/models/primitive.models';
export type { Position, Size } from './primitives/models/primitive.models';

// Local type aliases for use in this file
type Position = PositionType;
type Size = SizeType;

// ============================================================================
// Canvas Configuration
// ============================================================================

/**
 * Canvas configuration for the process diagram
 */
export interface ProcessCanvasConfig {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Background color (CSS color or 'transparent') */
  backgroundColor?: string;
  /** Grid size for snapping (0 = no grid) */
  gridSize?: number;
  /** Show grid lines in designer mode */
  showGrid?: boolean;
}

// ============================================================================
// Element Types
// ============================================================================

/**
 * All supported process element types
 */
export type ProcessElementType =
  // Containers
  | 'tank'
  | 'silo'
  | 'vessel'
  // Connectors (standalone, not connections)
  | 'pipe'
  // Actuators
  | 'valve'
  | 'pump'
  | 'motor'
  // Sensors/Displays
  | 'gauge'
  | 'digitalDisplay'
  | 'statusLight'
  // Layout
  | 'label'
  | 'image'
  | 'shape'
  | 'customSvg';

// ============================================================================
// Styling
// ============================================================================

/**
 * Common style properties for elements
 */
export interface ElementStyle {
  /** Fill color for the element body */
  fillColor?: string;
  /** Stroke/border color */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Opacity (0-1) */
  opacity?: number;
  /** CSS filter effects */
  filter?: string;
}

/**
 * Style for text elements in process widgets
 * Note: This is distinct from PrimitiveTextStyle which has SVG-specific properties
 */
export interface ProcessTextStyle {
  /** Font family */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Font weight */
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  /** Text color */
  color?: string;
  /** Text alignment */
  textAlign?: 'left' | 'center' | 'right';
}

// ============================================================================
// Data Binding
// ============================================================================

/**
 * Data source types for process elements
 */
export type ProcessDataSourceType = 'runtimeEntity' | 'persistentQuery' | 'static';

/**
 * Data binding configuration
 * Connects a visual element to OctoMesh data
 */
export interface ProcessDataBinding {
  /** Type of data source */
  sourceType: ProcessDataSourceType;

  /** Data source configuration */
  sourceConfig: {
    /** CK Type ID for runtime entity lookup */
    ckTypeId?: string;
    /** Runtime ID (can include ${variables}) */
    rtId?: string;
    /** Query ID for persistent query */
    queryRtId?: string;
    /** Static value */
    staticValue?: unknown;
  };

  /** Attribute path to read the value from */
  attributePath: string;

  /** Value transformation configuration */
  transform?: ValueTransform;

  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
}

/**
 * Value transformation types
 */
export type TransformType = 'none' | 'linear' | 'percentage' | 'threshold' | 'map';

/**
 * Threshold definition for color/state changes
 */
export interface Threshold {
  /** Value at which this threshold activates */
  value: number;
  /** Color to apply when threshold is active */
  color: string;
  /** Optional label for the threshold */
  label?: string;
  /** Animation to apply at this threshold */
  animation?: 'none' | 'blink' | 'pulse';
}

/**
 * Value mapping for discrete values
 */
export interface ValueMapping {
  /** Input value to match */
  input: string | number | boolean;
  /** Output value/color/label */
  output: string;
  /** Optional color for this mapping */
  color?: string;
}

/**
 * Value transformation configuration
 */
export interface ValueTransform {
  /** Type of transformation */
  type: TransformType;
  /** Minimum input value (for linear/percentage) */
  min?: number;
  /** Maximum input value (for linear/percentage) */
  max?: number;
  /** Thresholds for color changes */
  thresholds?: Threshold[];
  /** Value mappings for discrete values */
  mappings?: ValueMapping[];
  /** Number of decimal places for display */
  decimals?: number;
  /** Prefix for displayed value */
  prefix?: string;
  /** Suffix for displayed value */
  suffix?: string;
}

// ============================================================================
// Element Configurations
// ============================================================================

/**
 * Base interface for all process elements
 */
export interface ProcessElementBase {
  /** Unique element ID */
  id: string;
  /** Element type */
  type: ProcessElementType;
  /** Display name (shown in designer) */
  name: string;
  /** Position on canvas */
  position: Position;
  /** Element size */
  size: Size;
  /** Rotation in degrees */
  rotation?: number;
  /** Visual style */
  style?: ElementStyle;
  /** Data binding configuration */
  dataBinding?: ProcessDataBinding;
  /** Z-index for layering */
  zIndex?: number;
  /** Whether element is visible */
  visible?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Enable click interaction (for future use) */
  interactive?: boolean;
}

// ---------- Container Elements ----------

/**
 * Tank element configuration
 */
export interface TankElementConfig extends ProcessElementBase {
  type: 'tank';
  config: {
    /** Tank shape */
    shape: 'cylindrical' | 'rectangular' | 'conical';
    /** Tank orientation */
    orientation: 'vertical' | 'horizontal';
    /** Show fill level indicator */
    showLevel: boolean;
    /** Show percentage text */
    showPercentage: boolean;
    /** Tank capacity (for display) */
    capacity?: number;
    /** Unit of measurement */
    unit?: string;
    /** Color when empty */
    emptyColor?: string;
    /** Color when filled (can be overridden by thresholds) */
    fillColor?: string;
  };
}

/**
 * Silo element configuration
 */
export interface SiloElementConfig extends ProcessElementBase {
  type: 'silo';
  config: {
    /** Show fill level indicator */
    showLevel: boolean;
    /** Show percentage text */
    showPercentage: boolean;
    /** Cone angle in degrees (default 30) */
    coneAngle?: number;
    /** Capacity for display */
    capacity?: number;
    /** Unit of measurement */
    unit?: string;
    /** Color when empty */
    emptyColor?: string;
    /** Color when filled */
    fillColor?: string;
  };
}

/**
 * Vessel element configuration
 */
export interface VesselElementConfig extends ProcessElementBase {
  type: 'vessel';
  config: {
    /** Vessel shape variant */
    shape: 'round' | 'flat' | 'dished';
    /** Show fill level */
    showLevel: boolean;
    /** Show percentage */
    showPercentage: boolean;
    /** Capacity */
    capacity?: number;
    /** Unit */
    unit?: string;
    /** Empty color */
    emptyColor?: string;
    /** Fill color */
    fillColor?: string;
  };
}

// ---------- Actuator Elements ----------

/**
 * Valve element configuration
 */
export interface ValveElementConfig extends ProcessElementBase {
  type: 'valve';
  config: {
    /** Valve type */
    valveType: 'gate' | 'ball' | 'butterfly' | 'check' | 'globe';
    /** Color when open */
    openColor?: string;
    /** Color when closed */
    closedColor?: string;
    /** Color when in error state */
    errorColor?: string;
    /** Show state label */
    showState?: boolean;
  };
}

/**
 * Pump element configuration
 */
export interface PumpElementConfig extends ProcessElementBase {
  type: 'pump';
  config: {
    /** Pump type */
    pumpType: 'centrifugal' | 'positive-displacement' | 'submersible';
    /** Show rotation animation when running */
    showAnimation?: boolean;
    /** Animation speed (rpm-like visual) */
    animationSpeed?: number;
    /** Color when running */
    runningColor?: string;
    /** Color when stopped */
    stoppedColor?: string;
    /** Color when in error */
    errorColor?: string;
    /** Show state label */
    showState?: boolean;
  };
}

/**
 * Motor element configuration
 */
export interface MotorElementConfig extends ProcessElementBase {
  type: 'motor';
  config: {
    /** Show rotation animation */
    showAnimation?: boolean;
    /** Animation speed */
    animationSpeed?: number;
    /** Color when running */
    runningColor?: string;
    /** Color when stopped */
    stoppedColor?: string;
    /** Color when error */
    errorColor?: string;
    /** Show state label */
    showState?: boolean;
  };
}

// ---------- Display Elements ----------

/**
 * Digital display element configuration
 */
export interface DigitalDisplayElementConfig extends ProcessElementBase {
  type: 'digitalDisplay';
  config: {
    /** Display format */
    format?: string;
    /** Number of digits */
    digits?: number;
    /** Text style */
    textStyle?: ProcessTextStyle;
    /** Background color */
    backgroundColor?: string;
    /** Show unit */
    showUnit?: boolean;
    /** Unit text */
    unit?: string;
  };
}

/**
 * Status light element configuration
 */
export interface StatusLightElementConfig extends ProcessElementBase {
  type: 'statusLight';
  config: {
    /** Light shape */
    shape: 'circle' | 'square' | 'rectangle';
    /** Color when on/true */
    onColor?: string;
    /** Color when off/false */
    offColor?: string;
    /** Show glow effect when on */
    showGlow?: boolean;
    /** Blink when on */
    blinkWhenOn?: boolean;
    /** Blink interval in ms */
    blinkInterval?: number;
  };
}

/**
 * Gauge element for process diagram (simpler than widget gauge)
 */
export interface ProcessGaugeElementConfig extends ProcessElementBase {
  type: 'gauge';
  config: {
    /** Gauge type */
    gaugeType: 'arc' | 'linear' | 'semicircle';
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Show value text */
    showValue?: boolean;
    /** Show scale */
    showScale?: boolean;
    /** Unit text */
    unit?: string;
    /** Value arc/bar color */
    valueColor?: string;
    /** Background arc/bar color */
    backgroundColor?: string;
  };
}

// ---------- Layout Elements ----------

/**
 * Label element configuration
 */
export interface LabelElementConfig extends ProcessElementBase {
  type: 'label';
  config: {
    /** Static text (if no data binding) */
    text: string;
    /** Text style */
    textStyle?: ProcessTextStyle;
    /** Background color */
    backgroundColor?: string;
    /** Show border */
    showBorder?: boolean;
    /** Padding */
    padding?: number;
  };
}

/**
 * Image element configuration
 */
export interface ImageElementConfig extends ProcessElementBase {
  type: 'image';
  config: {
    /** Image URL or base64 data */
    src: string;
    /** Alt text */
    alt?: string;
    /** Object fit mode */
    objectFit?: 'contain' | 'cover' | 'fill' | 'none';
    /** Preserve aspect ratio */
    preserveAspectRatio?: boolean;
  };
}

/**
 * Shape element configuration
 */
export interface ShapeElementConfig extends ProcessElementBase {
  type: 'shape';
  config: {
    /** Shape type */
    shapeType: 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'line';
    /** Border radius for rectangle */
    borderRadius?: number;
    /** Points for polygon (as "x1,y1 x2,y2 ..." string) */
    points?: string;
    /** Line start point */
    lineStart?: Position;
    /** Line end point */
    lineEnd?: Position;
  };
}

/**
 * Custom SVG element configuration
 * Allows importing custom SVG graphics
 */
export interface CustomSvgElementConfig extends ProcessElementBase {
  type: 'customSvg';
  config: {
    /** SVG content (inline SVG string) */
    svgContent: string;
    /** Preserve original colors (false = apply style colors) */
    preserveColors?: boolean;
    /** CSS class to apply */
    cssClass?: string;
    /** Data binding attribute selectors (maps attribute paths to SVG element IDs) */
    attributeBindings?: {
      /** SVG element ID or selector */
      selector: string;
      /** SVG attribute to modify (fill, stroke, transform, text, etc.) */
      svgAttribute: string;
      /** Data binding for this attribute */
      dataBinding: ProcessDataBinding;
    }[];
  };
}

/**
 * Union type of all element configurations
 */
export type ProcessElement =
  | TankElementConfig
  | SiloElementConfig
  | VesselElementConfig
  | ValveElementConfig
  | PumpElementConfig
  | MotorElementConfig
  | DigitalDisplayElementConfig
  | StatusLightElementConfig
  | ProcessGaugeElementConfig
  | LabelElementConfig
  | ImageElementConfig
  | ShapeElementConfig
  | CustomSvgElementConfig;

// ============================================================================
// Connections
// ============================================================================

/**
 * Connection port on an element
 */
export type ConnectionPort = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Animation types for connections
 */
export type ConnectionAnimationType = 'none' | 'flow' | 'pulse' | 'dash';

/**
 * Flow direction for animations
 */
export type FlowDirection = 'forward' | 'backward' | 'bidirectional';

/**
 * Connection style configuration
 */
export interface ConnectionStyle {
  /** Line width in pixels */
  strokeWidth: number;
  /** Line color */
  strokeColor: string;
  /** Dash pattern (e.g., [5, 3] for dashed line) */
  strokeDash?: number[];
  /** Line cap style */
  lineCap?: 'butt' | 'round' | 'square';
  /** Line join style */
  lineJoin?: 'miter' | 'round' | 'bevel';
}

/**
 * Connection animation configuration
 */
export interface ConnectionAnimation {
  /** Whether animation is enabled */
  enabled: boolean;
  /** Animation type */
  type: ConnectionAnimationType;
  /** Animation speed (1 = normal, 2 = double speed, etc.) */
  speed: number;
  /** Flow direction */
  direction: FlowDirection;
  /** Particle color for flow animation */
  particleColor?: string;
  /** Particle size for flow animation */
  particleSize?: number;
  /** Data binding to control animation (animation active when value > 0) */
  dataBinding?: ProcessDataBinding;
  /** Condition for animation to be active */
  activeWhen?: 'always' | 'positive' | 'nonZero' | 'true';
}

/**
 * Connection between two elements
 * Represents pipes, cables, or other connectors
 */
export interface ProcessConnection {
  /** Unique connection ID */
  id: string;
  /** Display name */
  name?: string;
  /** Source element and port */
  from: {
    elementId: string;
    port: ConnectionPort;
  };
  /** Target element and port */
  to: {
    elementId: string;
    port: ConnectionPort;
  };
  /** Intermediate path points for routing */
  pathPoints?: Position[];
  /** Connection style */
  style: ConnectionStyle;
  /** Animation configuration */
  animation?: ConnectionAnimation;
  /** Z-index for layering */
  zIndex?: number;
  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// Process Diagram Configuration
// ============================================================================

/**
 * Variable definition for process diagrams
 * Allows parameterization of data bindings
 */
export interface ProcessVariable {
  /** Variable name (without $ prefix) */
  name: string;
  /** Display label */
  label?: string;
  /** Description */
  description?: string;
  /** Data type */
  type: 'string' | 'number' | 'boolean';
  /** Default value */
  defaultValue?: string;
  /** Current value */
  value?: string;
}

/**
 * Re-export primitive types for use in diagrams
 */
export type { PrimitiveBase, PrimitiveTypeValue } from './primitives';
export { PrimitiveType } from './primitives';

/**
 * Re-export symbol types for use in diagrams
 */
export type { SymbolInstance, SymbolDefinition, SymbolLibrary } from './primitives/models/symbol.model';

/**
 * Re-export transform property types for diagram-level exposed properties
 */
export type { TransformProperty, PropertyBinding, TransformPropertyType, BindingEffectType, BindingTargetType, TransformAnchor } from './primitives/models/transform-property.models';

/**
 * Re-export animation types for diagram-level animations
 */
export type { AnimationDefinition, SVGAnimation, AnimationTiming, AnimationAnchor } from './primitives/models/animation.models';

/**
 * Complete process diagram configuration
 * This is the main configuration object stored in the backend
 */
export interface ProcessDiagramConfig {
  /** Unique diagram ID */
  id: string;
  /** Diagram name */
  name: string;
  /** Description */
  description?: string;
  /** Schema version for migrations */
  version: string;
  /** Canvas settings */
  canvas: ProcessCanvasConfig;
  /**
   * Elements on the canvas (legacy element types)
   * @deprecated Use symbolInstances instead. Elements will be removed in a future version.
   */
  elements: ProcessElement[];
  /** Primitives on the canvas (new primitive types: rectangles, ellipses, lines, etc.) */
  primitives?: import('./primitives').PrimitiveBase[];
  /** Symbol instances on the canvas (reusable components from symbol libraries) */
  symbolInstances?: import('./primitives/models/symbol.model').SymbolInstance[];
  /** Connections between elements */
  connections: ProcessConnection[];
  /** Variables for parameterization */
  variables?: ProcessVariable[];
  /** Global refresh interval (ms) */
  refreshInterval?: number;

  /**
   * Transform properties exposed by this diagram.
   * These define values that can be set at runtime to control
   * transforms, styles, visibility, and animations through expressions.
   */
  transformProperties?: import('./primitives/models/transform-property.models').TransformProperty[];

  /**
   * Bindings from transform properties to element properties.
   * Define how property values are transformed and applied to primitives and symbol instances.
   */
  propertyBindings?: import('./primitives/models/transform-property.models').PropertyBinding[];

  /**
   * Diagram-level animations.
   * These animations can target specific primitives by ID
   * and can be controlled via transform property bindings.
   */
  animations?: import('./primitives/models/animation.models').AnimationDefinition[];

  /** Metadata */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    tags?: string[];
  };
}

// ============================================================================
// Widget Integration
// ============================================================================

/**
 * Process Widget configuration (extends base widget config)
 * Used when embedding a process diagram as a MeshBoard widget
 */
export interface ProcessWidgetSpecificConfig {
  /** Reference to stored process diagram (by rtId) */
  processDiagramRtId?: string;
  /** Or inline configuration (for simple cases) */
  inlineConfig?: ProcessDiagramConfig;
  /** Enable zoom controls */
  allowZoom?: boolean;
  /** Enable pan/drag */
  allowPan?: boolean;
  /** Initial zoom level (1 = 100%) */
  initialZoom?: number;
  /** Fit diagram to widget bounds */
  fitToBounds?: boolean;
  /** Show toolbar (zoom controls, etc.) */
  showToolbar?: boolean;
}

// ============================================================================
// Runtime Data Types
// ============================================================================

/**
 * Runtime data for a single element
 * Populated by the data service
 */
export interface ElementRuntimeData {
  /** Element ID this data belongs to */
  elementId: string;
  /** Current value from data binding */
  value: unknown;
  /** Formatted display value */
  displayValue: string;
  /** Computed color based on thresholds */
  computedColor?: string;
  /** Whether animation should be active */
  animationActive?: boolean;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Error message if data fetch failed */
  error?: string;
}

/**
 * Runtime data for a connection
 */
export interface ConnectionRuntimeData {
  /** Connection ID */
  connectionId: string;
  /** Whether flow animation is active */
  flowActive: boolean;
  /** Flow rate value (for speed calculation) */
  flowRate?: number;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Error message */
  error?: string;
}

/**
 * Complete runtime state for a process diagram
 */
export interface ProcessDiagramRuntimeState {
  /** Element data map (elementId -> data) */
  elements: Map<string, ElementRuntimeData>;
  /** Connection data map (connectionId -> data) */
  connections: Map<string, ConnectionRuntimeData>;
  /** Overall loading state */
  isLoading: boolean;
  /** Last full refresh timestamp */
  lastRefresh: Date;
  /** Global error */
  error?: string;
}
