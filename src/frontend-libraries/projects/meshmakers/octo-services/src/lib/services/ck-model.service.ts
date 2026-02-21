import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GetCkModelByIdDtoGQL } from '../graphQL/getCkModelById';

/** Represents a parsed semantic version */
interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Service for checking CK model availability in the current tenant.
 */
@Injectable({
  providedIn: 'root'
})
export class CkModelService {
  private readonly getCkModelByIdGQL = inject(GetCkModelByIdDtoGQL);

  /**
   * Checks if a construction kit model is available in the current tenant.
   * @param modelId The model ID to check (e.g., 'System.UI')
   * @returns true if the model is available and in AVAILABLE state
   */
  public async isModelAvailable(modelId: string): Promise<boolean> {
    const result = await firstValueFrom(
      this.getCkModelByIdGQL.fetch({ variables: { model: modelId } })
    );

    if (result?.data?.constructionKit?.models?.items) {
      return result.data.constructionKit.models.items.length > 0;
    }

    return false;
  }

  /**
   * Checks if a construction kit model is available with at least the specified version.
   * @param modelId The model ID to check (e.g., 'System.UI')
   * @param minVersion The minimum required version (e.g., '1.0.1')
   * @returns true if the model is available and version >= minVersion
   */
  public async isModelAvailableWithMinVersion(modelId: string, minVersion: string): Promise<boolean> {
    const result = await firstValueFrom(
      this.getCkModelByIdGQL.fetch({ variables: { model: modelId } })
    );

    const items = result?.data?.constructionKit?.models?.items;
    if (!items || items.length === 0) {
      return false;
    }

    const model = items[0];
    if (!model?.id?.version) {
      return false;
    }

    const modelVersion = this.parseVersion(model.id.version);
    const requiredVersion = this.parseVersion(minVersion);

    if (!modelVersion || !requiredVersion) {
      console.warn(`Could not parse version: model=${model.id.version}, required=${minVersion}`);
      return false;
    }

    return this.compareVersions(modelVersion, requiredVersion) >= 0;
  }

  /**
   * Gets the version of an available model.
   * @param modelId The model ID to check
   * @returns The version string or null if not available
   */
  public async getModelVersion(modelId: string): Promise<string | null> {
    const result = await firstValueFrom(
      this.getCkModelByIdGQL.fetch({ variables: { model: modelId } })
    );

    const items = result?.data?.constructionKit?.models?.items;
    if (!items || items.length === 0 || !items[0]?.id?.version) {
      return null;
    }

    return String(items[0].id.version);
  }

  /**
   * Parses a version string into its components.
   * Supports formats: "1.0.1", "1.0", "1"
   */
  private parseVersion(version: string | number | object): SemanticVersion | null {
    let versionStr: string;

    if (typeof version === 'object' && version !== null) {
      // Handle object format like { major: 1, minor: 0, patch: 1 }
      const v = version as { major?: number; minor?: number; patch?: number };
      if (typeof v.major === 'number') {
        return {
          major: v.major,
          minor: v.minor ?? 0,
          patch: v.patch ?? 0
        };
      }
      versionStr = String(version);
    } else {
      versionStr = String(version);
    }

    const parts = versionStr.split('.').map(p => parseInt(p, 10));

    if (parts.some(isNaN)) {
      return null;
    }

    return {
      major: parts[0] ?? 0,
      minor: parts[1] ?? 0,
      patch: parts[2] ?? 0
    };
  }

  /**
   * Compares two semantic versions.
   * @returns negative if a < b, 0 if equal, positive if a > b
   */
  private compareVersions(a: SemanticVersion, b: SemanticVersion): number {
    if (a.major !== b.major) {
      return a.major - b.major;
    }
    if (a.minor !== b.minor) {
      return a.minor - b.minor;
    }
    return a.patch - b.patch;
  }
}
