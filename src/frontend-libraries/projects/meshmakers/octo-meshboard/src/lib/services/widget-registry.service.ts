import { Injectable, Type, inject, Injector, EnvironmentInjector, ApplicationRef } from '@angular/core';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { WindowService, WindowRef, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { WindowStateService } from '@meshmakers/shared-ui';
import { AnyWidgetConfig, WidgetType, RuntimeEntityDataSource, DataSourceType } from '../models/meshboard.models';

/**
 * Base interface for all widget config dialog results.
 * Each dialog must return at least the data source info.
 */
export interface WidgetConfigResult {
  ckTypeId: string;
  rtId?: string;
}

/**
 * Base configuration passed to widget factory functions.
 * Contains common fields that all widgets need.
 */
export interface BaseWidgetConfig {
  id: string;
  title: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  configurable?: boolean;
  chromeless?: boolean;
}

/**
 * Persisted widget data from the backend.
 * Used for deserializing widgets from storage.
 */
export interface PersistedWidgetData {
  rtId: string;
  ckTypeId: string;
  name: string;
  type: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  dataSourceType: string;
  dataSourceCkTypeId?: string | null;
  dataSourceRtId?: string | null;
  config: string;
}

/**
 * Data structure for widget persistence.
 * Returned by toPersistedConfig to serialize widget-specific config.
 */
export interface WidgetPersistenceData {
  /** Data source type for storage (note: 'persistentQuery' maps to 'systemQuery' in backend) */
  dataSourceType: DataSourceType;
  /** CkTypeId for runtimeEntity data sources */
  dataSourceCkTypeId?: string;
  /** RtId for runtimeEntity or queryRtId for persistentQuery */
  dataSourceRtId?: string;
  /** Widget-specific configuration as JSON-serializable object */
  config: Record<string, unknown>;
}

/**
 * Size configuration for widget config dialogs opened via WindowService.
 */
export interface WidgetConfigDialogSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

/**
 * Interface that config dialog components must implement.
 * Dialogs are opened via WindowService and use WindowRef.close() to return results.
 */
export interface WidgetConfigDialog<TResult extends WidgetConfigResult = WidgetConfigResult> {
  // Initial values - set via inputs
  initialCkTypeId?: string;
  initialRtId?: string;

  // Legacy events (optional - dialogs now use WindowRef.close() instead)
  save?: Subject<TResult>;
  cancelled?: Subject<void>;
}

/**
 * Function type for applying config result to widget.
 * Takes the current widget and config result, returns updated widget.
 */
export type ConfigResultApplier<
  TWidget extends AnyWidgetConfig = AnyWidgetConfig,
  TResult extends WidgetConfigResult = WidgetConfigResult
> = (widget: TWidget, result: TResult) => TWidget;

/**
 * Registration for a widget type including display component, config dialog, and result handler.
 * This is the central definition for each widget type - all widget-specific logic lives here.
 */
export interface WidgetRegistration<
  TWidget extends AnyWidgetConfig = AnyWidgetConfig,
  TResult extends WidgetConfigResult = WidgetConfigResult
> {
  /** Widget type identifier */
  type: WidgetType;

  /** Display name for UI */
  label: string;

  /** Component that renders the widget */
  component: Type<unknown>;

  /** Config dialog component (optional - some widgets may not be configurable) */
  configDialogComponent?: Type<unknown>;

  /** Size configuration for the config dialog window */
  configDialogSize?: WidgetConfigDialogSize;

  /** Title for the config dialog window */
  configDialogTitle?: string;

  /** Function to apply config result to widget config */
  applyConfigResult?: ConfigResultApplier<TWidget, TResult>;

  /** Default size for the widget */
  defaultSize: { colSpan: number; rowSpan: number };

  /** Function to extract initial config values for dialog */
  getInitialConfig?: (widget: TWidget) => Record<string, unknown>;

  /**
   * Data source types that this widget supports.
   * Used by config dialogs to show only relevant options.
   * If not specified, all data source types are assumed to be supported.
   */
  supportedDataSources?: DataSourceType[];

  // ========== SOLID: Factory and Persistence Functions ==========

  /**
   * Creates a new widget with default configuration.
   * Called when adding a new widget to the dashboard.
   */
  createDefaultConfig: (baseConfig: BaseWidgetConfig) => TWidget;

  /**
   * Serializes widget configuration for persistence.
   * Extracts widget-specific data for storage in the backend.
   */
  toPersistedConfig: (widget: TWidget) => WidgetPersistenceData;

  /**
   * Deserializes persisted data back to widget configuration.
   * Called when loading a dashboard from the backend.
   */
  fromPersistedConfig: (data: PersistedWidgetData, baseConfig: BaseWidgetConfig) => TWidget;
}

/**
 * Result of opening a config dialog
 */
export interface ConfigDialogResult<TResult extends WidgetConfigResult = WidgetConfigResult> {
  saved: boolean;
  result?: TResult;
}

/**
 * Central registry for widget types.
 * Manages widget components, config dialogs, and their interactions.
 *
 * Usage:
 * 1. Widgets register themselves via registerWidget()
 * 2. Dashboard uses getRegisteredWidgets() for "Add Widget" dialog
 * 3. Dashboard uses getWidgetComponent() for rendering
 * 4. Dashboard uses openConfigDialog() for configuration
 */
@Injectable({
  providedIn: 'root'
})
export class WidgetRegistryService {
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);

  private static scrollbarStylesInjected = false;

  private readonly registry = new Map<WidgetType, WidgetRegistration>();

  /**
   * Registers a widget type with its components and handlers.
   */
  registerWidget<
    TWidget extends AnyWidgetConfig = AnyWidgetConfig,
    TResult extends WidgetConfigResult = WidgetConfigResult
  >(registration: WidgetRegistration<TWidget, TResult>): void {
    // Use unknown as intermediate type to avoid generic constraint issues
    this.registry.set(registration.type, registration as unknown as WidgetRegistration);
  }

  /**
   * Gets all registered widget types for the "Add Widget" dialog.
   */
  getRegisteredWidgets(): { type: WidgetType; label: string }[] {
    return Array.from(this.registry.values()).map(reg => ({
      type: reg.type,
      label: reg.label
    }));
  }

  /**
   * Gets the display component for a widget type.
   */
  getWidgetComponent(type: WidgetType): Type<unknown> | undefined {
    return this.registry.get(type)?.component;
  }

  /**
   * Gets the default size for a widget type.
   */
  getDefaultSize(type: WidgetType): { colSpan: number; rowSpan: number } {
    return this.registry.get(type)?.defaultSize ?? { colSpan: 2, rowSpan: 1 };
  }

  /**
   * Gets the full registration for a widget type.
   * Used by factory and persistence services to delegate widget-specific logic.
   */
  getRegistration(type: WidgetType): WidgetRegistration | undefined {
    return this.registry.get(type);
  }

  /**
   * Gets the supported data source types for a widget.
   * Returns all types if not specified in registration.
   */
  getSupportedDataSources(type: WidgetType): DataSourceType[] {
    const registration = this.registry.get(type);
    if (registration?.supportedDataSources) {
      return registration.supportedDataSources;
    }
    // Default: all data source types
    return ['runtimeEntity', 'persistentQuery', 'aggregation', 'serviceCall', 'constructionKitQuery', 'static'];
  }

  // ========== SOLID: Factory Methods ==========

  /**
   * Creates a new widget with default configuration.
   * Delegates to the widget's createDefaultConfig function.
   */
  createWidget(type: WidgetType, baseConfig: BaseWidgetConfig): AnyWidgetConfig {
    const registration = this.registry.get(type);
    if (!registration) {
      throw new Error(`Unknown widget type: ${type}`);
    }
    return registration.createDefaultConfig(baseConfig);
  }

  // ========== SOLID: Persistence Methods ==========

  /**
   * Serializes a widget for persistence.
   * Delegates to the widget's toPersistedConfig function.
   */
  serializeWidget(widget: AnyWidgetConfig): WidgetPersistenceData {
    const registration = this.registry.get(widget.type);
    if (!registration) {
      throw new Error(`Unknown widget type: ${widget.type}`);
    }
    return registration.toPersistedConfig(widget);
  }

  /**
   * Deserializes persisted data back to a widget configuration.
   * Delegates to the widget's fromPersistedConfig function.
   */
  deserializeWidget(data: PersistedWidgetData): AnyWidgetConfig {
    const type = data.type as WidgetType;
    const registration = this.registry.get(type);
    if (!registration) {
      // Fallback for unknown types - return a basic KPI widget
      console.warn(`Unknown widget type: ${type}, falling back to KPI`);
      const kpiRegistration = this.registry.get('kpi');
      if (!kpiRegistration) {
        throw new Error('KPI widget registration not found for fallback');
      }
      const baseConfig = this.buildBaseConfig(data);
      return kpiRegistration.fromPersistedConfig(data, baseConfig);
    }

    const baseConfig = this.buildBaseConfig(data);
    return registration.fromPersistedConfig(data, baseConfig);
  }

  /**
   * Builds base configuration from persisted data.
   */
  private buildBaseConfig(data: PersistedWidgetData): BaseWidgetConfig {
    const parsedConfig = data.config ? (typeof data.config === 'string' ? JSON.parse(data.config) : data.config) : {};
    return {
      id: data.rtId,
      title: data.name,
      col: data.col,
      row: data.row,
      colSpan: data.colSpan,
      rowSpan: data.rowSpan,
      configurable: true,
      chromeless: parsedConfig['chromeless'] === true ? true : undefined
    };
  }

  /**
   * Checks if a widget type has a config dialog.
   */
  hasConfigDialog(type: WidgetType): boolean {
    return this.registry.get(type)?.configDialogComponent !== undefined;
  }

  /**
   * Gets the config dialog component for a widget type.
   */
  getConfigDialogComponent(type: WidgetType): Type<unknown> | undefined {
    return this.registry.get(type)?.configDialogComponent;
  }

  /**
   * Gets the initial config values for a widget's config dialog.
   */
  getInitialConfig(widget: AnyWidgetConfig): Record<string, unknown> {
    const registration = this.registry.get(widget.type);
    if (!registration?.getInitialConfig) {
      // Default: extract data source info
      return {
        initialCkTypeId: this.getCkTypeId(widget),
        initialRtId: this.getRtId(widget)
      };
    }
    return registration.getInitialConfig(widget);
  }

  /**
   * Applies config result to a widget.
   */
  applyConfigResult(widget: AnyWidgetConfig, result: WidgetConfigResult): AnyWidgetConfig {
    const registration = this.registry.get(widget.type);

    if (registration?.applyConfigResult) {
      return registration.applyConfigResult(widget, result);
    }

    // Default: just update data source
    const newDataSource: RuntimeEntityDataSource = {
      type: 'runtimeEntity',
      ckTypeId: result.ckTypeId,
      rtId: result.rtId
    };

    return {
      ...widget,
      dataSource: newDataSource
    } as AnyWidgetConfig;
  }

  /**
   * Opens a config dialog for a widget and returns an Observable with the result.
   * Uses WindowService to create a resizable Kendo Window.
   */
  openConfigDialog(widget: AnyWidgetConfig): Observable<ConfigDialogResult> {
    return new Observable(subscriber => {
      const registration = this.registry.get(widget.type);

      if (!registration?.configDialogComponent) {
        subscriber.next({ saved: false });
        subscriber.complete();
        return;
      }

      const registeredSize = registration.configDialogSize ?? { width: 700, height: 600, minWidth: 550, minHeight: 450 };
      const dialogTitle = registration.configDialogTitle ?? `${registration.label} Configuration`;

      // Calculate responsive width: ~1/3 of viewport, clamped to min constraint
      const responsiveWidth = Math.max(registeredSize.minWidth, Math.round(window.innerWidth / 3));

      // Use persisted size if available, otherwise responsive width
      const savedSize = this.windowStateService.getDimensions('widget-config');
      const dialogSize = savedSize
        ? { ...registeredSize, width: savedSize.width, height: savedSize.height }
        : { ...registeredSize, width: responsiveWidth };

      const windowRef: WindowRef = this.windowService.open({
        content: registration.configDialogComponent,
        title: dialogTitle,
        width: dialogSize.width,
        height: dialogSize.height,
        minWidth: dialogSize.minWidth,
        minHeight: dialogSize.minHeight,
        resizable: true
      });

      this.windowStateService.applyModalBehavior('widget-config', windowRef);

      // Ensure scrollbar styles are injected for macOS overlay scrollbar support.
      // macOS hides scrollbars by default and only shows them during active scrolling.
      // Defining ::-webkit-scrollbar pseudo-elements forces permanent visibility.
      this.injectScrollbarStyles();

      // Disable overflow on Kendo Window's content wrapper so our dialog's
      // internal flex layout handles scrolling via .config-form { overflow-y: auto }.
      const windowEl = windowRef.window.location.nativeElement;
      const contentEl = windowEl.querySelector('.k-window-content');
      if (contentEl instanceof HTMLElement) {
        contentEl.style.overflow = 'hidden';
      }

      // Set initial values on the dialog component using Angular's setInput API.
      // This properly registers inputs and triggers change detection,
      // matching the behavior of the old ViewContainerRef.createComponent() pattern.
      const initialConfig = this.getInitialConfig(widget);
      if (windowRef.content) {
        Object.entries(initialConfig).forEach(([key, value]) => {
          windowRef.content.setInput(key, value);
        });
      }

      const subscription = windowRef.result.subscribe({
        next: (result) => {
          if (result instanceof WindowCloseResult) {
            subscriber.next({ saved: false });
          } else if (result && typeof result === 'object') {
            subscriber.next({ saved: true, result: result as WidgetConfigResult });
          } else {
            subscriber.next({ saved: false });
          }
          subscriber.complete();
        },
        error: () => {
          subscriber.next({ saved: false });
          subscriber.complete();
        }
      });

      return () => subscription.unsubscribe();
    });
  }

  /**
   * Opens a config dialog and waits for result (Promise version).
   */
  async openConfigDialogAsync(widget: AnyWidgetConfig): Promise<ConfigDialogResult> {
    return firstValueFrom(this.openConfigDialog(widget));
  }

  /**
   * Helper to extract ckTypeId from widget.
   */
  private getCkTypeId(widget: AnyWidgetConfig): string | undefined {
    if (widget.dataSource.type === 'runtimeEntity') {
      return widget.dataSource.ckTypeId;
    }
    return undefined;
  }

  /**
   * Helper to extract rtId from widget.
   */
  private getRtId(widget: AnyWidgetConfig): string | undefined {
    if (widget.dataSource.type === 'runtimeEntity') {
      return widget.dataSource.rtId;
    }
    return undefined;
  }

  /**
   * Injects global CSS for permanent scrollbar visibility in config dialogs.
   * macOS hides scrollbars by default (overlay scrollbar mode) and only shows
   * them during active scrolling. Defining ::-webkit-scrollbar pseudo-elements
   * overrides this behavior and makes scrollbars always visible.
   */
  private injectScrollbarStyles(): void {
    if (WidgetRegistryService.scrollbarStylesInjected) return;

    const style = document.createElement('style');
    style.setAttribute('data-widget-config-scrollbar', '');
    style.textContent = `
      .k-window-content .config-form::-webkit-scrollbar {
        width: 8px;
      }
      .k-window-content .config-form::-webkit-scrollbar-track {
        background: transparent;
      }
      .k-window-content .config-form::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.3);
        border-radius: 4px;
      }
      .k-window-content .config-form::-webkit-scrollbar-thumb:hover {
        background: rgba(128, 128, 128, 0.5);
      }
    `;
    document.head.appendChild(style);
    WidgetRegistryService.scrollbarStylesInjected = true;
  }
}
