/**
 * Text Primitive Handler
 *
 * Handles move, resize, and bounds calculations for text primitives.
 * Text primitives scale by adjusting font size rather than transform.
 */

import { PrimitiveBase, Position } from '../../../primitives';
import { PrimitiveHandler, PrimitiveBounds, GroupScaleParams } from './primitive-handler.interface';

interface TextPrimitive extends PrimitiveBase {
  config: {
    text: string;
    textStyle?: {
      fontSize?: number;
    };
    width?: number;
    height?: number;
  };
}

export class TextHandler implements PrimitiveHandler {
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
    const p = primitive as TextPrimitive;
    const fontSize = p.config.textStyle?.fontSize ?? 14;

    // Estimate text bounds based on font size and text length
    const estimatedWidth = p.config.width ?? (p.config.text?.length ?? 10) * fontSize * 0.6;
    const estimatedHeight = p.config.height ?? fontSize * 1.2;

    return {
      x: primitive.position.x,
      y: primitive.position.y,
      width: estimatedWidth,
      height: estimatedHeight
    };
  }

  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase {
    const { childStartBounds, groupStartBounds, groupNewBounds, scaleX, scaleY } = params;
    const p = primitive as TextPrimitive;

    // Calculate relative position within the group
    const relX = childStartBounds.x - groupStartBounds.x;
    const relY = childStartBounds.y - groupStartBounds.y;

    // New position scaled within new group bounds
    const newX = groupNewBounds.x + relX * scaleX;
    const newY = groupNewBounds.y + relY * scaleY;

    // Scale font size using average scale
    const currentFontSize = p.config.textStyle?.fontSize ?? 14;
    const avgScale = (scaleX + scaleY) / 2;

    return {
      ...primitive,
      position: { x: newX, y: newY },
      config: {
        ...p.config,
        textStyle: {
          ...p.config.textStyle,
          fontSize: Math.max(6, currentFontSize * avgScale)
        }
      }
    } as PrimitiveBase;
  }

  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase {
    const currentBounds = this.getBounds(primitive);
    const p = primitive as TextPrimitive;

    // Calculate average scale for font size
    const scaleX = currentBounds.width > 0 ? newBounds.width / currentBounds.width : 1;
    const scaleY = currentBounds.height > 0 ? newBounds.height / currentBounds.height : 1;
    const avgScale = (scaleX + scaleY) / 2;

    const currentFontSize = p.config.textStyle?.fontSize ?? 14;

    return {
      ...primitive,
      position: { x: newBounds.x, y: newBounds.y },
      config: {
        ...p.config,
        textStyle: {
          ...p.config.textStyle,
          fontSize: Math.max(6, currentFontSize * avgScale)
        }
      }
    } as PrimitiveBase;
  }
}
