import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { GridModule, GridDataResult } from '@progress/kendo-angular-grid';
import {
  AttributeSortSelectorDialogService,
  AttributeSortSelectorResult,
  AttributeSortItem
} from '@meshmakers/octo-ui';

@Component({
  selector: 'app-attribute-sort-selector-demo',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    GridModule
  ],
  template: `
    <div class="demo-container">
      <h2>Attribute Sort Selector Dialog Demo</h2>

      <div class="controls">
        <button
          kendoButton
          themeColor="primary"
          (click)="openAttributeSortSelector()"
          [disabled]="!sampleCkTypeId">
          Open Attribute Sort Selector
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
        
        <h3 *ngIf="selectedAttributes.length > 0">Selected Attributes with Sort Order ({{ selectedAttributes.length }})</h3>

        <kendo-grid
          [data]="gridData"
          [height]="300"
          class="results-grid"
          *ngIf="selectedAttributes.length > 0">
          <kendo-grid-column field="attributePath" title="Attribute Path" [width]="300"></kendo-grid-column>
          <kendo-grid-column field="attributeValueType" title="Value Type" [width]="150"></kendo-grid-column>
          <kendo-grid-column field="sortOrder" title="Sort Order" [width]="150">
            <ng-template kendoGridCellTemplate let-dataItem>
              <div class="sort-display">
                <span class="sort-indicator">{{ getSortIndicator(dataItem.sortOrder) }}</span>
                <span>{{ getSortText(dataItem.sortOrder) }}</span>
              </div>
            </ng-template>
          </kendo-grid-column>
        </kendo-grid>

        <div class="selected-list" *ngIf="selectedAttributes.length > 0">
          <h4>Selected Attribute Paths with Sort Orders:</h4>
          <ul>
            <li *ngFor="let attr of selectedAttributes">
              {{ attr.attributePath }} ({{ attr.attributeValueType }}) - <strong>{{ getSortText(attr.sortOrder) }}</strong>
            </li>
          </ul>
        </div>
      </div>

      <div class="instructions">
        <h3>Instructions</h3>
        <ul>
          <li>Click "Open Attribute Sort Selector" to open the dialog</li>
          <li>Use the search box to filter available attributes</li>
          <li>Select a sort order: Standard, Ascending ↑, or Descending ↓</li>
          <li><strong>Double-click</strong> any attribute to quickly add it with current sort order</li>
          <li>Or select an attribute and click "Add Attribute with Sort" button</li>
          <li>Use the Remove button (✕) to delete attributes from the selected list</li>
          <li>Click "Apply" to confirm selections or "Cancel" to discard changes</li>
        </ul>
        
        <div class="sort-explanation">
          <h4>Sort Order Explanation:</h4>
          <ul>
            <li><strong>Standard:</strong> No specific sort order applied (default database order)</li>
            <li><strong>Ascending ↑:</strong> Sort values from lowest to highest (A-Z, 1-9)</li>
            <li><strong>Descending ↓:</strong> Sort values from highest to lowest (Z-A, 9-1)</li>
          </ul>
        </div>
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

    .sort-display {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sort-indicator {
      font-size: 16px;
      font-weight: bold;
      color: var(--kendo-color-primary, #ff6358);
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
      margin-bottom: 16px;
    }

    .instructions li {
      margin-bottom: 8px;
    }

    .sort-explanation {
      background: #fff3cd;
      padding: 15px;
      border-radius: 4px;
      border-left: 4px solid #ffc107;
      margin-top: 16px;
    }

    .sort-explanation h4 {
      margin-top: 0;
      color: #856404;
    }

    .sort-explanation ul {
      margin-bottom: 0;
    }

    .sort-explanation li {
      margin-bottom: 6px;
    }
  `]
})
export class AttributeSortSelectorDemoComponent {
  private readonly attributeSortSelectorService = inject(AttributeSortSelectorDialogService);

  public selectedAttributes: AttributeSortItem[] = [];
  public gridData: GridDataResult = { data: [], total: 0 };
  public lastActionResult: AttributeSortSelectorResult | null = null;

  // Sample CkTypeId - replace with any valid CkTypeId from your system
  public sampleCkTypeId = 'System.Identity/User';

  public async openAttributeSortSelector(): Promise<void> {
    if (!this.sampleCkTypeId) {
      alert('No CkTypeId available. Please ensure backend is running and configure a valid CkTypeId.');
      return;
    }

    // Pre-populate with current selections for editing
    const preSelectedAttributes = [...this.selectedAttributes];

    try {
      const result = await this.attributeSortSelectorService.openAttributeSortSelector(
        this.sampleCkTypeId,
        preSelectedAttributes,
        'Select User Attributes with Sort Order'
      );

      // Store the full result for display
      this.lastActionResult = result;

      if (result.confirmed) {
        // User clicked Apply - update the selected attributes
        this.selectedAttributes = result.selectedAttributes;
        this.updateGrid();
        console.log('User confirmed selection:', result.selectedAttributes);
      } else {
        // User clicked Cancel - keep existing attributes but show the action result
        console.log('User cancelled selection');
      }
    } catch (error) {
      console.error('Error in attribute sort selector:', error);
      alert('Error loading attributes. Please check console for details.');
    }
  }

  public getSortIndicator(sortOrder: string): string {
    switch (sortOrder) {
      case 'ascending': return '↑';
      case 'descending': return '↓';
      default: return '';
    }
  }

  public getSortText(sortOrder: string): string {
    switch (sortOrder) {
      case 'ascending': return 'Ascending';
      case 'descending': return 'Descending';
      case 'standard':
      default:
        return 'Standard';
    }
  }

  private updateGrid(): void {
    this.gridData = {
      data: this.selectedAttributes,
      total: this.selectedAttributes.length
    };
  }
}