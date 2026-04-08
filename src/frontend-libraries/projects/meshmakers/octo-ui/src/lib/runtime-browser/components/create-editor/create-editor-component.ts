import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import {
  AssociationModOptionsDto,
  RtEntityInputDto,
} from "@meshmakers/octo-services";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { CardModule } from "@progress/kendo-angular-layout";
import { CkTypeSelectorItem } from "@meshmakers/octo-services";
import { firstValueFrom, of, startWith, switchMap } from "rxjs";
import { CreateEntitiesDtoGQL } from "../../../graphQL/createEntities";
import { CkTypeSelectorInputComponent } from "../../../ck-type-selector-input/ck-type-selector-input.component";
import { Attribute } from "../../models/attribute";
import {
  DEFAULT_RUNTIME_BROWSER_MESSAGES,
  RuntimeBrowserMessages,
} from "../../runtime-browser.model";
import { AttributeCoordinatorService } from "../../services/attribute-coordinator.service";
import { AttributeDataService } from "../../services/attribute-data.service";
import { AttributeMapperService } from "../../services/attribute-mapper.service";
import { AttributesGroupComponent } from "../attributes-group/attributes-group.component";
import { SharedEditor } from "../shared-editor/shared-editor";

@Component({
  selector: "mm-create-editor-component",
  imports: [
    ReactiveFormsModule,
    CardModule,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
    KENDO_DATEINPUTS,
    CkTypeSelectorInputComponent,
    AttributesGroupComponent,
  ],
  template: `
    <div class="entity-editor-container">
      <kendo-card class="basic-info-card">
        <kendo-card-header>
          <h3 class="title">
            {{ resolvedMessages().createEntity }}
          </h3>
        </kendo-card-header>
        <kendo-card-body>
          <div class="info-item">
            <label>{{ resolvedMessages().targetLocation }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="
                createInput()!.parent!.name || resolvedMessages().rootLevel
              "
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{ resolvedMessages().entityType }}</label>
            <mm-ck-type-selector-input
              [placeholder]="resolvedMessages().selectType"
              [allowAbstract]="false"
              [derivedFromRtCkTypeId]="createInput()!.derivedFromRtCkTypeId"
              [dialogTitle]="resolvedMessages().selectType"
              (ckTypeSelected)="onCkTypeSelected($event)"
              (ckTypeCleared)="onCkTypeCleared()"
            >
            </mm-ck-type-selector-input>
          </div>
        </kendo-card-body>
      </kendo-card>

      <div class="attributes-form-container">
        @if (selectedRtCkTypeId() && form()) {
          <mm-attributes-group
            [ckId]="selectedRtCkTypeId()!"
            [parentFormGroup]="form()!"
            [isRecord]="false"
          />
        } @else {
          <p class="select-type-prompt">
            {{ resolvedMessages().selectTypePrompt }}
          </p>
        }
      </div>

      <div class="entity-editor-actions">
        <button
          kendoButton
          (click)="onCreate()"
          [disabled]="!isCreateButtonEnabled()"
        >
          {{ resolvedMessages().save }}
        </button>
        <button
          kendoButton
          [disabled]="!isCancelButtonEnabled()"
          (click)="cancelRequested.emit()"
        >
          {{ resolvedMessages().cancel }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ["../shared-editor/shared-editor.scss"],
})
/**
 * Editor for creating a new runtime entity under a parent: type selection via dropdown, attribute form
 * via mm-attributes-group, and createEntities mutation with optional parent association. Save is enabled
 * when form is valid, coordinator is ready, and form is dirty vs initial snapshot.
 */
export class CreateEditorComponent {
  // Inputs
  createInput = input.required<CreateInput>();
  messages = input<Partial<RuntimeBrowserMessages>>({});
  protected readonly resolvedMessages = computed<RuntimeBrowserMessages>(
    () => ({
      ...DEFAULT_RUNTIME_BROWSER_MESSAGES,
      ...this.messages(),
    }),
  );
  // Outputs
  createOutput = output<CreateOutput>();
  cancelRequested = output<void>();
  // State
  protected isCreating = signal(false);
  protected isCanceling = signal(false);
  protected form = signal<FormGroup | null>(null);
  protected selectedCkTypeId = signal<string | null>(null);
  protected selectedRtCkTypeId = signal<string | null>(null);
  /** Snapshot of form value when coordinator is ready; used for dirty check. */
  private initialValue = signal<string | null>(null);
  // Dependencies
  private readonly createEntitiesGQL = inject(CreateEntitiesDtoGQL);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dataService = inject(AttributeDataService);
  private readonly mapperService = inject(AttributeMapperService);
  private readonly coordinatorService = inject(AttributeCoordinatorService);
  private readonly sharedEditor = inject(SharedEditor);

  isCreateButtonEnabled = computed(() => {
    const status = this.formStatusSignal();
    const isLoaded = this.coordinatorService.isFullyLoaded();
    const isDirty = this.formIsDifferentFromInitial();

    return (
      !this.isCreating() &&
      !this.isCanceling() &&
      status === "VALID" &&
      isLoaded &&
      isDirty
    );
  });

  isCancelButtonEnabled = computed(() => {
    return !this.isCreating() && !this.isCanceling();
  });

  formIsDifferentFromInitial = computed(() => {
    const current = this.formValueSignal();
    const initial = this.initialValue();

    if (!current || initial == null) return false;

    return JSON.stringify(current) !== initial;
  });

  formStatusSignal = toSignal(
    toObservable(this.form).pipe(
      switchMap((f) => {
        if (!f) return of("INVALID");
        return f.statusChanges.pipe(startWith(f.status));
      }),
    ),
  );

  formValueSignal = toSignal(
    toObservable(this.form).pipe(
      switchMap((f) => {
        if (!f) return of(null);
        return f.valueChanges.pipe(startWith(f.getRawValue()));
      }),
    ),
  );

  constructor() {
    this.coordinatorService.reset();
    effect(() => {
      if (this.coordinatorService.isFullyLoaded()) {
        const currentForm = this.form();
        if (currentForm) {
          const val = currentForm.getRawValue();
          this.initialValue.set(JSON.stringify(val));
        }
      }
    });
  }

  /**
   * Validates preconditions, maps form to attributes, builds create payload, runs mutation, emits result.
   */
  protected async onCreate(): Promise<void> {
    const currentForm = this.form();
    const ckTypeId = this.selectedCkTypeId();
    const rtCkTypeId = this.selectedRtCkTypeId();

    if (this.isCreating() || !currentForm?.valid || !ckTypeId || !rtCkTypeId) {
      return;
    }

    this.isCreating.set(true);

    try {
      const attributesMetadata = await this.fetchAttributesMetadata(rtCkTypeId);
      const mappedAttributes = await firstValueFrom(
        this.mapFormToAttributes$(
          currentForm.getRawValue(),
          attributesMetadata,
        ),
      );

      if (!this.hasValidMappedAttributes(mappedAttributes)) {
        this.sharedEditor.showErrorNotification(
          this.resolvedMessages().failedToCreateEntity,
        );
        return;
      }

      const entityInput = this.buildCreatePayload(mappedAttributes);
      const options = this.sharedEditor.prepareMutationOptions(entityInput);
      const result = await firstValueFrom(
        this.createEntitiesGQL.mutate(options),
      );

      const createdRtId =
        result.data?.runtime?.runtimeEntities?.create?.[0]?.rtId;
      if (createdRtId != null) {
        this.createOutput.emit({
          success: true,
          data: { createdRtEntityId: createdRtId },
        });
      } else {
        this.sharedEditor.showErrorNotification(
          this.resolvedMessages().failedToCreateEntity,
        );
      }
    } catch (error) {
      console.error("Error saving entity:", error);
      this.sharedEditor.showErrorNotification(
        this.resolvedMessages().failedToCreateEntity,
      );
    } finally {
      this.isCreating.set(false);
    }
  }

  /** Fetches attribute definitions for the given runtime CK type (single emission). */
  private fetchAttributesMetadata(rtCkTypeId: string): Promise<Attribute[]> {
    return firstValueFrom(
      this.dataService.getAttributesDefinition$(rtCkTypeId, false),
    );
  }

  /** Maps form raw value to GraphQL attributes (Observable for composition/retry). */
  private mapFormToAttributes$(
    formValue: unknown,
    attributesMetadata: Attribute[],
  ) {
    return this.mapperService.mapFormValueToGraphQLAttributes$(
      formValue,
      attributesMetadata,
    );
  }

  /** Ensures we have at least one mapped attribute (validation). */
  private hasValidMappedAttributes(
    mapped: { attributeName: string; value: unknown }[] | null | undefined,
  ): boolean {
    return Array.isArray(mapped) && mapped.length > 0;
  }

  /** Builds the create mutation payload: ckTypeId, attributes, optional parent association. */
  private buildCreatePayload(
    attributes: { attributeName: string; value: unknown }[],
  ): RtEntityInputDto {
    const ckTypeId = this.selectedCkTypeId() ?? this.selectedRtCkTypeId();
    const entity: RtEntityInputDto = {
      ckTypeId: ckTypeId!,
      attributes,
    };

    const parent = this.createInput()?.parent;
    if (parent?.ckTypeId && parent?.rtId) {
      entity.associations = [
        {
          roleName: "parent",
          targets: [
            {
              modOption: AssociationModOptionsDto.CreateDto,
              target: { ckTypeId: parent.ckTypeId, rtId: parent.rtId },
            },
          ],
        },
      ];
    }

    return entity;
  }

  /**
   * Handles type selection from the CkTypeSelectorInput.
   * CkTypeSelectorItem has fullName and rtCkTypeId.
   * - selectedRtCkTypeId = fullName → used as [ckId] for attributes-group (getCkAttributesDetailed expects type id).
   * - selectedCkTypeId = rtCkTypeId → used in create mutation payload as entity.ckTypeId.
   */
  protected onCkTypeSelected(selectedType: CkTypeSelectorItem) {
    const rtCkTypeId = selectedType.fullName;
    const ckTypeId = selectedType.rtCkTypeId;

    if (ckTypeId && rtCkTypeId) {
      this.form.set(this.formBuilder.group({}));
      this.selectedRtCkTypeId.set(rtCkTypeId);
      this.selectedCkTypeId.set(ckTypeId);
    } else {
      this.form.set(null);
      this.selectedRtCkTypeId.set(null);
      this.selectedCkTypeId.set(null);
    }
  }

  protected onCkTypeCleared() {
    this.form.set(null);
    this.selectedRtCkTypeId.set(null);
    this.selectedCkTypeId.set(null);
  }
}

export interface CreateInput {
  /**
   * Parent context: object is always present; ckTypeId, rtId and name are optional (undefined for root-level creation, e.g. when creating under a CK Type or when parentNode is null).
   * Code uses parent?.ckTypeId and parent?.rtId defensively when building associations.
   */
  parent: {
    ckTypeId?: string;
    rtId?: string;
    name?: string;
  };
  /**
   * Base CK type ID used to filter the type selector to only show derived types.
   * For child creation this is typically 'Basic/TreeNode'; for root-level it is 'Basic/Tree'.
   */
  derivedFromRtCkTypeId?: string;
}

export interface CreateOutput {
  success: boolean;
  data?: {
    /**
     * The RT ID of the newly created entity. This is returned after a successful creation operation and can be used for further operations or navigation. It is optional because the creation might fail, in which case this value would be undefined.
     */
    createdRtEntityId: string;
  };
}

