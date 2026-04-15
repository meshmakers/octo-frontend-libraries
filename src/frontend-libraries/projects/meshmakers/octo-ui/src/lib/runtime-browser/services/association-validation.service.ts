import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GetCkTypeAssociationRolesDtoGQL } from '../../graphQL/getCkTypeAssociationRoles';

/** Single CK association role extracted from the query result. */
export interface CkAssociationRole {
  roleId: string;
  rtRoleId: string;
  targetCkTypeId: string;
  rtTargetCkTypeId: string;
  multiplicity: string;
  navigationPropertyName: string;
}

/** Result of a move-validation check. */
export interface MoveValidationResult {
  allowed: boolean;
  /** The runtime role ID to use for the association mutation (e.g. "System/ParentChild"). */
  rtRoleId?: string;
  /** The versioned role ID (e.g. "System-2.0.8/ParentChild-1"). */
  roleId?: string;
  /** Navigation property name on the source entity (e.g. "Parent"). */
  navigationPropertyName?: string;
  /** Reason when move is not allowed. */
  reason?: string;
}

/**
 * Validates whether a drag-and-drop move (reparenting) is allowed by the CK model.
 *
 * Strategy: query the SOURCE type's OUTBOUND association roles and look for a
 * `System/ParentChild` role whose `rtTargetCkTypeId` matches the destination type.
 * This means "source entity can have a parent of destination type".
 */
@Injectable({
  providedIn: 'root',
})
export class AssociationValidationService {
  private readonly getCkTypeAssociationRolesGQL = inject(
    GetCkTypeAssociationRolesDtoGQL,
  );

  /** Cache: sourceCkTypeId → outbound roles */
  private readonly outRolesCache = new Map<string, CkAssociationRole[]>();

  /**
   * Checks whether an entity of `sourceCkTypeId` can be moved (reparented)
   * to an entity of `destinationCkTypeId` via a ParentChild association.
   */
  async canMove(
    sourceCkTypeId: string,
    destinationCkTypeId: string,
  ): Promise<MoveValidationResult> {
    const outRoles = await this.getOutboundRoles(sourceCkTypeId);

    // Find a ParentChild outbound role where the target matches the destination type.
    // Use rtTargetCkTypeId (runtime format) for matching — it matches event.ckTypeId.
    const matchingRole = outRoles.find(
      (r) =>
        r.rtRoleId === 'System/ParentChild' &&
        r.rtTargetCkTypeId === destinationCkTypeId,
    );

    if (matchingRole) {
      return {
        allowed: true,
        rtRoleId: matchingRole.rtRoleId,
        roleId: matchingRole.roleId,
        navigationPropertyName: this.toLowerCamelCase(
          matchingRole.navigationPropertyName,
        ),
      };
    }

    return {
      allowed: false,
      reason: `CK model does not define a ParentChild association from "${sourceCkTypeId}" to "${destinationCkTypeId}"`,
    };
  }

  /**
   * Fetches and caches the outbound association roles for a given CK type.
   */
  private async getOutboundRoles(
    ckTypeId: string,
  ): Promise<CkAssociationRole[]> {
    const cached = this.outRolesCache.get(ckTypeId);
    if (cached) {
      return cached;
    }

    const result = await firstValueFrom(
      this.getCkTypeAssociationRolesGQL.fetch({
        variables: { ckTypeId },
        fetchPolicy: 'network-only',
      }),
    );

    const typeData = result.data?.constructionKit?.types?.items?.[0];
    const rawRoles = typeData?.associations?.out?.all ?? [];

    const roles: CkAssociationRole[] = rawRoles
      .filter(
        (r): r is NonNullable<typeof r> => r !== null && r !== undefined,
      )
      .map((r) => ({
        roleId: r.roleId?.fullName ?? '',
        rtRoleId: String(r.rtRoleId ?? ''),
        targetCkTypeId: r.targetCkTypeId?.fullName ?? '',
        rtTargetCkTypeId: String(r.rtTargetCkTypeId ?? ''),
        multiplicity: r.multiplicity ?? '',
        navigationPropertyName: r.navigationPropertyName ?? '',
      }));

    this.outRolesCache.set(ckTypeId, roles);
    return roles;
  }

  /**
   * Normalizes navigation property name to lowerCamelCase, matching the
   * backend convention used by typed input types (e.g. "Parent" → "parent").
   */
  private toLowerCamelCase(name: string): string {
    if (!name) {
      return name;
    }
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /** Clears the role cache (e.g. on tenant switch). */
  clearCache(): void {
    this.outRolesCache.clear();
  }
}
