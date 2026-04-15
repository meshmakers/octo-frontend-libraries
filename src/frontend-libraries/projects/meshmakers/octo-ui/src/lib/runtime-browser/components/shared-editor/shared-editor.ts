import { inject, Injectable } from "@angular/core";
import { RtEntityInputDto, RtEntityUpdateDto } from "@meshmakers/octo-services";
import { NotificationService } from "@progress/kendo-angular-notification";

interface MutationOptions<TVariables> {
  variables: TVariables;
  context?: { useMultipart: true };
}

/**
 * Shared utilities for create and update entity editors: builds Apollo mutation options (with multipart
 * context for binary uploads) and shows error notifications. Injected by both CreateEditorComponent and
 * UpdateEditorComponent.
 */
@Injectable({
  providedIn: "root",
})
export class SharedEditor {
  private readonly notificationService = inject(NotificationService);

  /**
   * Builds Apollo mutation options for createEntities. Multipart context is enabled when any attribute
   * value (top-level or nested in RECORD / RECORD_ARRAY) contains a File instance.
   */
  public prepareMutationOptions(
    entityInput: RtEntityInputDto,
  ): MutationOptions<{ entities: RtEntityInputDto[] }> {
    return this.buildMutationOptions({ entities: [entityInput] });
  }

  /**
   * Builds Apollo mutation options for updateRuntimeEntities. Multipart context is enabled when any
   * attribute value (top-level or nested in RECORD / RECORD_ARRAY) contains a File instance.
   */
  public prepareUpdateMutationOptions(
    entities: RtEntityUpdateDto[],
  ): MutationOptions<{ entities: RtEntityUpdateDto[] }> {
    return this.buildMutationOptions({ entities });
  }

  /**
   * Shows an error notification to the user.
   */
  public showErrorNotification(message: string): void {
    this.notificationService.show({
      content: message,
      hideAfter: 3000,
      position: { horizontal: "right", vertical: "top" },
      animation: { type: "fade", duration: 400 },
      type: { style: "error", icon: true },
    });
  }

  /** Wraps variables with optional multipart context based on whether a File is present anywhere in the payload. */
  private buildMutationOptions<TVariables>(
    variables: TVariables,
  ): MutationOptions<TVariables> {
    const options: MutationOptions<TVariables> = { variables };
    if (this.containsFile(variables)) {
      options.context = { useMultipart: true };
    }
    return options;
  }

  /**
   * Recursively checks whether the given value contains a File instance anywhere in its structure
   * (top-level, inside arrays or inside nested objects). Used to decide whether the mutation must
   * be sent as a multipart request so that nested BINARY_LINKED files are uploaded correctly.
   */
  private containsFile(value: unknown): boolean {
    if (value == null) return false;
    if (value instanceof File) return true;
    if (Array.isArray(value)) {
      return value.some((item) => this.containsFile(item));
    }
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).some((v) =>
        this.containsFile(v),
      );
    }
    return false;
  }
}
