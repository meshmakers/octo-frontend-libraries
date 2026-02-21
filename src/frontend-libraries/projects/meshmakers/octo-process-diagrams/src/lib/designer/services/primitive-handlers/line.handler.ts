/**
 * Line Primitive Handler
 *
 * Handles move, resize, and bounds calculations for line primitives.
 * Lines are defined by start and end points in config, not by position.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface LinePrimitive extends PrimitiveBase {
  config: {
    start: Position;
    end: Position;
  };
}

export class LineHandler implements PrimitiveHandler {
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase {
    const p = primitive as LinePrimitive;
    return {
      ...primitive,
      config: {
        ...p.config,
        start: {
          x: Math.round(p.config.start.x + delta.x),
          y: Math.round(p.config.start.y + delta.y)
        },
        end: {
          x: Math.round(p.config.end.x + delta.x),
          y: Math.round(p.config.end.y + delta.y)
        }
      }
    } as PrimitiveBase;
  }

  getBounds(primitive: PrimitiveBase): PrimitiveBounds {
    const p = primitive as LinePrimitive;
    // config.start/end are relative to position (as used in rendering)
    const minX = Math.min(p.config.start.x, p.config.end.x);
    const maxX = Math.max(p.config.start.x, p.config.end.x);
    const minY = Math.min(p.config.start.y, p.config.end.y);
    const maxY = Math.max(p.config.start.y, p.config.end.y);

    return {
      // Add position offset to get absolute bounds (consistent with rendering)
      x: minX + primitive.position.x,
      y: minY + primitive.position.y,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { groupStartBounds, groupNewBounds, scaleX, scaleY } = params;
    const p = primitive as LinePrimitive;
    const pos = primitive.position;

    // Convert relative coords to absolute, scale, then back to relative
    const scalePoint = (pt: Position): Position => {
      // Convert to absolute coordinates
      const absX = pt.x + pos.x;
      const absY = pt.y + pos.y;
      // Scale relative to group origin
      const relX = absX - groupStartBounds.x;
      const relY = absY - groupStartBounds.y;
      const scaledAbsX = groupNewBounds.x + relX * scaleX;
      const scaledAbsY = groupNewBounds.y + relY * scaleY;
      // Convert back to relative (position stays the same)
      return {
        x: Math.round(scaledAbsX - pos.x),
        y: Math.round(scaledAbsY - pos.y)
      };
    };

    return {
      ...primitive,
      config: {
        ...p.config,
        start: scalePoint(p.config.start),
        end: scalePoint(p.config.end)
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const p = primitive as LinePrimitive;
    const pos = primitive.position;
    const currentBounds = this.getBounds(primitive);

    // Calculate scale factors
    const scaleX = currentBounds.width > 0 ? newBounds.width / currentBounds.width : 1;
    const scaleY = currentBounds.height > 0 ? newBounds.height / currentBounds.height : 1;

    // Scale points: convert relative to absolute, scale, convert back to relative
    const scalePoint = (pt: Position): Position => {
      // Convert to absolute coordinates
      const absX = pt.x + pos.x;
      const absY = pt.y + pos.y;
      // Scale relative to current bounds origin
      const relX = absX - currentBounds.x;
      const relY = absY - currentBounds.y;
      const scaledAbsX = newBounds.x + relX * scaleX;
      const scaledAbsY = newBounds.y + relY * scaleY;
      // Convert back to relative (position stays the same)
      return {
        x: Math.round(scaledAbsX - pos.x),
        y: Math.round(scaledAbsY - pos.y)
      };
    };

    return {
      ...primitive,
      config: {
        ...p.config,
        start: scalePoint(p.config.start),
        end: scalePoint(p.config.end)
      }
    } as PrimitiveBase;
  }
}
