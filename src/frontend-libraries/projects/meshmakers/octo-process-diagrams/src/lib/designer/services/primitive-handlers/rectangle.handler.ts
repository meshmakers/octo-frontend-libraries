/**
 * Rectangle Primitive Handler
 *
 * Handles move, resize, and bounds calculations for rectangle primitives.
 * Also used for Image primitives which share the same geometry model.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface RectanglePrimitive extends PrimitiveBase {
  config: {
    width: number;
    height: number;
  };
}

export class RectangleHandler implements PrimitiveHandler {
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
    const p = primitive as RectanglePrimitive;
    return {
      x: primitive.position.x,
      y: primitive.position.y,
      width: p.config.width,
      height: p.config.height
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { childStartBounds, groupStartBounds, groupNewBounds, scaleX, scaleY } = params;
    const p = primitive as RectanglePrimitive;

    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;
    const newWidth = childStartBounds.width * scaleX;
    const newHeight = childStartBounds.height * scaleY;

    return {
      ...primitive,
      position: { x: newX, y: newY },
      config: {
        ...p.config,
        width: Math.max(5, newWidth),
        height: Math.max(5, newHeight)
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const p = primitive as RectanglePrimitive;
    return {
      ...primitive,
      position: { x: newBounds.x, y: newBounds.y },
      config: {
        ...p.config,
        width: Math.max(5, newBounds.width),
        height: Math.max(5, newBounds.height)
      }
    } as PrimitiveBase;
  }
}
