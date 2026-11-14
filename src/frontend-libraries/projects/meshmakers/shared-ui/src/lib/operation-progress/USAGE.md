# Operation progress (AB#8448)

State, progress and outcome of one long-running operation — today an asynchronous CK method operation
(`runtime.operations`, followed with `CkMethodOperationService` of `@meshmakers/octo-services`).

- `mm-operation-progress` — presentational. Input `view: OperationProgressView` (`status` = `running` | `succeeded` |
  `failed` | `outcomeUnknown` | `notAvailable`, method label, start / finish / expiry dates, `percent` — `null` renders an
  indeterminate bar —, stage text, error code and message, `connectionLost`, `canDownload`, `canStartNew`), `messages`
  (i18n overrides), `showOperationsLink`, `showActions`. Outputs `download`, `startNew`, `openOperations`. No cancel action.
- `OperationProgressWindowService.open({ title, view: Observable<OperationProgressView>, onDownload?, onStartNew?,
  onOpenOperations?, messages? })` — a closable dialog around it (Close, Download, Start again). Closing never cancels the
  operation; follow it only while the window is open (`dialogRef.result`). Unlike `ProgressWindowService` the window stays
  open after the operation finished, so the user can download or read the error. `onDownload` owns its failure
  handling (show a message); the window only logs a rejection that reaches it.

```ts
const view = operations.follow(id, { retryAfterSeconds }).pipe(/* map to OperationProgressView, e.g. toOperationProgressView */);
operationProgressWindow.open({ title: 'Tenant backup · t1', view, onDownload: () => download(), onOpenOperations: () => router.navigate([...]) });
```

Colours are Kendo CSS variables only (`--kendo-color-success/-error/-warning/-info` and their `-subtle` variants).
