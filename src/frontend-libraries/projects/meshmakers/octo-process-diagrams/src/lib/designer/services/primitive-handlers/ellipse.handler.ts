/**
 * Ellipse Primitive Handler
 *
 * Handles move, resize, and bounds calculations for ellipse primitives.
 * Ellipse position is at the center, with radiusX and radiusY for dimensions.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface EllipsePrimitive extends PrimitiveBase {
  config: {
    radiusX: number;
    radiusY: number;
  };
}

export class EllipseHandler implements PrimitiveHandler {
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
    const p = primitive as EllipsePrimitive;
    // Position is center, so bounds start at position - radius
    return {
      x: primitive.position.x - p.config.radiusX,
      y: primitive.position.y - p.config.radiusY,
      width: p.config.radiusX * 2,
      height: p.config.radiusY * 2
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { childStartBounds, groupStartBounds, groupNewBounds, scaleX, scaleY } = params;
    const p = primitive as EllipsePrimitive;

    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;
    const newWidth = childStartBounds.width * scaleX;
    const newHeight = childStartBounds.height * scaleY;

    // For ellipse, position is center
    return {
      ...primitive,
      position: { x: newX + newWidth / 2, y: newY + newHeight / 2 },
      config: {
        ...p.config,
        radiusX: Math.max(2.5, newWidth / 2),
        radiusY: Math.max(2.5, newHeight / 2)
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const p = primitive as EllipsePrimitive;
    // Position is center, so add half width/height
    return {
      ...primitive,
      position: {
        x: newBounds.x + newBounds.width / 2,
        y: newBounds.y + newBounds.height / 2
      },
      config: {
        ...p.config,
        radiusX: Math.max(2.5, newBounds.width / 2),
        radiusY: Math.max(2.5, newBounds.height / 2)
      }
    } as PrimitiveBase;
  }
}
