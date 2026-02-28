import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import {
  CkTypeSelectorDialogService,
  CkTypeSelectorResult,
  CkTypeSelectorInputComponent
} from '@meshmakers/octo-ui';
import { CkTypeSelectorItem } from '@meshmakers/octo-services';

@Component({
  selector: 'app-ck-type-selector-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    CkTypeSelectorInputComponent
  ],
  providers: [
    CkTypeSelectorDialogService
  ],
  template: `
    <div class="demo-container">
      <h2>CkType Selector Demo</h2>

      <div class="demo-section">
        <h3>Input Component</h3>
        <p>Use the input component for inline type selection with autocomplete and dialog support.</p>

        <div class="input-demo-row">
          <label>Select CK Type:</label>
          <mm-ck-type-selector-input
            [(ngModel)]="inputSelectedType"
            [allowAbstract]="false"
            placeholder="Search for a type..."
            dialogTitle="Select Construction Kit Type"
            (ckTypeSelected)="onInputTypeSelected($event)"
            (ckTypeCleared)="onInputTypeCleared()">
          </mm-ck-type-selector-input>
        </div>

        <div class="result-display" *ngIf="inputSelectedType">
          <h4>Selected Type (via Input):</h4>
          <div class="type-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ inputSelectedType.rtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Full Name:</span>
              <span class="value monospace">{{ inputSelectedType.fullName }}</span>
            </div>
            <div class="info-row" *ngIf="inputSelectedType.baseTypeRtCkTypeId">
              <span class="label">Base Type:</span>
              <span class="value">{{ inputSelectedType.baseTypeRtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Flags:</span>
              <span class="value">
                <span *ngIf="inputSelectedType.isAbstract" class="badge abstract">abstract</span>
                <span *ngIf="inputSelectedType.isFinal" class="badge final">final</span>
                <span *ngIf="!inputSelectedType.isAbstract && !inputSelectedType.isFinal" class="badge normal">normal</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Input with Model Filter</h3>
        <p>Input component pre-filtered to a specific model.</p>

        <div class="controls">
          <kendo-textbox
            [(ngModel)]="inputModelFilter"
            placeholder="Enter model ID (e.g., System-1.0.0)"
            class="model-input">
          </kendo-textbox>
        </div>

        <div class="input-demo-row" *ngIf="inputModelFilter">
          <label>Select Type from Model:</label>
          <mm-ck-type-selector-input
            [(ngModel)]="inputFilteredSelectedType"
            [ckModelIds]="[inputModelFilter]"
            [allowAbstract]="false"
            placeholder="Search in model..."
            [dialogTitle]="'Select Type from ' + inputModelFilter">
          </mm-ck-type-selector-input>
        </div>

        <div class="result-display" *ngIf="inputFilteredSelectedType">
          <h4>Selected Type:</h4>
          <div class="type-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ inputFilteredSelectedType.rtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Full Name:</span>
              <span class="value monospace">{{ inputFilteredSelectedType.fullName }}</span>
            </div>
          </div>
        </div>
      </div>

      <hr class="section-divider">
      <h2>Dialog-Only Usage</h2>

      <div class="demo-section">
        <h3>Basic Dialog</h3>
        <p>Open a dialog to select a Construction Kit Type from all available types.</p>

        <div class="controls">
          <button
            kendoButton
            themeColor="primary"
            (click)="openBasicSelector()">
            Select CkType
          </button>
        </div>

        <div class="result-display" *ngIf="basicSelectedType">
          <h4>Selected Type:</h4>
          <div class="type-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ basicSelectedType.rtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Full Name:</span>
              <span class="value monospace">{{ basicSelectedType.fullName }}</span>
            </div>
            <div class="info-row" *ngIf="basicSelectedType.baseTypeRtCkTypeId">
              <span class="label">Base Type:</span>
              <span class="value">{{ basicSelectedType.baseTypeRtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Flags:</span>
              <span class="value">
                <span *ngIf="basicSelectedType.isAbstract" class="badge abstract">abstract</span>
                <span *ngIf="basicSelectedType.isFinal" class="badge final">final</span>
                <span *ngIf="!basicSelectedType.isAbstract && !basicSelectedType.isFinal" class="badge normal">normal</span>
              </span>
            </div>
            <div class="info-row" *ngIf="basicSelectedType.description">
              <span class="label">Description:</span>
              <span class="value">{{ basicSelectedType.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>With Model Filter</h3>
        <p>Open a dialog pre-filtered to a specific model.</p>

        <div class="controls">
          <kendo-textbox
            [(ngModel)]="modelFilter"
            placeholder="Enter model ID (e.g., System-1.0.0)"
            class="model-input">
          </kendo-textbox>
          <button
            kendoButton
            themeColor="primary"
            (click)="openFilteredSelector()"
            [disabled]="!modelFilter">
            Select from Model
          </button>
        </div>

        <div class="result-display" *ngIf="filteredSelectedType">
          <h4>Selected Type:</h4>
          <div class="type-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ filteredSelectedType.rtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Full Name:</span>
              <span class="value monospace">{{ filteredSelectedType.fullName }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Allow Abstract Types</h3>
        <p>Open a dialog that allows selecting abstract types (normally disabled).</p>

        <div class="controls">
          <button
            kendoButton
            themeColor="primary"
            (click)="openAbstractSelector()">
            Select (Allow Abstract)
          </button>
        </div>

        <div class="result-display" *ngIf="abstractSelectedType">
          <h4>Selected Type:</h4>
          <div class="type-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">{{ abstractSelectedType.rtCkTypeId }}</span>
            </div>
            <div class="info-row">
              <span class="label">Is Abstract:</span>
              <span class="value">{{ abstractSelectedType.isAbstract ? 'Yes' : 'No' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="demo-section">
        <h3>Last Action Result</h3>
        <div class="action-result" *ngIf="lastActionResult">
          <div class="info-row">
            <span class="label">Confirmed:</span>
            <span class="value" [class.confirmed]="lastActionResult.confirmed" [class.cancelled]="!lastActionResult.confirmed">
              {{ lastActionResult.confirmed ? 'Yes (OK clicked)' : 'No (Cancelled)' }}
            </span>
          </div>
          <div class="info-row" *ngIf="lastActionResult.selectedCkType">
            <span class="label">Selected CkTypeId:</span>
            <span class="value monospace">{{ lastActionResult.selectedCkType.fullName }}</span>
          </div>
        </div>
        <div class="no-result" *ngIf="!lastActionResult">
          No action performed yet. Click one of the buttons above.
        </div>
      </div>

      <div class="instructions">
        <h3>Instructions</h3>
        <ul>
          <li>Click "Select CkType" to open the type selector dialog</li>
          <li>Use the <strong>Model Filter</strong> dropdown to filter types by model</li>
          <li>Use the <strong>Type Search</strong> textbox to search for specific types</li>
          <li>Click on a row in the grid to select a type</li>
          <li>Abstract types are shown with a yellow "abstract" badge and are disabled by default</li>
          <li>Final types are shown with a green "final" badge</li>
          <li>Use the pagination controls to navigate through large lists</li>
          <li>Click OK to confirm selection or Cancel to discard</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1000px;
    }

    .demo-section {
      margin-bottom: 30px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #fafafa;
    }

    .demo-section h3 {
      margin-top: 0;
      color: var(--kendo-color-primary, #ff6358);
      border-bottom: 2px solid var(--kendo-color-primary, #ff6358);
      padding-bottom: 8px;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .model-input {
      width: 300px;
    }

    .result-display {
      margin-top: 16px;
      padding: 16px;
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 4px;
    }

    .result-display h4 {
      margin: 0 0 12px 0;
      color: #2e7d32;
    }

    .type-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .info-row .label {
      font-weight: 600;
      min-width: 120px;
      color: #555;
    }

    .info-row .value {
      color: #333;
    }

    .info-row .value.monospace {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .info-row .value.confirmed {
      color: #2e7d32;
      font-weight: 600;
    }

    .info-row .value.cancelled {
      color: #c62828;
      font-weight: 600;
    }

    .badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .badge.abstract {
      background-color: #fff3cd;
      color: #856404;
    }

    .badge.final {
      background-color: #d4edda;
      color: #155724;
    }

    .badge.normal {
      background-color: #e2e3e5;
      color: #383d41;
    }

    .action-result {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
    }

    .no-result {
      color: #666;
      font-style: italic;
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

    .input-demo-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .input-demo-row label {
      font-weight: 600;
      color: #555;
    }

    .input-demo-row mm-ck-type-selector-input {
      max-width: 500px;
    }

    .section-divider {
      margin: 40px 0;
      border: none;
      border-top: 2px solid #e0e0e0;
    }
  `]
})
export class CkTypeSelectorDemoComponent {
  private readonly ckTypeSelectorService = inject(CkTypeSelectorDialogService);

  // Input component state
  public inputSelectedType: CkTypeSelectorItem | null = null;
  public inputFilteredSelectedType: CkTypeSelectorItem | null = null;
  public inputModelFilter = '';

  // Dialog state
  public basicSelectedType: CkTypeSelectorItem | null = null;
  public filteredSelectedType: CkTypeSelectorItem | null = null;
  public abstractSelectedType: CkTypeSelectorItem | null = null;
  public lastActionResult: CkTypeSelectorResult | null = null;

  public modelFilter = '';

  // Input component event handlers
  public onInputTypeSelected(ckType: CkTypeSelectorItem): void {
    console.log('Input: CkType selected:', ckType);
  }

  public onInputTypeCleared(): void {
    console.log('Input: CkType cleared');
  }

  public async openBasicSelector(): Promise<void> {
    try {
      const result = await this.ckTypeSelectorService.openCkTypeSelector({
        dialogTitle: 'Select Construction Kit Type'
      });

      this.lastActionResult = result;

      if (result.confirmed && result.selectedCkType) {
        this.basicSelectedType = result.selectedCkType;
        console.log('Selected CkType:', result.selectedCkType);
      }
    } catch (error) {
      console.error('Error opening CkType selector:', error);
    }
  }

  public async openFilteredSelector(): Promise<void> {
    if (!this.modelFilter) {
      return;
    }

    try {
      const result = await this.ckTypeSelectorService.openCkTypeSelector({
        ckModelIds: [this.modelFilter],
        dialogTitle: `Select Type from ${this.modelFilter}`
      });

      this.lastActionResult = result;

      if (result.confirmed && result.selectedCkType) {
        this.filteredSelectedType = result.selectedCkType;
        console.log('Selected CkType (filtered):', result.selectedCkType);
      }
    } catch (error) {
      console.error('Error opening filtered CkType selector:', error);
    }
  }

  public async openAbstractSelector(): Promise<void> {
    try {
      const result = await this.ckTypeSelectorService.openCkTypeSelector({
        dialogTitle: 'Select Type (Abstract Allowed)',
        allowAbstract: true
      });

      this.lastActionResult = result;

      if (result.confirmed && result.selectedCkType) {
        this.abstractSelectedType = result.selectedCkType;
        console.log('Selected CkType (abstract allowed):', result.selectedCkType);
      }
    } catch (error) {
      console.error('Error opening abstract CkType selector:', error);
    }
  }
}
