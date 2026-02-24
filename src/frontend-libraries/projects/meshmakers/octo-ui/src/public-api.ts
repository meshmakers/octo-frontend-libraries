/*
 * Public API Surface of octo-ui
 */

import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import { provideOctoServices } from "@meshmakers/octo-services";
import { provideMmSharedUi } from "@meshmakers/shared-ui";
import { provideMmSharedAuth } from "@meshmakers/shared-auth";
import { AttributeSortSelectorDialogService } from './lib/attribute-sort-selector-dialog';
import { PropertyConverterService } from './lib/property-grid';
import { CkTypeSelectorDialogService } from './lib/ck-type-selector-dialog';

export * from './lib/data-sources/octo-graph-ql-data-source';
export * from './lib/data-sources/octo-graph-ql-hierarchy-data-source';
export * from './lib/property-grid';
export * from './lib/attribute-selector-dialog';
export * from './lib/attribute-sort-selector-dialog';
export * from './lib/ck-type-selector-dialog';
export * from './lib/ck-type-selector-input';
export * from './lib/field-filter-editor';
export * from './lib/entity-id-info';
export * from './lib/octo-loader';

/**
 * Provides OctoUi services using modern Angular provider functions.
 * This is the recommended approach for library providers.
 */
export function provideOctoUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideOctoServices(),
    provideMmSharedUi(),
    provideMmSharedAuth(),
    AttributeSortSelectorDialogService,
    PropertyConverterService,
    CkTypeSelectorDialogService
  ]);
}
