import { inject, Injectable } from "@angular/core";
import { RtEntityInputDto, RtEntityUpdateDto } from "@meshmakers/octo-services";
import { NotificationService } from "@progress/kendo-angular-notification";

/**
 * Shared utilities for create and update entity editors: mutation options (including multipart for binary uploads)
 * and error notifications. Injected by both CreateEditorComponent and UpdateEditorComponent.
 */
@Injectable({
  providedIn: "root",
})
export class SharedEditor {
  private readonly notificationService = inject(NotificationService);

  /**
   * Builds Apollo mutation options for createEntities: variables and optional multipart context when attributes contain File(s).
   */
  public prepareMutationOptions(entityInput: RtEntityInputDto): {
    variables: { entities: RtEntityInputDto[] };
    context?: { useMultipart: true };
  } {
    const mutationOptions: {
      variables: { entities: RtEntityInputDto[] };
      context?: { useMultipart: true };
    } = {
      variables: { entities: [entityInput] },
    };

    // Use multipart for binary file uploads (BINARY_LINKED or BINARY)
    const hasBinaryFiles =
      entityInput.attributes?.some((attr) => {
        // BINARY_LINKED: File, BINARY: File or File[]
        if (attr?.value instanceof File) return true;
        if (Array.isArray(attr?.value) && attr?.value[0] instanceof File)
          return true;
        return false;
      }) ?? false;
    if (hasBinaryFiles) {
      mutationOptions.context = { useMultipart: true };
    }

    return mutationOptions;
  }

  /**
   * Builds Apollo mutation options for updateRuntimeEntities: variables and optional multipart context when attributes contain File(s).
   */
  public prepareUpdateMutationOptions(entities: RtEntityUpdateDto[]): {
    variables: { entities: RtEntityUpdateDto[] };
    context?: { useMultipart: true };
  } {
    const mutationOptions: {
      variables: { entities: RtEntityUpdateDto[] };
      context?: { useMultipart: true };
    } = {
      variables: { entities },
    };

    const hasBinaryFiles =
      entities?.some((e) =>
        e?.item?.attributes?.some((attr: any) => {
          if (attr?.value instanceof File) return true;
          if (Array.isArray(attr?.value) && attr?.value[0] instanceof File)
            return true;
          return false;
        }),
      ) ?? false;

    if (hasBinaryFiles) {
      mutationOptions.context = { useMultipart: true };
    }

    return mutationOptions;
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
}
