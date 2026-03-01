/**
 * Process Widget Registration
 *
 * This file is separate from default-widget-registrations.ts to enable
 * lazy loading of the ProcessWidget and its dependencies (octo-process-diagrams).
 *
 * Usage:
 * - Import and call registerProcessWidget() only in routes/components that need it
 * - Or use provideProcessWidget() in app config for eager loading
 */

import { EnvironmentProviders, makeEnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { WidgetRegistryService, BaseWidgetConfig, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import { ProcessWidgetConfig } from '../models/meshboard.models';

// Process Widget Components (these pull in @meshmakers/octo-process-diagrams)
import { ProcessWidgetComponent } from '../widgets/process-widget/process-widget.component';
import { ProcessConfigDialogComponent, ProcessConfigResult } from '../widgets/process-widget/process-config-dialog.component';

/**
 * Registers the Process Widget with the widget registry.
 *
 * Call this function to enable Process Diagram widgets in MeshBoard.
 * This is kept separate to allow lazy loading of the octo-process-diagrams dependency.
 *
 * @example
 * ```typescript
 * // In a lazy-loaded route or component
 * const registry = inject(WidgetRegistryService);
 * registerProcessWidget(registry);
 * ```
 */
export function registerProcessWidget(registry: WidgetRegistryService): void {
  // Helper to parse config JSON
  const parseConfig = (data: PersistedWidgetData): Record<string, unknown> => {
    try {
      return typeof data.config === 'string' ? JSON.parse(data.config) : (data.config ?? {});
    } catch {
      return {};
    }
  };

  // Process Widget
  // HMI-style process visualization with tanks, pipes, valves, pumps
  registry.registerWidget<ProcessWidgetConfig, ProcessConfigResult>({
    type: 'process',
    label: 'Process Diagram',
    component: ProcessWidgetComponent,
    configDialogComponent: ProcessConfigDialogComponent,
    configDialogSize: { width: 680, height: 650, minWidth: 550, minHeight: 500 },
    configDialogTitle: 'Process Diagram Configuration',
    defaultSize: { colSpan: 4, rowSpan: 3 },
    supportedDataSources: ['static'],

    getInitialConfig: (widget) => ({
      // Diagram selection
      initialProcessDiagramRtId: widget.processDiagramRtId,
      // Display options
      initialFitToBounds: widget.fitToBounds,
      initialAllowZoom: widget.allowZoom,
      initialAllowPan: widget.allowPan,
      initialShowToolbar: widget.showToolbar,
      initialInitialZoom: widget.initialZoom,
      // Data binding
      initialDataBindingMode: widget.dataBindingMode,
      initialBindingCkTypeId: widget.bindingCkTypeId,
      initialBindingRtId: widget.bindingRtId,
      initialBindingQueryRtId: widget.bindingQueryRtId,
      initialBindingQueryName: widget.bindingQueryName,
      initialBindingFilters: widget.bindingFilters,
      initialPropertyMappings: widget.propertyMappings
    }),

    applyConfigResult: (widget, result) => ({
      ...widget,
      // Diagram selection
      processDiagramRtId: result.processDiagramRtId,
      inlineConfig: result.inlineConfig,
      // Display options
      fitToBounds: result.fitToBounds,
      allowZoom: result.allowZoom,
      allowPan: result.allowPan,
      showToolbar: result.showToolbar,
      initialZoom: result.initialZoom,
      // Data binding
      dataBindingMode: result.dataBindingMode,
      bindingCkTypeId: result.bindingCkTypeId,
      bindingRtId: result.bindingRtId,
      bindingQueryRtId: result.bindingQueryRtId,
      bindingQueryName: result.bindingQueryName,
      bindingFilters: result.bindingFilters,
      propertyMappings: result.propertyMappings
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): ProcessWidgetConfig => ({
      ...base,
      type: 'process',
      colSpan: 4,
      rowSpan: 3,
      dataSource: {
        type: 'static',
        data: null
      },
      fitToBounds: true,
      allowZoom: false,
      allowPan: false,
      showToolbar: false,
      initialZoom: 1
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: ProcessWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'static',
      config: {
        // Diagram selection
        processDiagramRtId: widget.processDiagramRtId,
        inlineConfig: widget.inlineConfig,
        // Display options
        fitToBounds: widget.fitToBounds,
        allowZoom: widget.allowZoom,
        allowPan: widget.allowPan,
        showToolbar: widget.showToolbar,
        initialZoom: widget.initialZoom,
        // Data binding
        dataBindingMode: widget.dataBindingMode,
        bindingCkTypeId: widget.bindingCkTypeId,
        bindingRtId: widget.bindingRtId,
        bindingQueryRtId: widget.bindingQueryRtId,
        bindingQueryName: widget.bindingQueryName,
        bindingFilters: widget.bindingFilters,
        propertyMappings: widget.propertyMappings
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): ProcessWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'process',
        dataSource: {
          type: 'static',
          data: null
        },
        // Diagram selection
        processDiagramRtId: config['processDiagramRtId'] as string | undefined,
        inlineConfig: config['inlineConfig'] as ProcessWidgetConfig['inlineConfig'],
        // Display options
        fitToBounds: (config['fitToBounds'] as boolean) ?? true,
        allowZoom: (config['allowZoom'] as boolean) ?? false,
        allowPan: (config['allowPan'] as boolean) ?? false,
        showToolbar: (config['showToolbar'] as boolean) ?? false,
        initialZoom: (config['initialZoom'] as number) ?? 1,
        // Data binding
        dataBindingMode: config['dataBindingMode'] as ProcessWidgetConfig['dataBindingMode'],
        bindingCkTypeId: config['bindingCkTypeId'] as string | undefined,
        bindingRtId: config['bindingRtId'] as string | undefined,
        bindingQueryRtId: config['bindingQueryRtId'] as string | undefined,
        bindingQueryName: config['bindingQueryName'] as string | undefined,
        bindingFilters: config['bindingFilters'] as ProcessWidgetConfig['bindingFilters'],
        propertyMappings: config['propertyMappings'] as ProcessWidgetConfig['propertyMappings']
      };
    }
  });
}

/**
 * Provides the Process Widget registration as an environment provider.
 *
 * Use this if you want to eagerly register the Process Widget at app startup.
 * For lazy loading, use registerProcessWidget() directly in the component/route instead.
 *
 * @example
 * ```typescript
 * // In app.config.ts (eager loading)
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMeshBoard(),
 *     provideProcessWidget() // Optional: only if you need ProcessWidget
 *   ]
 * };
 * ```
 */
export function provideProcessWidget(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const registry = inject(WidgetRegistryService);
      registerProcessWidget(registry);
    })
  ]);
}
