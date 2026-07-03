// Filesystem-backed mind map store (Node only).
//
// Shared by server.js (production, launched via MindMap.app) and the Vite dev
// middleware (vite.config.js) so `npm run dev` and the packaged app talk to the
// same disk store. Never imported by browser code — keeps fs out of the bundle.
//
// Maps are stored one JSON file per map at <root>/data/<id>.json. Writes are
// atomic (tmp file + rename) so a crash mid-save can't corrupt an existing map.

import fs from 'fs';
import path from 'path';

// Map ids are generated as `map-<timestamp>`; restrict to that shape so a
// request path can never escape the data directory.
const ID_RE = /^map-[A-Za-z0-9_-]+$/;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

export function getDataDir(rootDir) {
  return path.join(rootDir, 'data');
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function nodeCountOf(map) {
  return map && map.nodes ? Object.keys(map.nodes).length : 0;
}

export async function listMaps(dataDir) {
  await ensureDir(dataDir);
  const files = await fs.promises.readdir(dataDir);
  const maps = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.promises.readFile(path.join(dataDir, file), 'utf-8');
      const map = JSON.parse(raw);
      maps.push({
        id: map.id,
        name: map.name,
        lastUpdated: map.lastUpdated,
        nodeCount: map.nodeCount ?? nodeCountOf(map),
      });
    } catch {
      // Skip unreadable/corrupt files rather than failing the whole listing.
    }
  }
  maps.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  return maps;
}

export async function readMap(dataDir, id) {
  if (!ID_RE.test(id)) return null;
  try {
    const raw = await fs.promises.readFile(path.join(dataDir, `${id}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeMap(dataDir, map) {
  if (!map || !ID_RE.test(map.id)) throw new Error('Invalid map id');
  await ensureDir(dataDir);
  const toSave = {
    ...map,
    nodeCount: nodeCountOf(map),
    lastUpdated: new Date().toISOString(),
  };
  const dest = path.join(dataDir, `${map.id}.json`);
  const tmp = `${dest}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(toSave, null, 2), 'utf-8');
  await fs.promises.rename(tmp, dest);
  return toSave;
}

export async function removeMap(dataDir, id) {
  if (!ID_RE.test(id)) return;
  try {
    await fs.promises.unlink(path.join(dataDir, `${id}.json`));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) reject(new Error('Request body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Handle a /api/maps request. Returns true if it matched (and a response was
 * sent), false if the caller should continue to its own routing.
 */
export async function handleMapsApi(req, res, dataDir) {
  const url = (req.url || '').split('?')[0];
  if (url !== '/api/maps' && !url.startsWith('/api/maps/')) return false;

  try {
    // Collection endpoint: list all maps (metadata only).
    if (url === '/api/maps' || url === '/api/maps/') {
      if (req.method === 'GET') {
        sendJson(res, 200, await listMaps(dataDir));
      } else {
        sendJson(res, 405, { error: 'Method not allowed' });
      }
      return true;
    }

    // Item endpoint: /api/maps/:id
    const id = decodeURIComponent(url.slice('/api/maps/'.length));
    if (!ID_RE.test(id)) {
      sendJson(res, 400, { error: 'Invalid map id' });
      return true;
    }

    if (req.method === 'GET') {
      const map = await readMap(dataDir, id);
      if (!map) sendJson(res, 404, { error: 'Not found' });
      else sendJson(res, 200, map);
      return true;
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      let map;
      try {
        map = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return true;
      }
      if (!map || map.id !== id) {
        sendJson(res, 400, { error: 'Map id mismatch' });
        return true;
      }
      sendJson(res, 200, await writeMap(dataDir, map));
      return true;
    }

    if (req.method === 'DELETE') {
      await removeMap(dataDir, id);
      res.writeHead(204);
      res.end();
      return true;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  } catch (e) {
    sendJson(res, 500, { error: (e && e.message) || String(e) });
    return true;
  }
}
