import { Component } from '@angular/core';
import { ConfirmationService, ConfirmationWindowResult, ButtonTypes } from '@meshmakers/shared-ui-legacy';

@Component({
  selector: 'app-confirmation-demo',
  standalone: false,
  templateUrl: './confirmation-demo.component.html',
  styleUrls: ['./confirmation-demo.component.scss']
})
export class ConfirmationDemoComponent {
  yesNoResult: string = '';
  yesNoCancelResult: string = '';
  okCancelResult: string = '';
  okResult: string = '';

  constructor(private confirmationService: ConfirmationService) {}

  async showYesNo(): Promise<void> {
    const result = await this.confirmationService.showYesNoConfirmationDialog(
      'Confirm Action',
      'Are you sure you want to proceed with this action?'
    );
    this.yesNoResult = result ? 'Yes' : 'No';
  }

  async showYesNoCancel(): Promise<void> {
    const result: ConfirmationWindowResult | undefined =
      await this.confirmationService.showYesNoCancelConfirmationDialog(
        'Save Changes',
        'You have unsaved changes. Do you want to save them before leaving?'
      );
    if (!result) {
      this.yesNoCancelResult = 'Cancel (dialog dismissed)';
    } else {
      switch (result.result) {
        case ButtonTypes.Yes:
          this.yesNoCancelResult = 'Yes';
          break;
        case ButtonTypes.No:
          this.yesNoCancelResult = 'No';
          break;
        case ButtonTypes.Cancel:
          this.yesNoCancelResult = 'Cancel';
          break;
        default:
          this.yesNoCancelResult = 'Unknown';
      }
    }
  }

  async showOkCancel(): Promise<void> {
    const result = await this.confirmationService.showOkCancelConfirmationDialog(
      'Delete Item',
      'This item will be permanently deleted. This action cannot be undone.'
    );
    this.okCancelResult = result ? 'OK' : 'Cancel';
  }

  async showOk(): Promise<void> {
    const result = await this.confirmationService.showOkDialog(
      'Operation Complete',
      'The data has been successfully exported to the specified location.'
    );
    this.okResult = result ? 'OK' : 'Dismissed';
  }
}
