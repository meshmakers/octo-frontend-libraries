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

/** How a perspective determines its root nodes. */
export type PerspectiveRootMode = 'Spatial' | 'Type';

/** Direction a perspective's primary role is navigated from the root node. */
export type PerspectiveDirection = 'Inbound' | 'Outbound';

/**
 * One switchable tree perspective (AB#4263). A perspective defines its own root
 * (the spatial ParentChild tree, or all instances of a CK type) and an optional
 * primary/secondary navigation whitelist applied at the root level. The built-in
 * `Spatial` perspective is synthesized by the data source and is not stored.
 */
export interface PerspectiveDefinition {
  /** Stable key, unique within the tenant (e.g. `Spatial`, `Systems`). */
  key: string;
  /** Label shown in the perspective switcher. */
  displayName: string;
  /** Switcher ordering hint (ascending). */
  sortIndex?: number;
  /** Icon name for the switcher entry (resolved by the frontend). */
  icon?: string;
  /** `Spatial` = all Basic/Tree entities; `Type` = all instances of rootCkTypeId. */
  rootMode: PerspectiveRootMode;
  /** Runtime CK type id whose instances form the roots when rootMode = `Type`. */
  rootCkTypeId?: string;
  /** Association role flattened directly under each root node (like ParentChild). */
  primaryRoleId?: string;
  /** Direction the primary role is navigated (default: Inbound / containment side). */
  primaryDirection?: PerspectiveDirection;
  /** Additional roles shown as group nodes directly under each root node. */
  secondaryRoleIds?: string[];
}

/** The full configuration as loaded for editing. */
export interface TreeNavigationConfig {
  /** rtId of the singleton, or null when it does not exist yet. */
  rtId: string | null;
  /** True when the CK type is installed on the tenant (System.UI >= 2.2.0). */
  typePresent: boolean;
  roles: TreeNavigationRoleConfig[];
  /** Configured extra perspectives (excludes the built-in spatial one). */
  perspectives: PerspectiveDefinition[];
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

interface RawPerspective {
  key?: string | null;
  displayName?: string | null;
  sortIndex?: number | null;
  icon?: string | null;
  rootMode?: string | null;
  rootCkTypeId?: string | null;
  primaryRoleId?: string | null;
  primaryDirection?: string | null;
  secondaryRoleIds?: (string | null)[] | null;
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
 * Loads the singleton's `perspectives` array (AB#4263). Kept SEPARATE from
 * CONFIG_QUERY on purpose: the `perspectives` field only exists in the tenant
 * schema when System.UI >= 2.3.0. On a tenant still on System.UI 2.2.0 the type
 * IS present (so the type-exists probe passes) but this field is not, which would
 * raise a GraphQL validation error for the whole operation. Isolating it here
 * lets `fetchPerspectives` swallow that error so the 2.2.0 roles feature keeps
 * working and perspectives simply come back empty.
 */
const CONFIG_PERSPECTIVES_QUERY = gql`
  query getTreeNavigationPerspectives {
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
          perspectives {
            key
            displayName
            sortIndex
            icon
            rootMode
            rootCkTypeId
            primaryRoleId
            primaryDirection
            secondaryRoleIds
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

  /** Configured extra perspectives; cached for the session. */
  private perspectivesPromise?: Promise<PerspectiveDefinition[]>;

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
    this.perspectivesPromise = undefined;
  }

  /**
   * Returns the configured extra tree perspectives (AB#4263), sorted by
   * sortIndex then displayName. Returns [] when the CK type is absent
   * (System.UI < 2.3.0) or none are configured. The built-in spatial
   * perspective is synthesized by the data source and is NOT included here.
   */
  perspectives(): Promise<PerspectiveDefinition[]> {
    if (!this.perspectivesPromise) {
      this.perspectivesPromise = this.loadPerspectives().catch((error) => {
        console.error('Error loading tree navigation perspectives', error);
        this.perspectivesPromise = undefined;
        return [];
      });
    }
    return this.perspectivesPromise;
  }

  private async loadPerspectives(): Promise<PerspectiveDefinition[]> {
    // Skip the singleton entirely when the CK type is not installed at all.
    if (!(await this.probeTypePresent())) {
      return [];
    }
    const rawPerspectives = await this.fetchPerspectivesRaw();
    return rawPerspectives
      .map((raw) => this.toPerspectiveDefinition(raw))
      .filter((p): p is PerspectiveDefinition => p !== null)
      .sort(
        (a, b) =>
          (a.sortIndex ?? Number.MAX_SAFE_INTEGER) -
            (b.sortIndex ?? Number.MAX_SAFE_INTEGER) ||
          a.displayName.localeCompare(b.displayName),
      );
  }

  /** Maps a raw perspective record to a definition, dropping invalid rows. */
  private toPerspectiveDefinition(
    raw: RawPerspective | null,
  ): PerspectiveDefinition | null {
    const key = raw?.key?.trim();
    if (!key) {
      return null;
    }
    const rootMode: PerspectiveRootMode =
      raw?.rootMode === 'Type' ? 'Type' : 'Spatial';
    const secondary = (raw?.secondaryRoleIds ?? [])
      .map((r) => (typeof r === 'string' ? r : ''))
      .filter((r) => r.length > 0);
    return {
      key,
      displayName: raw?.displayName?.trim() || key,
      sortIndex: raw?.sortIndex ?? undefined,
      icon: raw?.icon ?? undefined,
      rootMode,
      rootCkTypeId: raw?.rootCkTypeId ?? undefined,
      primaryRoleId: raw?.primaryRoleId ?? undefined,
      primaryDirection:
        raw?.primaryDirection === 'Outbound' ? 'Outbound' : undefined,
      secondaryRoleIds: secondary.length > 0 ? secondary : undefined,
    };
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
    const rawPerspectives = typePresent ? await this.fetchPerspectivesRaw() : [];
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
    const perspectives = rawPerspectives
      .map((raw) => this.toPerspectiveDefinition(raw))
      .filter((p): p is PerspectiveDefinition => p !== null);
    return { typePresent, rtId, roles, perspectives };
  }

  /**
   * Creates or updates the singleton with the given rules and perspectives, then
   * invalidates the resolve/perspective cache so the trees pick up the change on
   * the next expand. Returns the singleton rtId.
   */
  async saveConfig(
    rtId: string | null,
    roles: TreeNavigationRoleConfig[],
    perspectives: PerspectiveDefinition[] = [],
  ): Promise<string> {
    const cleanRoles = roles
      .filter((r) => r.sourceCkTypeId && r.roleId)
      .map((r) => this.toRoleInput(r));
    const cleanPerspectives = perspectives
      .filter((p) => p.key)
      .map((p) => this.toPerspectiveInput(p));

    // Only send `perspectives` when non-empty: on a System.UI 2.2.0 tenant the
    // input type has no `perspectives` field, so including it (even as []) would
    // fail validation and break roles saving. Trade-off: clearing the last
    // perspective on 2.3.0 is not persisted via save (edge case).
    let savedRtId: string;
    if (rtId) {
      const item: Record<string, unknown> = { roles: cleanRoles };
      if (cleanPerspectives.length > 0) {
        item['perspectives'] = cleanPerspectives;
      }
      const result = await firstValueFrom(
        this.apollo.mutate<{
          runtime?: {
            systemUITreeNavigationConfigurations?: {
              update?: ({ rtId?: string } | null)[] | null;
            };
          };
        }>({
          mutation: UPDATE_CONFIG_MUTATION,
          variables: {
            entities: [{ rtId, item }],
          },
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
                ...(cleanPerspectives.length > 0
                  ? { perspectives: cleanPerspectives }
                  : {}),
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

  /** Drops undefined/empty fields so the perspective input only carries set values. */
  private toPerspectiveInput(
    p: PerspectiveDefinition,
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {
      key: p.key,
      displayName: p.displayName || p.key,
      rootMode: p.rootMode,
    };
    if (p.sortIndex !== undefined && p.sortIndex !== null) {
      input['sortIndex'] = p.sortIndex;
    }
    if (p.icon) input['icon'] = p.icon;
    if (p.rootCkTypeId) input['rootCkTypeId'] = p.rootCkTypeId;
    if (p.primaryRoleId) input['primaryRoleId'] = p.primaryRoleId;
    if (p.primaryDirection) input['primaryDirection'] = p.primaryDirection;
    if (p.secondaryRoleIds && p.secondaryRoleIds.length > 0) {
      input['secondaryRoleIds'] = p.secondaryRoleIds;
    }
    return input;
  }

  /**
   * Probes whether the `System.UI/TreeNavigationConfiguration` CK type is
   * installed on the tenant (System.UI >= 2.2.0). Uses the always-valid
   * `constructionKit.types` query so it never raises a schema validation error.
   */
  private async probeTypePresent(): Promise<boolean> {
    const exists = await firstValueFrom(
      this.apollo.query<{
        constructionKit?: {
          types?: { items?: ({ rtCkTypeId?: string } | null)[] | null } | null;
        };
      }>({ query: CONFIG_TYPE_EXISTS_QUERY, fetchPolicy: 'network-only' }),
    );
    return (exists.data?.constructionKit?.types?.items?.length ?? 0) > 0;
  }

  /**
   * Probes the CK schema and (when present) loads the singleton's raw roles.
   * Perspectives are loaded separately (see fetchPerspectivesRaw) so a System.UI
   * 2.2.0 tenant (type present but no `perspectives` field yet) keeps its roles.
   */
  private async fetchSingleton(): Promise<{
    typePresent: boolean;
    rtId: string | null;
    rawRoles: (RawRole | null)[];
  }> {
    if (!(await this.probeTypePresent())) {
      return { typePresent: false, rtId: null, rawRoles: [] };
    }

    const result = await firstValueFrom(
      this.apollo.query<{
        runtime?: {
          systemUITreeNavigationConfiguration?: {
            items?:
              | ({
                rtId?: string;
                roles?: RawRole[] | null;
              } | null)[]
              | null;
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

  /**
   * Loads the singleton's raw perspectives, tolerating the System.UI 2.2.0 case
   * where the `perspectives` field does not yet exist (GraphQL validation error).
   * Any failure yields an empty list so roles loading is never affected.
   */
  private async fetchPerspectivesRaw(): Promise<(RawPerspective | null)[]> {
    try {
      const result = await firstValueFrom(
        this.apollo.query<{
          runtime?: {
            systemUITreeNavigationConfiguration?: {
              items?:
                | ({ perspectives?: RawPerspective[] | null } | null)[]
                | null;
            } | null;
          };
        }>({ query: CONFIG_PERSPECTIVES_QUERY, fetchPolicy: 'network-only' }),
      );
      return (
        result.data?.runtime?.systemUITreeNavigationConfiguration?.items?.[0]
          ?.perspectives ?? []
      );
    } catch {
      // System.UI 2.2.0: `perspectives` field absent → validation error. Degrade
      // to no perspectives; the roles query above is unaffected.
      return [];
    }
  }
}

export const TREE_NAVIGATION_CONFIG_CONSTANTS = {
  CONFIG_CK_TYPE_ID,
  CONFIG_WELL_KNOWN_NAME,
  WILDCARD,
};
