import { ActivatedRouteSnapshot } from '@angular/router';
import { AssistantContextChip, AssistantExplainTarget } from './assistant.models';
import { AssistantMessages, formatAssistantMessage, resolveAssistantMessages } from './assistant.messages';

/** Route params that name the object a page shows (detail pages, editors). */
const ENTITY_PARAM = /^(rtId|id|[a-zA-Z]+Id|userName)$/;
/** Params that are scope, not the object. */
const SCOPE_PARAMS = new Set(['tenantId']);

/** Inputs of {@link deriveAssistantContext}, all read from the shell. */
export interface AssistantContextSource {
  /** Root of the router state snapshot. */
  root: ActivatedRouteSnapshot | null | undefined;
  /** Router URL of the page (query and fragment are dropped). */
  url: string;
  /** Breadcrumb labels of the page, root first. */
  breadcrumbs: string[];
  /** Active rail area and tab (see `ASSISTANT_PAGE_CONTEXT`). */
  areaText?: string | null;
  tabText?: string | null;
  /** Entity set explicitly by an Explain entry point; wins over the route. */
  explicitEntity?: AssistantExplainTarget | null;
}

/**
 * Turns the current route into the panel's context chips (ui-concept §5.3):
 * tenant, page ("Area › Tab", else the breadcrumb) and the selected entity — the
 * one an Explain entry point named, otherwise the deepest id-like route param
 * (labelled with the last breadcrumb). Pure, so it is tested without a router.
 */
export function deriveAssistantContext(
  source: AssistantContextSource,
  messages?: Partial<AssistantMessages> | null
): AssistantContextChip[] {
  const m = resolveAssistantMessages(messages);
  const params = collectParams(source.root);
  const chips: AssistantContextChip[] = [];

  const tenantId = params.get('tenantId');
  if (tenantId) {
    chips.push({ id: `tenant:${tenantId}`, kind: 'tenant', label: formatAssistantMessage(m.contextTenant, { tenant: tenantId }), value: tenantId });
  }

  const path = source.url.split('#')[0].split('?')[0];
  const pageLabel = source.areaText && source.tabText && source.tabText !== source.areaText
    ? `${source.areaText} › ${source.tabText}`
    : source.tabText ?? source.areaText ?? source.breadcrumbs[0] ?? null;
  if (pageLabel && path) {
    chips.push({ id: `page:${path}`, kind: 'page', label: formatAssistantMessage(m.contextPage, { page: pageLabel }), value: path });
  }

  const explicit = source.explicitEntity;
  if (explicit) {
    const value = explicit.rtId ?? explicit.ckTypeId ?? explicit.label;
    chips.push({
      id: `entity:${value}`, kind: 'entity', label: explicit.label, value,
      ...(explicit.ckTypeId ? { ckTypeId: explicit.ckTypeId } : {})
    });
    return chips;
  }

  const entity = [...params.entries()].reverse().find(([name]) => !SCOPE_PARAMS.has(name) && ENTITY_PARAM.test(name));
  if (entity) {
    const [, value] = entity;
    const crumbs = source.breadcrumbs;
    const label = crumbs.length > 1 ? crumbs[crumbs.length - 1] : value;
    chips.push({ id: `entity:${value}`, kind: 'entity', label, value });
  }
  return chips;
}

/** Params from the root to the deepest primary child, in that order (later wins on clashes). */
function collectParams(root: ActivatedRouteSnapshot | null | undefined): Map<string, string> {
  const params = new Map<string, string>();
  let node: ActivatedRouteSnapshot | null | undefined = root;
  while (node) {
    for (const [name, value] of Object.entries(node.params ?? {})) {
      if (typeof value === 'string' && value) {
        params.delete(name);
        params.set(name, value);
      }
    }
    node = node.firstChild;
  }
  return params;
}
