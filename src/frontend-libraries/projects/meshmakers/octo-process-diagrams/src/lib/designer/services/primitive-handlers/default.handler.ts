/**
 * Default Primitive Handler
 *
 * Fallback handler for primitive types that don't have specific handling.
 * Uses position-based operations which work for most simple primitives.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface GenericPrimitive extends PrimitiveBase {
  config?: {
    width?: number;
    height?: number;
  };
}

export class DefaultHandler implements PrimitiveHandler {
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
    const p = primitive as GenericPrimitive;
    return {
      x: primitive.position.x,
      y: primitive.position.y,
      width: p.config?.width ?? 100,
      height: p.config?.height ?? 100
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { childStartBounds, groupStartBounds, groupNewBounds, scaleX, scaleY } = params;

    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;

    // For generic primitives, just update position
    return {
      ...primitive,
      position: { x: newX, y: newY }
    };
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    return {
      ...primitive,
      position: { x: newBounds.x, y: newBounds.y }
    };
  }
}
