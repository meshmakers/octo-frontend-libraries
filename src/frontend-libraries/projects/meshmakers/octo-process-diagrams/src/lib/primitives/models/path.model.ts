/**
 * Path Primitive Model
 *
 * Supports SVG path data format (d attribute)
 */

import { PrimitiveBase, PrimitiveType, BoundingBox } from './primitive.models';

/**
 * Path fill rule
 */
export type FillRule = 'nonzero' | 'evenodd';

/**
 * Path-specific configuration
 */
export interface PathConfig {
  /** SVG path data (d attribute) */
  d: string;
  /** Fill rule for complex paths */
  fillRule?: FillRule;
}

/**
 * Path primitive element
 */
export interface PathPrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Path;
  config: PathConfig;
}

/**
 * Type guard for Path primitive
 */
export function isPath(primitive: PrimitiveBase): primitive is PathPrimitive {
  return primitive.type === PrimitiveType.Path;
}

/**
 * Create a new path primitive
 */
export function createPath(
  id: string,
  d: string,
  x = 0,
  y = 0,
  options?: Partial<Omit<PathPrimitive, 'id' | 'type' | 'position' | 'config'> & { config?: Partial<Omit<PathConfig, 'd'>> }>
): PathPrimitive {
  const { config: configOptions, ...rest } = options ?? {};
  return {
    ...rest,
    id,
    type: PrimitiveType.Path,
    position: { x, y },
    config: {
      d,
      fillRule: configOptions?.fillRule
    }
  };
}

/**
 * Parse numbers from SVG path argument string, handling negative numbers
 * that may follow other numbers without separator (e.g., "4-90.12" → [4, -90.12])
 */
export function parsePathNumbers(argsStr: string): number[] {
  const numbers: number[] = [];
  // Match numbers including negative numbers, decimals, and scientific notation
  // This regex handles cases like "4-90.12" correctly by matching the negative sign
  const numberRegex = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  let numMatch: RegExpExecArray | null;

  while ((numMatch = numberRegex.exec(argsStr)) !== null) {
    const num = parseFloat(numMatch[0]);
    if (!isNaN(num)) {
      numbers.push(num);
    }
  }

  return numbers;
}

/**
 * Parse path bounds by properly parsing SVG path commands.
 * Handles both absolute (uppercase) and relative (lowercase) commands.
 */
export function estimatePathBounds(path: PathPrimitive): BoundingBox {
  const d = path.config.d;
  if (!d || d.trim().length === 0) {
    return { x: path.position.x, y: path.position.y, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;

  // Track point for bounds
  const trackPoint = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  // Parse path commands using regex
  const commandRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(d)) !== null) {
    const command = match[1];
    const argsStr = match[2].trim();
    // Parse numbers including negative values that follow other numbers without separator
    // e.g., "4-90.12" should become [4, -90.12]
    const args = argsStr.length > 0
      ? parsePathNumbers(argsStr)
      : [];
    const isRelative = command === command.toLowerCase();

    switch (command.toUpperCase()) {
      case 'M': // MoveTo
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX = isRelative ? currentX + args[i] : args[i];
            currentY = isRelative ? currentY + args[i + 1] : args[i + 1];
            if (i === 0) {
              startX = currentX;
              startY = currentY;
            }
            trackPoint(currentX, currentY);
          }
        }
        break;
      case 'L': // LineTo
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX = isRelative ? currentX + args[i] : args[i];
            currentY = isRelative ? currentY + args[i + 1] : args[i + 1];
            trackPoint(currentX, currentY);
          }
        }
        break;
      case 'H': // Horizontal LineTo
        for (const arg of args) {
          currentX = isRelative ? currentX + arg : arg;
          trackPoint(currentX, currentY);
        }
        break;
      case 'V': // Vertical LineTo
        for (const arg of args) {
          currentY = isRelative ? currentY + arg : arg;
          trackPoint(currentX, currentY);
        }
        break;
      case 'C': // Cubic Bezier
        for (let i = 0; i < args.length; i += 6) {
          if (i + 5 < args.length) {
            const x1 = isRelative ? currentX + args[i] : args[i];
            const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
            const x2 = isRelative ? currentX + args[i + 2] : args[i + 2];
            const y2 = isRelative ? currentY + args[i + 3] : args[i + 3];
            const x = isRelative ? currentX + args[i + 4] : args[i + 4];
            const y = isRelative ? currentY + args[i + 5] : args[i + 5];
            trackPoint(x1, y1);
            trackPoint(x2, y2);
            trackPoint(x, y);
            currentX = x;
            currentY = y;
          }
        }
        break;
      case 'S': // Smooth Cubic Bezier
        for (let i = 0; i < args.length; i += 4) {
          if (i + 3 < args.length) {
            const x2 = isRelative ? currentX + args[i] : args[i];
            const y2 = isRelative ? currentY + args[i + 1] : args[i + 1];
            const x = isRelative ? currentX + args[i + 2] : args[i + 2];
            const y = isRelative ? currentY + args[i + 3] : args[i + 3];
            trackPoint(x2, y2);
            trackPoint(x, y);
            currentX = x;
            currentY = y;
          }
        }
        break;
      case 'Q': // Quadratic Bezier
        for (let i = 0; i < args.length; i += 4) {
          if (i + 3 < args.length) {
            const x1 = isRelative ? currentX + args[i] : args[i];
            const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
            const x = isRelative ? currentX + args[i + 2] : args[i + 2];
            const y = isRelative ? currentY + args[i + 3] : args[i + 3];
            trackPoint(x1, y1);
            trackPoint(x, y);
            currentX = x;
            currentY = y;
          }
        }
        break;
      case 'T': // Smooth Quadratic Bezier
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            const x = isRelative ? currentX + args[i] : args[i];
            const y = isRelative ? currentY + args[i + 1] : args[i + 1];
            trackPoint(x, y);
            currentX = x;
            currentY = y;
          }
        }
        break;
      case 'A': // Arc
        for (let i = 0; i < args.length; i += 7) {
          if (i + 6 < args.length) {
            const x = isRelative ? currentX + args[i + 5] : args[i + 5];
            const y = isRelative ? currentY + args[i + 6] : args[i + 6];
            // For arcs, also consider the radii for bounding box estimation
            const rx = args[i];
            const ry = args[i + 1];
            trackPoint(x - rx, y - ry);
            trackPoint(x + rx, y + ry);
            trackPoint(x, y);
            currentX = x;
            currentY = y;
          }
        }
        break;
      case 'Z': // ClosePath
        currentX = startX;
        currentY = startY;
        break;
    }
  }

  // Handle case where no valid points were found
  if (!isFinite(minX)) {
    return { x: path.position.x, y: path.position.y, width: 0, height: 0 };
  }

  return {
    x: path.position.x + minX,
    y: path.position.y + minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Common path commands for creating paths programmatically
 */
export const PathCommands = {
  moveTo: (x: number, y: number) => `M ${x} ${y}`,
  lineTo: (x: number, y: number) => `L ${x} ${y}`,
  horizontalLineTo: (x: number) => `H ${x}`,
  verticalLineTo: (y: number) => `V ${y}`,
  curveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
    `C ${x1} ${y1} ${x2} ${y2} ${x} ${y}`,
  smoothCurveTo: (x2: number, y2: number, x: number, y: number) =>
    `S ${x2} ${y2} ${x} ${y}`,
  quadraticCurveTo: (x1: number, y1: number, x: number, y: number) =>
    `Q ${x1} ${y1} ${x} ${y}`,
  smoothQuadraticCurveTo: (x: number, y: number) => `T ${x} ${y}`,
  arc: (rx: number, ry: number, rotation: number, largeArc: boolean, sweep: boolean, x: number, y: number) =>
    `A ${rx} ${ry} ${rotation} ${largeArc ? 1 : 0} ${sweep ? 1 : 0} ${x} ${y}`,
  closePath: () => 'Z'
} as const;

/**
 * Offset all coordinates in a path data string by (dx, dy).
 * Handles both absolute (uppercase) and relative (lowercase) commands.
 * Relative commands are left unchanged as they represent deltas.
 */
export function offsetPathData(d: string, dx: number, dy: number): string {
  if (!d || (dx === 0 && dy === 0)) return d;

  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let result = '';
  let match: RegExpExecArray | null;

  // Track current position for path state
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;
  let isFirst = true;

  while ((match = commandRegex.exec(d)) !== null) {
    const command = match[1];
    const argsStr = match[2].trim();
    const isRelative = command === command.toLowerCase();

    const args = argsStr.length > 0 ? parsePathNumbers(argsStr) : [];

    switch (command.toUpperCase()) {
      case 'M':
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            let x = isRelative ? currentX + args[i] : args[i];
            let y = isRelative ? currentY + args[i + 1] : args[i + 1];
            x += dx;
            y += dy;
            currentX = x - dx;
            currentY = y - dy;
            if (isFirst || i === 0) {
              startX = currentX;
              startY = currentY;
              isFirst = false;
            }
            args[i] = isRelative ? args[i] : x;
            args[i + 1] = isRelative ? args[i + 1] : y;
          }
        }
        break;
      case 'L':
      case 'T':
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            if (!isRelative) {
              args[i] += dx;
              args[i + 1] += dy;
            }
            currentX = isRelative ? currentX + args[i] : args[i] - dx;
            currentY = isRelative ? currentY + args[i + 1] : args[i + 1] - dy;
          }
        }
        break;
      case 'H':
        for (let i = 0; i < args.length; i++) {
          if (!isRelative) {
            args[i] += dx;
          }
          currentX = isRelative ? currentX + args[i] : args[i] - dx;
        }
        break;
      case 'V':
        for (let i = 0; i < args.length; i++) {
          if (!isRelative) {
            args[i] += dy;
          }
          currentY = isRelative ? currentY + args[i] : args[i] - dy;
        }
        break;
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          if (i + 5 < args.length) {
            if (!isRelative) {
              args[i] += dx; args[i + 1] += dy;
              args[i + 2] += dx; args[i + 3] += dy;
              args[i + 4] += dx; args[i + 5] += dy;
            }
            currentX = isRelative ? currentX + args[i + 4] : args[i + 4] - dx;
            currentY = isRelative ? currentY + args[i + 5] : args[i + 5] - dy;
          }
        }
        break;
      case 'S':
      case 'Q':
        for (let i = 0; i < args.length; i += 4) {
          if (i + 3 < args.length) {
            if (!isRelative) {
              args[i] += dx; args[i + 1] += dy;
              args[i + 2] += dx; args[i + 3] += dy;
            }
            currentX = isRelative ? currentX + args[i + 2] : args[i + 2] - dx;
            currentY = isRelative ? currentY + args[i + 3] : args[i + 3] - dy;
          }
        }
        break;
      case 'A':
        for (let i = 0; i < args.length; i += 7) {
          if (i + 6 < args.length) {
            if (!isRelative) {
              args[i + 5] += dx;
              args[i + 6] += dy;
            }
            currentX = isRelative ? currentX + args[i + 5] : args[i + 5] - dx;
            currentY = isRelative ? currentY + args[i + 6] : args[i + 6] - dy;
          }
        }
        break;
      case 'Z':
        currentX = startX;
        currentY = startY;
        break;
    }

    result += command + (args.length > 0 ? args.join(',') : '');
  }

  return result;
}
