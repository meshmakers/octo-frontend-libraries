/**
 * Industry-standard branding vocabulary controlling what a brand block renders.
 * - 'signet'   — symbol/mark only (the image)
 * - 'logotype' — wordmark only (the text)
 * - 'logo'     — combined (image + text); falls back to text-only when image absent
 */
export type BrandDisplay = 'signet' | 'logotype' | 'logo';
