import { Signal } from '@angular/core';
import { AnyWidgetConfig, RuntimeEntityData } from '../models/meshboard.models';

/**
 * Base interface for all dashboard widgets.
 * Each widget is a self-contained plugin that loads its own data.
 */
export interface DashboardWidget<TConfig extends AnyWidgetConfig = AnyWidgetConfig, TData = unknown> {
  /**
   * The widget configuration containing data source and display options.
   */
  config: TConfig;

  /**
   * Signal indicating if the widget is currently loading data.
   */
  readonly isLoading: Signal<boolean>;

  /**
   * Signal containing the loaded data, or null if not loaded yet.
   */
  readonly data: Signal<TData | null>;

  /**
   * Signal containing any error that occurred during data loading.
   */
  readonly error: Signal<string | null>;

  /**
   * Triggers a data reload.
   */
  refresh(): void;
}

/**
 * Type for widgets that display a single entity.
 */
export type EntityWidget = DashboardWidget<AnyWidgetConfig, RuntimeEntityData>;

/**
 * Type for widgets that display multiple entities.
 */
export type EntityListWidget = DashboardWidget<AnyWidgetConfig, RuntimeEntityData[]>;
