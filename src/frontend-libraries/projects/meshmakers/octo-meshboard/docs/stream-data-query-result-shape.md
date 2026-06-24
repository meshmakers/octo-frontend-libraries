# Stream-Data & Runtime Query Result Shapes

Reference for widget authors and reviewers: how raw GraphQL `streamData.streamDataQuery` / `runtime.runtimeQuery` responses map into the unified `QueryExecutionResult` that all widgets consume via `QueryExecutorService.execute()`.

Last verified against backend `octo-asset-repo-services` and `octo-construction-kit-engine-mongodb` on 2026-06-24.

## TL;DR

```
QueryExecutorService.execute(family, queryRtId, opts) → Observable<QueryExecutionResult>

QueryExecutionResult {
  family: 'runtime' | 'streamData',
  queryRtId, associatedCkTypeId,
  columns: QueryColumnInfo[],   // attributePath + attributeValueType + aggregationType
  rows:    QueryResultRow[],    // FLATTENED cells (no .items wrapper)
  totalCount, hasNextPage, endCursor
}

QueryResultRow {
  __typename,
  rtId, ckTypeId,
  timestamp, rtWellKnownName,        // stream-data only
  rtCreationDateTime, rtChangedDateTime,
  cells: QueryCell[]                  // flat array — NOT a Relay connection
}

QueryCell { attributePath, value }
```

Widgets should never speak raw GraphQL types. Iterate `result.rows[i].cells[j]` directly; the executor unwraps the Relay `cells.items` connection for you.

## Two families, four kinds

| Family       | Kinds                                                  | Persisted CK subtypes                                                                                                  | GraphQL path                              |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `runtime`    | `simple`, `aggregation`, `groupingAggregation`         | `RtSimpleRtQuery`, `RtAggregationRtQuery`, `RtGroupingAggregationRtQuery`                                              | `runtime.runtimeQuery(rtId)`              |
| `streamData` | `simple`, `aggregation`, `groupingAggregation`, `downsampling` | `RtSimpleSdQuery`, `RtAggregationSdQuery`, `RtGroupingAggregationSdQuery`, `RtDownsamplingSdQuery`             | `streamData.streamDataQuery(rtId)`        |

`QueryFamily` is classified from the persisted query entity's CK subtype via `utils/query-family.ts:classifyQuery()`. Ordering matters: `GroupingAggregation*` contains `Aggregation*` as a substring, so the grouping rule has to come first.

## Backend row types

### Runtime queries (3 distinct `__typename`)

| `__typename`                       | Has `rtId` | Cell semantics                                                                  |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `RtSimpleQueryRow`                 | yes        | One cell per selected attribute on the entity                                   |
| `RtAggregationQueryRow`            | no         | One cell per aggregation column (count / sum / avg / min / max)                 |
| `RtGroupingAggregationQueryRow`    | no         | Group-key cells + aggregation cells; one row per group                          |

Defined in `octo-asset-repo-services/src/AssetRepositoryServices/GraphQL/Types/RtQueryRowDtoType.cs`.

### Stream-data queries (1 uniform `__typename`)

All four SD kinds share `StreamDataQueryRow`. The variant distinction lives at the *query* level (which `RtXxxSdQuery` subtype) — rows themselves are uniform and carry these row-level fields:

| Field                  | Type           | Notes                                                                              |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `rtId`                 | `OctoObjectId` | Set for `Simple`; may be empty for aggregated kinds                                |
| `ckTypeId`             | `RtCkId<CkTypeId>` | Target CK type of the row                                                      |
| `timestamp`            | `DateTime?`    | Bucket/sample/window timestamp depending on kind                                   |
| `rtWellKnownName`      | `string?`      | Optional human-readable label                                                      |
| `rtCreationDateTime`   | `DateTime?`    | For `Simple` rows that mirror an existing rt entity                                |
| `rtChangedDateTime`    | `DateTime?`    | "                                                                                  |
| `cells`                | connection     | Built from the engine's `Values` dictionary; one cell per selected column          |

Defined in `octo-asset-repo-services/src/AssetRepositoryServices/GraphQL/Types/StreamDataQueryRowDtoType.cs`.

## Columns and attribute types

```graphql
columns {
  attributePath        # camelCase field name on the wire
  attributeValueType   # AttributeValueTypesDto: String, Int32, Int64, Double, DateTime, Boolean, ...
  aggregationType      # null for raw columns; Count/Sum/Avg/Min/Max/First/Last for aggregations
}
```

`attributeValueType` is **per family/kind specific**:

| Query kind                   | `attributeValueType` source                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Runtime simple               | The selected attribute's declared CK type                                                 |
| Runtime aggregation          | `GetAggregationResultType(attrType, aggType)` — e.g. `Avg(Int32) → Double`               |
| Runtime grouping aggregation | Group-key cells use the attribute's CK type; aggregation cells use the aggregation rule  |
| SD simple                    | The column's declared CK type, looked up via `CkCacheService.GetCkTypeQueryColumnPathsByRtCkId` |
| SD aggregation               | Same lookup, then `GetAggregationResultType()`                                            |
| SD grouping aggregation      | "                                                                                         |
| SD downsampling              | "                                                                                         |

The hardcoded `attributeValueType: "STRING"` bug that broke the meshboard Y-axis picker was specifically the SD path missing the CK-cache lookup (fixed by `b68fb26` / `6c23024`).

## How `QueryExecutorService` flattens it

The raw GraphQL response is nested:

```jsonc
{
  "runtime": {              // or "streamData"
    "runtimeQuery": {
      "items": [{
        "queryRtId": "...",
        "associatedCkTypeId": "...",
        "columns": [...],
        "rows": {
          "totalCount": 8,
          "pageInfo": { "hasNextPage": false, "endCursor": "..." },
          "items": [{
            "__typename": "RtSimpleQueryRow",
            "rtId": "...",
            "ckTypeId": "...",
            "cells": {
              "totalCount": 4,
              "items": [
                { "attributePath": "name", "value": "..." },
                { "attributePath": "value", "value": 42.5 }
              ]
            }
          }]
        }
      }]
    }
  }
}
```

`QueryExecutorService.mapRuntimeRows()` / `mapStreamDataRows()` flatten this to:

```ts
result.rows = [
  {
    __typename: 'RtSimpleQueryRow',
    rtId: '...',
    ckTypeId: '...',
    cells: [
      { attributePath: 'name', value: '...' },
      { attributePath: 'value', value: 42.5 }
    ]
  }
]
```

For SD rows the executor additionally lifts `timestamp`, `rtWellKnownName`, `rtCreationDateTime`, and `rtChangedDateTime` onto the row. Widgets that draw time series (`LineChart`, `BarChart` time axis) read `row.timestamp` directly without digging into `cells`.

## Widget consumption patterns

### Time-series x-axis (SD)

```ts
const points = result.rows.map(row => ({
  x: row.timestamp,          // already a Date | null
  y: parseNumericValue(
        row.cells.find(c => c.attributePath === 'amount_value')?.value
     )
}));
```

### Aggregated KPI (RT or SD)

```ts
// Aggregation queries return exactly one row.
const firstRow = result.rows[0];
const cell = firstRow?.cells.find(c => c.attributePath === valueField);
const value = parseNumericValue(cell?.value);
```

### Grouped aggregation (Pie / Bar by category)

```ts
const series = result.rows.map(row => {
  const cat = row.cells.find(c => c.attributePath === categoryField)?.value;
  const val = parseNumericValue(
    row.cells.find(c => c.attributePath === valueField)?.value
  );
  return { category: String(cat), value: val };
});
```

### Picker — value-field choices

The Y-axis / value-field picker in widget config dialogs filters `result.columns` by `attributeValueType ∈ { Double, Int32, Int64, Single, Decimal }`. This is why the broken-types backend bug made every Y-axis picker empty for SD queries: every column reported `STRING` and was filtered out.

## Time-range override (SD only)

`opts.streamDataArgs?: StreamDataExecutionArgs` becomes the GraphQL `arg` input. The executor builds it via `buildStreamDataArg()`:

| Caller field   | Backend behavior                                                                  |
| -------------- | --------------------------------------------------------------------------------- |
| `from` / `to`  | Override `simple.From/To`, `aggregation.From/To`, etc. via `?? from-persisted`    |
| `limit`        | Override `simple.Limit` / `downsampling.Limit`                                    |
| `interval`     | **Ignored** by every backend variant today; downsampling derives `(to-from)/limit` itself |
| `queryMode`    | **Ignored on dispatch** — the variant comes from the persisted CK subtype. Schema-NonNull, so we still send `Default`. See AB#4235 |

When the caller passes no `streamDataArgs`, `buildStreamDataArg` returns `undefined` and the request omits `arg` entirely; the persisted query then runs with its intrinsic windowing.

Runtime queries ignore `streamDataArgs` even when set — `executeRuntime()` doesn't pass it to the GraphQL variables.

### MeshBoard time-filter auto-binding

Stream-data widgets do **not** construct `streamDataArgs` by hand. Each calls
`MeshBoardStateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter)`, which maps
the active MeshBoard time filter to `{ from, to }` (or `undefined` when no filter
is active). This means a SD widget narrows to the dashboard's selected range
without a `fieldFilter` on `timestamp`.

Per-widget opt-out: when the widget's `PersistentQueryDataSource.ignoreTimeFilter`
is `true` (set via the dialog's "Ignore MeshBoard time filter" toggle), the helper
returns `undefined` and the saved query's intrinsic range wins. See AB#4236.

## Transient queries (ad-hoc, not persisted)

`streamData.transientStreamDataQuery.{simple,aggregation,groupingAggregation,downsampling}` exposes the four kinds without requiring a saved entity. The widget layer doesn't use these today — they're for tooling like the MCP `query_stream_data_*` tools. The row shape is identical to persistent SD rows (`StreamDataQueryRow`).

## Cheat sheet: which fields exist on which row

| Field                | RT Simple | RT Aggregation | RT Grouping | SD Simple | SD Aggregation | SD Grouping | SD Downsampling |
| -------------------- | :-------: | :------------: | :---------: | :-------: | :------------: | :---------: | :-------------: |
| `__typename`         | `RtSimpleQueryRow` | `RtAggregationQueryRow` | `RtGroupingAggregationQueryRow` | `StreamDataQueryRow` | `StreamDataQueryRow` | `StreamDataQueryRow` | `StreamDataQueryRow` |
| `rtId`               |     ✓     |        ·       |      ·      |     ✓     |        ·       |      ·      |        ·        |
| `ckTypeId`           |     ✓     |        ✓       |      ✓      |     ✓     |        ✓       |      ✓      |        ✓        |
| `timestamp`          |     ·     |        ·       |      ·      |     ✓     |        ✓       |      ✓      |        ✓        |
| `rtWellKnownName`    |     ·     |        ·       |      ·      |     ✓     |        ·       |      ·      |        ·        |
| `rtCreationDateTime` |     ·     |        ·       |      ·      |     ✓     |        ·       |      ·      |        ·        |
| `rtChangedDateTime`  |     ·     |        ·       |      ·      |     ✓     |        ·       |      ·      |        ·        |
| `cells[]`            |     ✓     |        ✓       |      ✓      |     ✓     |        ✓       |      ✓      |        ✓        |

`·` = field present in TypeScript interface but `null`/`undefined` in practice.

## Pitfalls

- **Don't read `cells.items[]` from `QueryResultRow`** — that's the raw GraphQL shape. After the executor maps it, cells is a flat `QueryCell[]`. The legacy `cells: { items?: ... }` shape only appears in the raw Apollo response.
- **Don't classify family by `queryCkTypeId`** — `queryCkTypeId` is the *target* CK type the query reads from (e.g. `Basic.Energy/EnergyMeasurement`). Classify by `ckTypeId` (the query entity's *own* CK type, e.g. `RtSimpleSdQuery`). See `PersistentQueryItem` JSDoc.
- **Don't send `queryMode: DOWNSAMPLING` on a `RtSimpleSdQuery` expecting it to switch behavior** — backend ignores `arg.queryMode`. To run a downsampled query you need a saved `RtDownsamplingSdQuery` (or AB#4233 once implemented).
- **For aggregated rows, `rtId` is `null`** — don't key widget rows by `rtId`. Use the row index or a synthetic key built from group cells.
- **`row.timestamp` is a `Date` after Apollo deserializes it** when `DateTimeGraphType` is in play. Treat as `Date | null`, not string.

## References

- Backend: `octo-asset-repo-services/src/AssetRepositoryServices/GraphQL/Types/StreamDataQueryRowDtoType.cs`, `RtQueryRowDtoType.cs`, `StreamDataQueryDtoType.cs`
- Frontend: `projects/meshmakers/octo-meshboard/src/lib/services/query-executor.service.ts`, `utils/query-family.ts`, `graphQL/executeStreamDataQuery.graphql`, `graphQL/executeRuntimeQuery.graphql`
- Related issues: AB#4187 (this integration), AB#4233 (downsampling on simple SD), AB#4235 (queryMode cleanup)
