# Value labels editor (`mm-value-labels-editor`)

Edits the names a chart shows instead of raw values (OBIS codes, material numbers, ...) in the config
dialogs of the pie, bar and line chart (AB#7235). One row per raw value: the value exactly as the data
delivers it, and the name to display. The widget side is described in the meshboard README ("Chart value
labels").

```html
<mm-value-labels-editor [(rows)]="categoryLabelRows" subject="category"></mm-value-labels-editor>
```

| Input | Type | Description |
|---|---|---|
| `rows` | `model<ValueLabelRow[]>` | The rows, two-way. The editor replaces the array on every change; rows carry a stable `id`. |
| `subject` | `string` | What the values are in the texts, `category` (default) or `series`. |

The dialog builds its rows with `toValueLabelRows(config.categoryLabels)` and turns them back on Save with
`fromValueLabelRows(rows)` (`utils/chart-value-labels.ts`): only rows with a value and a name count, so an
unfinished row never replaces the name of a complete row with the same value.

Behaviour: an empty list shows a hint; a value that two complete rows list shows a warning (`--kendo-color-warning`,
the last row wins); adding focuses the new row, removing focuses the next row (or the add button). The
textboxes carry their accessible names on the inner input (`inputAttributes`); below 420 px of editor width a row
stacks value above name. Kendo theme variables only.
