import { Component, NgZone, OnDestroy } from '@angular/core';
import { Subject, interval, takeUntil, map, takeWhile, finalize } from 'rxjs';
import { ProgressDialogRef, ProgressWindowService, ProgressValue } from '@meshmakers/shared-ui-legacy';

@Component({
  selector: 'app-progress-demo',
  standalone: false,
  templateUrl: './progress-demo.component.html',
  styleUrls: ['./progress-demo.component.scss']
})
export class ProgressDemoComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  determinateStatus = '';
  indeterminateStatus = '';

  constructor(
    private progressWindowService: ProgressWindowService,
    private ngZone: NgZone,
  ) {}

  showDeterminate(): void {
    this.determinateStatus = '';
    const progress$ = new Subject<ProgressValue>();

    // Open dialog outside Angular zone to prevent CDK overlay popover rendering issues
    const ref = this.openDialogOutsideZone('determinate', 'Processing Data', progress$);

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        let current = 0;
        const sub = interval(200)
          .pipe(
            takeUntil(this.destroy$),
            map(() => {
              current += 5;
              const pv = new ProgressValue();
              pv.progressValue = Math.min(current, 100);
              pv.statusText = `Processing item ${Math.ceil(current / 5)} of 20...`;
              return pv;
            }),
            takeWhile(pv => pv.progressValue < 100, true),
            finalize(() => {
              progress$.complete();
              ref.close();
              setTimeout(() => this.ngZone.run(() => {
                this.determinateStatus = 'Completed successfully';
              }));
            })
          )
          .subscribe(pv => progress$.next(pv));

        this.destroy$.subscribe(() => sub.unsubscribe());
      }, 500);
    });
  }

  showDeterminateWithCancel(): void {
    this.determinateStatus = '';
    const progress$ = new Subject<ProgressValue>();
    let cancelled = false;

    const ref = this.openDialogOutsideZone('determinate', 'Uploading Files', progress$, {
      isCancelOperationAvailable: true,
      cancelOperation: () => {
        cancelled = true;
        setTimeout(() => this.ngZone.run(() => {
          this.determinateStatus = 'Cancelled by user';
        }));
      }
    });

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        let current = 0;
        const sub = interval(300)
          .pipe(
            takeUntil(this.destroy$),
            map(() => {
              current += 5;
              const pv = new ProgressValue();
              pv.progressValue = Math.min(current, 100);
              pv.statusText = `Uploading file ${Math.ceil(current / 10)} of 10...`;
              return pv;
            }),
            takeWhile(pv => pv.progressValue < 100 && !cancelled, true),
            finalize(() => {
              progress$.complete();
              ref.close();
              if (!cancelled) {
                setTimeout(() => this.ngZone.run(() => {
                  this.determinateStatus = 'Upload completed';
                }));
              }
            })
          )
          .subscribe(pv => progress$.next(pv));

        this.destroy$.subscribe(() => sub.unsubscribe());
      }, 500);
    });
  }

  showIndeterminate(): void {
    this.indeterminateStatus = '';
    const progress$ = new Subject<ProgressValue>();

    const ref = this.openDialogOutsideZone('indeterminate', 'Connecting to Server', progress$);

    this.ngZone.runOutsideAngular(() => {
      const steps = [
        { text: 'Establishing connection...', delay: 500 },
        { text: 'Authenticating...', delay: 2000 },
        { text: 'Loading configuration...', delay: 3500 },
      ];

      steps.forEach(step => {
        setTimeout(() => {
          const sv = new ProgressValue();
          sv.statusText = step.text;
          progress$.next(sv);
        }, step.delay);
      });

      setTimeout(() => {
        progress$.complete();
        ref.close();
        setTimeout(() => this.ngZone.run(() => {
          this.indeterminateStatus = 'Connection established';
        }));
      }, 5000);
    });
  }

  showIndeterminateWithCancel(): void {
    this.indeterminateStatus = '';
    const progress$ = new Subject<ProgressValue>();
    let cancelled = false;

    const ref = this.openDialogOutsideZone('indeterminate', 'Synchronizing Data', progress$, {
      isCancelOperationAvailable: true,
      cancelOperation: () => {
        cancelled = true;
        progress$.complete();
        ref.close();
        setTimeout(() => this.ngZone.run(() => {
          this.indeterminateStatus = 'Sync cancelled';
        }));
      }
    });

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const pv = new ProgressValue();
        pv.statusText = 'Synchronizing records...';
        progress$.next(pv);
      }, 300);

      setTimeout(() => {
        if (!cancelled) {
          progress$.complete();
          ref.close();
          setTimeout(() => this.ngZone.run(() => {
            this.indeterminateStatus = 'Sync completed';
          }));
        }
      }, 6000);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private openDialogOutsideZone(
    mode: 'determinate' | 'indeterminate',
    title: string,
    progress$: Subject<ProgressValue>,
    options?: { isCancelOperationAvailable?: boolean; cancelOperation?: () => void }
  ): ProgressDialogRef {
    let ref!: ProgressDialogRef;
    this.ngZone.runOutsideAngular(() => {
      ref = mode === 'determinate'
        ? this.progressWindowService.showDeterminateProgress(title, progress$, options)
        : this.progressWindowService.showIndeterminateProgress(title, progress$, options);
    });
    return ref;
  }
}
