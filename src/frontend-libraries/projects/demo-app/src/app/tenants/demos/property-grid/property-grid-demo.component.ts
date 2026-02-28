import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { gearIcon, cloudIcon, saveIcon } from '@progress/kendo-svg-icons';

import {
  PropertyGridComponent,
  PropertyGridItem,
  PropertyGridConfig,
  PropertyChangeEvent,
  PropertyConverterService,
  AttributeValueTypeDto
} from '@meshmakers/octo-ui';
import { firstValueFrom, take } from 'rxjs';
import {GetRuntimeEntityByIdDtoGQL} from '../../../graphQL/getRuntimeEntityById';

interface DemoEntity {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdDate: Date;
  priority: number;
  tags: string[];
  config: {
    maxRetries: number;
    timeout: number;
    enabled: boolean;
  };
}

@Component({
  selector: 'app-property-grid-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    LayoutModule,
    SVGIconModule,
    PropertyGridComponent
  ],
  providers: [PropertyConverterService],
  template: `
    <div class="property-grid-demo">

      <kendo-card class="demo-card" width="100%">
        <kendo-card-header>
          <div class="card-header">
            <h2>Property Grid Demo</h2>
            <div class="demo-controls">
              <button kendoButton [primary]="true" [svgIcon]="refreshIcon" (click)="loadSampleData()">
                Load Sample Data
              </button>
              <button kendoButton [svgIcon]="refreshIcon" (click)="loadRuntimeEntity()">
                Load Runtime Entity
              </button>
              <button kendoButton [svgIcon]="settingsIcon" (click)="toggleMode()">
                {{ currentConfig.readOnlyMode ? 'Enable Edit' : 'Make Read-Only' }}
              </button>
            </div>
          </div>
        </kendo-card-header>

        <kendo-card-body>
          <div class="demo-content">

            <!-- Configuration Panel -->
            <div class="config-panel">
              <h3>Configuration Options</h3>
              <div class="config-options">
                <label>
                  <input type="checkbox" [(ngModel)]="currentConfig.showSearch" (change)="updateConfig()">
                  Show Search
                </label>
                <label>
                  <input type="checkbox" [(ngModel)]="showTypeColumn" (change)="updateConfig()">
                  Show Type Column
                </label>
                <label>
                  <input type="checkbox" [(ngModel)]="currentConfig.showTypeIcons" (change)="updateConfig()">
                  Show Type Icons
                </label>
              </div>
            </div>

            <!-- Property Grid -->
            <div class="grid-container">
              <mm-property-grid
                [data]="propertyData"
                [config]="currentConfig"
                [showTypeColumn]="showTypeColumn"
                (propertyChange)="onPropertyChange($event)"
                (saveRequested)="onSaveRequested($event)">
              </mm-property-grid>
            </div>

            <!-- Change Log -->
            @if (changeLog.length > 0) {
              <div class="change-log">
                <h3>Change Log</h3>
                <div class="log-entries">
                  @for (change of changeLog; track change.timestamp) {
                    <div class="log-entry">
                      <span class="timestamp">{{ change.timestamp | date:'short' }}</span>
                      <span class="property">{{ change.property }}</span>
                      <span class="change">{{ change.oldValue }} → {{ change.newValue }}</span>
                    </div>
                  }
                </div>
                <button kendoButton [fillMode]="'outline'" (click)="clearLog()">Clear Log</button>
              </div>
            }

          </div>
        </kendo-card-body>
      </kendo-card>

    </div>
  `,
  styles: [`
    .property-grid-demo {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .demo-card {
      width: 100%;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .demo-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .demo-content {
      display: grid;
      grid-template-columns: 300px 1fr;
      grid-template-rows: auto auto;
      gap: 24px;
      grid-template-areas:
        "config grid"
        "log grid";
    }

    .config-panel {
      grid-area: config;
      padding: 16px;
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
      height: fit-content;
    }

    .config-panel h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
    }

    .config-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .config-options label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .grid-container {
      grid-area: grid;
      min-height: 500px;
      border-radius: 4px;
      overflow: hidden;
    }

    .change-log {
      grid-area: log;
      padding: 16px;
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
      max-height: 300px;
      overflow: auto;
    }

    .change-log h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
    }

    .log-entries {
      margin-bottom: 12px;
    }

    .log-entry {
      display: grid;
      grid-template-columns: 120px 1fr 1fr;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--kendo-color-border);
      font-size: 12px;
    }

    .timestamp {
      color: var(--kendo-color-subtle);
    }

    .property {
      font-weight: 500;
    }

    .change {
      font-family: monospace;
    }

    @media (max-width: 1024px) {
      .demo-content {
        grid-template-columns: 1fr;
        grid-template-areas:
          "config"
          "grid"
          "log";
      }
    }
  `]
})
export class PropertyGridDemoComponent implements OnInit {

  private readonly propertyConverter = inject(PropertyConverterService);
  private readonly getRuntimeEntityByIdDtoGQL = inject(GetRuntimeEntityByIdDtoGQL);

  // Component state
  propertyData: PropertyGridItem[] = [];
  showTypeColumn = false;

  currentConfig: PropertyGridConfig = {
    readOnlyMode: false,
    showSearch: true,
    showTypeIcons: true,
    height: '800px'
  };

  changeLog: {
    timestamp: Date;
    property: string;
    oldValue: string;
    newValue: string;
  }[] = [];

  // Icons
  readonly settingsIcon = gearIcon;
  readonly refreshIcon = cloudIcon;
  readonly saveIcon = saveIcon;

  ngOnInit() {
    this.loadSampleData();
  }

  /**
   * Load sample data for demonstration
   */
  loadSampleData() {
    const sampleEntity: DemoEntity = {
      id: 'demo-001',
      name: 'Sample Configuration',
      description: 'This is a sample entity to demonstrate the property grid functionality',
      isActive: true,
      createdDate: new Date(),
      priority: 5,
      tags: ['demo', 'sample', 'test'],
      config: {
        maxRetries: 3,
        timeout: 5000,
        enabled: true
      }
    };

    // Convert object to properties using the converter service
    const objectProperties = this.propertyConverter.convertObjectToProperties(sampleEntity as unknown as Record<string, unknown>, 'Demo Entity');

    // Add some custom properties to demonstrate different types including complex records
    const customProperties: PropertyGridItem[] = [
      {
        id: 'custom_enum',
        name: 'status',
        displayName: 'Status',
        value: 'active',
        type: AttributeValueTypeDto.EnumDto,
        category: 'Demo Entity',
        description: 'Current status of the entity',
        readOnly: false
      },
      {
        id: 'custom_binary',
        name: 'avatar',
        displayName: 'Avatar',
        value: new ArrayBuffer(1024),
        type: AttributeValueTypeDto.BinaryDto,
        category: 'Demo Entity',
        description: 'User avatar image',
        readOnly: true
      },
      {
        id: 'custom_timespan',
        name: 'duration',
        displayName: 'Duration',
        value: '00:15:30',
        type: AttributeValueTypeDto.TimeSpanDto,
        category: 'Demo Entity',
        description: 'Processing duration',
        readOnly: false
      },
      {
        id: 'complex_record',
        name: 'userProfile',
        displayName: 'User Profile',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          isActive: true,
          lastLogin: '2024-01-15T10:30:00Z',
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: true
          },
          roles: ['admin', 'user']
        },
        type: AttributeValueTypeDto.RecordDto,
        category: 'Demo Entity',
        description: 'Complex user profile object',
        readOnly: false
      },
      {
        id: 'record_array',
        name: 'addresses',
        displayName: 'Addresses',
        value: [
          {
            type: 'home',
            street: '123 Main St',
            city: 'Anytown',
            country: 'USA',
            isDefault: true
          },
          {
            type: 'work',
            street: '456 Business Ave',
            city: 'Corporate City',
            country: 'USA',
            isDefault: false
          }
        ],
        type: AttributeValueTypeDto.RecordArrayDto,
        category: 'Demo Entity',
        description: 'Array of address objects',
        readOnly: false
      }
    ];

    this.propertyData = [...objectProperties, ...customProperties];
  }

  /**
   * Load actual runtime entity from OctoMesh
   */
  async loadRuntimeEntity() {
    try {
      const result = await firstValueFrom(this.getRuntimeEntityByIdDtoGQL.fetch({variables: { ckTypeId: 'Basic/Document' }}));
      const entities = result.data?.runtime?.runtimeEntities?.items;

      if (entities && entities.length > 0) {
        const entity = entities[0];
        if (!entity) return;
        this.propertyConverter.convertRtEntityToProperties(entity as never).pipe(
          take(1)
        ).subscribe({
          next: (data) => {
            this.propertyData = data;
            this.addLogEntry('System', 'Loaded runtime entity', entity?.rtId || 'unknown');
          },
          error: (err) => {
            console.error('Error converting entity:', err);
            this.addLogEntry('System', 'Error converting entity', err.message || String(err));
          }
        });
      } else {
        this.addLogEntry('System', 'No runtime entities found', 'empty');
      }
    } catch (error) {
      console.error('Error loading runtime entity:', error);
      this.addLogEntry('System', 'Error loading entity', String(error));
    }
  }

  /**
   * Toggle between read-only and edit mode
   */
  toggleMode() {
    this.currentConfig = {
      ...this.currentConfig,
      readOnlyMode: !this.currentConfig.readOnlyMode
    };
    this.addLogEntry('Config', 'Read-only mode', this.currentConfig.readOnlyMode ? 'enabled' : 'disabled');
  }

  /**
   * Update configuration
   */
  updateConfig() {
    // Configuration is already updated via two-way binding
    this.addLogEntry('Config', 'Configuration updated', 'applied');
  }

  /**
   * Handle property changes
   */
  onPropertyChange(event: PropertyChangeEvent) {
    this.addLogEntry(
      event.property.displayName || event.property.name,
      String(event.oldValue),
      String(event.newValue)
    );
  }

  /**
   * Handle save requests
   */
  onSaveRequested(updatedData: PropertyGridItem[]) {
    console.log('Saving updated data:', updatedData);
    this.propertyData = updatedData;
    this.addLogEntry('System', 'Data saved', `${updatedData.length} properties`);
  }

  /**
   * Add entry to change log
   */
  private addLogEntry(property: string, oldValue: string, newValue: string) {
    this.changeLog.unshift({
      timestamp: new Date(),
      property,
      oldValue,
      newValue
    });

    // Keep only last 20 entries
    if (this.changeLog.length > 20) {
      this.changeLog = this.changeLog.slice(0, 20);
    }
  }

  /**
   * Clear change log
   */
  clearLog() {
    this.changeLog = [];
  }
}
