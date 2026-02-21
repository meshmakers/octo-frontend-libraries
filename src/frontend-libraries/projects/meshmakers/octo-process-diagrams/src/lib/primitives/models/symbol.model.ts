/**
 * Symbol Model
 *
 * Symbols are reusable compositions of primitives organized in libraries.
 * They can be instantiated in diagrams with custom position, scale, and rotation.
 */

import { PrimitiveBase, Position, BoundingBox } from './primitive.models';
import { TransformProperty, PropertyBinding } from './transform-property.models';
import { AnimationDefinition } from './animation.models';
import { StyleClass } from './style-class.model';

// ============================================================================
// Connection Points
// ============================================================================

/**
 * Direction for connection points
 */
export type ConnectionDirection = 'in' | 'out' | 'both';

/**
 * A connection point on a symbol where connections can attach
 */
export interface ConnectionPoint {
  /** Unique ID within the symbol */
  id: string;
  /** Display name */
  name: string;
  /** Position relative to symbol bounds (0-1 normalized or absolute) */
  position: Position;
  /** Connection direction */
  direction?: ConnectionDirection;
}

// ============================================================================
// Symbol Parameters (for future customization)
// ============================================================================

/**
 * Parameter types for symbol customization
 */
export type SymbolParameterType = 'string' | 'number' | 'color' | 'boolean';

/**
 * Binding from a parameter to a primitive property
 */
export interface SymbolParameterBinding {
  /** ID of the primitive to modify */
  primitiveId: string;
  /** Property path (e.g., "style.fill.color" or "config.width") */
  property: string;
}

/**
 * A customizable parameter for a symbol
 */
export interface SymbolParameter {
  /** Unique ID within the symbol */
  id: string;
  /** Display name */
  name: string;
  /** Parameter type */
  type: SymbolParameterType;
  /** Default value */
  defaultValue: unknown;
  /** Which primitive properties this parameter affects */
  bindings: SymbolParameterBinding[];
}

// ============================================================================
// Symbol Definition
// ============================================================================

/**
 * A symbol definition - a reusable template composed of primitives.
 * Stored as a separate CK entity in the backend.
 */
export interface SymbolDefinition {
  /** Runtime ID from backend (unique identifier) */
  rtId: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Version for tracking changes */
  version: string;

  /** Primitives that make up this symbol (positions relative to 0,0) */
  primitives: PrimitiveBase[];

  /** Nested symbol instances (positions relative to 0,0) */
  symbolInstances?: SymbolInstance[];

  /** Bounding box / default size (calculated from content) */
  bounds: { width: number; height: number };

  /**
   * Preferred canvas size for the symbol editor.
   * Separate from bounds which is calculated from content.
   * If not set, bounds is used as fallback.
   */
  canvasSize?: { width: number; height: number };

  /** Grid size for the symbol editor (default: 10) */
  gridSize?: number;

  /** Optional connection points for wiring */
  connectionPoints?: ConnectionPoint[];

  /** Optional customizable parameters (legacy - use transformProperties for new implementations) */
  parameters?: SymbolParameter[];

  /**
   * Transform properties exposed by this symbol.
   * These define values that can be set on instances to control
   * transforms, styles, and visibility through expressions.
   */
  transformProperties?: TransformProperty[];

  /**
   * Bindings from transform properties to element properties.
   * Define how property values are transformed and applied.
   */
  propertyBindings?: PropertyBinding[];

  /**
   * Symbol-level animations.
   * These animations are applied to the symbol as a whole or can target
   * specific primitives by ID. Can be linked to transform properties.
   */
  animations?: AnimationDefinition[];

  /**
   * Named style classes for this symbol.
   * Style classes provide reusable style configurations that can be applied
   * to primitives via `styleClassId` reference.
   */
  styleClasses?: StyleClass[];

  /** Tags for filtering/searching (comma-separated in backend) */
  tags?: string[];
  /** Category for grouping */
  category?: string;

  /** Preview image (data URL or external URL) */
  previewImage?: string;

  /** Reference to parent library rtId */
  libraryRtId?: string;
}

// ============================================================================
// Symbol Library
// ============================================================================

/**
 * A library is a collection of symbols
 */
export interface SymbolLibrary {
  /** Runtime ID from backend */
  id: string;
  /** Library name */
  name: string;
  /** Description */
  description?: string;
  /** Library version */
  version: string;

  /** Symbols in this library */
  symbols: SymbolDefinition[];

  /** Author information */
  author?: string;
  /** Is this a built-in system library? */
  isBuiltIn?: boolean;
  /** Is this library read-only? */
  isReadOnly?: boolean;

  /** Creation timestamp */
  createdAt?: string;
  /** Last modification timestamp */
  updatedAt?: string;
}

// ============================================================================
// Symbol Instance (placed in a diagram)
// ============================================================================

/**
 * An instance of a symbol placed in a diagram
 */
export interface SymbolInstance {
  /** Unique instance ID within the diagram */
  id: string;
  /** Type discriminator */
  type: 'symbol';

  /** Reference to the library containing the symbol (rtId) */
  libraryRtId: string;
  /** Reference to the symbol definition (rtId) */
  symbolRtId: string;

  /** Position on canvas */
  position: Position;
  /** Scale factor (default: 1) */
  scale?: number;
  /** Rotation in degrees (default: 0) */
  rotation?: number;

  /** Parameter value overrides (legacy - use propertyValues for new implementations) */
  parameterValues?: Record<string, unknown>;

  /**
   * Transform property value overrides.
   * Keys are property IDs, values are the override values.
   *
   * @example
   * ```typescript
   * propertyValues: {
   *   'rotation': 180,
   *   'fillLevel': 75,
   *   'alertColor': '#ff0000'
   * }
   * ```
   */
  propertyValues?: Record<string, unknown>;

  /** Z-index for layering */
  zIndex?: number;
  /** Visibility */
  visible?: boolean;
  /** Lock state */
  locked?: boolean;
  /** Instance name for identification */
  name?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for SymbolInstance
 */
export function isSymbolInstance(obj: unknown): obj is SymbolInstance {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as SymbolInstance).type === 'symbol' &&
    'libraryRtId' in obj &&
    'symbolRtId' in obj
  );
}

/**
 * Type guard for SymbolDefinition
 */
export function isSymbolDefinition(obj: unknown): obj is SymbolDefinition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'rtId' in obj &&
    'name' in obj &&
    'primitives' in obj &&
    Array.isArray((obj as SymbolDefinition).primitives) &&
    'bounds' in obj
  );
}

/**
 * Type guard for SymbolLibrary
 */
export function isSymbolLibrary(obj: unknown): obj is SymbolLibrary {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'symbols' in obj &&
    Array.isArray((obj as SymbolLibrary).symbols)
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new symbol instance
 */
export function createSymbolInstance(
  libraryRtId: string,
  symbolRtId: string,
  position: Position,
  options?: Partial<Omit<SymbolInstance, 'id' | 'type' | 'libraryRtId' | 'symbolRtId' | 'position'>>
): SymbolInstance {
  return {
    id: generateId(),
    type: 'symbol',
    libraryRtId,
    symbolRtId,
    position,
    scale: options?.scale ?? 1,
    rotation: options?.rotation ?? 0,
    parameterValues: options?.parameterValues,
    propertyValues: options?.propertyValues,
    zIndex: options?.zIndex,
    visible: options?.visible ?? true,
    locked: options?.locked ?? false,
    name: options?.name
  };
}

/**
 * Create a new symbol definition (for local use before saving to backend)
 * Note: rtId will be assigned by the backend when saved
 */
export function createSymbolDefinition(
  name: string,
  primitives: PrimitiveBase[],
  options?: Partial<Omit<SymbolDefinition, 'rtId' | 'name' | 'primitives'>>
): Omit<SymbolDefinition, 'rtId'> & { rtId?: string } {
  const bounds = options?.bounds ?? calculateBoundsFromPrimitives(primitives);
  return {
    rtId: undefined, // Will be assigned by backend
    name,
    primitives,
    bounds,
    version: options?.version ?? '1.0',
    description: options?.description,
    connectionPoints: options?.connectionPoints,
    parameters: options?.parameters,
    transformProperties: options?.transformProperties,
    propertyBindings: options?.propertyBindings,
    tags: options?.tags,
    category: options?.category,
    previewImage: options?.previewImage,
    libraryRtId: options?.libraryRtId
  };
}

/**
 * Create a new symbol library
 */
export function createSymbolLibrary(
  name: string,
  options?: Partial<Omit<SymbolLibrary, 'id' | 'name' | 'symbols'>>
): SymbolLibrary {
  return {
    id: generateId(),
    name,
    symbols: [],
    version: options?.version ?? '1.0',
    description: options?.description,
    author: options?.author,
    isBuiltIn: options?.isBuiltIn ?? false,
    isReadOnly: options?.isReadOnly ?? false
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate bounding box from an array of primitives
 */
export function calculateBoundsFromPrimitives(primitives: PrimitiveBase[]): { width: number; height: number } {
  if (primitives.length === 0) {
    return { width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const primitive of primitives) {
    const pos = primitive.position;

    // Simple estimation based on position
    // A proper implementation would use the renderer's getBoundingBox
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + 100); // Placeholder
    maxY = Math.max(maxY, pos.y + 100); // Placeholder
  }

  return {
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Get the bounding box of a symbol instance
 */
export function getSymbolInstanceBounds(
  instance: SymbolInstance,
  definition: SymbolDefinition
): BoundingBox {
  const scale = instance.scale ?? 1;
  const width = definition.bounds.width * scale;
  const height = definition.bounds.height * scale;

  return {
    x: instance.position.x,
    y: instance.position.y,
    width,
    height
  };
}

/**
 * Find a symbol definition in a library by rtId
 */
export function findSymbolInLibrary(
  library: SymbolLibrary,
  symbolRtId: string
): SymbolDefinition | undefined {
  return library.symbols.find(s => s.rtId === symbolRtId);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `sym_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Circular Dependency Detection
// ============================================================================

/**
 * Result of circular dependency check
 */
export interface CircularDependencyCheckResult {
  /** Whether circular dependencies were found */
  hasCircularDependency: boolean;
  /** The chain of symbol rtIds that form the cycle (if found) */
  cyclePath?: string[];
  /** Human-readable error message */
  errorMessage?: string;
}

/**
 * Check if adding symbol instances to a symbol would create circular dependencies.
 *
 * @param symbolRtId - The rtId of the symbol being edited
 * @param symbolInstances - The symbol instances to be added
 * @param getSymbolDefinition - Function to fetch a symbol definition by rtId
 * @returns Result indicating if circular dependencies exist
 */
export async function checkCircularDependencies(
  symbolRtId: string,
  symbolInstances: SymbolInstance[],
  getSymbolDefinition: (rtId: string) => Promise<SymbolDefinition | null>
): Promise<CircularDependencyCheckResult> {
  if (!symbolInstances || symbolInstances.length === 0) {
    return { hasCircularDependency: false };
  }

  // Check each symbol instance for direct or indirect reference to the current symbol
  const visited = new Set<string>();
  const path: string[] = [symbolRtId];

  for (const instance of symbolInstances) {
    const result = await checkSymbolForCircularRef(
      instance.symbolRtId,
      symbolRtId,
      visited,
      [...path],
      getSymbolDefinition
    );

    if (result.hasCircularDependency) {
      return result;
    }
  }

  return { hasCircularDependency: false };
}

/**
 * Recursively check if a symbol references the target symbol (directly or indirectly)
 */
async function checkSymbolForCircularRef(
  currentSymbolRtId: string,
  targetSymbolRtId: string,
  visited: Set<string>,
  path: string[],
  getSymbolDefinition: (rtId: string) => Promise<SymbolDefinition | null>
): Promise<CircularDependencyCheckResult> {
  // Direct circular reference
  if (currentSymbolRtId === targetSymbolRtId) {
    return {
      hasCircularDependency: true,
      cyclePath: [...path, currentSymbolRtId],
      errorMessage: `Circular dependency detected: Symbol cannot contain itself (directly or indirectly). Path: ${[...path, currentSymbolRtId].join(' → ')}`
    };
  }

  // Already visited this symbol in current traversal (prevent infinite loops)
  if (visited.has(currentSymbolRtId)) {
    return { hasCircularDependency: false };
  }

  visited.add(currentSymbolRtId);
  path.push(currentSymbolRtId);

  // Get the symbol definition to check its nested symbols
  const symbolDef = await getSymbolDefinition(currentSymbolRtId);
  if (!symbolDef || !symbolDef.symbolInstances || symbolDef.symbolInstances.length === 0) {
    return { hasCircularDependency: false };
  }

  // Recursively check all nested symbol instances
  for (const nestedInstance of symbolDef.symbolInstances) {
    const result = await checkSymbolForCircularRef(
      nestedInstance.symbolRtId,
      targetSymbolRtId,
      visited,
      [...path],
      getSymbolDefinition
    );

    if (result.hasCircularDependency) {
      return result;
    }
  }

  return { hasCircularDependency: false };
}

/**
 * Synchronous version of circular dependency check (for use when all symbols are cached)
 */
export function checkCircularDependenciesSync(
  symbolRtId: string,
  symbolInstances: SymbolInstance[],
  symbolCache: Map<string, SymbolDefinition>
): CircularDependencyCheckResult {
  if (!symbolInstances || symbolInstances.length === 0) {
    return { hasCircularDependency: false };
  }

  const visited = new Set<string>();
  const path: string[] = [symbolRtId];

  for (const instance of symbolInstances) {
    const result = checkSymbolForCircularRefSync(
      instance.symbolRtId,
      symbolRtId,
      visited,
      [...path],
      symbolCache
    );

    if (result.hasCircularDependency) {
      return result;
    }
  }

  return { hasCircularDependency: false };
}

/**
 * Synchronous recursive check for circular references
 */
function checkSymbolForCircularRefSync(
  currentSymbolRtId: string,
  targetSymbolRtId: string,
  visited: Set<string>,
  path: string[],
  symbolCache: Map<string, SymbolDefinition>
): CircularDependencyCheckResult {
  if (currentSymbolRtId === targetSymbolRtId) {
    return {
      hasCircularDependency: true,
      cyclePath: [...path, currentSymbolRtId],
      errorMessage: `Circular dependency detected: Symbol cannot contain itself. Path: ${[...path, currentSymbolRtId].join(' → ')}`
    };
  }

  if (visited.has(currentSymbolRtId)) {
    return { hasCircularDependency: false };
  }

  visited.add(currentSymbolRtId);
  path.push(currentSymbolRtId);

  const symbolDef = symbolCache.get(currentSymbolRtId);
  if (!symbolDef || !symbolDef.symbolInstances || symbolDef.symbolInstances.length === 0) {
    return { hasCircularDependency: false };
  }

  for (const nestedInstance of symbolDef.symbolInstances) {
    const result = checkSymbolForCircularRefSync(
      nestedInstance.symbolRtId,
      targetSymbolRtId,
      visited,
      [...path],
      symbolCache
    );

    if (result.hasCircularDependency) {
      return result;
    }
  }

  return { hasCircularDependency: false };
}
