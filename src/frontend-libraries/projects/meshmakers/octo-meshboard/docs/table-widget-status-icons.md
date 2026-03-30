# Table Widget: Status Icons Column Support

## Current State

The Table Widget supports `statusIcons` columns via the `TableColumn` configuration in YAML/JSON. This allows mapping enum/status values to colored SVG icons instead of displaying raw text.

### Configuration Example

```json
{
  "columns": [
    {
      "field": "machineState",
      "title": "Status",
      "dataType": "statusIcons",
      "statusMapping": {
        "On": { "icon": "check-circle", "tooltip": "Aktiv", "color": "#10b981" },
        "Off": { "icon": "x-circle", "tooltip": "Aus", "color": "#ef4444" },
        "Unknown": { "icon": "question-circle", "tooltip": "Unbekannt", "color": "#6b7280" }
      }
    }
  ]
}
```

### Available Icons

Defined in `table-widget.component.ts` via `ICON_MAP`:

| Key | Kendo Icon | Typical Use |
|-----|-----------|-------------|
| `check-circle` | checkCircleIcon | Active, OK, Success |
| `x-circle` | xCircleIcon | Inactive, Off, Failed |
| `exclamation-circle` | exclamationCircleIcon | Error, Critical |
| `warning-triangle` | warningTriangleIcon | Warning |
| `minus-circle` | minusCircleIcon | Idle, Paused |
| `question-circle` | questionCircleIcon | Unknown (also used as fallback) |
| `circle` | circleIcon | Neutral |

### Implementation

- `meshboard.models.ts`: `TableColumn` interface with optional `dataType` and `statusMapping`
- `table-widget.component.ts`: `resolveStatusMapping()` converts string icon names to Kendo `SVGIcon` objects
- Uses the existing `statusIcons` dataType support in `ListViewComponent` (shared-ui)

## TODO: Config Dialog Support

**The Table Widget Config Dialog does not yet support configuring statusIcons columns via the UI.**

Currently, `dataType` and `statusMapping` can only be set through YAML/JSON import. The config dialog needs the following enhancements:

### Required Changes

1. **Column Detail Editor** — After selecting columns via the attribute selector, add a detail view per column where users can:
   - Set `dataType` (dropdown: Text, StatusIcons, Numeric, Date, Boolean)
   - Set column `width` (optional number input)

2. **StatusMapping Editor** — When `dataType = statusIcons` is selected, show:
   - A list of value-to-icon mappings (key/value pairs)
   - Per entry: value input (string), icon picker (dropdown with available icons), color picker, tooltip input
   - Add/remove mapping entries
   - Option to auto-detect possible values from the CK enum definition

3. **Icon Picker Component** — A reusable dropdown showing available icons with preview:
   - Show icon + name for each entry in `ICON_MAP`
   - Consider making `ICON_MAP` extensible (allow adding more icons without code changes)

### Files to Modify

- `widgets/table-widget/table-config-dialog.component.ts` — Add column detail editing UI
- `widgets/table-widget/table-config-dialog.component.html` — Template for new editors
- `models/meshboard.models.ts` — No changes needed (interfaces already support it)
- `services/widget-registry.service.ts` — Ensure `toPersistedConfig`/`fromPersistedConfig` preserve `dataType` and `statusMapping`

### Considerations

- The existing `AttributeSelectorDialogService` returns simple field selections. The column detail editor should work as a secondary step after attribute selection.
- Enum values could be pre-populated from the CK model (via `getCkTypeAttributes` GraphQL query) to make statusMapping configuration easier.
- The `ICON_MAP` in `table-widget.component.ts` could be extracted to a shared utility if other widgets need icon resolution from string names.
