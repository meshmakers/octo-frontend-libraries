/**
 * Image Primitive Model
 *
 * Supports raster images (PNG, JPG, etc.) and SVG
 */

import { PrimitiveBase, PrimitiveType, Size } from './primitive.models';

/**
 * Image source type
 */
export type ImageSourceType = 'url' | 'dataUrl' | 'svg';

/**
 * How the image should fit within its bounds
 */
export type ImageFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

/**
 * Image alignment within bounds
 */
export interface ImageAlignment {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
}

/**
 * Image-specific configuration
 */
export interface ImageConfig {
  /** Image source (URL, data URL, or SVG string) */
  src: string;
  /** Source type */
  sourceType: ImageSourceType;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** How image fits within bounds */
  fit?: ImageFit;
  /** Alignment within bounds */
  alignment?: ImageAlignment;
  /** Preserve aspect ratio */
  preserveAspectRatio?: boolean;
  /** Alt text for accessibility */
  alt?: string;
  /** Cross-origin setting for external images */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

/**
 * Image primitive element
 */
export interface ImagePrimitive extends PrimitiveBase {
  type: typeof PrimitiveType.Image;
  config: ImageConfig;
}

/**
 * Type guard for Image primitive
 */
export function isImage(primitive: PrimitiveBase): primitive is ImagePrimitive {
  return primitive.type === PrimitiveType.Image;
}

/**
 * Create a new image primitive from URL
 */
export function createImage(
  id: string,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: Partial<Omit<ImagePrimitive, 'id' | 'type' | 'position' | 'config'> & { config?: Partial<Omit<ImageConfig, 'src' | 'width' | 'height'>> }>
): ImagePrimitive {
  const sourceType = detectSourceType(src);
  const { config: configOptions, ...rest } = options ?? {};

  return {
    ...rest,
    id,
    type: PrimitiveType.Image,
    position: { x, y },
    config: {
      src,
      sourceType,
      width,
      height,
      fit: configOptions?.fit ?? 'contain',
      preserveAspectRatio: configOptions?.preserveAspectRatio ?? true,
      alignment: configOptions?.alignment,
      alt: configOptions?.alt,
      crossOrigin: configOptions?.crossOrigin
    }
  };
}

/**
 * Create an image from SVG string
 */
export function createSvgImage(
  id: string,
  svgContent: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: Partial<Omit<ImagePrimitive, 'id' | 'type' | 'position' | 'config'>>
): ImagePrimitive {
  const rest = options ?? {};
  return {
    ...rest,
    id,
    type: PrimitiveType.Image,
    position: { x, y },
    config: {
      src: svgContent,
      sourceType: 'svg',
      width,
      height,
      fit: 'contain',
      preserveAspectRatio: true
    }
  };
}

/**
 * Detect the source type from the src string
 */
export function detectSourceType(src: string): ImageSourceType {
  if (src.startsWith('data:')) {
    return 'dataUrl';
  }
  if (src.trim().startsWith('<svg') || src.trim().startsWith('<?xml')) {
    return 'svg';
  }
  return 'url';
}

/**
 * Get the size of an image
 */
export function getImageSize(image: ImagePrimitive): Size {
  return {
    width: image.config.width,
    height: image.config.height
  };
}

/**
 * Convert SVG preserveAspectRatio value
 */
export function toSvgPreserveAspectRatio(
  fit: ImageFit,
  alignment?: ImageAlignment
): string {
  if (fit === 'none' || fit === 'fill') {
    return 'none';
  }

  const alignX = alignment?.horizontal === 'left' ? 'xMin' :
                 alignment?.horizontal === 'right' ? 'xMax' : 'xMid';
  const alignY = alignment?.vertical === 'top' ? 'YMin' :
                 alignment?.vertical === 'bottom' ? 'YMax' : 'YMid';
  const meetOrSlice = fit === 'cover' ? 'slice' : 'meet';

  return `${alignX}${alignY} ${meetOrSlice}`;
}
