/**
 * Text Primitive Model
 */

import { PrimitiveBase, PrimitiveType, TextStyle, DEFAULT_TEXT_STYLE } from './primitive.models';

/**
 * Text overflow behavior
 */
export type TextOverflow = 'visible' | 'clip' | 'ellipsis';

/**
 * Text-specific configuration
 */
export interface TextConfig {
  /** Text content */
  content: string;
  /** Text style */
  textStyle?: TextStyle;
  /** Maximum width (for wrapping) */
  maxWidth?: number;
  /** Text overflow behavior */
  overflow?: TextOverflow;
  /** Enable text wrapping */
  wrap?: boolean;
  /** Line height multiplier */
  lineHeight?: number;
  /** Letter spacing in pixels */
  letterSpacing?: number;
  /** Text decoration */
  decoration?: 'none' | 'underline' | 'overline' | 'line-through';
  /** Text transform */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

/**
 * Text primitive element
 */
export interface TextPrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Text;
  config: TextConfig;
}

/**
 * Type guard for Text primitive
 */
export function isText(primitive: PrimitiveBase): primitive is TextPrimitive {
  return primitive.type === PrimitiveType.Text;
}

/**
 * Create a new text primitive
 */
export function createText(
  id: string,
  content: string,
  x: number,
  y: number,
  options?: Partial<Omit<TextPrimitive, 'id' | 'type' | 'position' | 'config'> & { config?: Partial<Omit<TextConfig, 'content'>> }>
): TextPrimitive {
  const { config: configOptions, ...rest } = options ?? {};
  return {
    ...rest,
    id,
    type: PrimitiveType.Text,
    position: { x, y },
    config: {
      content,
      textStyle: configOptions?.textStyle ?? { ...DEFAULT_TEXT_STYLE },
      maxWidth: configOptions?.maxWidth,
      overflow: configOptions?.overflow ?? 'visible',
      wrap: configOptions?.wrap ?? false,
      lineHeight: configOptions?.lineHeight ?? 1.2,
      letterSpacing: configOptions?.letterSpacing,
      decoration: configOptions?.decoration ?? 'none',
      textTransform: configOptions?.textTransform ?? 'none'
    }
  };
}

/**
 * Get effective text style (merged with defaults)
 */
export function getEffectiveTextStyle(text: TextPrimitive): Required<TextStyle> {
  return {
    fontFamily: text.config.textStyle?.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily!,
    fontSize: text.config.textStyle?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize!,
    fontWeight: text.config.textStyle?.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight!,
    fontStyle: text.config.textStyle?.fontStyle ?? 'normal',
    color: text.config.textStyle?.color ?? DEFAULT_TEXT_STYLE.color!,
    textAnchor: text.config.textStyle?.textAnchor ?? DEFAULT_TEXT_STYLE.textAnchor!,
    dominantBaseline: text.config.textStyle?.dominantBaseline ?? DEFAULT_TEXT_STYLE.dominantBaseline!
  };
}

/**
 * Apply text transform to content
 */
export function applyTextTransform(content: string, transform?: TextConfig['textTransform']): string {
  switch (transform) {
    case 'uppercase':
      return content.toUpperCase();
    case 'lowercase':
      return content.toLowerCase();
    case 'capitalize':
      return content.replace(/\b\w/g, char => char.toUpperCase());
    default:
      return content;
  }
}

/**
 * Split text into lines for wrapping
 */
export function wrapText(
  content: string,
  maxWidth: number,
  fontSize: number,
  _fontFamily: string
): string[] {
  // Rough estimation: average character width is ~0.6 * fontSize
  const avgCharWidth = fontSize * 0.6;
  const charsPerLine = Math.floor(maxWidth / avgCharWidth);

  if (charsPerLine <= 0 || content.length <= charsPerLine) {
    return [content];
  }

  const words = content.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= charsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
