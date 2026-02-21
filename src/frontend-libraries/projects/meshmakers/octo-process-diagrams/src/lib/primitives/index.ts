/**
 * Primitives Module - Barrel Export
 *
 * This module provides the primitive element system for the Process Widget.
 * It includes:
 * - Models: Type definitions for all primitive types
 * - Renderers: SVG rendering implementations
 * - Registry: Central registry for renderer lookup
 */

// Models
export * from './models';

// Renderers (includes PrimitiveRendererRegistry)
export * from './renderers';

// Additional exports from registry not covered by renderers
export { createRenderContext } from './primitive-renderer.registry';
