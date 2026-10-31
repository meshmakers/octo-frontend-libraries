# Formula field (`mm-meshboard-formula-field`)

Shared formula input of the MeshBoard widget config dialogs (KPI and gauge since AB#7950; the chart
formula series of AB#7952/AB#7953 reuse it). It renders:

- the formula input (label linked to the input, described by the hint and the message),
- the syntax hint (operators, functions, `${variableName}`; with `clampHint` the clamp pattern
  `max(0, min(100, …))`),
- the validation message (`role="alert"`) or the live preview,
- the list of variables as buttons that append a `${name}` reference.

## Inputs

| Input | Type | Description |
|---|---|---|
| `formula` | `model<string>` | The formula text, two-way: `[(formula)]` |
| `variables` | `MeshBoardVariable[]` | Operands with their current values (preview, insert buttons) |
| `declaredNames` | `string[]` | Names that are valid without a value yet (declared outputs, selector variables) |
| `numericOnly` | `boolean` | The widget needs a number: a string/boolean preview shows *Result is not a number* |
| `clampHint` | `boolean` | Show the clamp pattern in the hint (widgets with a scale) |
| `label` / `placeholder` | `string` | Defaults `Formula` / `e.g., (${a} - ${b}) / 1000` |

## Validation

The field shows `validateFormulaField(formula, variables, declaredNames, evaluator)` from
`utils/meshboard-formula.ts`. A dialog that hosts the field calls the same function with the same
inputs to enable Save — never a second implementation.

```html
<mm-meshboard-formula-field
  [(formula)]="form.formula"
  [variables]="formulaVariables"
  [declaredNames]="declaredVariableNames"
  [numericOnly]="true"
  [clampHint]="true">
</mm-meshboard-formula-field>
```

Colours come only from Kendo CSS variables (`--kendo-color-error`, `--kendo-color-subtle`,
`--kendo-color-on-app-surface`).
