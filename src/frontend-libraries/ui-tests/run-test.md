# How to Run UI Tests with Claude

## Quick Start

To run a test suite, tell Claude:

```
Run the UI tests from ui-tests/symbol-editor/primitives.test.json
```

## Manual Test Execution Example

Here's how Claude executes each test step using MCP tools:

### 1. Navigate to URL
```
mcp__chrome-devtools__navigate_page(url: "https://localhost:4201/meshtesting/symbol-library")
```

### 2. Wait for page load
```
mcp__chrome-devtools__wait_for(text: "Symbol Libraries", timeout: 5000)
```

### 3. Take snapshot to find elements
```
mcp__chrome-devtools__take_snapshot()
```

### 4. Click element by UID
```
mcp__chrome-devtools__click(uid: "187_17")
```

### 5. Type into input
```
mcp__chrome-devtools__fill(uid: "188_18", value: "Test Symbol")
```

### 6. Drag element
```
mcp__chrome-devtools__drag(from_uid: "...", to_uid: "...")
```

### 7. Take screenshot for verification
```
mcp__chrome-devtools__take_screenshot()
```

### 8. Evaluate JavaScript
```
mcp__chrome-devtools__evaluate_script(function: "() => document.querySelectorAll('.primitive').length")
```

### 9. Check console for errors
```
mcp__chrome-devtools__list_console_messages(types: ["error"])
```

## Test Assertions

Claude verifies assertions by:

1. **exists**: Use `take_snapshot()` and check if element with selector/testId is present
2. **notExists**: Use `take_snapshot()` and verify element is NOT present
3. **count**: Use `evaluate_script()` to count elements
4. **text**: Use `evaluate_script()` to get element text content
5. **noConsoleErrors**: Use `list_console_messages(types: ["error"])` and verify empty

## Finding Elements

### By data-testid (preferred)
```javascript
document.querySelector('[data-testid="palette-element-rectangle"]')
```

### By text content
Use `take_snapshot()` and find element with matching StaticText

### By CSS selector
```javascript
document.querySelector('.palette-element')
```

## Example Test Run Output

```
=== Test Suite: Primitive Creation Tests ===

[TC001] Verify element palette is visible
  ✓ Navigate to symbol editor
  ✓ Element palette exists
  ✓ Rectangle tool available
  ✓ Ellipse tool available
  ✓ Line tool available
  ✓ Text tool available
  PASSED

[TC002] Create Rectangle by drag and drop
  ✓ Navigate to new symbol
  ✓ Get canvas position
  ✓ Drag rectangle to canvas
  ✓ Rectangle primitive created
  PASSED

Total: 2 passed, 0 failed
```

## Prerequisites

1. Dev server running: `npm start` (https://localhost:4201)
2. Backend running with test data
3. Chrome browser with DevTools MCP server connected
4. Valid tenant (e.g., "meshtesting")

## Troubleshooting

### Backend 500 errors
If you see "Http failure response...500", the backend GraphQL endpoint isn't working.
Check that the tenant exists and has the required CK types.

### Element not found
Use `take_snapshot()` to see current page state and find correct UIDs.

### Drag not working
Some drag operations require specific coordinates. Use `evaluate_script` to get
element positions and calculate target coordinates.
