import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { arrowLeftIcon } from '@progress/kendo-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { EntityDetailViewComponent } from './components/entity-detail-view.component';
import { EntityDetailDataSource } from './data-sources/entity-detail-data-source.service';
import { RtEntityDto } from './graphQL/globalTypes';
import { RtEntityId, RtEntityIdHelper } from './models/rt-entity-id';

@Component({
  selector: 'mm-entity-detail',
  imports: [
    CommonModule,
    ButtonModule,
    SVGIconModule,
    EntityDetailViewComponent,
  ],
  template: `
    <div class="entity-detail">
      <div class="entity-detail-header">
        <button
          kendoButton
          size="small"
          [svgIcon]="arrowLeftIcon"
          (click)="navigateBack()"
        >
          Back
        </button>

        @if (entity) {
          <div class="header-info">
            <div class="entity-title">
              <h2>{{ getEntityDisplayName() }}</h2>
              <p class="entity-type">{{ entity.ckTypeId }}</p>
            </div>
          </div>
        }
      </div>

      <mm-entity-detail-view
        [entity]="entity"
        [loading]="loading"
        [error]="error"
        (retry)="loadEntity()"
        (propertyChange)="onPropertyChange($event)"
        (navigateToEntity)="navigateToEntity($event.rtId, $event.ckTypeId)"
      >
      </mm-entity-detail-view>
    </div>
  `,
  styleUrls: ['./entity-detail.component.scss'],
})
export class EntityDetailComponent implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataSource = inject(EntityDetailDataSource);
  private readonly destroy$ = new Subject<void>();

  protected readonly arrowLeftIcon = arrowLeftIcon;

  entity: RtEntityDto | null = null;
  loading = false;
  error: string | null = null;
  entityId: RtEntityId | null = null;

  async ngOnInit(): Promise<void> {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (params) => {
        const encodedId = params['id'];
        if (encodedId) {
          try {
            this.entityId = RtEntityIdHelper.decode(encodedId);
            await this.loadEntity();
          } catch (error) {
            this.error = 'Invalid entity ID format';
            console.error('Failed to decode entity ID:', error);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadEntity(): Promise<void> {
    if (!this.entityId) {
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      this.entity = await this.dataSource.fetchEntityDetails(
        this.entityId.rtId,
        this.entityId.ckTypeId,
      );
      if (!this.entity) {
        this.error = 'Entity not found';
      }
    } catch (error) {
      console.error('Failed to load entity:', error);
      this.error = 'Failed to load entity details';
    } finally {
      this.loading = false;
    }
  }

  navigateBack(): void {
    this.location.back();
  }

  async navigateToEntity(rtId: string, ckTypeId: string): Promise<void> {
    if (!rtId || !ckTypeId || rtId === 'Unknown' || ckTypeId === 'Unknown')
      return;

    const encodedId = RtEntityIdHelper.encode(rtId, ckTypeId);
    // Navigate to another entity detail page
    const currentUrl = this.router.url;
    const newEntityUrl = currentUrl.replace(
      /\/browser\/entity\/[^/]+$/,
      `/browser/entity/${encodedId}`,
    );
    await this.router.navigateByUrl(newEntityUrl);
  }

  getEntityDisplayName(): string {
    if (!this.entity) return 'Unknown Entity';

    const nameAttr = this.entity.attributes?.items?.find(
      (attr) =>
        attr?.attributeName === 'name' || attr?.attributeName === 'displayName',
    );

    if (nameAttr?.value && typeof nameAttr.value === 'string') {
      return nameAttr.value;
    }

    return (
      this.entity.rtWellKnownName || this.entity.ckTypeId || 'Unknown Entity'
    );
  }

  /**
   * Handle property value changes from the property grid
   */
  onPropertyChange(event: unknown): void {
    console.debug('Property changed:', event);
    // TODO: Implement property change handling
    // This could be used to track modifications and enable save functionality
  }
}
