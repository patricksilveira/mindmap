import { describe, it, expect } from 'vitest';
import { calculateLayout } from './layout.js';

describe('calculateLayout', () => {
  it('returns an empty object for missing or rootless input', () => {
    expect(calculateLayout(null)).toEqual({});
    expect(calculateLayout({})).toEqual({});
  });

  it('places the root at the origin', () => {
    const nodes = { root: { id: 'root', text: 'Root', children: [] } };
    const layout = calculateLayout(nodes, 'split');
    expect(Object.keys(layout)).toHaveLength(1);
    expect(layout.root).toMatchObject({ x: 0, y: 0, side: 'root' });
  });

  it('alternates children left/right in split mode', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a', 'b', 'c'] },
      a: { id: 'a', text: 'A', parentId: 'root', children: [] },
      b: { id: 'b', text: 'B', parentId: 'root', children: [] },
      c: { id: 'c', text: 'C', parentId: 'root', children: [] },
    };
    const layout = calculateLayout(nodes, 'split');
    expect(layout.a.side).toBe('right');
    expect(layout.b.side).toBe('left');
    expect(layout.c.side).toBe('right');
    expect(layout.a.x).toBeGreaterThan(0);
    expect(layout.b.x).toBeLessThan(0);
  });

  it('puts every child on the right in right mode', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a', 'b'] },
      a: { id: 'a', text: 'A', parentId: 'root', children: [] },
      b: { id: 'b', text: 'B', parentId: 'root', children: [] },
    };
    const layout = calculateLayout(nodes, 'right');
    expect(layout.a.side).toBe('right');
    expect(layout.b.side).toBe('right');
    expect(layout.a.x).toBeGreaterThan(0);
    expect(layout.b.x).toBeGreaterThan(0);
  });

  it('excludes descendants of a collapsed node', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a'] },
      a: { id: 'a', text: 'A', parentId: 'root', children: ['b'], isCollapsed: true },
      b: { id: 'b', text: 'B', parentId: 'a', children: [] },
    };
    const layout = calculateLayout(nodes, 'right');
    expect(layout.a).toBeDefined();
    expect(layout.b).toBeUndefined();
  });

  it('stacks siblings at different vertical positions', () => {
    const nodes = {
      root: { id: 'root', text: 'R', children: ['a', 'b'] },
      a: { id: 'a', text: 'A', parentId: 'root', children: [] },
      b: { id: 'b', text: 'B', parentId: 'root', children: [] },
    };
    const layout = calculateLayout(nodes, 'right');
    expect(layout.a.y).not.toBe(layout.b.y);
  });

  it('clamps node width between the min and max bounds', () => {
    const long = 'x'.repeat(100);
    const nodes = {
      root: { id: 'root', text: 'R', children: ['wide', 'thin'] },
      wide: { id: 'wide', text: long, parentId: 'root', children: [] },
      thin: { id: 'thin', text: 'x', parentId: 'root', children: [] },
    };
    const layout = calculateLayout(nodes, 'right');
    expect(layout.wide.width).toBeLessThanOrEqual(300);
    expect(layout.thin.width).toBeGreaterThanOrEqual(120);
  });
});
