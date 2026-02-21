/**
 * Primitive Models - Barrel Export
 */

// Base types and interfaces
export * from './primitive.models';

// Transform property types
export * from './transform-property.models';

// Animation types
export * from './animation.models';

// Style class types
export * from './style-class.model';

// Specific primitive types
export * from './rectangle.model';
export * from './ellipse.model';
export * from './line.model';
export * from './path.model';
export * from './polygon.model';
export * from './image.model';
export * from './text.model';
export * from './group.model';

// Union type of all primitives
import { RectanglePrimitive } from './rectangle.model';
import { EllipsePrimitive } from './ellipse.model';
import { LinePrimitive } from './line.model';
import { PathPrimitive } from './path.model';
import { PolygonPrimitive, PolylinePrimitive } from './polygon.model';
import { ImagePrimitive } from './image.model';
import { TextPrimitive } from './text.model';
import { GroupPrimitive } from './group.model';

/**
 * Union type of all primitive elements
 */
export type Primitive =
  | RectanglePrimitive
  | EllipsePrimitive
  | LinePrimitive
  | PathPrimitive
  | PolygonPrimitive
  | PolylinePrimitive
  | ImagePrimitive
  | TextPrimitive
  | GroupPrimitive;
