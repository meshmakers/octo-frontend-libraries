# Dialog Demos

This directory contains demonstrations of various dialog components available in the `@meshmakers/shared-ui` library.

## Progress Window Examples

The progress window component provides three main demo scenarios:

### 1. Determinate Progress
Shows a progress bar with percentage and allows cancellation:
- Updates every 500ms with 10% increments
- Displays contextual status messages
- Cancellable operation
- Auto-closes when complete

### 2. Indeterminate Progress  
Shows a spinning progress animation for unknown duration tasks:
- Updates status text without percentage
- Cannot be cancelled (typical for critical operations)
- Simulates authentication/connection flow
- Auto-closes when complete

### 3. Long Running Task
Demonstrates realistic variable-progress scenario:
- Random progress increments (1-5%)
- Variable timing between updates (500-2000ms)
- Batch processing simulation
- Cancellable with proper cleanup
- Wider dialog (500px)

## Usage in Your Services

```typescript
import { ProgressWindowService, ProgressValue } from '@meshmakers/shared-ui';
import { Subject } from 'rxjs';

export class DataService {
  private readonly progressWindowService = inject(ProgressWindowService);
  
  async processLargeDataset(): Promise<void> {
    const progressSubject = new Subject<ProgressValue>();
    
    const dialogRef = this.progressWindowService.showDeterminateProgress(
      'Processing Dataset',
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: true,
        cancelOperation: () => this.cancelProcessing()
      }
    );
    
    // Your processing logic with progress updates
    for (let i = 0; i <= 100; i += 10) {
      const progress = new ProgressValue();
      progress.progressValue = i;
      progress.statusText = `Processing record ${i}/100...`;
      progressSubject.next(progress);
      
      await this.processChunk();
    }
    
    dialogRef.close();
  }
}
```

## Migration from Angular Material

Replace your existing `MatDialog` with `ProgressWindowService` for better Kendo UI integration and consistent theming.

### Before (Angular Material):
```typescript
this.dialog.open(ProgressDialogComponent, {
  data: { title, progress, isCancellable: true }
});
```

### After (Kendo UI):
```typescript
this.progressWindowService.showDeterminateProgress(title, progress, {
  isCancelOperationAvailable: true
});
```