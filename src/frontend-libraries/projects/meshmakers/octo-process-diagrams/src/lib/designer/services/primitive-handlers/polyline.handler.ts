/**
 * Polyline Primitive Handler
 *
 * Handles move, resize, and bounds calculations for polyline and polygon primitives.
 * These primitives store their geometry as an array of points in config.points.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface PolylinePrimitive extends PrimitiveBase {
  config: {
    points: Position[];
  };
}

export class PolylineHandler implements PrimitiveHandler {
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase {
    const p = primitive as PolylinePrimitive;
    return {
      ...primitive,
      config: {
        ...p.config,
        points: p.config.points.map(pt => ({
          x: pt.x + delta.x,
          y: pt.y + delta.y
        }))
      }
    } as PrimitiveBase;
  }

  getBounds(primitive: PrimitiveBase): PrimitiveBounds {
    const p = primitive as PolylinePrimitive;
    const points = p.config.points;

    if (points.length === 0) {
      return {
        x: primitive.position.x,
        y: primitive.position.y,
        width: 0,
        height: 0
      };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const pt of points) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }

    // Include primitive.position offset (consistent with designer-grouping.service.ts)
    return {
      x: primitive.position.x + minX,
      y: primitive.position.y + minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { groupStartBounds, groupNewBounds, scaleX, scaleY } = params;
    const p = primitive as PolylinePrimitive;
    const pos = primitive.position;

    // Scale each point relative to group origin
    // Points are stored relative to position, so add position for absolute coords
    const scaledPoints = p.config.points.map(pt => {
      // Get absolute position of this point
      const absX = pt.x + pos.x;
      const absY = pt.y + pos.y;
      // Calculate relative position within group
      const relX = absX - groupStartBounds.x;
      const relY = absY - groupStartBounds.y;
      // Scale and get new absolute position
      const newAbsX = groupNewBounds.x + relX * scaleX;
      const newAbsY = groupNewBounds.y + relY * scaleY;
      // Convert back to relative to position
      return {
        x: newAbsX - pos.x,
        y: newAbsY - pos.y
      };
    });

    return {
      ...primitive,
      config: {
        ...p.config,
        points: scaledPoints
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const p = primitive as PolylinePrimitive;
    const pos = primitive.position;
    const currentBounds = this.getBounds(primitive);

    // Calculate scale factors
    const scaleX = currentBounds.width > 0 ? newBounds.width / currentBounds.width : 1;
    const scaleY = currentBounds.height > 0 ? newBounds.height / currentBounds.height : 1;

    // Scale points relative to current bounds origin
    // Points are stored relative to position, so add position for absolute coords
    // After resize, position moves to newBounds.x/y and points become relative to that
    const scaledPoints = p.config.points.map(pt => {
      // Get absolute position of this point
      const absX = pt.x + pos.x;
      const absY = pt.y + pos.y;
      // Calculate relative position within current bounds
      const relX = absX - currentBounds.x;
      const relY = absY - currentBounds.y;
      // Scale to get position relative to new bounds origin
      // These become the new points relative to the updated position
      return {
        x: relX * scaleX,
        y: relY * scaleY
      };
    });

    return {
      ...primitive,
      position: { x: newBounds.x, y: newBounds.y },
      config: {
        ...p.config,
        points: scaledPoints
      }
    } as PrimitiveBase;
  }
}
