import type { ProcessDiagramConfig } from '@meshmakers/octo-process-diagrams';
import { describeProcessDiagramIssues, sanitizeProcessDiagram } from './process-diagram-validation';

/**
 * Render-time validation of stored process diagrams (AB#8151): a malformed element
 * is reported and skipped, valid ones stay, the input is never modified.
 */
describe('sanitizeProcessDiagram (AB#8151)', () => {
  const goodTank = {
    id: 'tank-ok', type: 'tank', name: 'Tank OK', position: { x: 10, y: 10 }, size: { width: 80, height: 120 },
    config: { shape: 'cylindrical', orientation: 'vertical', showLevel: true, showPercentage: true }
  };

  function diagram(elements: unknown[], connections: unknown[] = []): ProcessDiagramConfig {
    return {
      id: 'd', name: 'D', version: '1', canvas: { width: 400, height: 300 }, elements, connections
    } as unknown as ProcessDiagramConfig;
  }

  it('returns the very same diagram when everything is valid', () => {
    const input = diagram([goodTank, { id: 'p1', type: 'pipe', name: 'Pipe', position: { x: 0, y: 0 }, size: { width: 5, height: 5 } }]);

    const result = sanitizeProcessDiagram(input);

    expect(result.diagram).toBe(input);
    expect(result.issues).toEqual([]);
    expect(result.placeholders).toEqual([]);
  });

  it('skips a tank without config, names it and keeps its geometry for the placeholder', () => {
    const broken = { id: 'tank-bad', type: 'tank', name: 'Haupttank', position: { x: 50, y: 60 }, size: { width: 90, height: 130 } };
    const input = diagram([goodTank, broken]);

    const result = sanitizeProcessDiagram(input);

    expect(result.diagram.elements.map(e => e.id)).toEqual(['tank-ok']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual(expect.objectContaining({ id: 'tank-bad', label: 'Haupttank', reason: 'missing config', kind: 'element' }));
    expect(result.placeholders[0]).toEqual(expect.objectContaining({ x: 50, y: 60, width: 90, height: 130 }));
    // the stored diagram is not touched
    expect(input.elements).toHaveLength(2);
    expect(input.elements[1]).toBe(broken);
  });

  it('skips an element of unknown type', () => {
    const result = sanitizeProcessDiagram(diagram([
      goodTank,
      { id: 'x1', type: 'teleporter', name: 'X', position: { x: 1, y: 1 }, size: { width: 10, height: 10 }, config: {} }
    ]));

    expect(result.diagram.elements).toHaveLength(1);
    expect(result.issues[0].reason).toBe("unknown type 'teleporter'");
  });

  it('skips an element with missing geometry and places its placeholder on a fallback position', () => {
    const result = sanitizeProcessDiagram(diagram([
      { id: 'a', type: 'tank', config: {} },
      { id: 'b', type: 'label', name: 'B', size: { width: 'wide' }, config: {} }
    ]));

    expect(result.diagram.elements).toEqual([]);
    expect(result.issues.map(i => i.reason)).toEqual([
      'missing or invalid position, missing or invalid size',
      'missing or invalid position, missing or invalid size'
    ]);
    const [first, second] = result.placeholders;
    expect(Number.isFinite(first.x + first.y + first.width + first.height)).toBe(true);
    expect(second.y).toBeGreaterThan(first.y);
  });

  it('survives entries that are not objects and a non-array elements field', () => {
    const result = sanitizeProcessDiagram(diagram([null, 'x', 42, goodTank]));
    expect(result.diagram.elements.map(e => e.id)).toEqual(['tank-ok']);
    expect(result.issues.map(i => i.id)).toEqual(['#0', '#1', '#2']);

    const noElements = sanitizeProcessDiagram({ ...diagram([]), elements: undefined, connections: null } as unknown as ProcessDiagramConfig);
    expect(noElements.diagram.elements).toEqual([]);
    expect(noElements.diagram.connections).toEqual([]);
  });

  it('drops connections without from/to or style', () => {
    const okConnection = { id: 'c1', from: { elementId: 'a', port: 'top' }, to: { elementId: 'b', port: 'top' }, style: { strokeColor: '#000', strokeWidth: 2 } };
    const result = sanitizeProcessDiagram(diagram([goodTank], [okConnection, { id: 'c2', from: { elementId: 'a' } }]));

    expect(result.diagram.connections).toEqual([okConnection]);
    expect(result.issues).toEqual([expect.objectContaining({ kind: 'connection', id: 'c2' })]);
  });

  it('describes the issues in one line naming every element', () => {
    const result = sanitizeProcessDiagram(diagram([{ id: 't', type: 'tank', name: 'Tank 7', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } }]));

    expect(describeProcessDiagramIssues(result.issues)).toBe('1 invalid diagram item skipped: Tank 7: missing config');
    expect(describeProcessDiagramIssues([])).toBe('');
  });
});
