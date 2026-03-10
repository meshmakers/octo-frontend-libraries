/*
 * Public API Surface of octo-ui
 */
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideOctoServices } from '@meshmakers/octo-services';
import { provideMmSharedAuth } from '@meshmakers/shared-auth';
import { provideMmSharedUi } from '@meshmakers/shared-ui';
import { AttributeSortSelectorDialogService } from './lib/attribute-sort-selector-dialog';
import { CkTypeSelectorDialogService } from './lib/ck-type-selector-dialog';
import { AppTranslateService } from './lib/i18n/translate.service';
import { PropertyConverterService } from './lib/property-grid';
export * from './lib/attribute-selector-dialog';
export * from './lib/attribute-sort-selector-dialog';
export * from './lib/ck-type-selector-dialog';
export * from './lib/ck-type-selector-input';
export * from './lib/data-sources/octo-graph-ql-data-source';
export * from './lib/data-sources/octo-graph-ql-hierarchy-data-source';
export * from './lib/entity-id-info';
export * from './lib/field-filter-editor';
export * from './lib/i18n/merge-translate-loader';
export * from './lib/octo-loader';
export * from './lib/property-grid';
export * from './lib/runtime-browser';
export * from './lib/runtime-browser/services/constant.service';

export interface OctoUiTranslationConfig {
  language?: string;
}

/**
 * Provides OctoUi services using modern Angular provider functions.
 * This is the recommended approach for library providers.
 */
export function provideOctoUi(
  config: OctoUiTranslationConfig = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const translateService = inject(AppTranslateService);
      return translateService.initialize(config.language);
    }),
    provideOctoServices(),
    provideMmSharedUi(),
    provideMmSharedAuth(),
    provideAnimations(),
    AttributeSortSelectorDialogService,
    PropertyConverterService,
    CkTypeSelectorDialogService,
  ]);
}
