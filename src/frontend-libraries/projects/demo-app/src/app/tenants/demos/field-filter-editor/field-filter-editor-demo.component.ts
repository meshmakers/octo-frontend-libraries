import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { FieldFilterEditorComponent, FieldFilterItem } from '@meshmakers/octo-ui';
import {
  FieldFilterDto,
  FieldFilterOperatorsDto,
  AttributeSelectorService,
  AttributeItem
} from '@meshmakers/octo-services';

@Component({
  selector: 'app-field-filter-editor-demo',
  standalone: true,
  imports: [
    CommonModule,
    ButtonsModule,
    FieldFilterEditorComponent
  ],
  template: `
    <div class="demo-container">
      <h2>Field Filter Editor Demo</h2>

      <div class="description">
        <p>
          The Field Filter Editor component allows you to create and manage multiple field filters
          for querying data. Each filter consists of an attribute path, an operator, and a comparison value.
          The input field type adapts based on the attribute's data type (text, number, boolean, datetime).
        </p>
      </div>

      <div class="section">
        <h3>Basic Usage</h3>
        <mm-field-filter-editor
          [(filters)]="filters"
          [availableAttributes]="availableAttributes">
        </mm-field-filter-editor>
      </div>

      <div class="section">
        <h3>Actions</h3>
        <div class="actions">
          <button kendoButton (click)="loadSampleFilters()">
            Load Sample Filters
          </button>
          <button kendoButton (click)="clearFilters()">
            Clear All
          </button>
          <button kendoButton themeColor="primary" (click)="applyFilters()">
            Apply Filters
          </button>
        </div>
      </div>

      <div class="section">
        <h3>Current Filters ({{ filters.length }})</h3>
        <div class="output">
          <pre>{{ getFiltersJson() }}</pre>
        </div>
      </div>

      <div class="section">
        <h3>Field Filter DTOs (for GraphQL)</h3>
        <div class="output">
          <pre>{{ getFieldFilterDtosJson() }}</pre>
        </div>
      </div>

      <div class="instructions">
        <h3>Instructions</h3>
        <ul>
          <li>Click "Add Filter" to create a new filter row</li>
          <li>Select an attribute from the dropdown - the type is shown next to the name</li>
          <li>The value input adapts to the attribute type:
            <ul>
              <li><strong>String</strong>: Text input</li>
              <li><strong>Number (Int, Double)</strong>: Numeric input with spinners</li>
              <li><strong>Boolean</strong>: Dropdown with true/false</li>
              <li><strong>DateTime</strong>: Date/time picker</li>
            </ul>
          </li>
          <li>For "In" or "Not In" operators, enter comma-separated values</li>
          <li>Use checkboxes to select multiple rows, then click "Remove Selected"</li>
        </ul>

        <h4>Supported Operators</h4>
        <ul>
          <li><strong>Equals / Not Equals</strong>: Exact match comparison</li>
          <li><strong>Greater/Less Than</strong>: Numeric or date comparisons</li>
          <li><strong>Like</strong>: Pattern matching with * wildcard</li>
          <li><strong>In / Not In</strong>: Check if value is in a list</li>
          <li><strong>Any Equals / Any Like</strong>: Array field comparisons</li>
          <li><strong>Match RegEx</strong>: Regular expression matching</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1200px;
    }

    .description {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .description p {
      margin: 0;
    }

    .section {
      margin-bottom: 30px;
    }

    .section h3 {
      margin-bottom: 15px;
      color: #333;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .output {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
    }

    .output pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      white-space: pre-wrap;
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

    .instructions h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      color: #1976d2;
    }

    .instructions ul {
      margin-bottom: 0;
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 8px;
    }
  `]
})
export class FieldFilterEditorDemoComponent implements OnInit {
  private readonly attributeService = inject(AttributeSelectorService);

  public filters: FieldFilterItem[] = [];
  public availableAttributes: AttributeItem[] = [];

  private readonly sampleCkTypeId = 'System.Identity/User';

  ngOnInit(): void {
    this.loadAvailableAttributes();
  }

  private loadAvailableAttributes(): void {
    this.attributeService.getAvailableAttributes(this.sampleCkTypeId).subscribe({
      next: (result) => {
        this.availableAttributes = result.items;
      },
      error: (err) => {
        console.warn('Could not load attributes from backend, using sample data:', err);
        this.availableAttributes = [
          { attributePath: 'rtWellKnownName', attributeValueType: 'STRING' },
          { attributePath: 'userName', attributeValueType: 'STRING' },
          { attributePath: 'email', attributeValueType: 'STRING' },
          { attributePath: 'firstName', attributeValueType: 'STRING' },
          { attributePath: 'lastName', attributeValueType: 'STRING' },
          { attributePath: 'isActive', attributeValueType: 'BOOLEAN' },
          { attributePath: 'createdDate', attributeValueType: 'DATE_TIME' },
          { attributePath: 'age', attributeValueType: 'INT' },
          { attributePath: 'salary', attributeValueType: 'DOUBLE' },
          { attributePath: 'department', attributeValueType: 'STRING' }
        ];
      }
    });
  }

  public loadSampleFilters(): void {
    this.filters = [
      {
        id: 1,
        attributePath: 'userName',
        operator: FieldFilterOperatorsDto.LikeDto,
        comparisonValue: 'admin*'
      },
      {
        id: 2,
        attributePath: 'isActive',
        operator: FieldFilterOperatorsDto.EqualsDto,
        comparisonValue: 'true'
      },
      {
        id: 3,
        attributePath: 'department',
        operator: FieldFilterOperatorsDto.InDto,
        comparisonValue: '[IT, Sales, Marketing]'
      }
    ];
  }

  public clearFilters(): void {
    this.filters = [];
  }

  public applyFilters(): void {
    const fieldFilters = this.getFieldFilterDtos();
    console.log('Applying filters:', fieldFilters);
    alert(`Applying ${fieldFilters.length} filter(s). Check console for details.`);
  }

  public getFiltersJson(): string {
    return JSON.stringify(this.filters, null, 2);
  }

  public getFieldFilterDtos(): FieldFilterDto[] {
    return this.filters
      .filter(f => f.attributePath && f.attributePath.trim() !== '')
      .map(f => ({
        attributePath: f.attributePath,
        operator: f.operator,
        comparisonValue: f.comparisonValue
      }));
  }

  public getFieldFilterDtosJson(): string {
    return JSON.stringify(this.getFieldFilterDtos(), null, 2);
  }
}
