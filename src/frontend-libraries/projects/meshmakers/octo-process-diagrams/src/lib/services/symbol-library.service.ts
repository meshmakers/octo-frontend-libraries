import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  SymbolLibrary,
  SymbolDefinition,
  SymbolInstance,
  ConnectionPoint,
  SymbolParameter
} from '../primitives/models/symbol.model';
import { PrimitiveBase, StyleClass } from '../primitives';
import { TransformProperty, PropertyBinding } from '../primitives/models/transform-property.models';
import { AnimationDefinition } from '../primitives/models/animation.models';
import { GetSymbolLibrariesDtoGQL } from '../graphQL/getSymbolLibraries';
import { GetSymbolLibraryDtoGQL } from '../graphQL/getSymbolLibrary';
import { CreateSymbolLibraryDtoGQL } from '../graphQL/createSymbolLibrary';
import { UpdateSymbolLibraryDtoGQL } from '../graphQL/updateSymbolLibrary';
import { GetSymbolDefinitionDtoGQL } from '../graphQL/getSymbolDefinition';
import { CreateSymbolDefinitionDtoGQL } from '../graphQL/createSymbolDefinition';
import { UpdateSymbolDefinitionDtoGQL } from '../graphQL/updateSymbolDefinition';
import { DeleteSymbolDefinitionDtoGQL } from '../graphQL/deleteSymbolDefinition';

/**
 * Symbol Library Service
 *
 * Handles loading, caching, and management of symbol libraries and their symbols.
 * Symbols are now stored as separate CK entities with ParentChild associations to libraries.
 *
 * @example
 * ```typescript
 * // Get all libraries
 * const libraries = await symbolLibraryService.loadLibraryList();
 *
 * // Get a specific library with symbols
 * const library = await symbolLibraryService.loadLibrary('library-rtId');
 *
 * // Find a symbol
 * const symbol = symbolLibraryService.findSymbol('library-rtId', 'symbol-rtId');
 * ```
 */

/**
 * Summary item for symbol library list (without symbols)
 */
export interface SymbolLibrarySummary {
  rtId: string;
  name: string;
  description?: string | null;
  version: string;
  author?: string | null;
  isBuiltIn?: boolean | null;
  isReadOnly?: boolean | null;
  /** Number of symbols in this library */
  symbolCount?: number;
}

/**
 * Summary item for symbol definition list (without primitives)
 */
export interface SymbolDefinitionSummary {
  rtId: string;
  name: string;
  description?: string | null;
  version: string;
  bounds: { width: number; height: number };
  category?: string;
  tags?: string[];
  previewImage?: string;
  libraryRtId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SymbolLibraryService {

  private readonly getSymbolLibrariesGQL = inject(GetSymbolLibrariesDtoGQL);
  private readonly getSymbolLibraryGQL = inject(GetSymbolLibraryDtoGQL);
  private readonly createSymbolLibraryGQL = inject(CreateSymbolLibraryDtoGQL);
  private readonly updateSymbolLibraryGQL = inject(UpdateSymbolLibraryDtoGQL);
  private readonly getSymbolDefinitionGQL = inject(GetSymbolDefinitionDtoGQL);
  private readonly createSymbolDefinitionGQL = inject(CreateSymbolDefinitionDtoGQL);
  private readonly updateSymbolDefinitionGQL = inject(UpdateSymbolDefinitionDtoGQL);
  private readonly deleteSymbolDefinitionGQL = inject(DeleteSymbolDefinitionDtoGQL);

  /** Cache of loaded libraries (with symbols) */
  private libraryCache = new Map<string, SymbolLibrary>();

  /** Cache of individual symbols */
  private symbolCache = new Map<string, SymbolDefinition>();

  // ============================================================================
  // Library Operations
  // ============================================================================

  /**
   * Loads a list of available symbol libraries from the backend
   */
  async loadLibraryList(searchText?: string): Promise<SymbolLibrarySummary[]> {
    try {
      const result = await firstValueFrom(this.getSymbolLibrariesGQL.fetch({
        variables: {
          first: 100,
          searchFilter: searchText ? { searchTerm: searchText } : undefined
        }
      }));

      const items = result.data?.runtime?.systemUISymbolLibrary?.items || [];
      return items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          rtId: item.rtId,
          name: item.name,
          description: item.description,
          version: item.version,
          author: item.author,
          isBuiltIn: item.isBuiltIn,
          isReadOnly: item.isReadOnly,
          symbolCount: item.children?.totalCount ?? 0
        }));
    } catch (error) {
      console.error('Error loading symbol libraries:', error);
      return [];
    }
  }

  /**
   * Loads a symbol library with all its symbols from the backend
   */
  async loadLibrary(rtId: string, useCache = true): Promise<SymbolLibrary> {
    if (useCache && this.libraryCache.has(rtId)) {
      return this.libraryCache.get(rtId)!;
    }

    const result = await firstValueFrom(this.getSymbolLibraryGQL.fetch({
      variables: { rtId },
      // Use network-only when cache is bypassed to ensure fresh data after updates
      fetchPolicy: useCache ? 'cache-first' : 'network-only'
    }));

    const item = result.data?.runtime?.systemUISymbolLibrary?.items?.[0];
    if (!item) {
      throw new Error(`Symbol library not found: ${rtId}`);
    }

    // Parse symbols from children
    const symbolItems = item.children?.items || [];
    const symbols: SymbolDefinition[] = symbolItems
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map(s => this.parseSymbolDefinition(s, rtId));

    // Cache individual symbols
    for (const symbol of symbols) {
      this.symbolCache.set(symbol.rtId, symbol);
    }

    const library: SymbolLibrary = {
      id: item.rtId,
      name: item.name,
      description: item.description ?? undefined,
      version: item.version,
      symbols,
      author: item.author ?? undefined,
      isBuiltIn: item.isBuiltIn ?? false,
      isReadOnly: item.isReadOnly ?? false
    };

    this.libraryCache.set(rtId, library);
    return library;
  }

  /**
   * Creates a new symbol library in the backend
   */
  async createLibrary(library: Omit<SymbolLibrary, 'id' | 'symbols'>): Promise<SymbolLibrary> {
    const input = {
      name: library.name,
      description: library.description,
      version: library.version,
      author: library.author,
      isBuiltIn: library.isBuiltIn,
      isReadOnly: library.isReadOnly
    };

    const result = await firstValueFrom(this.createSymbolLibraryGQL.mutate({
      variables: { entities: [input] }
    }));

    const created = result.data?.runtime?.systemUISymbolLibrarys?.create?.[0];
    if (!created) {
      throw new Error('Failed to create symbol library');
    }

    const newLibrary: SymbolLibrary = {
      ...library,
      id: created.rtId,
      symbols: []
    };

    this.libraryCache.set(created.rtId, newLibrary);
    return newLibrary;
  }

  /**
   * Updates an existing symbol library in the backend
   */
  async updateLibrary(library: SymbolLibrary): Promise<SymbolLibrary> {
    if (!library.id) {
      throw new Error('Cannot update library without id');
    }

    const input = {
      rtId: library.id,
      item: {
        name: library.name,
        description: library.description,
        version: library.version,
        author: library.author,
        isBuiltIn: library.isBuiltIn,
        isReadOnly: library.isReadOnly
      }
    };

    const result = await firstValueFrom(this.updateSymbolLibraryGQL.mutate({
      variables: { entities: [input] }
    }));

    const updated = result.data?.runtime?.systemUISymbolLibrarys?.update?.[0];
    if (!updated) {
      throw new Error('Failed to update symbol library');
    }

    this.libraryCache.set(library.id, library);
    return library;
  }

  // ============================================================================
  // Symbol Operations
  // ============================================================================

  /**
   * Loads a single symbol definition
   * Note: libraryRtId won't be set when loading a single symbol directly.
   * Use loadLibrary() to get symbols with their library context.
   */
  async loadSymbol(rtId: string, useCache = true): Promise<SymbolDefinition> {
    if (useCache && this.symbolCache.has(rtId)) {
      return this.symbolCache.get(rtId)!;
    }

    const result = await firstValueFrom(this.getSymbolDefinitionGQL.fetch({
      variables: { rtId },
      // Use network-only when cache is bypassed to ensure fresh data after updates
      fetchPolicy: useCache ? 'cache-first' : 'network-only'
    }));

    const item = result.data?.runtime?.systemUISymbolDefinition?.items?.[0];
    if (!item) {
      throw new Error(`Symbol definition not found: ${rtId}`);
    }

    const symbol = this.parseSymbolDefinition(item);
    this.symbolCache.set(rtId, symbol);
    return symbol;
  }

  /**
   * Creates a new symbol definition in a library
   */
  async createSymbol(
    libraryRtId: string,
    symbol: Omit<SymbolDefinition, 'rtId' | 'libraryRtId'>
  ): Promise<SymbolDefinition> {
    const input = this.symbolToInputDto(symbol, libraryRtId);

    const result = await firstValueFrom(this.createSymbolDefinitionGQL.mutate({
      variables: { entities: [input] }
    }));

    const created = result.data?.runtime?.systemUISymbolDefinitions?.create?.[0];
    if (!created) {
      throw new Error('Failed to create symbol definition');
    }

    const newSymbol: SymbolDefinition = {
      ...symbol,
      rtId: created.rtId,
      libraryRtId
    };

    this.symbolCache.set(created.rtId, newSymbol);

    // Update library cache if present
    const cachedLibrary = this.libraryCache.get(libraryRtId);
    if (cachedLibrary) {
      cachedLibrary.symbols.push(newSymbol);
    }

    return newSymbol;
  }

  /**
   * Updates an existing symbol definition
   */
  async updateSymbol(symbol: SymbolDefinition): Promise<SymbolDefinition> {
    if (!symbol.rtId) {
      throw new Error('Cannot update symbol without rtId');
    }

    // Don't pass libraryRtId for updates - parent association already exists
    const input = {
      rtId: symbol.rtId,
      item: this.symbolToInputDto(symbol)
    };

    const result = await firstValueFrom(this.updateSymbolDefinitionGQL.mutate({
      variables: { entities: [input] }
    }));

    const updated = result.data?.runtime?.systemUISymbolDefinitions?.update?.[0];
    if (!updated) {
      throw new Error('Failed to update symbol definition');
    }

    this.symbolCache.set(symbol.rtId, symbol);

    // Update in library cache if present
    if (symbol.libraryRtId) {
      const cachedLibrary = this.libraryCache.get(symbol.libraryRtId);
      if (cachedLibrary) {
        const index = cachedLibrary.symbols.findIndex(s => s.rtId === symbol.rtId);
        if (index !== -1) {
          cachedLibrary.symbols[index] = symbol;
        }
      }
    }

    return symbol;
  }

  /**
   * Deletes a symbol definition
   */
  async deleteSymbol(symbol: SymbolDefinition): Promise<boolean> {
    if (!symbol.rtId) {
      throw new Error('Cannot delete symbol without rtId');
    }

    const result = await firstValueFrom(this.deleteSymbolDefinitionGQL.mutate({
      variables: {
        rtEntityIds: [{
          ckTypeId: 'System.UI/SymbolDefinition',
          rtId: symbol.rtId
        }]
      }
    }));

    const success = result.data?.runtime?.runtimeEntities?.delete ?? false;

    if (success) {
      // Remove from symbol cache
      this.symbolCache.delete(symbol.rtId);

      // Remove from library cache if present
      if (symbol.libraryRtId) {
        const cachedLibrary = this.libraryCache.get(symbol.libraryRtId);
        if (cachedLibrary) {
          cachedLibrary.symbols = cachedLibrary.symbols.filter(s => s.rtId !== symbol.rtId);
        }
      }
    }

    return success;
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  /**
   * Finds a symbol in cached libraries
   */
  findSymbol(libraryRtId: string, symbolRtId: string): SymbolDefinition | undefined {
    // First check symbol cache
    const cached = this.symbolCache.get(symbolRtId);
    if (cached) {
      return cached;
    }

    // Then check library cache
    const library = this.libraryCache.get(libraryRtId);
    if (library) {
      return library.symbols.find(s => s.rtId === symbolRtId);
    }

    return undefined;
  }

  /**
   * Gets a cached library
   */
  getCachedLibrary(rtId: string): SymbolLibrary | undefined {
    return this.libraryCache.get(rtId);
  }

  /**
   * Gets a cached symbol definition
   */
  getCachedSymbol(rtId: string): SymbolDefinition | undefined {
    return this.symbolCache.get(rtId);
  }

  /**
   * Clears the cache
   */
  clearCache(rtId?: string): void {
    if (rtId) {
      this.libraryCache.delete(rtId);
      // Also clear symbols from this library
      for (const [symbolRtId, symbol] of this.symbolCache.entries()) {
        if (symbol.libraryRtId === rtId) {
          this.symbolCache.delete(symbolRtId);
        }
      }
    } else {
      this.libraryCache.clear();
      this.symbolCache.clear();
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Parses a symbol from GraphQL response
   */
  private parseSymbolDefinition(
    item: {
      rtId: string;
      name: string;
      description?: string | null;
      version: string;
      primitives: string;
      symbolInstances?: string | null;
      boundsWidth: number;
      boundsHeight: number;
      connectionPoints?: string | null;
      parameters?: string | null;
      category?: string | null;
      tags?: string | null;
      previewImage?: string | null;
      gridSize?: number | null;
      canvasSizeWidth?: number | null;
      canvasSizeHeight?: number | null;
    },
    libraryRtId?: string
  ): SymbolDefinition {
    // Parse primitives data - may be wrapped format with transformProperties/propertyBindings
    const primitivesData = this.parsePrimitivesData(item.primitives);

    // Build canvasSize if either width or height is present
    const canvasSize = (item.canvasSizeWidth != null || item.canvasSizeHeight != null)
      ? {
          width: item.canvasSizeWidth ?? item.boundsWidth,
          height: item.canvasSizeHeight ?? item.boundsHeight
        }
      : undefined;

    return {
      rtId: item.rtId,
      name: item.name,
      description: item.description ?? undefined,
      version: item.version,
      primitives: primitivesData.primitives,
      symbolInstances: item.symbolInstances
        ? this.parseJsonField<SymbolInstance[]>(item.symbolInstances, [])
        : undefined,
      bounds: {
        width: item.boundsWidth,
        height: item.boundsHeight
      },
      canvasSize,
      gridSize: item.gridSize ?? undefined,
      connectionPoints: item.connectionPoints
        ? this.parseJsonField<ConnectionPoint[]>(item.connectionPoints, [])
        : undefined,
      parameters: item.parameters
        ? this.parseJsonField<SymbolParameter[]>(item.parameters, [])
        : undefined,
      transformProperties: primitivesData.transformProperties,
      propertyBindings: primitivesData.propertyBindings,
      animations: primitivesData.animations,
      styleClasses: primitivesData.styleClasses,
      category: item.category ?? undefined,
      tags: item.tags ? item.tags.split(',').map(t => t.trim()) : undefined,
      previewImage: item.previewImage ?? undefined,
      libraryRtId
    };
  }

  /**
   * Parses primitives JSON which may be in wrapped format (with transformProperties/propertyBindings/animations/styleClasses)
   * or legacy array format (just PrimitiveBase[])
   */
  private parsePrimitivesData(primitivesJson: string): {
    primitives: PrimitiveBase[];
    transformProperties?: TransformProperty[];
    propertyBindings?: PropertyBinding[];
    animations?: AnimationDefinition[];
    styleClasses?: StyleClass[];
  } {
    try {
      const parsed = JSON.parse(primitivesJson);

      // Check if it's wrapped format (object with primitives property)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'primitives' in parsed) {
        return {
          primitives: parsed.primitives as PrimitiveBase[],
          transformProperties: parsed.transformProperties as TransformProperty[] | undefined,
          propertyBindings: parsed.propertyBindings as PropertyBinding[] | undefined,
          animations: parsed.animations as AnimationDefinition[] | undefined,
          styleClasses: parsed.styleClasses as StyleClass[] | undefined
        };
      }

      // Legacy format: just an array of primitives
      if (Array.isArray(parsed)) {
        return { primitives: parsed as PrimitiveBase[] };
      }

      console.error('Invalid primitives format:', parsed);
      return { primitives: [] };
    } catch (error) {
      console.error('Error parsing primitives JSON:', error);
      return { primitives: [] };
    }
  }

  /**
   * Converts a symbol to GraphQL input format
   */
  private symbolToInputDto(
    symbol: Omit<SymbolDefinition, 'rtId' | 'libraryRtId'>,
    libraryRtId?: string
  ): {
    name: string;
    description?: string;
    version: string;
    primitives: string;
    symbolInstances?: string;
    boundsWidth: number;
    boundsHeight: number;
    connectionPoints?: string;
    parameters?: string;
    category?: string;
    tags?: string;
    previewImage?: string;
    gridSize?: number;
    canvasSizeWidth?: number;
    canvasSizeHeight?: number;
    parent?: { target: { ckTypeId: string; rtId: string } }[];
  } {
    // Serialize primitives data - use wrapped format if transformProperties/propertyBindings/animations/styleClasses exist
    const primitivesJson = this.serializePrimitivesData(
      symbol.primitives,
      symbol.transformProperties,
      symbol.propertyBindings,
      symbol.animations,
      symbol.styleClasses
    );

    const dto: ReturnType<typeof this.symbolToInputDto> = {
      name: symbol.name,
      description: symbol.description,
      version: symbol.version,
      primitives: primitivesJson,
      symbolInstances: symbol.symbolInstances && symbol.symbolInstances.length > 0
        ? JSON.stringify(symbol.symbolInstances)
        : undefined,
      boundsWidth: Math.round(symbol.bounds.width),
      boundsHeight: Math.round(symbol.bounds.height),
      connectionPoints: symbol.connectionPoints
        ? JSON.stringify(symbol.connectionPoints)
        : undefined,
      parameters: symbol.parameters
        ? JSON.stringify(symbol.parameters)
        : undefined,
      category: symbol.category,
      tags: symbol.tags?.join(', '),
      previewImage: symbol.previewImage,
      gridSize: symbol.gridSize,
      canvasSizeWidth: symbol.canvasSize?.width,
      canvasSizeHeight: symbol.canvasSize?.height
    };

    // Add parent association to library
    if (libraryRtId) {
      dto.parent = [{
        target: {
          ckTypeId: 'System.UI/SymbolLibrary',
          rtId: libraryRtId
        }
      }];
    }

    return dto;
  }

  /**
   * Serializes primitives data with optional transformProperties/propertyBindings/animations/styleClasses
   * Uses wrapped format when extended data exists, legacy array format otherwise
   */
  private serializePrimitivesData(
    primitives: PrimitiveBase[],
    transformProperties?: TransformProperty[],
    propertyBindings?: PropertyBinding[],
    animations?: AnimationDefinition[],
    styleClasses?: StyleClass[]
  ): string {
    const hasExtendedData =
      (transformProperties && transformProperties.length > 0) ||
      (propertyBindings && propertyBindings.length > 0) ||
      (animations && animations.length > 0) ||
      (styleClasses && styleClasses.length > 0);

    if (hasExtendedData) {
      // Use wrapped format
      const wrappedData: {
        primitives: PrimitiveBase[];
        transformProperties?: TransformProperty[];
        propertyBindings?: PropertyBinding[];
        animations?: AnimationDefinition[];
        styleClasses?: StyleClass[];
      } = { primitives };

      if (transformProperties && transformProperties.length > 0) {
        wrappedData.transformProperties = transformProperties;
      }
      if (propertyBindings && propertyBindings.length > 0) {
        wrappedData.propertyBindings = propertyBindings;
      }
      if (animations && animations.length > 0) {
        wrappedData.animations = animations;
      }
      if (styleClasses && styleClasses.length > 0) {
        wrappedData.styleClasses = styleClasses;
      }

      return JSON.stringify(wrappedData);
    }

    // Legacy format: just the array
    return JSON.stringify(primitives);
  }

  /**
   * Parses a JSON string with error handling
   */
  private parseJsonField<T>(json: string, defaultValue: T): T {
    try {
      return JSON.parse(json) as T;
    } catch (error) {
      console.error('Error parsing JSON field:', error);
      return defaultValue;
    }
  }
}
