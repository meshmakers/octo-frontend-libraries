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

/** One editable override rule (a row in the settings editor). */
export interface TreeNavigationRoleConfig {
  /** Source CK type id this rule applies to, or `*` for every type. */
  sourceCkTypeId: string;
  /** Runtime association role id (e.g. `EnergyIQ/SpaceSensors`). */
  roleId: string;
  visible?: boolean;
  displayName?: string;
  sortIndex?: number;
  grouped?: boolean;
  icon?: string;
}

/** The full configuration as loaded for editing. */
export interface TreeNavigationConfig {
  /** rtId of the singleton, or null when it does not exist yet. */
  rtId: string | null;
  /** True when the CK type is installed on the tenant (System.UI >= 2.2.0). */
  typePresent: boolean;
  roles: TreeNavigationRoleConfig[];
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

const ROLE_SUGGESTIONS_QUERY = gql`
  query treeNavigationRoleSuggestions($ckTypeId: String!) {
    constructionKit {
      types(rtCkId: $ckTypeId, first: 1) {
        items {
          associations {
            in {
              all {
                rtRoleId
                navigationPropertyName
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_CONFIG_MUTATION = gql`
  mutation createTreeNavigationConfiguration(
    $entities: [SystemUITreeNavigationConfigurationInput!]!
  ) {
    runtime {
      systemUITreeNavigationConfigurations {
        create(entities: $entities) {
          rtId
        }
      }
    }
  }
`;

const UPDATE_CONFIG_MUTATION = gql`
  mutation updateTreeNavigationConfiguration(
    $entities: [SystemUITreeNavigationConfigurationInputUpdate!]!
  ) {
    runtime {
      systemUITreeNavigationConfigurations {
        update(entities: $entities) {
          rtId
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

  /**
   * Returns the inbound association roles declared on a CK type, for the role
   * autocomplete in the settings editor. Returns `{ roleId, label }` where the
   * label is the friendly inbound name plus the role id. Empty for `*` or an
   * unknown type (orphan roles can still be typed as custom values).
   */
  async getRoleSuggestions(
    ckTypeId: string,
  ): Promise<{ roleId: string; label: string }[]> {
    if (!ckTypeId || ckTypeId === WILDCARD) {
      return [];
    }
    try {
      const result = await firstValueFrom(
        this.apollo.query<{
          constructionKit?: {
            types?: {
              items?:
                | ({
                    associations?: {
                      in?: {
                        all?:
                          | ({
                              rtRoleId?: string | null;
                              navigationPropertyName?: string | null;
                            } | null)[]
                          | null;
                      } | null;
                    } | null;
                  } | null)[]
                | null;
            } | null;
          };
        }>({
          query: ROLE_SUGGESTIONS_QUERY,
          variables: { ckTypeId },
          fetchPolicy: 'network-only',
        }),
      );
      const all =
        result.data?.constructionKit?.types?.items?.[0]?.associations?.in
          ?.all ?? [];
      const byRole = new Map<string, string>();
      for (const role of all) {
        const roleId = String(role?.rtRoleId ?? '');
        if (!roleId || byRole.has(roleId)) {
          continue;
        }
        const nav = role?.navigationPropertyName ?? '';
        byRole.set(roleId, nav ? `${nav} (${roleId})` : roleId);
      }
      return [...byRole.entries()].map(([roleId, label]) => ({ roleId, label }));
    } catch (error) {
      console.error('Error loading role suggestions for', ckTypeId, error);
      return [];
    }
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
    const { rawRoles } = await this.fetchSingleton();
    for (const raw of rawRoles) {
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

  /**
   * Loads the full configuration for editing (settings page). Returns whether
   * the CK type is installed (so the page can show a clear "upgrade System.UI"
   * hint), the singleton rtId (null when not created yet), and the role rules.
   */
  async loadConfig(): Promise<TreeNavigationConfig> {
    const { typePresent, rtId, rawRoles } = await this.fetchSingleton();
    const roles: TreeNavigationRoleConfig[] = [];
    for (const raw of rawRoles) {
      if (!raw?.sourceCkTypeId || !raw?.roleId) {
        continue;
      }
      roles.push({
        sourceCkTypeId: raw.sourceCkTypeId,
        roleId: raw.roleId,
        visible: raw.visible ?? undefined,
        displayName: raw.displayName ?? undefined,
        sortIndex: raw.sortIndex ?? undefined,
        grouped: raw.grouped ?? undefined,
        icon: raw.icon ?? undefined,
      });
    }
    return { typePresent, rtId, roles };
  }

  /**
   * Creates or updates the singleton with the given rules, then invalidates the
   * resolve cache so the trees pick up the change on the next expand. Returns the
   * singleton rtId.
   */
  async saveConfig(
    rtId: string | null,
    roles: TreeNavigationRoleConfig[],
  ): Promise<string> {
    const cleanRoles = roles
      .filter((r) => r.sourceCkTypeId && r.roleId)
      .map((r) => this.toRoleInput(r));

    let savedRtId: string;
    if (rtId) {
      const result = await firstValueFrom(
        this.apollo.mutate<{
          runtime?: {
            systemUITreeNavigationConfigurations?: {
              update?: ({ rtId?: string } | null)[] | null;
            };
          };
        }>({
          mutation: UPDATE_CONFIG_MUTATION,
          variables: { entities: [{ rtId, item: { roles: cleanRoles } }] },
          fetchPolicy: 'no-cache',
        }),
      );
      savedRtId =
        result.data?.runtime?.systemUITreeNavigationConfigurations?.update?.[0]
          ?.rtId ?? rtId;
    } else {
      const result = await firstValueFrom(
        this.apollo.mutate<{
          runtime?: {
            systemUITreeNavigationConfigurations?: {
              create?: ({ rtId?: string } | null)[] | null;
            };
          };
        }>({
          mutation: CREATE_CONFIG_MUTATION,
          variables: {
            entities: [
              {
                rtWellKnownName: CONFIG_WELL_KNOWN_NAME,
                name: 'Tree Navigation',
                roles: cleanRoles,
              },
            ],
          },
          fetchPolicy: 'no-cache',
        }),
      );
      const created =
        result.data?.runtime?.systemUITreeNavigationConfigurations?.create?.[0]
          ?.rtId;
      if (!created) {
        throw new Error('createTreeNavigationConfiguration returned no entity');
      }
      savedRtId = created;
    }

    this.reset();
    return savedRtId;
  }

  /** Drops undefined fields so the record-array input only carries set values. */
  private toRoleInput(role: TreeNavigationRoleConfig): Record<string, unknown> {
    const input: Record<string, unknown> = {
      sourceCkTypeId: role.sourceCkTypeId,
      roleId: role.roleId,
    };
    if (role.visible !== undefined) input['visible'] = role.visible;
    if (role.displayName !== undefined && role.displayName !== '') {
      input['displayName'] = role.displayName;
    }
    if (role.sortIndex !== undefined && role.sortIndex !== null) {
      input['sortIndex'] = role.sortIndex;
    }
    if (role.grouped !== undefined) input['grouped'] = role.grouped;
    if (role.icon !== undefined && role.icon !== '') input['icon'] = role.icon;
    return input;
  }

  /** Probes the CK schema and (when present) loads the singleton's raw roles. */
  private async fetchSingleton(): Promise<{
    typePresent: boolean;
    rtId: string | null;
    rawRoles: (RawRole | null)[];
  }> {
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
      return { typePresent: false, rtId: null, rawRoles: [] };
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
    const item =
      result.data?.runtime?.systemUITreeNavigationConfiguration?.items?.[0];
    return {
      typePresent: true,
      rtId: item?.rtId ?? null,
      rawRoles: item?.roles ?? [],
    };
  }
}

export const TREE_NAVIGATION_CONFIG_CONSTANTS = {
  CONFIG_CK_TYPE_ID,
  CONFIG_WELL_KNOWN_NAME,
  WILDCARD,
};
