import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeMap, readMap, listMaps, removeMap } from './mapStore.js';

describe('mapStore', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-store-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a map to disk and reads it back', async () => {
    const saved = await writeMap(dir, {
      id: 'map-1',
      name: 'Alpha',
      nodes: { root: { id: 'root', text: 'Root' } },
    });
    expect(saved.nodeCount).toBe(1);
    expect(saved.lastUpdated).toBeTruthy();

    const got = await readMap(dir, 'map-1');
    expect(got.name).toBe('Alpha');
    expect(fs.existsSync(path.join(dir, 'map-1.json'))).toBe(true);
  });

  it('rejects ids that could escape the data directory', async () => {
    await expect(writeMap(dir, { id: '../evil', nodes: {} })).rejects.toThrow();
    expect(await readMap(dir, '../evil')).toBeNull();
    expect(await readMap(dir, 'not-a-map-id')).toBeNull();
  });

  it('lists maps as metadata sorted newest first', async () => {
    await writeMap(dir, { id: 'map-1', name: 'One', nodes: {} });
    await new Promise((r) => setTimeout(r, 5));
    await writeMap(dir, { id: 'map-2', name: 'Two', nodes: {} });

    const list = await listMaps(dir);
    expect(list.map((m) => m.id)).toEqual(['map-2', 'map-1']);
    expect(list[0]).not.toHaveProperty('nodes'); // metadata only
  });

  it('removes a map', async () => {
    await writeMap(dir, { id: 'map-1', name: 'Alpha', nodes: {} });
    await removeMap(dir, 'map-1');
    expect(await readMap(dir, 'map-1')).toBeNull();
  });

  it('returns null when reading a missing map', async () => {
    expect(await readMap(dir, 'map-nope')).toBeNull();
  });
});
