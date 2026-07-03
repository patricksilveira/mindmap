// Mind map persistence.
//
// Primary store is the server's disk-backed REST API (/api/maps), so maps live
// as JSON files on disk and survive browser data clears, eviction, and browser
// switches. When the API is unreachable (e.g. the app is opened as a static
// file with no server), we fall back to the legacy IndexedDB store so the app
// still works. On first contact with an empty server we migrate any existing
// IndexedDB maps up to disk (copy, not move — IndexedDB is left intact).

const API_BASE = '/api/maps';

const DB_NAME = 'LocalMindMapDB';
const DB_VERSION = 1;
const STORE_NAME = 'mindmaps';

/* ------------------------------------------------------------------ *
 * IndexedDB (legacy store: migration source + offline fallback)
 * ------------------------------------------------------------------ */

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function idbGetAllFull() {
  return initDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  }));
}

function idbGetAllMeta() {
  return idbGetAllFull().then((maps) =>
    maps
      .map(({ id, name, lastUpdated, nodeCount }) => ({ id, name, lastUpdated, nodeCount }))
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
  );
}

function idbGet(id) {
  return initDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  }));
}

function idbPut(map) {
  return initDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(map);
    request.onsuccess = () => resolve(map);
    request.onerror = (event) => reject(event.target.error);
  }));
}

function idbDelete(id) {
  return initDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  }));
}

/* ------------------------------------------------------------------ *
 * Mode detection: server (disk) vs local (IndexedDB fallback)
 * ------------------------------------------------------------------ */

let modePromise = null;

function detectMode() {
  if (modePromise) return modePromise;
  modePromise = (async () => {
    try {
      const res = await fetch(API_BASE, { method: 'GET' });
      if (!res.ok) return 'local';
      const serverMaps = await res.json();

      // Empty server + existing local maps → migrate them up to disk once.
      if (Array.isArray(serverMaps) && serverMaps.length === 0) {
        let local = [];
        try {
          local = await idbGetAllFull();
        } catch {
          local = [];
        }
        for (const map of local) {
          try {
            await fetch(`${API_BASE}/${map.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(map),
            });
          } catch {
            // best effort; leave the IndexedDB copy in place
          }
        }
      }
      return 'server';
    } catch {
      return 'local';
    }
  })();
  return modePromise;
}

/* ------------------------------------------------------------------ *
 * Public API (stable across both storage modes)
 * ------------------------------------------------------------------ */

/** Retrieves all saved mind maps (metadata only), newest first. */
export async function getAllMaps() {
  if ((await detectMode()) === 'server') {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`Failed to list maps (${res.status})`);
    return res.json();
  }
  return idbGetAllMeta();
}

/** Retrieves a single mind map by id (undefined if not found). */
export async function getMap(id) {
  if ((await detectMode()) === 'server') {
    const res = await fetch(`${API_BASE}/${id}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`Failed to load map (${res.status})`);
    return res.json();
  }
  return idbGet(id);
}

/** Saves (inserts or updates) a mind map. */
export async function saveMap(map) {
  const nodeCount = map.nodes ? Object.keys(map.nodes).length : 0;
  const updatedMap = { ...map, nodeCount, lastUpdated: new Date().toISOString() };

  if ((await detectMode()) === 'server') {
    const res = await fetch(`${API_BASE}/${map.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMap),
    });
    if (!res.ok) throw new Error(`Failed to save map (${res.status})`);
    return res.json();
  }
  await idbPut(updatedMap);
  return updatedMap;
}

/** Deletes a mind map. */
export async function deleteMap(id) {
  if ((await detectMode()) === 'server') {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to delete map (${res.status})`);
    return;
  }
  await idbDelete(id);
}

/** Duplicates a mind map. */
export async function duplicateMap(id) {
  const map = await getMap(id);
  if (!map) throw new Error('Mind map not found');

  const newId = `map-${Date.now()}`;
  const duplicatedMap = { ...map, id: newId, name: `${map.name} Copy` };
  return saveMap(duplicatedMap);
}

/** Creates a brand new empty mind map object. */
export function createNewMapData(name = 'Untitled Mind Map') {
  const id = `map-${Date.now()}`;
  return {
    id,
    name,
    lastUpdated: new Date().toISOString(),
    nodeCount: 1,
    nodes: {
      root: {
        id: 'root',
        text: name,
        color: '#6366f1', // default purple accent
        emoji: '💡',
        children: [],
        notes: '',
        isRoot: true,
      },
    },
  };
}
