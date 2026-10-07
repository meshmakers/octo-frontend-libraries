import { PaletteGroup, PaletteQuery, PaletteResult } from './command-palette.models';

/** Match tiers: prefix > word-start > subsequence (ui-concept §4.2 rule 2). */
export enum MatchTier {
  None = 0,
  Fuzzy = 1,
  WordStart = 2,
  Prefix = 3
}

const TIER_WEIGHT = 100;
/** A keyword/path/id match counts like a label match of the same tier minus this. */
const SECONDARY_PENALTY = 40;
/** Frecency adds at most this — less than the gap between tiers, so it only orders within a tier. */
const FRECENCY_WEIGHT = 30;
/** `rankBoost` (pinned boards) adds at most this: more than any frecency, so pinned rows lead; both together stay below the tier gap. */
const RANK_BOOST_WEIGHT = 35;
const EXACT_MATCH_SCORE = 10_000;

/** Short queries (≤ 3 chars) list pages and actions first, longer ones entities (§4.2 rule 3). */
const SHORT_QUERY_ORDER: readonly PaletteGroup[] = ['recent', 'page', 'action', 'entity', 'board', 'tenant', 'ai'];
const LONG_QUERY_ORDER: readonly PaletteGroup[] = ['entity', 'page', 'board', 'action', 'tenant', 'recent', 'ai'];

/** Rows per group: a few for an empty query, more for a search, many when scoped by a prefix. */
const LIMIT_EMPTY = 6;
const LIMIT_SEARCH = 8;
const LIMIT_SCOPED = 50;

/** How well `text` matches `query` (both compared case-insensitively). */
export function matchTier(text: string | null | undefined, query: string): MatchTier {
  if (!text || !query) {
    return MatchTier.None;
  }
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.startsWith(needle)) {
    return MatchTier.Prefix;
  }
  if (haystack.split(/[\s/.\-_:›,()]+/).some(word => word.startsWith(needle))) {
    return MatchTier.WordStart;
  }
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) {
      index++;
      if (index === needle.length) {
        return MatchTier.Fuzzy;
      }
    }
  }
  return MatchTier.None;
}

/**
 * Score of one result for a query: 0 means "does not match". `frecency` is
 * the normalised (0…1) frecency of the result's recent key.
 */
export function scoreResult(result: PaletteResult, text: string, frecency = 0): number {
  const boost = Math.max(0, Math.min(1, frecency)) * FRECENCY_WEIGHT
    + Math.max(0, Math.min(1, result.rankBoost ?? 0)) * RANK_BOOST_WEIGHT;
  if (result.exactMatch) {
    return EXACT_MATCH_SCORE + boost;
  }
  if (!text) {
    return 1 + boost;
  }
  const labelTier = matchTier(result.label, text);
  const secondary = [...(result.keywords ?? []), ...(result.path ?? []), result.typeHint]
    .reduce<MatchTier>((best, candidate) => Math.max(best, matchTier(candidate, text)) as MatchTier, MatchTier.None);
  const labelScore = labelTier * TIER_WEIGHT;
  const secondaryScore = secondary > MatchTier.None ? secondary * TIER_WEIGHT - SECONDARY_PENALTY : 0;
  const base = Math.max(labelScore, secondaryScore);
  if (base === 0) {
    return result.alwaysShow ? 1 : 0;
  }
  return base + boost;
}

/** A section of the ranked palette list. */
export interface RankedGroup {
  group: PaletteGroup;
  results: PaletteResult[];
}

/**
 * Orders the rows of all providers into sections. Pure: the same input gives
 * the same output, so the palette can re-rank whenever a provider streams in
 * without the list jumping around for unchanged rows.
 *
 * - non-matching rows are dropped (except `alwaysShow`),
 * - rows sort by score within their group, ties by label,
 * - groups follow the short/long query order; a group holding an exact id match goes first,
 * - the assistant row (group `ai`) always stays last.
 */
export function rankResults(
  results: readonly PaletteResult[],
  query: PaletteQuery,
  frecencyOf: (key: string) => number = () => 0
): RankedGroup[] {
  const text = query.text;
  const scored = new Map<PaletteGroup, { result: PaletteResult; score: number }[]>();
  const seen = new Set<string>();
  for (const result of results) {
    if (seen.has(result.id)) {
      continue;
    }
    seen.add(result.id);
    const frecency = result.recentKey ? frecencyOf(result.recentKey) : 0;
    const score = scoreResult(result, text, frecency);
    if (score <= 0) {
      continue;
    }
    const bucket = scored.get(result.group) ?? [];
    bucket.push({ result, score });
    scored.set(result.group, bucket);
  }

  const limit = query.scope ? LIMIT_SCOPED : text ? LIMIT_SEARCH : LIMIT_EMPTY;
  const order = text.length <= 3 ? SHORT_QUERY_ORDER : LONG_QUERY_ORDER;
  const groups: (RankedGroup & { exact: boolean })[] = [];
  for (const [group, bucket] of scored) {
    bucket.sort((a, b) => b.score - a.score || a.result.label.localeCompare(b.result.label));
    groups.push({
      group,
      exact: bucket.some(entry => entry.result.exactMatch === true),
      results: bucket.slice(0, limit).map(entry => entry.result)
    });
  }
  groups.sort((a, b) => {
    if (a.group === 'ai' || b.group === 'ai') {
      return a.group === 'ai' ? 1 : -1;
    }
    if (a.exact !== b.exact) {
      return a.exact ? -1 : 1;
    }
    return order.indexOf(a.group) - order.indexOf(b.group);
  });
  return groups.map(({ group, results: rows }) => ({ group, results: rows }));
}

/** Splits a label into plain and highlighted parts for the first case-insensitive occurrence of `text`. */
export function highlightSegments(label: string, text: string): { text: string; match: boolean }[] {
  if (!text) {
    return [{ text: label, match: false }];
  }
  const index = label.toLowerCase().indexOf(text.toLowerCase());
  if (index < 0) {
    return [{ text: label, match: false }];
  }
  return [
    { text: label.slice(0, index), match: false },
    { text: label.slice(index, index + text.length), match: true },
    { text: label.slice(index + text.length), match: false }
  ].filter(segment => segment.text.length > 0);
}

/**
 * Keeps what the user already sees in place while results stream in for the
 * SAME query (ui-concept §4.2 rule 5): groups already shown keep their
 * position and new groups are appended below them (the assistant row stays
 * last); inside a group, rows already shown keep their order and late rows
 * are appended. Rows a provider no longer returns disappear. For a new query
 * the fresh ranking is used as is.
 */
export function stabilizeRanking(previous: readonly RankedGroup[], next: readonly RankedGroup[]): RankedGroup[] {
  if (previous.length === 0) {
    return [...next];
  }
  const nextByGroup = new Map(next.map(section => [section.group, section]));
  const ordered: RankedGroup[] = [];
  for (const old of previous) {
    const fresh = nextByGroup.get(old.group);
    if (!fresh || old.group === 'ai') {
      continue;
    }
    const freshIds = new Set(fresh.results.map(result => result.id));
    const freshById = new Map(fresh.results.map(result => [result.id, result]));
    const kept = old.results.filter(result => freshIds.has(result.id)).map(result => freshById.get(result.id) as PaletteResult);
    const keptIds = new Set(kept.map(result => result.id));
    ordered.push({ group: old.group, results: [...kept, ...fresh.results.filter(result => !keptIds.has(result.id))] });
    nextByGroup.delete(old.group);
  }
  for (const section of next) {
    if (nextByGroup.has(section.group) && section.group !== 'ai') {
      ordered.push(section);
    }
  }
  const ai = nextByGroup.get('ai') ?? next.find(section => section.group === 'ai');
  if (ai) {
    ordered.push(ai);
  }
  return ordered;
}
