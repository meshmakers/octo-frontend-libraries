import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import {
  FileUploadService,
  ConfirmationService,
  ProgressWindowService,
  ProgressValue,
  SaveAsDialogService,
  SaveAsDialogDataSource,
  NameAvailabilityResult
} from '@meshmakers/shared-ui';
import { Subject, Observable, of, delay, from, map } from 'rxjs';
import { GetSdkCustomersDtoGQL, GetSdkCustomersQueryVariablesDto } from '../../../../graphQL/getSdkCustomers';
import { FieldFilterOperatorsDto } from '../../../../graphQL/globalTypes';

/**
 * Demo data source that simulates checking name availability
 */
class DemoSaveAsDataSource implements SaveAsDialogDataSource {
  private existingNames = ['document', 'report', 'backup', 'config', 'settings'];

  checkNameAvailability(name: string): Observable<NameAvailabilityResult> {
    // Simulate API call with delay
    const normalizedName = name.toLowerCase().trim();
    const isAvailable = !this.existingNames.includes(normalizedName);

    return of({
      isAvailable,
      message: isAvailable ? undefined : `"${name}" already exists. Please choose a different name.`
    }).pipe(delay(500)); // Simulate network delay
  }
}

/**
 * GraphQL-based data source that checks if a customer with the given lastName already exists
 */
class CustomerLastNameSaveAsDataSource implements SaveAsDialogDataSource {
  constructor(private getSdkCustomersDtoGQL: GetSdkCustomersDtoGQL) {}

  checkNameAvailability(name: string): Observable<NameAvailabilityResult> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return of({ isAvailable: true });
    }

    const variables: GetSdkCustomersQueryVariablesDto = {
      first: 1,
      fieldFilters: [{
        operator: FieldFilterOperatorsDto.EqualsDto,
        attributePath: 'lastName',
        comparisonValue: trimmedName
      }]
    };

    return from(this.getSdkCustomersDtoGQL.fetch({ variables })).pipe(
      map(result => {
        const totalCount = result.data?.runtime?.octoSdkDemoCustomer?.totalCount ?? 0;
        const isAvailable = totalCount === 0;

        return {
          isAvailable,
          message: isAvailable
            ? undefined
            : `A customer with last name "${trimmedName}" already exists. Please choose a different name.`
        };
      })
    );
  }
}

@Component({
  selector: 'app-dialogs-demo',
  imports: [
    CommonModule,
    ButtonComponent
  ],
  templateUrl: './dialogs-demo.component.html',
  styleUrl: './dialogs-demo.component.scss'
})
export class DialogsDemoComponent {
  private readonly fileUploadService = inject(FileUploadService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly progressWindowService = inject(ProgressWindowService);
  private readonly saveAsDialogService = inject(SaveAsDialogService);
  private readonly getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  // Save As dialog state
  protected lastSaveAsResult: { confirmed: boolean; name?: string } | null = null;
  protected lastGraphQLSaveAsResult: { confirmed: boolean; name?: string } | null = null;

  protected async onUploadClick() {
    const r = await this.fileUploadService.showUploadDialog("Upload File", "Please select a file to upload", "application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "pdf,xls,xlsx");
    if (r) {
      console.log('onUploadClick', r);
    }

  }

  protected async onOkClick() {
    const r = await this.confirmationService.showOkDialog("Demo Title", "Demo ok message text");
    if (r) {
      console.log('onOkClick', r);
    }
  }

  protected async onOkCancelClick() {
    const r = await this.confirmationService.showOkCancelConfirmationDialog("Demo Title", "Demo ok cancel message text");
    if (r) {
      console.log('onOkCancelClick', r);
    }
  }

  protected async onYesNoClick() {
    const r = await this.confirmationService.showYesNoConfirmationDialog("Demo Title", "Demo yes no message text");
    if (r) {
      console.log('onYesNoClick', r);
    }
  }

  protected async onYesNoCancelClick() {
    const r = await this.confirmationService.showYesNoCancelConfirmationDialog("Demo Title", "Demo yes no cancel message text");
    if (r) {
      console.log('onYesNoCancelClick', r);
    }
  }

  protected onDeterminateProgressClick() {
    const progressSubject = new Subject<ProgressValue>();

    const dialogRef = this.progressWindowService.showDeterminateProgress(
      'Processing Data',
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: true,
        cancelOperation: () => {
          console.log('Progress cancelled');
          dialogRef.close();
        }
      }
    );

    // Simulate progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;

      const progressValue = new ProgressValue();
      progressValue.progressValue = progress;

      if (progress <= 30) {
        progressValue.statusText = 'Loading data...';
      } else if (progress <= 60) {
        progressValue.statusText = 'Processing records...';
      } else if (progress <= 90) {
        progressValue.statusText = 'Finalizing results...';
      } else {
        progressValue.statusText = 'Complete!';
      }

      progressSubject.next(progressValue);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          dialogRef.close();
          console.log('Determinate progress completed');
        }, 1000);
      }
    }, 500);
  }

  protected onIndeterminateProgressClick() {
    const progressSubject = new Subject<ProgressValue>();

    const dialogRef = this.progressWindowService.showIndeterminateProgress(
      'Loading...',
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: false
      }
    );

    // Simulate status text updates
    const statusMessages = [
      'Connecting to server...',
      'Authenticating user...',
      'Loading configuration...',
      'Preparing interface...',
      'Ready!'
    ];

    let messageIndex = 0;
    const interval = setInterval(() => {
      const progressValue = new ProgressValue();
      progressValue.statusText = statusMessages[messageIndex];
      progressSubject.next(progressValue);

      messageIndex++;

      if (messageIndex >= statusMessages.length) {
        clearInterval(interval);
        setTimeout(() => {
          dialogRef.close();
          console.log('Indeterminate progress completed');
        }, 1000);
      }
    }, 1500);
  }

  protected onLongRunningProgressClick() {
    const progressSubject = new Subject<ProgressValue>();
    let cancelled = false;

    const dialogRef = this.progressWindowService.showDeterminateProgress(
      'Long Running Task',
      progressSubject.asObservable(),
      {
        isCancelOperationAvailable: true,
        cancelOperation: () => {
          cancelled = true;
          console.log('Long running task cancelled');
          dialogRef.close();
        },
        width: 500
      }
    );

    // Simulate a longer process with variable timing
    let progress = 0;
    const updateProgress = () => {
      if (cancelled) return;

      // Random progress increment
      const increment = Math.floor(Math.random() * 5) + 1;
      progress += increment;

      if (progress > 100) progress = 100;

      const progressValue = new ProgressValue();
      progressValue.progressValue = progress;

      // Dynamic status messages based on progress
      if (progress < 20) {
        progressValue.statusText = 'Initializing task...';
      } else if (progress < 40) {
        progressValue.statusText = 'Processing batch 1 of 5...';
      } else if (progress < 60) {
        progressValue.statusText = 'Processing batch 2 of 5...';
      } else if (progress < 80) {
        progressValue.statusText = 'Processing batch 3 of 5...';
      } else if (progress < 95) {
        progressValue.statusText = 'Finalizing results...';
      } else {
        progressValue.statusText = 'Task completed successfully!';
      }

      progressSubject.next(progressValue);

      if (progress >= 100) {
        setTimeout(() => {
          if (!cancelled) {
            dialogRef.close();
            console.log('Long running task completed');
          }
        }, 1500);
      } else {
        // Random delay between updates (500ms to 2000ms)
        const delay = Math.floor(Math.random() * 1500) + 500;
        setTimeout(updateProgress, delay);
      }
    };

    updateProgress();
  }

  // Save As Dialog methods
  protected async onSaveAsSimpleClick(): Promise<void> {
    const result = await this.saveAsDialogService.showSaveAsDialog({
      title: 'Save As',
      nameLabel: 'File name',
      placeholder: 'Enter file name...',
      suggestedName: 'New Document',
      saveButtonText: 'Save',
      cancelButtonText: 'Cancel'
    });

    this.lastSaveAsResult = result;
    console.log('Save As (Simple) result:', result);
  }

  protected async onSaveAsWithValidationClick(): Promise<void> {
    const result = await this.saveAsDialogService.showSaveAsDialog({
      title: 'Save Document As',
      nameLabel: 'Document name',
      placeholder: 'Enter document name...',
      suggestedName: 'My Report',
      saveButtonText: 'Save',
      cancelButtonText: 'Cancel',
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*$/,
      patternErrorMessage: 'Name must start with a letter or number and contain only letters, numbers, spaces, hyphens, or underscores',
      dataSource: new DemoSaveAsDataSource(),
      debounceTime: 300
    });

    this.lastSaveAsResult = result;
    console.log('Save As (With Validation) result:', result);
  }

  protected async onSaveAsWithGraphQLClick(): Promise<void> {
    const result = await this.saveAsDialogService.showSaveAsDialog({
      title: 'Save Customer As',
      nameLabel: 'Last name',
      placeholder: 'Enter customer last name...',
      saveButtonText: 'Save',
      cancelButtonText: 'Cancel',
      minLength: 2,
      maxLength: 100,
      dataSource: new CustomerLastNameSaveAsDataSource(this.getSdkCustomersDtoGQL),
      debounceTime: 400
    });

    this.lastGraphQLSaveAsResult = result;
    console.log('Save As (GraphQL) result:', result);
  }
}
