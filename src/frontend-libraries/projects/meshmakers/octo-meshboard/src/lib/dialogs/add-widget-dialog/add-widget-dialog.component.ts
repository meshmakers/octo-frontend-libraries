import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  chartLineIcon,
  chartPieIcon,
  chartColumnStackedIcon,
  tableIcon,
  fileTxtIcon,
  shareIcon,
  heartIcon,
  chartDoughnutIcon,
  gridLayoutIcon,
  checkCircleIcon,
  copyIcon,
  SVGIcon
} from '@progress/kendo-svg-icons';

import { WidgetRegistryService } from '../../services/widget-registry.service';
import { WidgetType } from '../../models/meshboard.models';

/**
 * Widget type info for display in the dialog.
 */
interface WidgetTypeInfo {
  type: WidgetType;
  label: string;
  description: string;
  icon: SVGIcon;
}

/**
 * Dialog for selecting a widget type to add to the MeshBoard.
 */
@Component({
  selector: 'mm-add-widget-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    SVGIconModule
  ],
  templateUrl: './add-widget-dialog.component.html',
  styleUrl: './add-widget-dialog.component.scss'
})
export class AddWidgetDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef);
  private readonly widgetRegistry = inject(WidgetRegistryService);

  // Icons
  protected readonly checkCircleIcon = checkCircleIcon;

  // State
  protected readonly widgetTypes = signal<WidgetTypeInfo[]>([]);
  protected readonly selectedType = signal<WidgetType | null>(null);

  ngOnInit(): void {
    // Load available widget types from registry
    const registeredWidgets = this.widgetRegistry.getRegisteredWidgets();

    const widgetTypeInfos: WidgetTypeInfo[] = registeredWidgets.map(widget => ({
      type: widget.type,
      label: widget.label,
      description: this.getWidgetDescription(widget.type),
      icon: this.getWidgetIcon(widget.type)
    }));

    this.widgetTypes.set(widgetTypeInfos);
  }

  /**
   * Gets the icon for a widget type.
   */
  private getWidgetIcon(type: WidgetType): SVGIcon {
    switch (type) {
      case 'entityCard':
        return fileTxtIcon;
      case 'entityWithAssociations':
        return shareIcon;
      case 'kpi':
        return heartIcon;
      case 'table':
        return tableIcon;
      case 'gauge':
        return chartDoughnutIcon;
      case 'pieChart':
        return chartPieIcon;
      case 'barChart':
        return chartColumnStackedIcon;
      case 'statsGrid':
        return gridLayoutIcon;
      case 'statusIndicator':
        return checkCircleIcon;
      case 'serviceHealth':
        return heartIcon;
      case 'widgetGroup':
        return copyIcon;
      case 'process':
        return chartLineIcon;
      default:
        return chartLineIcon;
    }
  }

  /**
   * Gets the description for a widget type.
   */
  private getWidgetDescription(type: WidgetType): string {
    switch (type) {
      case 'entityCard':
        return 'Display a single entity with its attributes in a card layout';
      case 'entityWithAssociations':
        return 'Display an entity with its associated relationships';
      case 'kpi':
        return 'Display a single key performance indicator or metric';
      case 'table':
        return 'Display multiple entities in a table with sorting and filtering';
      case 'gauge':
        return 'Visualize a numeric value as a gauge (arc, circular, linear, or radial)';
      case 'pieChart':
        return 'Display data distribution as a pie or donut chart';
      case 'barChart':
        return 'Display data as vertical or horizontal bars';
      case 'statsGrid':
        return 'Display multiple KPIs in a grid layout';
      case 'statusIndicator':
        return 'Display a boolean status with visual indicator';
      case 'serviceHealth':
        return 'Display service health status with pulse animation';
      case 'widgetGroup':
        return 'Display a repeating group of child widgets from a query or CK type';
      case 'process':
        return 'Display and interact with process diagrams and HMI graphics';
      default:
        return 'Widget for displaying data';
    }
  }

  /**
   * Selects a widget type.
   */
  selectType(type: WidgetType): void {
    this.selectedType.set(type);
  }

  /**
   * Checks if a widget type is selected.
   */
  isSelected(type: WidgetType): boolean {
    return this.selectedType() === type;
  }

  /**
   * Adds the selected widget and closes the dialog.
   */
  add(): void {
    const selected = this.selectedType();
    if (selected) {
      this.dialogRef.close({ widgetType: selected });
    }
  }

  /**
   * Cancels and closes the dialog.
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
