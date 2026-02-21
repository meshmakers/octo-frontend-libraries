/**
 * Path Primitive Handler
 *
 * Handles move, resize, and bounds calculations for path primitives.
 * Paths use position and transform for scaling, as they contain complex SVG path data.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PathPrimitive, estimatePathBounds } from '../../../primitives/models/path.model';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

export class PathHandler implements PrimitiveHandler {
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase {
    return {
      ...primitive,
      position: {
        x: primitive.position.x + delta.x,
        y: primitive.position.y + delta.y
      }
    };
  }

  getBounds(primitive: PrimitiveBase): PrimitiveBounds {
    // Use estimatePathBounds to calculate actual bounds from the path's d string
    // This correctly handles paths with absolute coordinates baked into the d attribute
    const bounds = estimatePathBounds(primitive as PathPrimitive);

    // Apply transform scale if present
    const scaleX = primitive.transform?.scaleX ?? 1;
    const scaleY = primitive.transform?.scaleY ?? 1;

    if (scaleX !== 1 || scaleY !== 1) {
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width * scaleX,
        height: bounds.height * scaleY
      };
    }

    return bounds;
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { childStartBounds, groupStartBounds, groupNewBounds, scaleX, scaleY } = params;

    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;

    // For paths, apply scale through transform
    return {
      ...primitive,
      position: { x: newX, y: newY },
      transform: {
        ...primitive.transform,
        scaleX: (primitive.transform?.scaleX ?? 1) * scaleX,
        scaleY: (primitive.transform?.scaleY ?? 1) * scaleY
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const currentBounds = this.getBounds(primitive);

    // Calculate scale factors relative to current size
    const scaleX = currentBounds.width > 0 ? newBounds.width / currentBounds.width : 1;
    const scaleY = currentBounds.height > 0 ? newBounds.height / currentBounds.height : 1;

    return {
      ...primitive,
      position: { x: newBounds.x, y: newBounds.y },
      transform: {
        ...primitive.transform,
        scaleX: (primitive.transform?.scaleX ?? 1) * scaleX,
        scaleY: (primitive.transform?.scaleY ?? 1) * scaleY
      }
    } as PrimitiveBase;
  }
}
