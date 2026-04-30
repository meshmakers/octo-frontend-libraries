/*
 * Public API Surface of octo-ui
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideOctoServices } from '@meshmakers/octo-services';
import { provideMmSharedAuth } from '@meshmakers/shared-auth';
import { provideMmSharedUi } from '@meshmakers/shared-ui';
import { AttributeSortSelectorDialogService } from './lib/attribute-sort-selector-dialog';
import { CkTypeSelectorDialogService } from './lib/ck-type-selector-dialog';
import { PropertyConverterService } from './lib/property-grid';
import { RuntimeEntityVariableDialogService } from './lib/runtime-entity-variable-dialog';

export * from './lib/attribute-selector-dialog';
export * from './lib/attribute-sort-selector-dialog';
// Branding feature lives in the secondary entry point `@meshmakers/octo-ui/branding`
// to avoid pulling in the entire primary FESM (RuntimeBrowser, FieldFilterEditor,
// AttributeSelectors, etc.) for apps that only need the lightweight branding
// pieces (logo, theme switcher, services). The re-export below preserves
// backwards compatibility for consumers importing branding symbols from
// `@meshmakers/octo-ui` directly.
export * from '@meshmakers/octo-ui/branding';
export * from './lib/ck-type-selector-dialog';
export * from './lib/ck-type-selector-input';
export * from './lib/data-sources/octo-graph-ql-data-source';
export * from './lib/data-sources/octo-graph-ql-hierarchy-data-source';
export * from './lib/entity-id-info';
export * from './lib/entity-selector-dialog';
export * from './lib/field-filter-editor';
export * from './lib/octo-loader';
export * from './lib/property-grid';
export * from './lib/runtime-browser';
export * from './lib/runtime-entity-variable-dialog';
export * from './lib/tenant-switcher';

/**
 * Provides OctoUi services using modern Angular provider functions.
 * This is the recommended approach for library providers.
 */
export function provideOctoUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideOctoServices(),
    provideMmSharedUi(),
    provideMmSharedAuth(),
    provideAnimationsAsync(),
    AttributeSortSelectorDialogService,
    PropertyConverterService,
    CkTypeSelectorDialogService,
    RuntimeEntityVariableDialogService,
  ]);
}
