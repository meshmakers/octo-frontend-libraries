import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';

/** Runtime CK type id of the per-tenant tree navigation configuration singleton. */
const CONFIG_CK_TYPE_ID = 'System.UI/TreeNavigationConfiguration';
/** rtWellKnownName of the singleton instance. */
const CONFIG_WELL_KNOWN_NAME = 'TreeNavigation';
/** Matches every source CK type. */
const WILDCARD = '*';

/** One resolved per-role override (presentation only). */
export interface TreeNavigationRoleOverride {
  visible?: boolean;
  displayName?: string;
  sortIndex?: number;
  grouped?: boolean;
  icon?: string;
}

interface RawRole {
  sourceCkTypeId?: string | null;
  roleId?: string | null;
  visible?: boolean | null;
  displayName?: string | null;
  sortIndex?: number | null;
  grouped?: boolean | null;
  icon?: string | null;
}

const CONFIG_TYPE_EXISTS_QUERY = gql`
  query treeNavigationConfigTypeExists {
    constructionKit {
      types(rtCkId: "System.UI/TreeNavigationConfiguration", first: 1) {
        items {
          rtCkTypeId
        }
      }
    }
  }
`;

const CONFIG_QUERY = gql`
  query getTreeNavigationConfiguration {
    runtime {
      systemUITreeNavigationConfiguration(
        first: 1
        fieldFilter: [
          {
            attributePath: "rtWellKnownName"
            operator: EQUALS
            comparisonValue: "TreeNavigation"
          }
        ]
      ) {
        items {
          rtId
          roles {
            sourceCkTypeId
            roleId
            visible
            displayName
            sortIndex
            grouped
            icon
          }
        }
      }
    }
  }
`;

/**
 * Loads the optional per-tenant `System.UI/TreeNavigationConfiguration` singleton
 * and resolves per-association overrides for the entity trees.
 *
 * Design notes:
 * - The config entity is OPTIONAL. When the CK type is not installed on the
 *   tenant (System.UI < 2.2.0) or no instance exists, every lookup returns
 *   undefined and the trees fall back to pure auto-discovery.
 * - The singleton field (`systemUITreeNavigationConfiguration`) only exists in
 *   the tenant schema when the CK type is installed, so querying it blindly
 *   would raise a GraphQL validation error (and a user-facing toast). We first
 *   probe the CK schema with the always-valid `constructionKit.types` query and
 *   only run the singleton query when the type is present.
 * - Uses inline `gql` (not codegen) so the feature is decoupled from a schema
 *   re-introspection that includes the new CK type.
 */
@Injectable({
  providedIn: 'root',
})
export class TreeNavigationConfigService {
  private readonly apollo = inject(Apollo);

  /** key `${sourceCkTypeId}::${roleId}` -> override; cached for the session. */
  private overridesPromise?: Promise<Map<string, TreeNavigationRoleOverride>>;

  /**
   * Resolves the override for one (source type, role) pair, preferring an exact
   * source-type match over a wildcard (`*`) rule. Returns undefined when nothing
   * is configured.
   */
  async resolve(
    sourceCkTypeId: string,
    roleId: string,
  ): Promise<TreeNavigationRoleOverride | undefined> {
    const overrides = await this.getOverrides();
    return (
      overrides.get(`${sourceCkTypeId}::${roleId}`) ??
      overrides.get(`${WILDCARD}::${roleId}`)
    );
  }

  /** Forces a reload on next access (e.g. after a tenant switch). */
  reset(): void {
    this.overridesPromise = undefined;
  }

  private getOverrides(): Promise<Map<string, TreeNavigationRoleOverride>> {
    if (!this.overridesPromise) {
      this.overridesPromise = this.load().catch((error) => {
        console.error('Error loading tree navigation configuration', error);
        // Drop the cache so a later expand can retry, fall back to no overrides.
        this.overridesPromise = undefined;
        return new Map<string, TreeNavigationRoleOverride>();
      });
    }
    return this.overridesPromise;
  }

  private async load(): Promise<Map<string, TreeNavigationRoleOverride>> {
    const map = new Map<string, TreeNavigationRoleOverride>();

    // Guard: only query the singleton when the CK type is installed on the tenant.
    const exists = await firstValueFrom(
      this.apollo.query<{
        constructionKit?: {
          types?: { items?: ({ rtCkTypeId?: string } | null)[] | null } | null;
        };
      }>({ query: CONFIG_TYPE_EXISTS_QUERY, fetchPolicy: 'network-only' }),
    );
    const typePresent =
      (exists.data?.constructionKit?.types?.items?.length ?? 0) > 0;
    if (!typePresent) {
      return map;
    }

    const result = await firstValueFrom(
      this.apollo.query<{
        runtime?: {
          systemUITreeNavigationConfiguration?: {
            items?: ({ rtId?: string; roles?: RawRole[] | null } | null)[] | null;
          } | null;
        };
      }>({ query: CONFIG_QUERY, fetchPolicy: 'network-only' }),
    );

    const roles =
      result.data?.runtime?.systemUITreeNavigationConfiguration?.items?.[0]
        ?.roles ?? [];
    for (const raw of roles) {
      if (!raw?.sourceCkTypeId || !raw?.roleId) {
        continue;
      }
      map.set(`${raw.sourceCkTypeId}::${raw.roleId}`, {
        visible: raw.visible ?? undefined,
        displayName: raw.displayName ?? undefined,
        sortIndex: raw.sortIndex ?? undefined,
        grouped: raw.grouped ?? undefined,
        icon: raw.icon ?? undefined,
      });
    }
    return map;
  }
}

export const TREE_NAVIGATION_CONFIG_CONSTANTS = {
  CONFIG_CK_TYPE_ID,
  CONFIG_WELL_KNOWN_NAME,
  WILDCARD,
};
