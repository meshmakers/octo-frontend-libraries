import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonsModule} from '@progress/kendo-angular-buttons';
import {GridModule, GridDataResult} from '@progress/kendo-angular-grid';
import {AttributeSelectorDialogService, AttributeSelectorResult} from '@meshmakers/octo-ui';
import {AttributeItem} from '@meshmakers/octo-services';

@Component({
  selector: 'app-attribute-selector-demo',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    GridModule
  ],
  providers: [
    AttributeSelectorDialogService
  ],
  template: `
    <div class="demo-container">
      <h2>Attribute Selector Dialog Demo</h2>

      <div class="controls">
        <button
          kendoButton
          themeColor="primary"
          (click)="openAttributeSelector()"
          [disabled]="!sampleCkTypeId">
          Open Attribute Selector
        </button>
        <span class="info-text">
          CkTypeId: {{ sampleCkTypeId || 'Not available - check if backend is running' }}
        </span>
      </div>

      <div class="results" *ngIf="selectedAttributes.length > 0 || lastActionResult">
        <h3>Last Action Result</h3>
        <div class="action-result">
          <strong>Action:</strong> {{ lastActionResult?.confirmed ? 'Confirmed (OK)' : 'Cancelled' }}<br>
          <strong>Selected Count:</strong> {{ lastActionResult?.selectedAttributes?.length || 0 }}
        </div>

        <h3 *ngIf="selectedAttributes.length > 0">Selected Attributes ({{ selectedAttributes.length }})</h3>

        <kendo-grid
          [data]="gridData"
          [height]="300"
          class="results-grid">
          <kendo-grid-column field="attributePath" title="Attribute Path" [width]="300"></kendo-grid-column>
          <kendo-grid-column field="attributeValueType" title="Value Type" [width]="150"></kendo-grid-column>
        </kendo-grid>

        <div class="selected-list">
          <h4>Selected Attribute Paths:</h4>
          <ul>
            <li *ngFor="let attr of selectedAttributes">
              {{ attr.attributePath }} ({{ attr.attributeValueType }})
            </li>
          </ul>
        </div>
      </div>

      <div class="instructions">
        <h3>Instructions</h3>
        <ul>
          <li>Click "Open Attribute Selector" to open the dialog</li>
          <li>Use the search box to filter available attributes</li>
          <li><strong>Double-click</strong> any attribute to quickly move it between lists</li>
          <li>Select attributes from the left grid and use arrow buttons to move them to selected list</li>
          <li>Use the + and - buttons to add/remove all attributes</li>
          <li>Click OK to confirm selection or Cancel to discard changes</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1200px;
    }

    .controls {
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .info-text {
      font-style: italic;
      color: #666;
    }

    .results {
      margin-bottom: 30px;
    }

    .action-result {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
      margin-bottom: 20px;
      font-family: monospace;
    }

    .results-grid {
      margin-bottom: 20px;
      border: 1px solid #d5d5d5;
    }

    .selected-list {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
    }

    .selected-list h4 {
      margin-top: 0;
      margin-bottom: 10px;
    }

    .selected-list ul {
      margin: 0;
      padding-left: 20px;
    }

    .selected-list li {
      margin-bottom: 5px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }

    .instructions {
      background: #e7f3ff;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #1976d2;
    }

    .instructions h3 {
      margin-top: 0;
      color: #1976d2;
    }

    .instructions ul {
      margin-bottom: 0;
    }

    .instructions li {
      margin-bottom: 8px;
    }
  `]
})
export class AttributeSelectorDemoComponent {
  private readonly attributeSelectorService = inject(AttributeSelectorDialogService);

  public selectedAttributes: AttributeItem[] = [];
  public gridData: GridDataResult = {data: [], total: 0};
  public lastActionResult: AttributeSelectorResult | null = null;

  // Sample CkTypeId - in a real application, this would come from user selection
  // You can replace this with any valid CkTypeId from your system
  public sampleCkTypeId = 'System.Identity/User'; // Example CkTypeId

  public async openAttributeSelector(): Promise<void> {
    if (!this.sampleCkTypeId) {
      alert('No CkTypeId available. Please ensure backend is running and configure a valid CkTypeId.');
      return;
    }

    // Pre-select some attributes for demonstration
    const preSelectedAttributes = this.selectedAttributes.map(attr => attr.attributePath);

    try {
      const result = await this.attributeSelectorService.openAttributeSelector(
        this.sampleCkTypeId,
        preSelectedAttributes,
        'Select User Attributes'
      );

      // Store the full result for display
      this.lastActionResult = result;

      if (result.confirmed) {
        // User clicked OK - update the selected attributes
        this.selectedAttributes = result.selectedAttributes;
        this.updateGrid();
        console.log('User confirmed selection:', result.selectedAttributes);
      } else {
        // User clicked Cancel - keep existing attributes but show the action result
        console.log('User cancelled selection');
      }
    } catch (error) {
      console.error('Error in attribute selector:', error);
      alert('Error loading attributes. Please check console for details.');
    }
  }

  private updateGrid(): void {
    this.gridData = {
      data: this.selectedAttributes,
      total: this.selectedAttributes.length
    };
  }
}
