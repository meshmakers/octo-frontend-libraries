# KPI Widget: Formula Values and Output Variables (Implementation Plan)

> Work item: AB#5364 (parent epic AB#3444 "Data Refinery Studio - enhance usablity")
> Status: implemented (AB#5366 comparison-text fix, AB#5367 formula mode and output variables). See *Implementation Notes* for deviations from the plan below.

## Context

MeshBoard variables are plain text substitution today (`${name}` / `$name`). A KPI widget in "Static" mode can display a value such as `${variable1}`, but it cannot calculate. For example, `(${a} - ${b}) / 1000` resolves to the string `"5 - 3 / 1000"`, and `parseFloat` then displays `5`. No widget can publish a value as a variable either.

Goals:

1. **Formula:** a KPI widget computes its value from a formula over MeshBoard variables.
2. **Output variable:** any KPI widget (query, entity, static or formula) can publish its displayed raw value as a variable. This lets KPIs be chained. Example: query KPI A publishes `consumption`, and formula KPI B shows `${consumption} / 1000`.

Decisions taken:

- Formulas are evaluated in the **frontend with expr-eval**.
- Published variables reach **reactive consumers** immediately: the KPI formula, the KPI comparison text and markdown. Query filters of other widgets see the new value on the next refresh.
- The KPI config dialog gets a **separate "Formula" mode**.

## Findings

**Variables (frontend).** All paths below are relative to `projects/meshmakers/octo-meshboard/src/lib/`.

- Model: `models/meshboard.models.ts` (`MeshBoardVariable`, `MeshBoardVariableSource`)
  - `MeshBoardVariableSource = 'static' | 'timeFilter' | 'entitySelector'`.
  - `'expression'` exists only as a "Future" comment.
- Resolution: `services/meshboard-variable.service.ts` (`resolveVariables`, `hasUnresolvedVariables`) does regex text substitution and no maths.
- State: `services/meshboard-state.service.ts` (`getVariables`, `setVariableValue`, …)
  - Variables live inside the `_meshBoardConfig` signal.
  - `setVariableValue` replaces the whole config.
- There are no computed variables, no widget outputs, and no dependency or cycle detection.
- Persistence
  - Variables are stored as a JSON blob in `System/Description` by `meshboard-persistence.service.ts`. Only `static` variables are persisted.
  - A widget's config is a JSON string in `DashboardWidget.Config`.
- KPI widget
  - `widgets/kpi-widget/kpi-widget.component.ts`: the static branch of `loadData()` resolves the value only once per load; `formatDisplayValue` formats it.
  - Dialog: `widgets/kpi-widget/kpi-config-dialog.component.ts`.
  - Persistence mapping: `registrations/default-widget-registrations.ts`, KPI registration (`toPersistedConfig` / `fromPersistedConfig`).

**Formula engines**

- **Backend:** `IFormulaEngine`, based on mXparser, in `octo-construction-kit-engine/src/Runtime.Engine.Formulas/FormulaEngine.cs`. It offers `CheckSyntax`, `Validate` and `Evaluate` with arbitrary named arguments.
  - No endpoint accepts arbitrary variables. `POST …/communication/validate-expression` binds only `value`.
  - The engine does not know the `${}` syntax.
  - **Not needed for this feature.**
- **Frontend:** `ExpressionEvaluatorService` (based on expr-eval-fork) in `octo-process-diagrams/src/lib/services/expression-evaluator.service.ts`.
  - API: `validate()`, `evaluate(expr, ctx)`, `getVariables(expr)`.
  - `octo-meshboard` already declares `@meshmakers/octo-process-diagrams` as a peer dependency, and `process-widget.component.ts` already uses the service. **No new dependency is needed.**

## Prerequisites and Blockers

- **No blocking prerequisites.**
  - No backend or CK model change is required.
  - New widget fields go into the existing `Config` JSON.
  - Published variables are runtime values and are not persisted.
- **Nothing makes the feature obsolete.**
  - The planned variable source `'expression'` would be a board-level computed variable and partly overlaps with the formula mode.
  - Mitigation: the formula logic lives in a standalone util, which a future `'expression'` variable can reuse.
- **Existing bug, fixed as part of this work:** the KPI `toPersistedConfig` does not write `comparisonText`, although all three `fromPersistedConfig` branches read it. The comparison text is therefore lost on save. The new fields would be lost the same way if they were not added there.
- **Limitations to document:**
  - Variable values are strings; numbers must use a dot as the decimal separator.
  - Query filters of other widgets see widget variables only on the next refresh.
  - The syntax is expr-eval's: `+ - * / ^ %`, `min`, `max`, `abs`, `round`, `?:`, plus the process-diagram custom functions (`clamp`, `lerp`, …).

## Implementation

### 1. Formula util (new): `utils/meshboard-formula.ts`

Pure functions on top of the `ExpressionEvaluatorService` or its parser:

- `rewriteFormula(formula)`
  - Replaces `${name}` and `$name` with safe identifiers `__v_<name>`, so variables named `max` or `E` do not clash with expr-eval built-ins.
  - Returns `{ expression, referencedNames[] }`.
- `validateFormula(formula, availableNames)`
  - Checks the syntax with `validate()`.
  - Reports unknown variables by comparing `getVariables()` with `availableNames`.
  - Returns `{ valid, error?, unknownVariables[] }`.
- `evaluateFormula(formula, variables: MeshBoardVariable[])`
  - Builds the evaluation context: numeric strings become `number`, `'true'` / `'false'` become `boolean`, everything else stays `string`.
  - Returns `{ status: 'pending' }` when a referenced variable is missing or empty, so the widget shows `-` instead of an error.
  - Otherwise returns `{ status: 'ok', value }` or `{ status: 'error', error }`.
- `findVariableCycles(widgets: AnyWidgetConfig[])`
  - Builds a graph from the KPI widgets: `outputVariableName` → the variables referenced by the formula.
  - Returns the IDs of the widgets that are part of a cycle, including self-references.

### 2. Model: `models/meshboard.models.ts`

- Add `'widget'` to `MeshBoardVariableSource`, and add `widgetId?: string` to `MeshBoardVariable`.
- Add to `KpiWidgetConfig`:
  - `valueMode?: 'value' | 'formula'`. With `formula`, the data source stays `{ type: 'static' }`. This avoids a new `DataSource` type, so the switches in the other widgets and in persistence stay untouched.
  - `formula?: string`
  - `outputVariableName?: string`

### 3. State: `services/meshboard-state.service.ts`

- Add a transient signal `_widgetVariables = signal<MeshBoardVariable[]>([])`, separate from `_meshBoardConfig`. Publishing then triggers no persistence, no dirty state and no config recomputation.
- `getVariables()` returns the config variables plus the widget variables; a config variable wins on a name clash.
  - Because `getVariables()` reads both signals, existing `computed()`s react automatically, e.g. the KPI `comparisonText` and the markdown `resolvedContent`.
- `setWidgetVariable(widgetId, name, value)`
  - Writes only when the value changes, which prevents loops.
  - Replaces an older name published by the same widget.
- `clearWidgetVariable(widgetId)`.
- `_widgetVariables` is cleared when the board is switched or loaded (`switchToMeshBoard` / load).

### 4. KPI widget: `widgets/kpi-widget/kpi-widget.component.ts` + `.html`

- Add `rawValue = computed<unknown>`, the unformatted numeric value. `value` then formats `rawValue()` with the existing `formatDisplayValue`.
- Formula mode
  - `rawValue` evaluates `evaluateFormula(config.formula, stateService.getVariables())` directly, not through `loadData()`, so the value is live and reactive.
  - `loadData()` does nothing in formula mode.
  - On `status: 'error'`, or when `findVariableCycles` puts the widget in a cycle, `_error` shows the reason.
- Publishing
  - An `effect()` calls `stateService.setWidgetVariable(config.id, config.outputVariableName, String(rawValue()))` once `outputVariableName` is set and a value is available.
  - For query KPIs the published value is the one after `applyValueMultiplier`, not the formatted display string.
  - `ngOnDestroy`, and a name change in `ngOnChanges`, call `clearWidgetVariable`.

### 5. Config dialog: `widgets/kpi-widget/kpi-config-dialog.component.ts` + `.html`

- Add a fourth button **"Formula"** to the data-source toggle (extend `KpiDataSourceType` with `'formula'`).
- Formula text field with:
  - a syntax hint,
  - a list of available variables from `getVariables()`, including the outputs of other KPI widgets,
  - live validation with `validateFormula` and a preview of the current result with `evaluateFormula`.
- New optional field **"Output variable"** for all modes.
  - Validated with `isValidVariableName`. The name must not clash with a config variable or with another widget's output.
  - The cycle check (`findVariableCycles` over the pending config) blocks saving.
- Extend `KpiConfigResult` with `valueMode`, `formula` and `outputVariableName`.

### 6. Persistence: `registrations/default-widget-registrations.ts` (KPI registration)

- `toPersistedConfig` / `fromPersistedConfig` write and read `valueMode`, `formula` and `outputVariableName`.
- **Fix:** `toPersistedConfig` writes `comparisonText` as well.
- `meshboard-persistence.service.ts` stays unchanged. Widget variables are never part of `config.variables`, so they are never written into the description blob.

### 7. Documentation

Update `octo-meshboard/CLAUDE.md`:

- "Variable System" section: the `widget` source, output variables, formula syntax and refresh behaviour.
- "Built-in Widgets" table: add the KPI formula mode.
- State service method table: add the new methods.

## Tests and Verification

- **Unit tests (Vitest)**
  - `utils/meshboard-formula.spec.ts`
    - Rewriting `${x}` and `$x`; a clash with built-ins (variable `max`).
    - Unknown variables, `pending` for empty values, division by zero, syntax errors.
    - Cycles: A↔B and a self-reference.
  - `meshboard-state.service.spec.ts`
    - `getVariables()` merge, config variable precedence, no write when the value is unchanged.
    - Clearing on board switch; widget variables are not persisted.
  - `kpi-widget.component.spec.ts`
    - The formula value reacts to variable changes.
    - Publish, and clear on destroy.
    - The multiplier is applied before publishing.
  - Registry spec: round trip `toPersistedConfig` → `fromPersistedConfig` with `formula`, `outputVariableName` and `comparisonText` (regression test for the bug).
- **Commands**, run in `octo-frontend-libraries/src/frontend-libraries`:
  ```bash
  npm run lint:octo-meshboard && npm run test:octo-meshboard && npm run build:octo-meshboard
  ```
- **Manual test (demo-app or Refinery Studio)**
  1. Create static variables `a=5000` and `b=2000`.
  2. KPI in formula mode with `(${a} - ${b}) / 1000` → shows `3`.
  3. Create a query KPI with output variable `consumption`.
  4. Formula KPI `${consumption} * 2` → follows the query value after every refresh or time-filter change.
  5. Markdown with `${consumption}` updates live.
  6. Create a cycle A→B→A → the dialog refuses to save.
  7. Save and reload → the formula, the output variable name and the comparison text are kept.

## Implementation Notes

Deviations and findings discovered while implementing:

- **`comparisonText` was lost twice.** Besides `toPersistedConfig`, `applyConfigResult` dropped it in all three branches, so the dialog value was already gone before saving. Both are fixed (AB#5366).
- **Write paths use the config variables only.** `setVariableValue`, `addVariable`, `removeVariable` and the time-filter / entity-selector helpers used `getVariables()` to build the new variable list. With the merged `getVariables()` they would have written widget variables into the config. They now build on a private `configVariables()`.
- **Config signal in the KPI widget.** `config` is a plain `@Input()`, so computeds did not track config changes. The widget mirrors it into a private `_config` signal (set in `ngOnInit` / `ngOnChanges`).
- **Evaluator as parameter.** `octo-meshboard` has no direct dependency on `expr-eval-fork`, so the util functions take the root-provided `ExpressionEvaluatorService` as a parameter instead of building their own parser.
- **Dialog result.** The dialog returns `dataSourceType: 'formula'` instead of a separate `valueMode`; `applyConfigResult` maps it to `{ type: 'static' }` + `valueMode: 'formula'`. The dialog gets the widget id (`initialWidgetId`) for the cycle check and to exclude the widget's own output.
- **Runtime cycle guard.** A widget that is part of a cycle is not evaluated and publishes nothing, otherwise the widgets of the cycle would publish ever-changing values to each other.
- **Pending values clear the output.** While a formula is pending or a query has not loaded, the widget removes its published variable, so dependent formulas show `-` too.
