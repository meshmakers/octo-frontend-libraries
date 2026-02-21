import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntityWithAssociationsWidgetConfig, RuntimeEntityData, EntityAssociation } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { arrowRightIcon, arrowLeftIcon, linkIcon, chevronDownIcon, chevronRightIcon } from '@progress/kendo-svg-icons';
import { catchError, of } from 'rxjs';
import { EntityDetailDialogComponent } from './entity-detail-dialog.component';

interface GroupedAssociation {
  roleId: string;
  roleName: string;
  targetType: string;
  direction: 'in' | 'out';
  count: number;
  associations: EntityAssociation[];
  isExpanded: boolean;
}

interface TargetEntity {
  rtId: string;
  ckTypeId: string;
  displayName: string;
}

@Component({
  selector: 'mm-entity-associations-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, EntityDetailDialogComponent, WidgetNotConfiguredComponent],
  templateUrl: './entity-associations-widget.component.html',
  styleUrl: './entity-associations-widget.component.scss'
})
export class EntityAssociationsWidgetComponent implements DashboardWidget<EntityWithAssociationsWidgetConfig, RuntimeEntityData>, OnInit, OnChanges {
  private readonly dataService = inject(DashboardDataService);

  @Input() config!: EntityWithAssociationsWidgetConfig;

  protected readonly arrowRightIcon = arrowRightIcon;
  protected readonly arrowLeftIcon = arrowLeftIcon;
  protected readonly linkIcon = linkIcon;
  protected readonly chevronDownIcon = chevronDownIcon;
  protected readonly chevronRightIcon = chevronRightIcon;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<RuntimeEntityData | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _expandedGroups = signal<Set<string>>(new Set());

  // Detail dialog state
  protected showDetailDialog = false;
  protected detailEntityRtId = '';
  protected detailEntityCkTypeId = '';

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;
    if (dataSource.type === 'runtimeEntity') {
      return !dataSource.rtId && !dataSource.ckTypeId;
    }
    if (dataSource.type === 'static') {
      return false; // Static data is always "configured"
    }
    return false;
  }

  readonly entityName = computed(() => {
    const data = this._data();
    if (!data?.ckTypeId) return 'Entity';
    const parts = data.ckTypeId.split('/');
    return parts[parts.length - 1];
  });

  readonly entityRtId = computed(() => {
    return this._data()?.rtId ?? '';
  });

  readonly entityCkTypeId = computed(() => {
    return this._data()?.ckTypeId ?? '';
  });

  readonly displayMode = computed(() => {
    return this.config?.displayMode ?? 'expandable';
  });

  readonly groupedAssociations = computed(() => {
    const data = this._data();
    if (!data?.associations) return [];

    const showIncoming = this.config?.showIncoming ?? true;
    const showOutgoing = this.config?.showOutgoing ?? true;
    const roleFilter = this.config?.roleFilter ?? [];
    const sourceRtId = data.rtId;

    const grouped = new Map<string, GroupedAssociation>();

    for (const assoc of data.associations) {
      // Determine direction based on origin vs target
      const isOutgoing = assoc.originRtId === sourceRtId;
      const direction: 'in' | 'out' = isOutgoing ? 'out' : 'in';

      // Apply direction filter
      if (direction === 'in' && !showIncoming) continue;
      if (direction === 'out' && !showOutgoing) continue;

      // Apply role filter
      if (roleFilter.length > 0 && !roleFilter.includes(assoc.ckAssociationRoleId)) {
        continue;
      }

      const targetCkTypeId = isOutgoing ? assoc.targetCkTypeId : assoc.originCkTypeId;
      const key = `${direction}-${assoc.ckAssociationRoleId}-${targetCkTypeId}`;

      if (!grouped.has(key)) {
        const targetParts = targetCkTypeId.split('/');
        grouped.set(key, {
          roleId: assoc.ckAssociationRoleId,
          roleName: this.formatRoleName(assoc.ckAssociationRoleId),
          targetType: targetParts[targetParts.length - 1],
          direction,
          count: 0,
          associations: [],
          isExpanded: this._expandedGroups().has(key)
        });
      }

      const group = grouped.get(key)!;
      group.count++;
      group.associations.push(assoc);
    }

    let result = Array.from(grouped.values());

    // Sort: outgoing first, then by role name
    result.sort((a, b) => {
      if (a.direction !== b.direction) {
        return a.direction === 'out' ? -1 : 1;
      }
      return a.roleName.localeCompare(b.roleName);
    });

    if (this.config?.maxAssociations) {
      result = result.slice(0, this.config.maxAssociations);
    }

    return result;
  });

  readonly totalAssociations = computed(() => {
    return this.groupedAssociations().reduce((sum, g) => sum + g.count, 0);
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadData();
    }
  }

  refresh(): void {
    this.loadData();
  }

  protected toggleGroup(group: GroupedAssociation): void {
    if (this.displayMode() !== 'expandable') return;

    const key = `${group.direction}-${group.roleId}-${group.targetType}`;
    const expanded = new Set(this._expandedGroups());

    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }

    this._expandedGroups.set(expanded);

    // Update the group's expanded state
    group.isExpanded = expanded.has(key);
  }

  protected isGroupExpanded(group: GroupedAssociation): boolean {
    const key = `${group.direction}-${group.roleId}-${group.targetType}`;
    return this._expandedGroups().has(key);
  }

  protected getTargetEntities(group: GroupedAssociation): TargetEntity[] {
    const sourceRtId = this._data()?.rtId;
    return group.associations.map(assoc => {
      const isOutgoing = assoc.originRtId === sourceRtId;
      const rtId = isOutgoing ? assoc.targetRtId : assoc.originRtId;
      const ckTypeId = isOutgoing ? assoc.targetCkTypeId : assoc.originCkTypeId;
      return {
        rtId,
        ckTypeId,
        displayName: rtId // Could be enhanced with wellKnownName if available
      };
    });
  }

  protected onTargetClick(target: TargetEntity): void {
    this.detailEntityRtId = target.rtId;
    this.detailEntityCkTypeId = target.ckTypeId;
    this.showDetailDialog = true;
  }

  protected onDetailDialogClosed(): void {
    this.showDetailDialog = false;
    this.detailEntityRtId = '';
    this.detailEntityCkTypeId = '';
  }

  private loadData(): void {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    const dataSource = this.config.dataSource;

    if (dataSource.type === 'static') {
      const staticData = dataSource.data as RuntimeEntityData;
      this._data.set(staticData);
      this._error.set(null);
      return;
    }

    // Note: isNotConfigured() check ensures rtId and ckTypeId are set
    if (dataSource.type === 'runtimeEntity') {
      this._isLoading.set(true);
      this._error.set(null);

      this.dataService.fetchEntityWithAssociations(dataSource.rtId!, dataSource.ckTypeId!)
        .pipe(
          catchError(err => {
            console.error('Error loading associations data:', err);
            this._error.set('Failed to load data');
            return of(null);
          })
        )
        .subscribe(entityData => {
          this._data.set(entityData);
          this._isLoading.set(false);
        });
    }
  }

  private formatRoleName(roleId: string): string {
    // Extract the last part after the last '/'
    const parts = roleId.split('/');
    const name = parts[parts.length - 1];

    // Convert camelCase/PascalCase to space-separated
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
