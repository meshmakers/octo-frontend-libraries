import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { CkTypeDto, RtEntityInputDto } from "@meshmakers/octo-services";
import { TreeItemDataTyped } from "@meshmakers/shared-services";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_DROPDOWNS } from "@progress/kendo-angular-dropdowns";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { CardModule } from "@progress/kendo-angular-layout";
import { firstValueFrom } from "rxjs";
import { CreateEntitiesDtoGQL } from "../../../graphQL/createEntities";
import {
  DEFAULT_RUNTIME_BROWSER_MESSAGES,
  RuntimeBrowserMessages,
} from "../../runtime-browser.model";
import {
  FormAttributesServiceMapper,
  RtEntityAttributeInput,
} from "../../services/form-attributes-mapper";
import { FormAttributesService } from "../../services/form-attributes-service";
import { SharedEditor } from "../shared-editor/shared-editor";
import { AttributesForm } from "../attributes-form/attributes-form";

type ParentTreeItem = TreeItemDataTyped<{ ckTypeId?: string; rtId?: string }>;

interface EntityInput {
  ckTypeId: string;
  attributes: RtEntityAttributeInput[];
  associations?: {
    roleName: string;
    targets: {
      modOption: string;
      target: { ckTypeId: string; rtId: string };
    }[];
  };
}

@Component({
  selector: "mm-entity-editor-component",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule,
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
            {{ _messages.createEntity }}
          </h3>
        </kendo-card-header>
        <kendo-card-body>
          <div class="info-item">
            <label>{{ _messages.targetLocation }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="parent?.text || _messages.rootLevel"
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{ _messages.entityType }}</label>
            <kendo-dropdownlist
              [data]="availableCkTypes"
              textField="rtCkTypeId"
              valueField="rtCkTypeId"
              [valuePrimitive]="false"
              [attr.placeholder]="_messages.selectType"
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
            {{ _messages.selectTypePrompt }}
          </p>
        }
      </div>

      <div class="entity-editor-actions">
        <button
          kendoButton
          [disabled]="!isSaveButtonEnabled"
          (click)="onSave()"
        >
          {{ _messages.save }}
        </button>
        <button kendoButton [disabled]="isSaving" (click)="cancelEdit.emit()">
          {{ _messages.cancel }}
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
  private readonly sharedEditor = inject(SharedEditor);

  // Inputs
  @Input() parent: ParentTreeItem | null = null;
  @Input() availableCkTypes: CkTypeDto[] = [];
  @Input() set messages(value: Partial<RuntimeBrowserMessages>) {
    this._messages = { ...DEFAULT_RUNTIME_BROWSER_MESSAGES, ...value };
  }

  // Form
  protected mainForm: FormGroup | null = null;
  protected newNodeCkId: string | null = null;
  protected newNodeRtCkTypeId: string | null = null;

  private fb = inject(FormBuilder);

  // Services
  protected _messages: RuntimeBrowserMessages = {
    ...DEFAULT_RUNTIME_BROWSER_MESSAGES,
  };

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
  @Output() saveEdit = new EventEmitter<EntityCreationResult>();

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
      this.sharedEditor.showErrorNotification(this._messages.missingRequiredIdentifiers);
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

      // Prepare mutation options (uses SharedEditor for correct multipart detection)
      const mutationOptions = this.sharedEditor.prepareMutationOptions(entityInput);

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
      this.sharedEditor.showErrorNotification(this._messages.failedToCreateEntity);
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
  private buildEntityObject(
    ckTypeId: string,
    attributes: RtEntityAttributeInput[],
  ): EntityInput {
    const entity: EntityInput = {
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

