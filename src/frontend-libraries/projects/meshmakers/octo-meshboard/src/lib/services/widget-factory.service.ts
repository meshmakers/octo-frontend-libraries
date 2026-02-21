import { Injectable, inject } from '@angular/core';
import { AnyWidgetConfig, WidgetType } from '../models/meshboard.models';
import { WidgetRegistryService } from './widget-registry.service';

export interface WidgetCreationOptions {
  title: string;
  type: WidgetType;
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
  ckTypeId?: string;
}

/**
 * Service responsible for creating widget configurations.
 * Delegates to WidgetRegistryService for widget-specific logic (SOLID: Open/Closed Principle).
 */
@Injectable({
  providedIn: 'root'
})
export class WidgetFactoryService {
  private readonly registry = inject(WidgetRegistryService);

  /**
   * Generates a unique widget ID.
   */
  generateId(): string {
    return `widget-${Date.now()}`;
  }

  /**
   * Creates a new widget with default configuration based on type.
   * Delegates to the widget registration's createDefaultConfig function.
   */
  createWidget(options: WidgetCreationOptions): AnyWidgetConfig {
    const id = this.generateId();
    const defaultSize = this.registry.getDefaultSize(options.type);

    const baseConfig = {
      id,
      title: options.title,
      col: options.col ?? 1,
      row: options.row ?? 1,
      colSpan: options.colSpan ?? defaultSize.colSpan,
      rowSpan: options.rowSpan ?? defaultSize.rowSpan,
      configurable: true
    };

    // Delegate to registry - no switch statement needed!
    return this.registry.createWidget(options.type, baseConfig);
  }

  /**
   * Gets the default size for a widget type.
   * Delegates to WidgetRegistryService.
   */
  getDefaultSize(type: WidgetType): { colSpan: number; rowSpan: number } {
    return this.registry.getDefaultSize(type);
  }
}
