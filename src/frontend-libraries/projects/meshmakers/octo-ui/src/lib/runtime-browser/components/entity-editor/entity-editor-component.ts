import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { CkTypeDto, RtEntityInputDto } from "@meshmakers/octo-services";
import { TranslateService } from "@ngx-translate/core";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_DROPDOWNS } from "@progress/kendo-angular-dropdowns";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { CardModule } from "@progress/kendo-angular-layout";
import { NotificationService } from "@progress/kendo-angular-notification";
import { firstValueFrom } from "rxjs";
import { RUNTIME_BROWSER_KEYS } from "../../../../i18n/keys";
import { AppTranslatePipe } from "../../../i18n/translate.pipe";
import { CreateEntitiesDtoGQL } from "../../graphQL/createEntities";
import { FormAttributesServiceMapper } from "../../services/form-attributes-mapper";
import { FormAttributesService } from "../../services/form-attributes-service";
import { AttributesForm } from "../attributes-form/attributes-form";

@Component({
  selector: "mm-entity-editor-component",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule,
    AppTranslatePipe,
    AttributesForm,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
    KENDO_DROPDOWNS,
    KENDO_DATEINPUTS,
  ],
  template: `
    <div class="entity-editor-container">
      <kendo-card class="basic-info-card">
        <kendo-card-header>
          <h3 class="title">
            {{ RUNTIME_BROWSER_KEYS.CreateEntity | appTranslate }}
          </h3>
        </kendo-card-header>
        <kendo-card-body>
          <div class="info-item">
            <label>{{
              RUNTIME_BROWSER_KEYS.TargetLocation | appTranslate
            }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="
                parent?.text || (RUNTIME_BROWSER_KEYS.RootLevel | appTranslate)
              "
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{ RUNTIME_BROWSER_KEYS.EntityType | appTranslate }}</label>
            <kendo-dropdownlist
              [data]="availableCkTypes"
              textField="rtCkTypeId"
              valueField="rtCkTypeId"
              [valuePrimitive]="false"
              placeholder="Select Type..."
              (valueChange)="onTypeChange($event)"
            >
            </kendo-dropdownlist>
          </div>
        </kendo-card-body>
      </kendo-card>

      <div class="attributes-form-container">
        @if (newNodeCkId) {
          <mm-attributes-form
            [ckId]="newNodeCkId"
            [isRecord]="false"
            [parentFormGroup]="mainForm!"
          >
          </mm-attributes-form>
        } @else {
          <p class="select-type-prompt">
            {{ RUNTIME_BROWSER_KEYS.SelectTypePrompt | appTranslate }}
          </p>
        }
      </div>

      <div class="entity-editor-actions">
        <button
          kendoButton
          [disabled]="!isSaveButtonEnabled"
          (click)="onSave()"
        >
          {{ RUNTIME_BROWSER_KEYS.Save | appTranslate }}
        </button>
        <button kendoButton [disabled]="isSaving" (click)="cancelEdit.emit()">
          {{ RUNTIME_BROWSER_KEYS.Cancel | appTranslate }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ["./entity-editor-component.scss"],
})
export class EntityEditorComponent {
  // GraphQL
  private readonly createEntitiesGQL = inject(CreateEntitiesDtoGQL);
  private readonly formAttributesService = inject(FormAttributesService);
  private readonly formAttributesMapper = inject(FormAttributesServiceMapper);

  // Inputs
  @Input() parent: any | null = null;
  @Input() availableCkTypes: CkTypeDto[] = [];

  // Form
  protected mainForm: FormGroup | null = null;
  protected newNodeCkId: string | null = null;
  protected newNodeRtCkTypeId: string | null = null;

  private fb = inject(FormBuilder);

  // Services
  private readonly notificationService = inject(NotificationService);
  private readonly translation = inject(TranslateService);
  protected readonly RUNTIME_BROWSER_KEYS = RUNTIME_BROWSER_KEYS;

  // State
  protected isSaving = false;

  /**
   * Determines if the Save button should be enabled.
   */
  protected get isSaveButtonEnabled(): boolean {
    return !this.isSaving && !!this.mainForm && this.mainForm.valid;
  }

  // Events
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() saveEdit = new EventEmitter<any>();

  /**
   * Builds and submits a create-entity mutation from the form state.
   */
  protected async onSave(): Promise<void> {
    // Anti-spam validation: prevent multiple clicks
    if (this.isSaving) {
      return;
    }

    // Validate form state
    if (!this.mainForm?.valid || !this.newNodeCkId) {
      return;
    }

    const newNodeRtCkTypeId = this.newNodeRtCkTypeId;
    if (!newNodeRtCkTypeId) {
      console.error("Missing required identifiers to create an entity.");
      this.showErrorNotification(
        this.translation.instant(
          RUNTIME_BROWSER_KEYS.MissingRequiredIdentifiers,
        ),
      );
      return;
    }

    try {
      this.isSaving = true;

      // Fetch attributes metadata for the selected type
      const attributesMetadata =
        await this.formAttributesService.getFormAttributes(
          this.newNodeCkId,
          undefined,
          false,
        );

      // Map form values to GraphQL attributes
      const newNodeCkAttributes =
        await this.formAttributesMapper.mapFormValueToGraphQLAttributes(
          this.mainForm.value,
          attributesMetadata,
        );

      // Build entity object
      const entity = this.buildEntityObject(
        newNodeRtCkTypeId,
        newNodeCkAttributes,
      );
      const entityInput = entity as unknown as RtEntityInputDto;

      // Prepare mutation options
      const mutationOptions = this.prepareMutationOptions(entityInput);

      // Execute mutation
      const result = await firstValueFrom(
        this.createEntitiesGQL.mutate(mutationOptions),
      );

      // Emit success event
      this.saveEdit.emit({
        success: true,
        rtId: result.data?.runtime?.runtimeEntities?.create?.[0]?.rtId,
        ckTypeId: newNodeRtCkTypeId,
      } as EntityCreationResult);
    } catch (error) {
      console.error("Error creating entity:", error);
      this.showErrorNotification(
        this.translation.instant(RUNTIME_BROWSER_KEYS.FailedToCreateEntity),
      );
      this.saveEdit.emit({
        success: false,
        rtId: undefined,
        ckTypeId: undefined,
      } as EntityCreationResult);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Builds the entity object with type, attributes, and optional parent association.
   */
  private buildEntityObject(ckTypeId: string, attributes: any[]): any {
    const entity: any = {
      ckTypeId,
      attributes,
    };

    // Add parent association only if parent is provided (not null)
    const parentCkTypeId = this.parent?.item?.ckTypeId;
    const parentRtId = this.parent?.item?.rtId;

    if (parentCkTypeId && parentRtId) {
      entity.associations = {
        roleName: "parent",
        targets: [
          {
            modOption: "CREATE",
            target: {
              ckTypeId: parentCkTypeId,
              rtId: parentRtId,
            },
          },
        ],
      };
    }

    return entity;
  }

  /**
   * Prepares mutation options with variables and optional multipart context.
   */
  private prepareMutationOptions(entityInput: RtEntityInputDto): any {
    const mutationOptions: any = {
      variables: { entities: [entityInput] },
    };

    // Use multipart for binary file uploads
    const hasBinaryLinkedFiles =
      Array.isArray(entityInput.attributes) &&
      entityInput.attributes.length > 0;
    if (hasBinaryLinkedFiles) {
      mutationOptions.context = { useMultipart: true };
    }

    return mutationOptions;
  }

  /**
   * Shows an error notification to the user.
   */
  private showErrorNotification(message: string): void {
    this.notificationService.show({
      content: message,
      hideAfter: 3000,
      position: { horizontal: "right", vertical: "top" },
      animation: { type: "fade", duration: 400 },
      type: { style: "error", icon: true },
    });
  }

  /**
   * Resets the form and prepares the state for the selected type.
   */
  protected onTypeChange(selectedType: CkTypeDto | null) {
    this.newNodeCkId = null;
    this.mainForm = null;

    if (selectedType?.ckTypeId?.fullName) {
      this.mainForm = this.fb.group({});
      this.newNodeCkId = selectedType.ckTypeId.fullName;
      this.newNodeRtCkTypeId =
        selectedType.rtCkTypeId || selectedType.ckTypeId.fullName;
    }
  }
}

/**
 * Result of the entity creation operation.
 */
export interface EntityCreationResult {
  /** Whether the entity creation operation was successful. */
  success: boolean;
  /** The RT ID of the created entity (if successful). */
  rtId?: string;
  /** The CK type ID of the created entity (if successful). */
  ckTypeId?: string;
}
