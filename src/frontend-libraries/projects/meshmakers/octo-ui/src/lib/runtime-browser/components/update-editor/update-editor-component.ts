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
import type { RtEntityUpdateDto } from "@meshmakers/octo-services";
import { KENDO_BUTTONS } from "@progress/kendo-angular-buttons";
import { KENDO_DATEINPUTS } from "@progress/kendo-angular-dateinputs";
import { KENDO_DROPDOWNS } from "@progress/kendo-angular-dropdowns";
import { KENDO_INPUTS } from "@progress/kendo-angular-inputs";
import { KENDO_LABEL } from "@progress/kendo-angular-label";
import { CardModule } from "@progress/kendo-angular-layout";
import { firstValueFrom, of, startWith, switchMap } from "rxjs";
import { RUNTIME_BROWSER_KEYS } from "../../../../i18n/keys";
import { AppTranslatePipe } from "../../../i18n/translate.pipe";
import { AppTranslateService } from "../../../i18n/translate.service";
import { UpdateRuntimeEntitiesDtoGQL } from "../../graphQL/updateRuntimeEntities";
import { Attribute } from "../../models/attribute";
import { AttributeCoordinatorService } from "../../services/attribute-coordinator.service";
import { AttributeDataService } from "../../services/attribute-data.service";
import { AttributeMapperService } from "../../services/attribute-mapper.service";
import { AttributesGroupComponent } from "../attributes-group/attributes-group.component";
import { SharedEditor } from "../shared-editor/shared-editor";

@Component({
  selector: "mm-update-editor-component",
  imports: [
    ReactiveFormsModule,
    CardModule,
    AppTranslatePipe,
    KENDO_INPUTS,
    KENDO_LABEL,
    KENDO_BUTTONS,
    KENDO_DROPDOWNS,
    KENDO_DATEINPUTS,
    AttributesGroupComponent,
  ],
  template: `
    <div class="entity-editor-container">
      <kendo-card class="basic-info-card">
        <kendo-card-header>
          <h3 class="title">
            {{ RUNTIME_BROWSER_KEYS.UpdateEntity | appTranslate }}
          </h3>
        </kendo-card-header>
        <kendo-card-body>
          <div class="info-item">
            <label>{{ RUNTIME_BROWSER_KEYS.Name | appTranslate }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="updateInput()!.name"
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{
              RUNTIME_BROWSER_KEYS.RuntimeCkTypeId | appTranslate
            }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="updateInput()!.rtCkTypeId"
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{ RUNTIME_BROWSER_KEYS.TypeId | appTranslate }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="updateInput()!.ckTypeId!"
            ></kendo-textbox>
          </div>

          <div class="info-item">
            <label>{{ RUNTIME_BROWSER_KEYS.RuntimeId | appTranslate }}</label>
            <kendo-textbox
              [disabled]="true"
              [value]="updateInput()!.rtId"
            ></kendo-textbox>
          </div>
        </kendo-card-body>
      </kendo-card>

      <div class="attributes-form-container">
        @if (updateInput().rtCkTypeId && form()) {
          <mm-attributes-group
            [ckId]="updateInput().rtCkTypeId"
            [parentFormGroup]="form()!"
            [initialValues]="entityData()?.initial"
            [isRecord]="false"
          />
        } @else {
          <div class="loading-shimmer">
            {{ RUNTIME_BROWSER_KEYS.LoadingEntityDetails | appTranslate }}
          </div>
        }
      </div>

      <div class="entity-editor-actions">
        <button
          kendoButton
          (click)="onUpdate()"
          [disabled]="!isUpdateButtonEnabled()"
        >
          {{ RUNTIME_BROWSER_KEYS.Save | appTranslate }}
        </button>
        <button
          kendoButton
          [disabled]="!isCancelButtonEnabled()"
          (click)="cancelRequested.emit()"
        >
          {{ RUNTIME_BROWSER_KEYS.Cancel | appTranslate }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ["../shared-editor/shared-editor.scss"],
})
/**
 * Editor for updating an existing runtime entity: loads entity data by rtId/ckTypeId, builds attribute form
 * via mm-attributes-group, and submits updateRuntimeEntities with mapped attributes. Save is enabled only when
 * form is valid, coordinator is ready, and form is dirty vs initial snapshot.
 */
export class UpdateEditorComponent {
  // Inputs
  updateInput = input.required<UpdateInput>();
  // Outputs
  updateOutput = output<UpdateOutput>();
  cancelRequested = output<void>();
  // State
  protected isUpdating = signal(false);
  protected isCanceling = signal(false);
  protected form = signal<FormGroup | null>(null);
  protected selectedCkTypeId = signal<string | null>(null);
  protected selectedRtCkTypeId = signal<string | null>(null);
  /** Snapshot of form value when coordinator and entity data are ready; used for dirty check. */
  private initialValue = signal<string | null>(null);
  // Dependencies
  private readonly updateRuntimeEntitiesGQL = inject(
    UpdateRuntimeEntitiesDtoGQL,
  );
  private readonly formBuilder = inject(FormBuilder);
  private readonly dataService = inject(AttributeDataService);
  private readonly mapperService = inject(AttributeMapperService);
  private readonly coordinatorService = inject(AttributeCoordinatorService);
  private readonly sharedEditor = inject(SharedEditor);
  private readonly translation = inject(AppTranslateService);
  protected readonly RUNTIME_BROWSER_KEYS = RUNTIME_BROWSER_KEYS;

  private dataLoaded = computed(() => !!this.entityData());

  isUpdateButtonEnabled = computed(() => {
    const status = this.formStatusSignal();
    const isLoaded = this.coordinatorService.isFullyLoaded();
    const isDirty = this.formIsDifferentFromInitial();

    return (
      !this.isUpdating() &&
      !this.isCanceling() &&
      status === "VALID" &&
      isLoaded &&
      isDirty
    );
  });

  isCancelButtonEnabled = computed(() => {
    return !this.isUpdating() && !this.isCanceling();
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

  /**
   * Dirty check: current form value vs snapshot taken when data was loaded.
   * Uses JSON.stringify for stability; do not replace with a custom deep-equal (caused regressions).
   * Known limitations: File objects serialize as {}, Dates as ISO strings. Circular refs are guarded with try/catch.
   */
  formIsDifferentFromInitial = computed(() => {
    const current = this.formValueSignal();
    const initial = this.initialValue();

    if (!current || initial == null) return false;

    try {
      return JSON.stringify(current) !== initial;
    } catch {
      return true;
    }
  });

  protected entityData = toSignal(
    toObservable(this.updateInput).pipe(
      switchMap((input) =>
        this.dataService.getRtEntityValues$(input.rtId, input.ckTypeId!),
      ),
    ),
  );

  constructor() {
    this.coordinatorService.reset();
    // INIT: React to input change — reset form and sync type ids from input
    effect(() => {
      const input = this.updateInput();
      this.form.set(this.formBuilder.group({}));
      this.selectedRtCkTypeId.set(input.rtCkTypeId);
      this.selectedCkTypeId.set(input.ckTypeId);
    });

    // SNAPSHOT: Take it only once when coordinator and data are ready
    effect(() => {
      const isCoordinatorReady = this.coordinatorService.isFullyLoaded();
      const isDataArrived = this.dataLoaded();
      const currentForm = this.form();

      // Boundary condition: everything must be wired
      if (isCoordinatorReady && isDataArrived && currentForm) {
        // Take snapshot without temporal side effects
        const rawValue = currentForm.getRawValue();
        this.initialValue.set(JSON.stringify(rawValue));
      }
    });
  }

  /**
   * Validates preconditions for update (form valid, not already updating, ids present).
   */
  protected async onUpdate(): Promise<void> {
    const input = this.updateInput();
    const currentForm = this.form();
    const ckTypeId = this.selectedCkTypeId() ?? input.ckTypeId;
    const rtCkTypeId = this.selectedRtCkTypeId() ?? input.rtCkTypeId;

    if (
      this.isUpdating() ||
      !currentForm?.valid ||
      !ckTypeId ||
      !rtCkTypeId ||
      !input.rtId
    ) {
      return;
    }

    this.isUpdating.set(true);

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
          this.translation.instant(RUNTIME_BROWSER_KEYS.FailedToUpdateEntity),
        );
        return;
      }

      const updateEntity = this.buildUpdatePayload(
        input,
        ckTypeId,
        mappedAttributes,
      );
      const options = this.sharedEditor.prepareUpdateMutationOptions([
        updateEntity,
      ]);
      const result = await firstValueFrom(
        this.updateRuntimeEntitiesGQL.mutate(options),
      );

      const updatedRtId =
        result.data?.runtime?.runtimeEntities?.update?.[0]?.rtId;
      if (updatedRtId != null) {
        this.updateOutput.emit({
          success: true,
          data: { updatedRtEntityId: updatedRtId },
        });
      } else {
        this.sharedEditor.showErrorNotification(
          this.translation.instant(RUNTIME_BROWSER_KEYS.FailedToUpdateEntity),
        );
      }
    } catch (error) {
      console.error("Error updating entity:", error);
      this.sharedEditor.showErrorNotification(
        this.translation.instant(RUNTIME_BROWSER_KEYS.FailedToUpdateEntity),
      );
    } finally {
      this.isUpdating.set(false);
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

  /** Builds the update mutation payload: rtId + item { ckTypeId, attributes }. */
  private buildUpdatePayload(
    input: UpdateInput,
    ckTypeId: string,
    attributes: { attributeName: string; value: unknown }[],
  ): RtEntityUpdateDto {
    return {
      rtId: input.rtId,
      item: {
        ckTypeId,
        attributes,
      },
    };
  }
}

export interface UpdateInput {
  /**
   * The name of the entity being updated. This is required to display the name of the entity in the UI.
   */
  name: string;
  /**
   * The RT ID of the entity being updated. This is required to identify which entity to update in the backend.
   */
  rtId: string;
  /**
   * The RT CK type ID of the entity being updated. This is required to understand the structure and attributes of the entity for proper mapping and validation during the update operation.
   */
  rtCkTypeId: string;
  /**
   * The CK type ID of the entity being updated. This is required to understand the structure and attributes of the entity for proper mapping and validation during the update operation.
   */
  ckTypeId: string;
}

export interface UpdateOutput {
  success: boolean;
  data?: {
    /**
     * The RT ID of the updated entity. This is returned after a successful update operation and can be used for further operations or navigation. It is optional because the update might fail, in which case this value would be undefined.
     */
    updatedRtEntityId: string;
  };
}
