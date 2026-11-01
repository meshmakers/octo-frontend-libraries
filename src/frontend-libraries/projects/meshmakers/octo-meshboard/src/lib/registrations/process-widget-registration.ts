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
import { DEFAULT_PROCESS_BINDING_NAME, ProcessConnectionDirection, ProcessWidgetBinding } from '../widgets/process-widget/process-widget-config.model';
import {
  hasNamedProcessBindings,
  parsePersistedProcessBindings,
  toPersistedProcessBindings
} from '../widgets/process-widget/process-widget-bindings';

/**
 * The legacy single-binding fields of one binding named `default` (AB#8023):
 * a widget with exactly that one binding is saved in the legacy shape, so no
 * existing board is migrated silently.
 */
function legacyFieldsOf(binding: ProcessWidgetBinding): Partial<ProcessWidgetConfig> {
  return {
    dataBindingMode: binding.mode,
    bindingCkTypeId: binding.ckTypeId,
    bindingRtId: binding.rtId,
    bindingQueryRtId: binding.queryRtId,
    bindingQueryName: binding.queryName,
    bindingQueryFamily: binding.queryFamily,
    bindingIgnoreTimeFilter: binding.ignoreTimeFilter,
    bindingEntitySelectorId: binding.entitySelectorId,
    bindingFilters: binding.filters
  };
}

/**
 * Normalizes the binding fields before persisting: a single binding named
 * `default` collapses into the legacy fields; anything else keeps `bindings`.
 */
function normalizeBindings(widget: ProcessWidgetConfig): ProcessWidgetConfig {
  if (!hasNamedProcessBindings(widget)) {
    return widget;
  }
  const bindings = widget.bindings!;
  if (bindings.length === 1 && bindings[0].name === DEFAULT_PROCESS_BINDING_NAME) {
    const { bindings: _dropped, ...rest } = widget;
    return { ...rest, ...legacyFieldsOf(bindings[0]) };
  }
  return widget;
}

/** Reads persisted `connectionDirections`; drops malformed entries, `undefined` when none is left. */
function parseConnectionDirections(raw: unknown): ProcessConnectionDirection[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const directions = raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .filter(e => typeof e['connectionId'] === 'string' && typeof e['propertyId'] === 'string')
    .map(e => ({ connectionId: e['connectionId'] as string, propertyId: e['propertyId'] as string }));
  return directions.length > 0 ? directions : undefined;
}

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
    configDialogSize: { width: 780, height: 750, minWidth: 600, minHeight: 550 },
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
      initialBindingQueryFamily: widget.bindingQueryFamily,
      initialBindingIgnoreTimeFilter: widget.bindingIgnoreTimeFilter,
      initialBindingEntitySelectorId: widget.bindingEntitySelectorId,
      initialBindingFilters: widget.bindingFilters,
      initialPropertyMappings: widget.propertyMappings,
      // Named bindings (AB#8023) and connection directions (AB#8025)
      initialBindings: widget.bindings,
      initialConnectionDirections: widget.connectionDirections
    }),

    // The dialog edits every binding (AB#8025): a result with `bindings` replaces
    // the legacy fields, a result without them (none, or one card named
    // `default`) writes the legacy fields and drops `bindings`.
    applyConfigResult: (widget, result) => {
      const named = Array.isArray(result.bindings) && result.bindings.length > 0;
      const { bindings: _bindings, connectionDirections: _directions, ...rest } = widget;
      return {
        ...rest,
        // Diagram selection
        processDiagramRtId: result.processDiagramRtId,
        inlineConfig: result.inlineConfig,
        // Display options
        fitToBounds: result.fitToBounds,
        allowZoom: result.allowZoom,
        allowPan: result.allowPan,
        showToolbar: result.showToolbar,
        initialZoom: result.initialZoom,
        // Data binding (legacy fields; absent when named bindings are used)
        dataBindingMode: result.dataBindingMode,
        bindingCkTypeId: result.bindingCkTypeId,
        bindingRtId: result.bindingRtId,
        bindingQueryRtId: result.bindingQueryRtId,
        bindingQueryName: result.bindingQueryName,
        bindingQueryFamily: result.bindingQueryFamily,
        bindingIgnoreTimeFilter: result.bindingIgnoreTimeFilter,
        bindingEntitySelectorId: result.bindingEntitySelectorId,
        bindingFilters: result.bindingFilters,
        propertyMappings: result.propertyMappings,
        ...(named && { bindings: result.bindings }),
        ...(result.connectionDirections && result.connectionDirections.length > 0 && { connectionDirections: result.connectionDirections })
      };
    },

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
    toPersistedConfig: (input: ProcessWidgetConfig): WidgetPersistenceData => {
      const widget = normalizeBindings(input);
      return {
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
          // Stream-data binding — written only when set.
          ...(widget.bindingQueryFamily && { bindingQueryFamily: widget.bindingQueryFamily }),
          ...(widget.bindingIgnoreTimeFilter && { bindingIgnoreTimeFilter: true }),
          ...(widget.bindingEntitySelectorId && { bindingEntitySelectorId: widget.bindingEntitySelectorId }),
          bindingFilters: widget.bindingFilters,
          propertyMappings: widget.propertyMappings,
          // Named bindings (AB#8023) — written only when present, so legacy
          // widgets encode byte-identically.
          ...(hasNamedProcessBindings(widget) && { bindings: toPersistedProcessBindings(widget.bindings!) }),
          // Connection directions (AB#8025) — written only when set.
          ...(widget.connectionDirections && widget.connectionDirections.length > 0 && {
            connectionDirections: widget.connectionDirections.map(d => ({ connectionId: d.connectionId, propertyId: d.propertyId }))
          })
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): ProcessWidgetConfig => {
      const config = parseConfig(data);
      const bindings = parsePersistedProcessBindings(config['bindings']);
      const connectionDirections = parseConnectionDirections(config['connectionDirections']);
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
        bindingQueryFamily: config['bindingQueryFamily'] as ProcessWidgetConfig['bindingQueryFamily'],
        bindingIgnoreTimeFilter: config['bindingIgnoreTimeFilter'] as boolean | undefined,
        bindingEntitySelectorId: config['bindingEntitySelectorId'] as string | undefined,
        bindingFilters: config['bindingFilters'] as ProcessWidgetConfig['bindingFilters'],
        propertyMappings: config['propertyMappings'] as ProcessWidgetConfig['propertyMappings'],
        // Named bindings (AB#8023); absent key stays absent.
        ...(bindings && { bindings }),
        // Connection directions (AB#8025); absent key stays absent.
        ...(connectionDirections && { connectionDirections })
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
