# Unsaved Changes Guard - Developer Documentation

## Overview

The Unsaved Changes system protects users from accidentally losing their changes. It consists of several components that work together:

| Component | Purpose |
|-----------|---------|
| `HasUnsavedChanges` | Interface for components with unsaved changes |
| `HAS_UNSAVED_CHANGES` | InjectionToken for dependency injection |
| `UnsavedChangesDirective` | Directive for browser events (back, refresh, close tab) |
| `UnsavedChangesGuard` | Route guard for in-app navigation |

## Protection Levels

### 1. Browser Navigation (beforeunload)
- Browser back/forward buttons
- Page reload (F5, refresh)
- Close tab/window
- **Shows:** Native browser warning ("Changes you made may not be saved")

### 2. In-App Navigation (Angular Router)
- Clicking links within the app
- Programmatic navigation (`router.navigate()`)
- **Shows:** Custom dialog with "Save / Discard / Cancel" options

---

## Implementation

### Option A: Using BaseFormComponent (automatic)

If your component uses `<mm-base-form>`, browser protection is **automatically active**:

```typescript
@Component({
  template: `
    <mm-base-form [form]="form" [config]="formConfig">
      <!-- Form fields -->
    </mm-base-form>
  `
})
export class MyEditorComponent {
  form = new FormGroup({...});
  formConfig: BaseFormConfig = { title: 'Editor' };
}
```

The `BaseFormComponent` automatically checks:
1. `config.hasChanges` (if explicitly set)
2. `form.dirty` (fallback)

**Optional:** For in-app navigation protection, add route guard (see Option C).

---

### Option B: Custom Component with Directive

For components without `<mm-base-form>`:

```typescript
import {
  HasUnsavedChanges,
  HAS_UNSAVED_CHANGES,
  UnsavedChangesDirective
} from '@meshmakers/shared-ui';

@Component({
  selector: 'my-custom-editor',
  standalone: true,
  hostDirectives: [UnsavedChangesDirective],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: MyCustomEditorComponent }],
  template: `...`
})
export class MyCustomEditorComponent implements HasUnsavedChanges {
  private isDirty = false;

  // REQUIRED: Check if unsaved changes exist
  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  // OPTIONAL: Enables "Save" option in dialog
  async saveChanges(): Promise<boolean> {
    try {
      await this.save();
      return true;
    } catch {
      return false;
    }
  }
}
```

---

### Option C: Full Protection with Route Guard

For complete protection (browser + in-app navigation):

#### 1. Component implements HasUnsavedChanges

```typescript
import {
  HasUnsavedChanges,
  HAS_UNSAVED_CHANGES,
  UnsavedChangesDirective
} from '@meshmakers/shared-ui';

@Component({
  selector: 'my-editor',
  standalone: true,
  hostDirectives: [UnsavedChangesDirective],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: MyEditorComponent }],
  template: `...`
})
export class MyEditorComponent implements HasUnsavedChanges {
  private form = new FormGroup({...});

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  async saveChanges(): Promise<boolean> {
    // Save logic
    await this.saveToServer();
    this.form.markAsPristine();
    return true;
  }
}
```

#### 2. Configure route with guard

```typescript
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';

export const routes: Routes = [
  {
    path: 'edit/:id',
    component: MyEditorComponent,
    canDeactivate: [UnsavedChangesGuard]
  }
];
```

---

## HasUnsavedChanges Interface

```typescript
export interface HasUnsavedChanges {
  /**
   * REQUIRED: Returns true if unsaved changes exist.
   */
  hasUnsavedChanges(): boolean;

  /**
   * OPTIONAL: Saves the changes.
   * If implemented, the guard will show a "Save" option.
   * @returns Promise<boolean> - true if save was successful
   */
  saveChanges?(): Promise<boolean>;
}
```

---

## Dialog Behavior

### With `saveChanges()` implemented:
```
┌─────────────────────────────────────────┐
│           Unsaved Changes               │
├─────────────────────────────────────────┤
│ You have unsaved changes.               │
│ Do you want to save before leaving?     │
│                                         │
│     [Yes]     [No]     [Cancel]         │
└─────────────────────────────────────────┘
```
- **Yes:** Calls `saveChanges()`, navigates on success
- **No:** Discards changes, navigates away
- **Cancel:** Stays on page

### Without `saveChanges()`:
```
┌─────────────────────────────────────────┐
│           Unsaved Changes               │
├─────────────────────────────────────────┤
│ You have unsaved changes.               │
│ Are you sure you want to leave?         │
│ Your changes will be lost.              │
│                                         │
│          [Yes]          [No]            │
└─────────────────────────────────────────┘
```
- **Yes:** Discards changes, navigates away
- **No:** Stays on page

---

## Examples

### Example 1: Simple Form

```typescript
@Component({
  selector: 'contact-form',
  standalone: true,
  imports: [ReactiveFormsModule, BaseFormComponent],
  template: `
    <mm-base-form [form]="form" [config]="config" (saveForm)="onSave()">
      <kendo-formfield>
        <kendo-label text="Name"></kendo-label>
        <kendo-textbox formControlName="name"></kendo-textbox>
      </kendo-formfield>
    </mm-base-form>
  `
})
export class ContactFormComponent {
  form = new FormGroup({
    name: new FormControl('')
  });

  config: BaseFormConfig = { title: 'Edit Contact' };

  onSave(): void {
    // Save...
    this.form.markAsPristine(); // Important: Mark form as clean
  }
}
```

### Example 2: Dashboard with State Management

```typescript
@Component({
  selector: 'dashboard-editor',
  standalone: true,
  hostDirectives: [UnsavedChangesDirective],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: DashboardEditorComponent }],
  template: `...`
})
export class DashboardEditorComponent implements HasUnsavedChanges {
  private readonly stateService = inject(DashboardStateService);

  hasUnsavedChanges(): boolean {
    return this.stateService.hasChanges();
  }

  async saveChanges(): Promise<boolean> {
    try {
      await this.stateService.save();
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }
}
```

### Example 3: Route Configuration for Multiple Paths

```typescript
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';

export const routes: Routes = [
  {
    path: 'items',
    children: [
      {
        path: 'new',
        component: ItemEditorComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: ':id/edit',
        component: ItemEditorComponent,
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: ':id',
        component: ItemViewComponent
        // No guard needed - view only
      }
    ]
  }
];
```

---

## Checklist

### Minimal Protection (browser events only):
- [ ] Component uses `<mm-base-form>` OR
- [ ] Component has `hostDirectives: [UnsavedChangesDirective]`
- [ ] Component has `providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: ... }]`
- [ ] Component implements `hasUnsavedChanges(): boolean`

### Full Protection (browser + in-app):
- [ ] All items from above
- [ ] Route has `canDeactivate: [UnsavedChangesGuard]`
- [ ] Optional: `saveChanges(): Promise<boolean>` implemented

---

## Tips

1. **Reset form after saving:**
   ```typescript
   this.form.markAsPristine();
   ```

2. **Explicit change tracking:**
   ```typescript
   config: BaseFormConfig = {
     hasChanges: true  // Overrides form.dirty
   };
   ```

3. **Debugging:**
   ```typescript
   hasUnsavedChanges(): boolean {
     const hasChanges = this.form.dirty;
     console.log('Has unsaved changes:', hasChanges);
     return hasChanges;
   }
   ```
