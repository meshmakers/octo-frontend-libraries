import type { ProcessConnection, ProcessDiagramConfig, ProcessElement } from '@meshmakers/octo-process-diagrams';

/**
 * Render-time validation of a stored process diagram (AB#8151).
 *
 * A diagram can be written through the API / MCP without the designer, so a single
 * element may lack its `config`, geometry or carry an unknown type. The widget
 * template dereferences those members directly; one bad element would throw during
 * change detection and take the whole MeshBoard down. {@link sanitizeProcessDiagram}
 * returns a copy that is safe to render plus the list of problems. The stored diagram
 * is never modified or written back.
 */

/** Element types the widget can render; every one of them except `pipe` carries a `config` object. */
const KNOWN_ELEMENT_TYPES: readonly string[] = [
  'tank', 'silo', 'vessel', 'pipe', 'valve', 'pump', 'motor', 'gauge',
  'digitalDisplay', 'statusLight', 'label', 'image', 'shape', 'customSvg'
];
const TYPES_WITHOUT_CONFIG: readonly string[] = ['pipe'];

/** One problem found in the diagram. */
export interface ProcessDiagramIssue {
  /** Element (or connection) id; `#<index>` when it has none. */
  id: string;
  /** Name shown to the user: element name, else id. */
  label: string;
  kind: 'element' | 'connection';
  reason: string;
  /** `<label>: <reason>`, for console and in-widget hint. */
  message: string;
}

/** Visible stand-in of a skipped element, with a geometry that is safe to draw. */
export interface ProcessElementPlaceholder {
  key: string;
  issue: ProcessDiagramIssue;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SanitizedProcessDiagram {
  /** The input itself when nothing was wrong, else a copy without the invalid elements/connections. */
  diagram: ProcessDiagramConfig;
  issues: ProcessDiagramIssue[];
  placeholders: ProcessElementPlaceholder[];
}

const FALLBACK_WIDTH = 160;
const FALLBACK_HEIGHT = 28;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasPosition(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && isFiniteNumber(value['x']) && isFiniteNumber(value['y']);
}

function hasSize(value: unknown): value is { width: number; height: number } {
  return isRecord(value) && isFiniteNumber(value['width']) && isFiniteNumber(value['height']);
}

function elementProblem(element: unknown): string | null {
  if (!isRecord(element)) {
    return 'not an object';
  }
  const problems: string[] = [];
  const type = element['type'];
  if (typeof type !== 'string' || !KNOWN_ELEMENT_TYPES.includes(type)) {
    problems.push(`unknown type '${String(type ?? '')}'`);
  } else if (!TYPES_WITHOUT_CONFIG.includes(type) && !isRecord(element['config'])) {
    problems.push('missing config');
  }
  if (!hasPosition(element['position'])) {
    problems.push('missing or invalid position');
  }
  if (!hasSize(element['size'])) {
    problems.push('missing or invalid size');
  }
  return problems.length > 0 ? problems.join(', ') : null;
}

function connectionProblem(connection: unknown): string | null {
  if (!isRecord(connection)) {
    return 'not an object';
  }
  const problems: string[] = [];
  if (typeof connection['id'] !== 'string' || connection['id'] === '') {
    problems.push('missing id');
  }
  const from = connection['from'];
  const to = connection['to'];
  if (!isRecord(from) || typeof from['elementId'] !== 'string' || !isRecord(to) || typeof to['elementId'] !== 'string') {
    problems.push('missing from/to element');
  }
  if (!isRecord(connection['style'])) {
    problems.push('missing style');
  }
  return problems.length > 0 ? problems.join(', ') : null;
}

function labelOf(item: unknown, index: number): { id: string; label: string } {
  if (isRecord(item)) {
    const id = typeof item['id'] === 'string' && item['id'] !== '' ? item['id'] : `#${index}`;
    const name = typeof item['name'] === 'string' && item['name'] !== '' ? item['name'] : id;
    return { id, label: name };
  }
  return { id: `#${index}`, label: `#${index}` };
}

/**
 * Splits the diagram into what can be rendered and what cannot.
 * Never throws, whatever shape `elements` / `connections` have.
 */
export function sanitizeProcessDiagram(diagram: ProcessDiagramConfig): SanitizedProcessDiagram {
  const issues: ProcessDiagramIssue[] = [];
  const placeholders: ProcessElementPlaceholder[] = [];

  const rawElements: unknown[] = Array.isArray(diagram.elements) ? diagram.elements : [];
  const elements: ProcessElement[] = [];
  let fallbackRow = 0;
  rawElements.forEach((element, index) => {
    const problem = elementProblem(element);
    if (!problem) {
      elements.push(element as ProcessElement);
      return;
    }
    const { id, label } = labelOf(element, index);
    const issue: ProcessDiagramIssue = { id, label, kind: 'element', reason: problem, message: `${label}: ${problem}` };
    issues.push(issue);
    const record = isRecord(element) ? element : {};
    const position = hasPosition(record['position']) ? record['position'] : { x: 8, y: 8 + fallbackRow++ * (FALLBACK_HEIGHT + 6) };
    const size = hasSize(record['size']) ? record['size'] : { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
    placeholders.push({
      key: `${id}@${index}`,
      issue,
      x: position.x,
      y: position.y,
      width: Math.max(size.width, 60),
      height: Math.max(size.height, FALLBACK_HEIGHT)
    });
  });

  const rawConnections: unknown[] = Array.isArray(diagram.connections) ? diagram.connections : [];
  const connections: ProcessConnection[] = [];
  rawConnections.forEach((connection, index) => {
    const problem = connectionProblem(connection);
    if (!problem) {
      connections.push(connection as ProcessConnection);
      return;
    }
    const { id, label } = labelOf(connection, index);
    issues.push({ id, label, kind: 'connection', reason: problem, message: `Connection ${label}: ${problem}` });
  });

  const clean =
    issues.length === 0 && Array.isArray(diagram.elements) && Array.isArray(diagram.connections);
  return {
    diagram: clean ? diagram : { ...diagram, elements, connections },
    issues,
    placeholders
  };
}

/** One line for the in-widget hint / dialog hint. */
export function describeProcessDiagramIssues(issues: readonly ProcessDiagramIssue[]): string {
  if (issues.length === 0) {
    return '';
  }
  const noun = issues.length === 1 ? 'item' : 'items';
  return `${issues.length} invalid diagram ${noun} skipped: ${issues.map(i => i.message).join('; ')}`;
}
