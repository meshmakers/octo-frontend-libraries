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

## Leaving the Page: Back and Cancel Stay in the App

A "Back" or "Cancel" button must not call `location.back()` directly. When the page was opened directly - a link, a
new tab, a bookmark, the return from the login page - the previous browser entry is a foreign page (or there is none):
`location.back()` then leaves the app, and a dirty form raises the browser's "Leave site?" prompt of
`UnsavedChangesDirective`.

Use `InAppHistoryService.back(fallback)`:

```typescript
import { InAppHistoryService } from '@meshmakers/shared-ui';

export class MyFormComponent {
  private readonly history = inject(InAppHistoryService);
  private readonly route = inject(ActivatedRoute);

  protected onCancel(): Promise<boolean> {
    // Back to the previous page of the app, else to the list (replaceUrl).
    const tenantId = this.route.snapshot.paramMap.get('tenantId');
    return this.history.back(['/', tenantId, 'items']);
  }
}
```

- `canGoBack()` is true when the previous browser entry is a page of this app, as far as the service can tell (see
  below).
- `back(fallback, extras?)` calls `location.back()` in that case; otherwise it navigates to `fallback` (absolute
  commands or a `UrlTree`) with `replaceUrl`, so the browser's back button does not return to the page that was left.
  The route's `UnsavedChangesGuard` runs in both cases, so a dirty form asks in the app, not with the browser prompt.
  The promise never rejects: a failed fallback navigation is logged and resolves `false`, so handlers can drop it.
- How it knows: the service writes a depth counter into `history.state` (`mmInAppHistoryDepth`) of every entry the
  router creates: 0 for the first entry of the app, +1 per pushed entry, unchanged for a replaced one. Browser
  Back/Forward and a reload restore the counter of their entry. The router's own navigation record cannot answer the
  question, because it starts empty after every page load while the browser keeps the app's earlier entries.
- Where it cannot be sure it counts low, so it falls back rather than leave the app: an entry without a counter counts
  as the first one; browser Back/Forward takes the counter of the entry the browser moved to, also when a guard
  refuses that navigation (the browser stays on that entry), redirects it, skips it (same URL) or a newer navigation
  supersedes it (the newer one counts from that entry); a navigation the router replaces because the browser path
  stays the same (`browserUrl`) keeps the counter; `back()` counts down at once, so a second click before the router
  handled the first cannot step past the first entry of the app.
- No `instanceof` against Angular classes: router events are told apart by `type`, the fallback by `Array.isArray`,
  so a host with a second copy of the router still works.
- `provideMmSharedUi()` starts the service with the app (`provideInAppHistory()` for apps without it). It supports the
  router's default history handling, not the experimental Navigation API integration (there it falls back more
  often).

**After a successful save** mark the form pristine (`form.markAsPristine()` or `hasChanges: false`) **before** you
navigate away, and navigate in the app (`router.navigate(...)`) to the list or the saved item. `mm-base-form` only
emits `saveForm`; it does not know whether the save succeeded, so the host component owns both steps.

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
- [ ] Back/Cancel use `InAppHistoryService.back(fallback)`, never `location.back()`
- [ ] A successful save marks the form pristine before it navigates

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
