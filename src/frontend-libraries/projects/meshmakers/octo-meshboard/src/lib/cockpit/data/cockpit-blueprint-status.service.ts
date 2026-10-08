import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CockpitBlueprintStatusDtoGQL, CockpitBlueprintStatusQueryDto } from '../../graphQL/cockpitBlueprintStatus';

/** Catalog entries read with the installations (one page; the catalog lists one entry per name and version). */
export const COCKPIT_BLUEPRINT_CATALOG_LIMIT = 500;
const SHARE_MS = 10_000;

/**
 * Blueprints whose name starts with `System.` are service-managed: the owning service applies and
 * rolls them forward per tenant (mirrors `BlueprintIdExtensions.IsServiceManaged`).
 */
export const SERVICE_MANAGED_BLUEPRINT_PREFIX = 'System.';

/** One installed blueprint with the highest version the catalogs offer for its name. */
export interface CockpitBlueprintUpdate {
  name: string;
  installedVersion: string;
  availableVersion: string;
  isServiceManaged: boolean;
}

/** Installed blueprints of the tenant compared with the catalogs (AB#5558, system cockpit). */
export interface CockpitBlueprintStatus {
  /** Installed root blueprints (dependencies pulled in by another blueprint are not counted). */
  installed: number;
  /** Installed blueprints with a strictly higher catalog version; installed by the tenant first, then service-managed. */
  updates: CockpitBlueprintUpdate[];
  /** Catalog entries read and available; more available than read = updates may be missing. */
  catalogRead: number;
  catalogTotal: number;
}

/**
 * `Name-Version` → parts. Splits at the last dash, like the Studio's blueprint pages (a `CkVersion`
 * never contains a dash).
 */
export function splitBlueprintId(blueprintId: string): { name: string; version: string } {
  const index = blueprintId.lastIndexOf('-');
  return index < 0 ? { name: blueprintId, version: '' } : { name: blueprintId.slice(0, index), version: blueprintId.slice(index + 1) };
}

/**
 * Compares two blueprint versions like the backend's `CkVersion` (`Major.Minor.Revision`,
 * numeric, missing components 0): negative when `a` is older, positive when newer. A string
 * comparison would rate `2.10.0` below `2.9.0` (AB#4837).
 */
export function compareBlueprintVersions(a: string, b: string): number {
  const left = versionComponents(a);
  const right = versionComponents(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
}

function versionComponents(version: string): number[] {
  const parts = version.split('.');
  return [0, 1, 2].map(i => {
    const parsed = Number.parseInt(parts[i] ?? '', 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });
}

/** The status from one `cockpitBlueprintStatus` answer. */
export function toBlueprintStatus(data: CockpitBlueprintStatusQueryDto | null | undefined): CockpitBlueprintStatus {
  const installations = data?.blueprints?.installations ?? [];
  const catalog = data?.blueprints?.list;
  const highest = new Map<string, string>();
  for (const item of catalog?.items ?? []) {
    if (!item?.name || !item.version) {
      continue;
    }
    const known = highest.get(item.name);
    if (!known || compareBlueprintVersions(item.version, known) > 0) {
      highest.set(item.name, item.version);
    }
  }
  const updates: CockpitBlueprintUpdate[] = [];
  let installed = 0;
  for (const installation of installations) {
    if (!installation?.blueprintId) {
      continue;
    }
    if (!installation.isDependency) {
      installed++;
    }
    const { name, version } = splitBlueprintId(installation.blueprintId);
    const available = highest.get(name);
    if (available && compareBlueprintVersions(available, version) > 0) {
      updates.push({ name, installedVersion: version, availableVersion: available, isServiceManaged: name.startsWith(SERVICE_MANAGED_BLUEPRINT_PREFIX) });
    }
  }
  updates.sort((a, b) => Number(a.isServiceManaged) - Number(b.isServiceManaged) || a.name.localeCompare(b.name));
  const read = catalog?.items?.length ?? 0;
  return { installed, updates, catalogRead: read, catalogTotal: Math.max(catalog?.totalCount ?? 0, read) };
}

/**
 * The tenant's blueprint status, shared for a few seconds per tenant between the "Blueprint
 * updates" KPI and the attention check.
 */
@Injectable({ providedIn: 'root' })
export class CockpitBlueprintStatusService {
  private readonly gql = inject(CockpitBlueprintStatusDtoGQL);
  private readonly shared = new Map<string, { at: number; status: Observable<CockpitBlueprintStatus> }>();

  status(tenantId: string, now = Date.now()): Observable<CockpitBlueprintStatus> {
    const cached = this.shared.get(tenantId);
    if (cached && now - cached.at <= SHARE_MS) {
      return cached.status;
    }
    const status = this.gql.fetch({ variables: { take: COCKPIT_BLUEPRINT_CATALOG_LIMIT }, fetchPolicy: 'network-only' }).pipe(
      map(result => toBlueprintStatus(result.data)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.shared.set(tenantId, { at: now, status });
    return status;
  }
}
