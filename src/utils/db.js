const DB_NAME = 'LocalMindMapDB';
const DB_VERSION = 1;
const STORE_NAME = 'mindmaps';

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Retrieves all saved mind maps (metadata only, excluding nodes for speed).
 * @returns {Promise<Array<Object>>}
 */
export async function getAllMaps() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const maps = request.result || [];
      // Return metadata sorted by lastUpdated descending
      const metadata = maps.map(({ id, name, lastUpdated, nodeCount }) => ({
        id,
        name,
        lastUpdated,
        nodeCount,
      })).sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
      resolve(metadata);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves a single mind map by ID.
 * @param {string} id 
 * @returns {Promise<Object>}
 */
export async function getMap(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Saves (inserts or updates) a mind map.
 * @param {Object} map 
 * @returns {Promise<Object>} The saved map
 */
export async function saveMap(map) {
  const db = await initDB();
  
  // Calculate node count
  const nodeCount = map.nodes ? Object.keys(map.nodes).length : 0;
  
  const updatedMap = {
    ...map,
    nodeCount,
    lastUpdated: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(updatedMap);

    request.onsuccess = () => {
      resolve(updatedMap);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Deletes a mind map.
 * @param {string} id 
 * @returns {Promise<void>}
 */
export async function deleteMap(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Duplicates a mind map.
 * @param {string} id 
 * @returns {Promise<Object>} The duplicated map
 */
export async function duplicateMap(id) {
  const map = await getMap(id);
  if (!map) throw new Error('Mind map not found');

  const newId = `map-${Date.now()}`;
  const duplicatedMap = {
    ...map,
    id: newId,
    name: `${map.name} Copy`,
  };

  return saveMap(duplicatedMap);
}

/**
 * Creates a brand new empty mind map object.
 * @param {string} [name]
 * @returns {Object}
 */
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
      }
    }
  };
}
