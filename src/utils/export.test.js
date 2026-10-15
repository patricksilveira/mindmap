import { describe, it, expect } from 'vitest';
import { exportToMarkdown, exportToText, exportToSVG } from './export.js';
import { calculateLayout } from './layout.js';

const sampleMap = {
  name: 'Sample',
  nodes: {
    root: { id: 'root', text: 'Root', emoji: '', children: ['a'] },
    a: { id: 'a', text: 'Child', parentId: 'root', children: [], notes: 'a note' },
  },
};

describe('exportToMarkdown', () => {
  it('renders the root as a heading and children as bullets with notes', () => {
    const md = exportToMarkdown(sampleMap);
    expect(md).toContain('# Root');
    expect(md).toContain('- Child');
    expect(md).toContain('*(Note: a note)*');
  });

  it('returns empty string for an invalid map', () => {
    expect(exportToMarkdown(null)).toBe('');
    expect(exportToMarkdown({ nodes: {} })).toBe('');
  });
});

describe('exportToText', () => {
  it('indents children by depth and includes notes', () => {
    const txt = exportToText(sampleMap);
    expect(txt).toContain('Root');
    expect(txt).toContain('    Child'); // depth 1 -> 4 spaces
    expect(txt).toContain('[Note: a note]');
  });
});

describe('exportToSVG', () => {
  it('escapes XML-significant characters in node text', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a'] },
      a: { id: 'a', text: 'A & B <c>', parentId: 'root', children: [] },
    };
    const svg = exportToSVG({ nodes }, 'right', false);
    expect(svg).toContain('A &amp; B &lt;c&gt;');
  });

  it('draws connection lines to the dynamic node width, not the fixed default', () => {
    // Regression for the bug where SVG used NODE_WIDTH (180) instead of the
    // layout's real width, so lines missed the card edge on non-default nodes.
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a'] },
      a: { id: 'a', text: 'A', parentId: 'root', children: [] },
    };
    const layout = calculateLayout(nodes, 'right');
    const child = layout.a;
    expect(child.width).not.toBe(180); // precondition: dynamic width differs

    const svg = exportToSVG({ nodes }, 'right', false);
    const dynamicEndX = child.x - child.width / 2;
    const fixedEndX = child.x - 180 / 2;
    expect(svg).toContain(`${dynamicEndX} ${child.y}"`);
    expect(svg).not.toContain(`${fixedEndX} ${child.y}"`);
  });

  it('renders multiline text with tspan elements in SVG export', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['multi'] },
      multi: { id: 'multi', text: 'Line 1\nLine 2', parentId: 'root', children: [] },
    };
    const svg = exportToSVG({ nodes }, 'right', false);
    expect(svg).toContain('<tspan');
    expect(svg).toContain('Line 1');
    expect(svg).toContain('Line 2');
  });

  it('renders organograma layout in SVG export with bottom side connections', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a'] },
      a: { id: 'a', text: 'Child', parentId: 'root', children: [] },
    };
    const svg = exportToSVG({ nodes }, 'org', false);
    expect(svg).toContain('<path d="M');
    expect(svg).toBeDefined();
  });
});
