import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';

/** Runtime CK type id of the per-tenant mapping coverage configuration singleton. */
const CONFIG_CK_TYPE_ID = 'System.UI/MappingCoverageConfiguration';
/** rtWellKnownName of the singleton instance. */
const CONFIG_WELL_KNOWN_NAME = 'MappingCoverage';

/** The per-tenant mapping coverage configuration as loaded for editing. */
export interface MappingCoverageConfig {
  /** rtId of the singleton, or null when it does not exist yet. */
  rtId: string | null;
  /** True when the CK type is installed on the tenant (System.UI >= 2.4.0). */
  typePresent: boolean;
  /** CK types whose entities act as source candidates in the Orphan Sources tab. */
  sourceCandidateCkTypeIds: string[];
}

const CONFIG_TYPE_EXISTS_QUERY = gql`
  query mappingCoverageConfigTypeExists {
    constructionKit {
      types(rtCkId: "System.UI/MappingCoverageConfiguration", first: 1) {
        items {
          rtCkTypeId
        }
      }
    }
  }
`;

const CONFIG_QUERY = gql`
  query getMappingCoverageConfiguration {
    runtime {
      systemUIMappingCoverageConfiguration(
        first: 1
        fieldFilter: [
          {
            attributePath: "rtWellKnownName"
            operator: EQUALS
            comparisonValue: "MappingCoverage"
          }
        ]
      ) {
        items {
          rtId
          sourceCandidateCkTypeIds
        }
      }
    }
  }
`;

const CREATE_CONFIG_MUTATION = gql`
  mutation createMappingCoverageConfiguration(
    $entities: [SystemUIMappingCoverageConfigurationInput!]!
  ) {
    runtime {
      systemUIMappingCoverageConfigurations {
        create(entities: $entities) {
          rtId
        }
      }
    }
  }
`;

const UPDATE_CONFIG_MUTATION = gql`
  mutation updateMappingCoverageConfiguration(
    $entities: [SystemUIMappingCoverageConfigurationInputUpdate!]!
  ) {
    runtime {
      systemUIMappingCoverageConfigurations {
        update(entities: $entities) {
          rtId
        }
      }
    }
  }
`;

/**
 * Loads and saves the optional per-tenant `System.UI/MappingCoverageConfiguration`
 * singleton that carries the source-catalogue CK types for the Mapping Coverage
 * page's Orphan Sources tab.
 *
 * Design notes (mirrors {@link TreeNavigationConfigService}):
 * - The config entity is OPTIONAL. When the CK type is not installed on the
 *   tenant (System.UI < 2.4.0) or no instance exists, `loadConfig` reports
 *   `typePresent`/an empty list and the host can fall back (e.g. to its old
 *   localStorage persistence) without surfacing an error.
 * - The singleton field (`systemUIMappingCoverageConfiguration`) only exists in
 *   the tenant schema when the CK type is installed, so querying it blindly
 *   would raise a GraphQL validation error (and a user-facing toast). We first
 *   probe the CK schema with the always-valid `constructionKit.types` query and
 *   only run the singleton query when the type is present.
 * - Uses inline `gql` (not codegen) so the feature is decoupled from a schema
 *   re-introspection that includes the new CK type.
 * - No session cache: the page loads once per visit / tenant switch, so every
 *   `loadConfig` goes to the network and there is no reset-on-tenant-switch
 *   pitfall.
 */
@Injectable({
  providedIn: 'root',
})
export class MappingCoverageConfigService {
  private readonly apollo = inject(Apollo);

  /**
   * Loads the singleton. Returns `typePresent: false` (and an empty list) when
   * the CK type is not installed on the tenant; `rtId: null` when the type is
   * installed but no instance exists yet.
   */
  async loadConfig(): Promise<MappingCoverageConfig> {
    if (!(await this.probeTypePresent())) {
      return { rtId: null, typePresent: false, sourceCandidateCkTypeIds: [] };
    }

    const result = await firstValueFrom(
      this.apollo.query<{
        runtime?: {
          systemUIMappingCoverageConfiguration?: {
            items?:
              | ({
                  rtId?: string;
                  sourceCandidateCkTypeIds?: (string | null)[] | null;
                } | null)[]
              | null;
          } | null;
        };
      }>({ query: CONFIG_QUERY, fetchPolicy: 'network-only' }),
    );
    const item =
      result.data?.runtime?.systemUIMappingCoverageConfiguration?.items?.[0];
    const ids = (item?.sourceCandidateCkTypeIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    return {
      rtId: item?.rtId ?? null,
      typePresent: true,
      sourceCandidateCkTypeIds: ids,
    };
  }

  /**
   * Creates or updates the singleton with the given source CK types. Returns
   * the singleton rtId.
   */
  async saveConfig(
    rtId: string | null,
    sourceCandidateCkTypeIds: string[],
  ): Promise<string> {
    const cleanIds = sourceCandidateCkTypeIds.filter((id) => id.length > 0);

    if (rtId) {
      const result = await firstValueFrom(
        this.apollo.mutate<{
          runtime?: {
            systemUIMappingCoverageConfigurations?: {
              update?: ({ rtId?: string } | null)[] | null;
            };
          };
        }>({
          mutation: UPDATE_CONFIG_MUTATION,
          variables: {
            entities: [
              { rtId, item: { sourceCandidateCkTypeIds: cleanIds } },
            ],
          },
          fetchPolicy: 'no-cache',
        }),
      );
      return (
        result.data?.runtime?.systemUIMappingCoverageConfigurations?.update?.[0]
          ?.rtId ?? rtId
      );
    }

    const result = await firstValueFrom(
      this.apollo.mutate<{
        runtime?: {
          systemUIMappingCoverageConfigurations?: {
            create?: ({ rtId?: string } | null)[] | null;
          };
        };
      }>({
        mutation: CREATE_CONFIG_MUTATION,
        variables: {
          entities: [
            {
              rtWellKnownName: CONFIG_WELL_KNOWN_NAME,
              name: 'Mapping Coverage',
              sourceCandidateCkTypeIds: cleanIds,
            },
          ],
        },
        fetchPolicy: 'no-cache',
      }),
    );
    const created =
      result.data?.runtime?.systemUIMappingCoverageConfigurations?.create?.[0]
        ?.rtId;
    if (!created) {
      throw new Error('createMappingCoverageConfiguration returned no entity');
    }
    return created;
  }

  /**
   * Probes whether the `System.UI/MappingCoverageConfiguration` CK type is
   * installed on the tenant (System.UI >= 2.4.0). Uses the always-valid
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
}

export const MAPPING_COVERAGE_CONFIG_CONSTANTS = {
  CONFIG_CK_TYPE_ID,
  CONFIG_WELL_KNOWN_NAME,
};
