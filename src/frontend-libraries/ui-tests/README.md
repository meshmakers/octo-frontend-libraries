# UI Tests for Symbol Editor (MCP Chrome DevTools)

This folder contains structured UI tests that can be executed by Claude using the Chrome DevTools MCP server.

## Overview

The tests are defined as JSON files that describe:
- **Navigation steps**: How to reach the component under test
- **Actions**: User interactions (click, drag, type, etc.)
- **Assertions**: Expected outcomes to verify

## Test File Format

```json
{
  "name": "Test Suite Name",
  "description": "What this test suite covers",
  "setup": {
    "url": "https://localhost:4201/...",
    "waitFor": "text or selector to wait for"
  },
  "tests": [
    {
      "name": "Test case name",
      "steps": [
        { "action": "click", "target": "uid or text selector" },
        { "action": "type", "target": "uid", "value": "text to type" },
        { "action": "drag", "from": "uid", "to": { "x": 100, "y": 200 } },
        { "action": "screenshot", "name": "step-result" },
        { "action": "assert", "type": "exists", "target": "selector" },
        { "action": "assert", "type": "count", "target": "selector", "expected": 3 }
      ]
    }
  ]
}
```

## Running Tests with Claude

To execute tests, ask Claude:

```
Run the UI tests from ui-tests/symbol-editor/primitives.test.json
```

Claude will:
1. Read the test file
2. Navigate to the test URL
3. Execute each step using MCP tools
4. Verify assertions
5. Report results with screenshots

## Available Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `navigate` | Navigate to URL | `url` |
| `click` | Click element | `target` (uid, text, or CSS selector) |
| `dblclick` | Double-click element | `target` |
| `type` | Type into input | `target`, `value` |
| `drag` | Drag element | `from`, `to` (uid or {x,y}) |
| `pressKey` | Press keyboard key | `key` (e.g., "Control+z") |
| `wait` | Wait for condition | `for` (text or time in ms) |
| `screenshot` | Take screenshot | `name` (optional) |
| `evaluate` | Run JavaScript | `script` |

## Assertion Types

| Type | Description | Parameters |
|------|-------------|------------|
| `exists` | Element exists | `target` |
| `notExists` | Element doesn't exist | `target` |
| `text` | Text content matches | `target`, `expected` |
| `count` | Element count matches | `target`, `expected` |
| `attribute` | Attribute value | `target`, `attribute`, `expected` |
| `noErrors` | No console errors | - |

## Test Data Selectors

Tests use these approaches to find elements:

1. **data-testid** attributes (preferred): `[data-testid="rectangle-tool"]`
2. **Text content**: `"Rectangle"` (finds by visible text)
3. **UID from snapshot**: `uid=123_45` (dynamic, from take_snapshot)
4. **CSS selectors**: `.palette-element`, `mm-process-designer`

## Folder Structure

```
ui-tests/
├── README.md                    # This file
├── symbol-editor/
│   ├── primitives.test.json    # Test primitive creation
│   ├── selection.test.json     # Test selection behavior
│   ├── transform.test.json     # Test move/resize/rotate
│   └── clipboard.test.json     # Test copy/paste/undo/redo
└── process-designer/
    └── basic.test.json         # Basic designer tests
```

## Adding data-testid Attributes

For reliable test selection, components should include `data-testid` attributes:

```html
<div class="palette-element"
     data-testid="palette-element-rectangle"
     draggable="true">
```

Then tests can target: `[data-testid="palette-element-rectangle"]`
