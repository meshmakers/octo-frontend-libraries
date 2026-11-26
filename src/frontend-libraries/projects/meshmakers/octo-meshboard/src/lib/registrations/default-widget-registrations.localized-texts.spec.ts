import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import { WidgetRegistryService, WidgetConfigResult } from '../services/widget-registry.service';
import { registerDefaultWidgets } from './default-widget-registrations';
import { AnyWidgetConfig } from '../models/meshboard.models';

/**
 * Saving a widget's config dialog keeps the per-language titles and the explanation the author put
 * into the board configuration: the dialogs do not edit them, so they must come out unchanged.
 */
describe('Default widget registrations - per-language widget texts survive a config dialog save', () => {
  const TITLES = { 'de-AT': 'Energiemengen', 'en-GB': 'Energy quantities' };
  const INFOS = { 'de-AT': 'Summe aller Zählpunkte', 'en-GB': 'Sum of all metering points' };

  let registry: WidgetRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  /** A dialog result that leaves every list empty, as a dialog saved without a data source would. */
  function emptyResult(): WidgetConfigResult {
    return new Proxy({}, {
      get: (_target, key) => (key === 'then' ? undefined : (String(key).endsWith('s') || key === 'sorting' ? [] : undefined))
    }) as WidgetConfigResult;
  }

  it('keeps titles, description and descriptions on the result of every widget config dialog', () => {
    const types = registry.getRegisteredWidgets().map(r => r.type)
      .filter(type => registry.getRegistration(type)?.applyConfigResult);
    expect(types.length).toBeGreaterThan(10);

    for (const type of types) {
      const widget = {
        ...registry.createWidget(type, { id: `w-${type}`, title: 'Energy quantities', col: 1, row: 1, colSpan: 2, rowSpan: 2 }),
        titles: TITLES,
        description: 'Sum of all metering points',
        descriptions: INFOS
      } as AnyWidgetConfig;

      const saved = registry.applyConfigResult(widget, emptyResult());

      expect({ type, titles: saved.titles, description: saved.description, descriptions: saved.descriptions })
        .toEqual({ type, titles: TITLES, description: 'Sum of all metering points', descriptions: INFOS });
    }
  });
});
