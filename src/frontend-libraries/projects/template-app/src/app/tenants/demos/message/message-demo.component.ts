import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { CardModule } from '@progress/kendo-angular-layout';
import { MessageService } from '@meshmakers/shared-services';
import { xCircleIcon, infoCircleIcon, exclamationCircleIcon, checkCircleIcon } from '@progress/kendo-svg-icons';

@Component({
  selector: 'app-message-demo',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule],
  templateUrl: './message-demo.component.html',
  styleUrls: ['./message-demo.component.scss']
})
export class MessageDemoComponent {
  private readonly messageService = inject(MessageService);

  protected readonly errorIcon = xCircleIcon;
  protected readonly infoIcon = infoCircleIcon;
  protected readonly warningIcon = exclamationCircleIcon;
  protected readonly checkCircleIcon = checkCircleIcon;

  showSimpleError(): void {
    this.messageService.showError('This is a simple error message');
  }

  // Success message methods
  showSimpleSuccess(): void {
    this.messageService.showSuccess('Operation completed successfully!');
  }

  showDataSavedSuccess(): void {
    this.messageService.showSuccess('Your data has been saved successfully');
  }

  showOperationCompleteSuccess(): void {
    this.messageService.showSuccess('The requested operation has been completed');
  }

  showFileUploadSuccess(): void {
    this.messageService.showSuccess('File uploaded successfully - document.pdf (2.3 MB)');
  }

  showUserCreatedSuccess(): void {
    this.messageService.showSuccess('User account created successfully for john.doe@example.com');
  }

  showSettingsSavedSuccess(): void {
    this.messageService.showSuccess('Your preferences have been updated and saved');
  }

  showErrorWithTitle(): void {
    this.messageService.showErrorWithDetails(
      'Processing Error',
      'Something went wrong while processing your request'
    );
  }

  showValidationError(): void {
    this.messageService.showErrorWithDetails(
      'Validation Error',
      'Please fill in all required fields before submitting the form. Required fields are: Name, Email, Phone Number, and Address.'
    );
  }

  showNetworkError(): void {
    const details = `Network Error Details:

Error Code: ECONNREFUSED
URL: https://api.example.com/v1/data
Timestamp: ${new Date().toISOString()}
Retry Count: 3
Timeout: 30000ms

Troubleshooting:
1. Check internet connection
2. Verify server status
3. Check firewall settings
4. Contact IT support if problem persists`;

    this.messageService.showErrorWithDetails(
      'Network Error',
      details
    );
  }

  showAuthenticationError(): void {
    this.messageService.showErrorWithDetails('Authentication Error', 'Your session has expired. Please log in again to continue.');
  }

  showPermissionError(): void {
    this.messageService.showErrorWithDetails('Permission Denied', 'You do not have permission to perform this action. Please contact your administrator.');
  }

  showDataError(): void {
    const details = `Database Error Details:

Connection String: Server=localhost;Database=MyApp;Trusted_Connection=true;
Error Code: DB_CONNECTION_FAILED (Code: 2)
SQL State: 08001
Timestamp: ${new Date().toISOString()}
Query: SELECT * FROM Users WHERE Active = 1

Stack Trace:
  at DatabaseConnection.connect() line 45
  at UserRepository.getActiveUsers() line 23
  at UserService.loadUsers() line 12

Possible Causes:
- Database server is down
- Network connectivity issues
- Authentication failure
- Connection pool exhausted`;

    this.messageService.showErrorWithDetails(
      'Database Error',
      details
    );
  }

  showTimeoutError(): void {
    this.messageService.showErrorWithDetails('Timeout Error', 'The operation timed out after 30 seconds. Please try again or contact support if the problem persists.');
  }

  showFileError(): void {
    this.messageService.showErrorWithDetails('File Upload Error', 'The file format is not supported. Please upload files in PDF, DOCX, or TXT format only.');
  }

  showConfigurationError(): void {
    const details = `Configuration Error Details:

Missing Configuration Keys:
- API_ENDPOINT (required)
- DATABASE_URL (optional)
- JWT_SECRET (required)

Current Configuration:
{
  "app": {
    "name": "MyApplication",
    "version": "1.2.3",
    "environment": "production"
  },
  "features": {
    "authentication": true,
    "notifications": false
  },
  "api": {
    "timeout": 30000,
    "retries": 3
  }
}

Expected Configuration:
Please add the missing API_ENDPOINT to your environment variables or config file.`;

    this.messageService.showErrorWithDetails(
      'Configuration Error',
      details
    );
  }

  showErrorFromObject(): void {
    const errorObject = {
      code: 'ERR_500',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: '/api/v1/resources'
    };
    this.messageService.showErrorWithDetails('Error Details', JSON.stringify(errorObject, null, 2));
  }

  showErrorFromError(): void {
    const error = new Error('This is an Error object with stack trace information');
    this.messageService.showErrorWithDetails('Error Instance', error.message + '\n\nStack Trace:\n' + (error.stack || 'No stack trace available'));
  }

  showMultilineError(): void {
    const multilineMessage = `Failed to process batch operation:
    - Item 1: Success
    - Item 2: Failed - Invalid format
    - Item 3: Failed - Duplicate entry
    - Item 4: Success
    Total: 2 succeeded, 2 failed`;
    this.messageService.showErrorWithDetails('Batch Processing Error', multilineMessage);
  }

  showInformationMessage(): void {
    this.messageService.showInformation('Operation completed successfully!');
  }

  showWarningMessage(): void {
    const details = `Warning Details:

Action: Delete selected records
Affected Records: 127 items
Last Backup: 2 days ago
Estimated Time: 30 seconds

This action will permanently delete:
- User profiles
- Associated documents
- Audit logs
- Related preferences

Considerations:
- Create a backup before proceeding
- Notify affected users
- Update related systems
- Document the change`;

    this.messageService.showWarningWithDetails(
      'Warning',
      details
    );
  }

  showMultipleErrors(): void {
    this.messageService.showErrorWithDetails('Error 1', 'First error: Database connection failed');
    setTimeout(() => {
      this.messageService.showErrorWithDetails('Error 2', 'Second error: Invalid user credentials');
    }, 500);
    setTimeout(() => {
      this.messageService.showErrorWithDetails('Error 3', 'Third error: Resource not found');
    }, 1000);
  }

  getErrorCount(): number {
    return this.messageService.getErrorMessageCount();
  }

  clearErrors(): void {
    // Note: The current MessageService doesn't have a clear method,
    // but we can demonstrate getting the count
    const count = this.getErrorCount();
    this.messageService.showInformation(`Total errors logged: ${count}`);
  }
}
