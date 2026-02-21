# Progress Window Component Usage

The Progress Window component provides a modern Kendo UI-based replacement for the old Angular Material progress dialog.

## Basic Usage

### 1. Import the Service

```typescript
import { ProgressWindowService, ProgressValue } from '@meshmakers/shared-ui';
```

### 2. Inject the Service

```typescript
export class MyService {
  private readonly progressWindowService = inject(ProgressWindowService);
}
```

### 3. Show Progress Dialog

#### Determinate Progress (with percentage)

```typescript
import { Subject } from 'rxjs';

// Create progress subject
const progressSubject = new Subject<ProgressValue>();

// Show progress dialog
const dialogRef = this.progressWindowService.showDeterminateProgress(
  'Processing Data',
  progressSubject.asObservable(),
  {
    isCancelOperationAvailable: true,
    cancelOperation: () => {
      // Handle cancellation
      console.log('Operation cancelled');
    }
  }
);

// Update progress
const progress = new ProgressValue();
progress.statusText = 'Loading data...';
progress.progressValue = 25;
progressSubject.next(progress);

progress.statusText = 'Processing...';
progress.progressValue = 50;
progressSubject.next(progress);

progress.statusText = 'Finalizing...';
progress.progressValue = 100;
progressSubject.next(progress);

// Close dialog when done
setTimeout(() => {
  dialogRef.close();
}, 2000);
```

#### Indeterminate Progress (spinning animation)

```typescript
// Show indeterminate progress
const dialogRef = this.progressWindowService.showIndeterminateProgress(
  'Loading...',
  progressSubject.asObservable(),
  {
    isCancelOperationAvailable: false
  }
);

// Update status text only (no percentage)
const progress = new ProgressValue();
progress.statusText = 'Connecting to server...';
progressSubject.next(progress);

progress.statusText = 'Authenticating...';
progressSubject.next(progress);
```

## Migration from Angular Material

### Old Angular Material Code:

```typescript
import { MatDialog } from '@angular/material/dialog';
import { MmProgressWindowComponent, ProgressWindowData } from './mm-progress-window';

const dialogRef = this.dialog.open(MmProgressWindowComponent, {
  data: {
    title: 'Processing',
    isDeterminate: true,
    progress: progressObservable,
    isCancelOperationAvailable: true,
    cancelOperation: () => { /* cancel logic */ }
  }
});
```

### New Kendo UI Code:

```typescript
import { ProgressWindowService } from '@meshmakers/shared-ui';

const dialogRef = this.progressWindowService.showDeterminateProgress(
  'Processing',
  progressObservable,
  {
    isCancelOperationAvailable: true,
    cancelOperation: () => { /* cancel logic */ }
  }
);
```

## Configuration Options

```typescript
interface ProgressWindowOptions {
  isCancelOperationAvailable?: boolean;  // Show cancel button
  cancelOperation?: () => void;           // Cancel callback
  width?: number;                         // Dialog width (default: 450)
  height?: number | string;               // Dialog height (default: 'auto')
  allowClose?: boolean;                   // Allow closing via X button (default: false)
}
```

## Complete Example with Job Status

```typescript
export class JobService {
  private readonly progressWindowService = inject(ProgressWindowService);
  
  async executeJobWithProgress(jobId: string): Promise<void> {
    const progressSubject = new Subject<ProgressValue>();
    
    // Show progress dialog
    const dialogRef = this.progressWindowService.showDeterminateProgress(
      'Executing Job',
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: true,
        cancelOperation: () => this.cancelJob(jobId),
        width: 500
      }
    );

    try {
      let isCompleted = false;
      
      while (!isCompleted) {
        const status = await this.getJobStatus(jobId);
        
        const progress = new ProgressValue();
        progress.statusText = status.message;
        progress.progressValue = status.percentage;
        
        progressSubject.next(progress);
        
        if (status.isCompleted) {
          isCompleted = true;
        } else {
          await this.delay(1000); // Wait 1 second before next check
        }
      }
      
      dialogRef.close();
    } catch (error) {
      dialogRef.close();
      throw error;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Styling

The progress window uses theme-aware Kendo UI components and will automatically adapt to your current theme. The component includes:

- Primary color title bar
- Smooth progress animations
- Consistent button styling
- Responsive layout
- Dark/light theme support