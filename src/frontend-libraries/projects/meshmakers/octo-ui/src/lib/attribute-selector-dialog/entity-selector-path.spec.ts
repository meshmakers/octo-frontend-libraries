import {
  applyEntitySelector,
  isNavigationPath,
  parseEntitySelector,
  stripEntitySelector,
} from './entity-selector-path';

describe('entity-selector-path', () => {
  const basePath = 'containedSensors.energyIQTemperatureSensor->currentValue';
  const selectorPath =
    "containedSensors.energyIQTemperatureSensor[wellKnownName='Sensor 1']->currentValue";

  describe('isNavigationPath', () => {
    it('detects navigation paths', () => {
      expect(isNavigationPath(basePath)).toBeTrue();
      expect(isNavigationPath('currentValue')).toBeFalse();
      expect(isNavigationPath('amount.value')).toBeFalse();
    });
  });

  describe('stripEntitySelector', () => {
    it('removes the selector', () => {
      expect(stripEntitySelector(selectorPath)).toBe(basePath);
    });

    it('keeps array indexes', () => {
      expect(stripEntitySelector('records[0].value')).toBe('records[0].value');
      expect(stripEntitySelector('records[*].value')).toBe('records[*].value');
    });

    it('is a no-op without selector', () => {
      expect(stripEntitySelector(basePath)).toBe(basePath);
    });
  });

  describe('parseEntitySelector', () => {
    it('parses wellKnownName selectors and strips quotes', () => {
      const selector = parseEntitySelector(selectorPath);
      expect(selector).toEqual({ kind: 'wellKnownName', value: 'Sensor 1' });
    });

    it('parses rtId selectors', () => {
      const selector = parseEntitySelector(
        'containedSensors.energyIQTemperatureSensor[rtId=6789a00000000000010012a1]->currentValue',
      );
      expect(selector).toEqual({ kind: 'rtId', value: '6789a00000000000010012a1' });
    });

    it('parses attribute selectors', () => {
      const selector = parseEntitySelector(
        'containedSensors.energyIQTemperatureSensor[name=Main]->currentValue',
      );
      expect(selector).toEqual({ kind: 'attribute', attributeName: 'name', value: 'Main' });
    });

    it('returns null without selector or navigation', () => {
      expect(parseEntitySelector(basePath)).toBeNull();
      expect(parseEntitySelector('currentValue')).toBeNull();
    });
  });

  describe('applyEntitySelector', () => {
    it('inserts a selector on the first navigation segment', () => {
      expect(
        applyEntitySelector(basePath, { kind: 'wellKnownName', value: 'Sensor 1' }),
      ).toBe(selectorPath);
    });

    it('replaces an existing selector', () => {
      expect(applyEntitySelector(selectorPath, { kind: 'rtId', value: 'abc' })).toBe(
        "containedSensors.energyIQTemperatureSensor[rtId='abc']->currentValue",
      );
    });

    it('applies attribute selectors with the attribute name as key', () => {
      expect(
        applyEntitySelector(basePath, {
          kind: 'attribute',
          attributeName: 'name',
          value: 'Main',
        }),
      ).toBe("containedSensors.energyIQTemperatureSensor[name='Main']->currentValue");
    });

    it('removes the selector when null is passed', () => {
      expect(applyEntitySelector(selectorPath, null)).toBe(basePath);
    });

    it('targets the first navigation segment on multi-hop paths', () => {
      expect(
        applyEntitySelector('children.testSensor->parent.testZone->designation', {
          kind: 'wellKnownName',
          value: 'S1',
        }),
      ).toBe("children.testSensor[wellKnownName='S1']->parent.testZone->designation");
    });

    it('is a no-op on non-navigation paths', () => {
      expect(applyEntitySelector('currentValue', { kind: 'rtId', value: 'x' })).toBe(
        'currentValue',
      );
    });
  });
});
