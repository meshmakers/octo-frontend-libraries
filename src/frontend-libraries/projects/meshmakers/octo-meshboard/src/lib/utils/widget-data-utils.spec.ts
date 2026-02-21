import {
  sanitizeFieldName,
  parseNumericValue,
  extractAggregationValue,
  extractGroupedAggregationValue,
  processStaticSeriesData,
  processDynamicSeriesData,
  processPieChartData,
  QueryRow,
  QueryResult,
  SeriesConfig,
  SUPPORTED_ROW_TYPES
} from './widget-data-utils';

/**
 * Creates a mock query cell for testing.
 */
function createCell(attributePath: string, value: unknown): { attributePath: string; value: unknown } {
  return { attributePath, value };
}

/**
 * Creates a mock query row for testing.
 */
function createRow(
  typename: string,
  cells: { attributePath: string; value: unknown }[]
): QueryRow {
  return {
    __typename: typename,
    cells: { items: cells }
  };
}

describe('Widget Data Utils', () => {

  describe('sanitizeFieldName', () => {
    it('should replace dots with underscores', () => {
      expect(sanitizeFieldName('customer.name')).toBe('customer_name');
    });

    it('should handle multiple dots', () => {
      expect(sanitizeFieldName('a.b.c.d')).toBe('a_b_c_d');
    });

    it('should return unchanged string without dots', () => {
      expect(sanitizeFieldName('name')).toBe('name');
    });

    it('should handle empty string', () => {
      expect(sanitizeFieldName('')).toBe('');
    });

    it('should handle string starting with dot', () => {
      expect(sanitizeFieldName('.name')).toBe('_name');
    });

    it('should handle string ending with dot', () => {
      expect(sanitizeFieldName('name.')).toBe('name_');
    });

    it('should handle consecutive dots', () => {
      expect(sanitizeFieldName('a..b')).toBe('a__b');
    });
  });

  describe('parseNumericValue', () => {
    it('should return number as-is', () => {
      expect(parseNumericValue(42)).toBe(42);
      expect(parseNumericValue(3.14)).toBe(3.14);
      expect(parseNumericValue(-10)).toBe(-10);
    });

    it('should parse string to number', () => {
      expect(parseNumericValue('42')).toBe(42);
      expect(parseNumericValue('3.14')).toBe(3.14);
      expect(parseNumericValue('-10')).toBe(-10);
    });

    it('should return 0 for invalid numeric string', () => {
      expect(parseNumericValue('abc')).toBe(0);
      expect(parseNumericValue('not a number')).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseNumericValue('')).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(parseNumericValue(null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect(parseNumericValue(undefined)).toBe(0);
    });

    it('should handle boolean values', () => {
      expect(parseNumericValue(true)).toBe(0);  // parseFloat('true') = NaN
      expect(parseNumericValue(false)).toBe(0); // parseFloat('false') = NaN
    });

    it('should handle string with leading number', () => {
      expect(parseNumericValue('42abc')).toBe(42);
    });

    it('should handle whitespace', () => {
      expect(parseNumericValue('  42  ')).toBe(42);
    });

    it('should return 0 for NaN input', () => {
      expect(parseNumericValue(NaN)).toBe(0);
    });
  });

  describe('extractAggregationValue', () => {
    it('should return 0 for empty result', () => {
      const result: QueryResult = { rows: { items: [] } };
      expect(extractAggregationValue(result)).toBe(0);
    });

    it('should return 0 for null rows', () => {
      const result: QueryResult = { rows: null };
      expect(extractAggregationValue(result)).toBe(0);
    });

    it('should extract value from first cell when no valueField specified', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtAggregationQueryRow', [
              createCell('count', 100)
            ])
          ]
        }
      };

      expect(extractAggregationValue(result)).toBe(100);
    });

    it('should extract specific field value when valueField specified', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtAggregationQueryRow', [
              createCell('sum', 500),
              createCell('count', 100)
            ])
          ]
        }
      };

      expect(extractAggregationValue(result, 'count')).toBe(100);
      expect(extractAggregationValue(result, 'sum')).toBe(500);
    });

    it('should handle field with dots (sanitized)', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtAggregationQueryRow', [
              createCell('entity.count', 150)
            ])
          ]
        }
      };

      expect(extractAggregationValue(result, 'entity_count')).toBe(150);
    });

    it('should skip unsupported row types', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('UnsupportedType', [createCell('count', 999)]),
            createRow('RtAggregationQueryRow', [createCell('count', 100)])
          ]
        }
      };

      expect(extractAggregationValue(result)).toBe(100);
    });

    it('should return first cell value if specified field not found', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtAggregationQueryRow', [
              createCell('sum', 500)
            ])
          ]
        }
      };

      expect(extractAggregationValue(result, 'nonexistent')).toBe(500);
    });

    it('should handle RtGroupingAggregationQueryRow', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtGroupingAggregationQueryRow', [
              createCell('total', 250)
            ])
          ]
        }
      };

      expect(extractAggregationValue(result)).toBe(250);
    });
  });

  describe('extractGroupedAggregationValue', () => {
    const createGroupedResult = (): QueryResult => ({
      rows: {
        items: [
          createRow('RtGroupingAggregationQueryRow', [
            createCell('status', 'active'),
            createCell('count', 50)
          ]),
          createRow('RtGroupingAggregationQueryRow', [
            createCell('status', 'inactive'),
            createCell('count', 30)
          ]),
          createRow('RtGroupingAggregationQueryRow', [
            createCell('status', 'pending'),
            createCell('count', 20)
          ])
        ]
      }
    });

    it('should return 0 when categoryField is empty', () => {
      const result = createGroupedResult();
      expect(extractGroupedAggregationValue(result, '', 'active', 'count')).toBe(0);
    });

    it('should return 0 when categoryValue is empty', () => {
      const result = createGroupedResult();
      expect(extractGroupedAggregationValue(result, 'status', '', 'count')).toBe(0);
    });

    it('should return 0 when valueField is empty', () => {
      const result = createGroupedResult();
      expect(extractGroupedAggregationValue(result, 'status', 'active', '')).toBe(0);
    });

    it('should extract value for matching category', () => {
      const result = createGroupedResult();

      expect(extractGroupedAggregationValue(result, 'status', 'active', 'count')).toBe(50);
      expect(extractGroupedAggregationValue(result, 'status', 'inactive', 'count')).toBe(30);
      expect(extractGroupedAggregationValue(result, 'status', 'pending', 'count')).toBe(20);
    });

    it('should return 0 for non-matching category', () => {
      const result = createGroupedResult();
      expect(extractGroupedAggregationValue(result, 'status', 'unknown', 'count')).toBe(0);
    });

    it('should handle fields with dots', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtGroupingAggregationQueryRow', [
              createCell('entity.status', 'active'),
              createCell('entity.count', 100)
            ])
          ]
        }
      };

      expect(extractGroupedAggregationValue(result, 'entity_status', 'active', 'entity_count')).toBe(100);
    });

    it('should return 0 for empty rows', () => {
      const result: QueryResult = { rows: { items: [] } };
      expect(extractGroupedAggregationValue(result, 'status', 'active', 'count')).toBe(0);
    });

    it('should handle numeric category values as strings', () => {
      const result: QueryResult = {
        rows: {
          items: [
            createRow('RtGroupingAggregationQueryRow', [
              createCell('year', 2024),
              createCell('count', 100)
            ])
          ]
        }
      };

      expect(extractGroupedAggregationValue(result, 'year', '2024', 'count')).toBe(100);
    });
  });

  describe('processStaticSeriesData', () => {
    const createSalesRows = (): QueryRow[] => [
      createRow('RtSimpleQueryRow', [
        createCell('region', 'North'),
        createCell('sales', 1000),
        createCell('profit', 200)
      ]),
      createRow('RtSimpleQueryRow', [
        createCell('region', 'South'),
        createCell('sales', 1500),
        createCell('profit', 300)
      ]),
      createRow('RtSimpleQueryRow', [
        createCell('region', 'East'),
        createCell('sales', 800),
        createCell('profit', 150)
      ])
    ];

    it('should extract categories from categoryField', () => {
      const rows = createSalesRows();
      const seriesConfigs: SeriesConfig[] = [{ field: 'sales' }];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.categories).toEqual(['North', 'South', 'East']);
    });

    it('should extract single series data', () => {
      const rows = createSalesRows();
      const seriesConfigs: SeriesConfig[] = [{ field: 'sales', name: 'Sales' }];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.seriesData.length).toBe(1);
      expect(result.seriesData[0].name).toBe('Sales');
      expect(result.seriesData[0].data).toEqual([1000, 1500, 800]);
    });

    it('should extract multiple series data', () => {
      const rows = createSalesRows();
      const seriesConfigs: SeriesConfig[] = [
        { field: 'sales', name: 'Sales' },
        { field: 'profit', name: 'Profit' }
      ];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.seriesData.length).toBe(2);
      expect(result.seriesData[0].name).toBe('Sales');
      expect(result.seriesData[0].data).toEqual([1000, 1500, 800]);
      expect(result.seriesData[1].name).toBe('Profit');
      expect(result.seriesData[1].data).toEqual([200, 300, 150]);
    });

    it('should use field name when series name not specified', () => {
      const rows = createSalesRows();
      const seriesConfigs: SeriesConfig[] = [{ field: 'sales' }];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.seriesData[0].name).toBe('sales');
    });

    it('should include color when specified', () => {
      const rows = createSalesRows();
      const seriesConfigs: SeriesConfig[] = [
        { field: 'sales', name: 'Sales', color: '#ff0000' }
      ];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.seriesData[0].color).toBe('#ff0000');
    });

    it('should handle empty rows', () => {
      const result = processStaticSeriesData([], 'region', [{ field: 'sales' }]);

      expect(result.categories).toEqual([]);
      expect(result.seriesData[0].data).toEqual([]);
    });

    it('should handle empty series config', () => {
      const rows = createSalesRows();
      const result = processStaticSeriesData(rows, 'region', []);

      expect(result.categories).toEqual(['North', 'South', 'East']);
      expect(result.seriesData).toEqual([]);
    });

    it('should handle missing value in row (returns 0)', () => {
      const rows: QueryRow[] = [
        createRow('RtSimpleQueryRow', [
          createCell('region', 'North'),
          createCell('sales', 1000)
          // profit missing
        ]),
        createRow('RtSimpleQueryRow', [
          createCell('region', 'South'),
          createCell('sales', 1500),
          createCell('profit', 300)
        ])
      ];

      const seriesConfigs: SeriesConfig[] = [
        { field: 'sales' },
        { field: 'profit' }
      ];

      const result = processStaticSeriesData(rows, 'region', seriesConfigs);

      expect(result.seriesData[1].data).toEqual([0, 300]); // profit: 0 for North
    });

    it('should skip rows with empty category', () => {
      const rows: QueryRow[] = [
        createRow('RtSimpleQueryRow', [
          createCell('region', 'North'),
          createCell('sales', 1000)
        ]),
        createRow('RtSimpleQueryRow', [
          createCell('region', ''),  // empty category
          createCell('sales', 500)
        ]),
        createRow('RtSimpleQueryRow', [
          createCell('region', 'South'),
          createCell('sales', 1500)
        ])
      ];

      const result = processStaticSeriesData(rows, 'region', [{ field: 'sales' }]);

      expect(result.categories).toEqual(['North', 'South']);
      expect(result.seriesData[0].data).toEqual([1000, 1500]);
    });

    it('should handle field names with dots', () => {
      const rows: QueryRow[] = [
        createRow('RtSimpleQueryRow', [
          createCell('entity.region', 'North'),
          createCell('entity.sales', 1000)
        ])
      ];

      const result = processStaticSeriesData(rows, 'entity.region', [{ field: 'entity.sales' }]);

      expect(result.categories).toEqual(['North']);
      expect(result.seriesData[0].data).toEqual([1000]);
    });

    it('should skip unsupported row types', () => {
      const rows: QueryRow[] = [
        createRow('UnsupportedType', [
          createCell('region', 'Invalid'),
          createCell('sales', 9999)
        ]),
        createRow('RtSimpleQueryRow', [
          createCell('region', 'Valid'),
          createCell('sales', 1000)
        ])
      ];

      const result = processStaticSeriesData(rows, 'region', [{ field: 'sales' }]);

      expect(result.categories).toEqual(['Valid']);
    });
  });

  describe('processDynamicSeriesData', () => {
    const createBillingRows = (): QueryRow[] => [
      createRow('RtGroupingAggregationQueryRow', [
        createCell('legalEntityType', 'Company'),
        createCell('billingType', 'Credit'),
        createCell('quantity', 261721)
      ]),
      createRow('RtGroupingAggregationQueryRow', [
        createCell('legalEntityType', 'Company'),
        createCell('billingType', 'Debit'),
        createCell('quantity', 65263)
      ]),
      createRow('RtGroupingAggregationQueryRow', [
        createCell('legalEntityType', 'Person'),
        createCell('billingType', 'Credit'),
        createCell('quantity', 189794)
      ]),
      createRow('RtGroupingAggregationQueryRow', [
        createCell('legalEntityType', 'Person'),
        createCell('billingType', 'Debit'),
        createCell('quantity', 108225)
      ])
    ];

    it('should extract categories from rows', () => {
      const rows = createBillingRows();
      const result = processDynamicSeriesData(rows, 'legalEntityType', 'billingType', 'quantity');

      expect(result.categories).toEqual(['Company', 'Person']);
    });

    it('should create series from unique seriesGroupField values', () => {
      const rows = createBillingRows();
      const result = processDynamicSeriesData(rows, 'legalEntityType', 'billingType', 'quantity');

      expect(result.seriesData.length).toBe(2);
      expect(result.seriesData.map(s => s.name).sort()).toEqual(['Credit', 'Debit']);
    });

    it('should correctly map values to categories and series', () => {
      const rows = createBillingRows();
      const result = processDynamicSeriesData(rows, 'legalEntityType', 'billingType', 'quantity');

      // Find Credit and Debit series
      const creditSeries = result.seriesData.find(s => s.name === 'Credit')!;
      const debitSeries = result.seriesData.find(s => s.name === 'Debit')!;

      // Categories: Company, Person
      expect(creditSeries.data).toEqual([261721, 189794]);
      expect(debitSeries.data).toEqual([65263, 108225]);
    });

    it('should return 0 for missing combinations', () => {
      const rows: QueryRow[] = [
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', 'A'),
          createCell('series', 'X'),
          createCell('value', 100)
        ]),
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', 'B'),
          createCell('series', 'Y'),
          createCell('value', 200)
        ])
      ];

      const result = processDynamicSeriesData(rows, 'category', 'series', 'value');

      // Categories: A, B
      // Series X has data for A only -> [100, 0]
      // Series Y has data for B only -> [0, 200]
      const seriesX = result.seriesData.find(s => s.name === 'X')!;
      const seriesY = result.seriesData.find(s => s.name === 'Y')!;

      expect(seriesX.data).toEqual([100, 0]);
      expect(seriesY.data).toEqual([0, 200]);
    });

    it('should handle empty rows', () => {
      const result = processDynamicSeriesData([], 'category', 'series', 'value');

      expect(result.categories).toEqual([]);
      expect(result.seriesData).toEqual([]);
    });

    it('should skip rows with empty category', () => {
      const rows: QueryRow[] = [
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', ''),
          createCell('series', 'X'),
          createCell('value', 100)
        ]),
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', 'A'),
          createCell('series', 'X'),
          createCell('value', 200)
        ])
      ];

      const result = processDynamicSeriesData(rows, 'category', 'series', 'value');

      expect(result.categories).toEqual(['A']);
    });

    it('should skip rows with empty series group', () => {
      const rows: QueryRow[] = [
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', 'A'),
          createCell('series', ''),
          createCell('value', 100)
        ]),
        createRow('RtGroupingAggregationQueryRow', [
          createCell('category', 'A'),
          createCell('series', 'X'),
          createCell('value', 200)
        ])
      ];

      const result = processDynamicSeriesData(rows, 'category', 'series', 'value');

      expect(result.seriesData.length).toBe(1);
      expect(result.seriesData[0].name).toBe('X');
    });

    it('should handle field names with dots', () => {
      const rows: QueryRow[] = [
        createRow('RtGroupingAggregationQueryRow', [
          createCell('entity.category', 'A'),
          createCell('entity.series', 'X'),
          createCell('entity.value', 100)
        ])
      ];

      const result = processDynamicSeriesData(rows, 'entity.category', 'entity.series', 'entity.value');

      expect(result.categories).toEqual(['A']);
      expect(result.seriesData[0].name).toBe('X');
      expect(result.seriesData[0].data).toEqual([100]);
    });
  });

  describe('processPieChartData', () => {
    const createStatusRows = (): QueryRow[] => [
      createRow('RtAggregationQueryRow', [
        createCell('status', 'Active'),
        createCell('count', 150)
      ]),
      createRow('RtAggregationQueryRow', [
        createCell('status', 'Inactive'),
        createCell('count', 50)
      ]),
      createRow('RtAggregationQueryRow', [
        createCell('status', 'Pending'),
        createCell('count', 25)
      ])
    ];

    it('should extract category and value pairs', () => {
      const rows = createStatusRows();
      const result = processPieChartData(rows, 'status', 'count');

      expect(result.length).toBe(3);
      expect(result).toEqual([
        { category: 'Active', value: 150 },
        { category: 'Inactive', value: 50 },
        { category: 'Pending', value: 25 }
      ]);
    });

    it('should handle empty rows', () => {
      const result = processPieChartData([], 'status', 'count');
      expect(result).toEqual([]);
    });

    it('should skip rows with empty category', () => {
      const rows: QueryRow[] = [
        createRow('RtAggregationQueryRow', [
          createCell('status', ''),
          createCell('count', 100)
        ]),
        createRow('RtAggregationQueryRow', [
          createCell('status', 'Active'),
          createCell('count', 150)
        ])
      ];

      const result = processPieChartData(rows, 'status', 'count');

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('Active');
    });

    it('should return 0 for missing value', () => {
      const rows: QueryRow[] = [
        createRow('RtAggregationQueryRow', [
          createCell('status', 'Active')
          // count missing
        ])
      ];

      const result = processPieChartData(rows, 'status', 'count');

      expect(result[0].value).toBe(0);
    });

    it('should handle numeric category values', () => {
      const rows: QueryRow[] = [
        createRow('RtAggregationQueryRow', [
          createCell('year', 2024),
          createCell('count', 100)
        ])
      ];

      const result = processPieChartData(rows, 'year', 'count');

      expect(result[0].category).toBe('2024');
    });

    it('should handle field names with dots', () => {
      const rows: QueryRow[] = [
        createRow('RtAggregationQueryRow', [
          createCell('entity.status', 'Active'),
          createCell('entity.count', 100)
        ])
      ];

      const result = processPieChartData(rows, 'entity.status', 'entity.count');

      expect(result[0].category).toBe('Active');
      expect(result[0].value).toBe(100);
    });

    it('should skip unsupported row types', () => {
      const rows: QueryRow[] = [
        createRow('UnsupportedType', [
          createCell('status', 'Invalid'),
          createCell('count', 999)
        ]),
        createRow('RtAggregationQueryRow', [
          createCell('status', 'Valid'),
          createCell('count', 100)
        ])
      ];

      const result = processPieChartData(rows, 'status', 'count');

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('Valid');
    });
  });

  describe('SUPPORTED_ROW_TYPES constant', () => {
    it('should include all expected row types', () => {
      expect(SUPPORTED_ROW_TYPES).toContain('RtSimpleQueryRow');
      expect(SUPPORTED_ROW_TYPES).toContain('RtAggregationQueryRow');
      expect(SUPPORTED_ROW_TYPES).toContain('RtGroupingAggregationQueryRow');
    });

    it('should have exactly 3 supported types', () => {
      expect(SUPPORTED_ROW_TYPES.length).toBe(3);
    });
  });
});
