import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleMapsApi, getDataDir } from './mapStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5515;
const DATA_DIR = getDataDir(__dirname);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // Mind map REST API (persists to disk under ./data) takes precedence.
  if (await handleMapsApi(req, res, DATA_DIR)) return;

  // Get route path (stripping out any query params)
  const reqUrl = req.url || '/';
  const parsedPath = decodeURIComponent(reqUrl.split('?')[0]);
  const relativePath = parsedPath === '/' ? 'index.html' : parsedPath;
  const distRoot = path.join(__dirname, 'dist');
  const filePath = path.normalize(path.join(distRoot, relativePath));

  // Reject any path that escapes the dist root (e.g. /../server.js)
  if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // fallback to index.html for client-side routing fallback
        fs.readFile(path.join(__dirname, 'dist', 'index.html'), (fallbackError, fallbackContent) => {
          if (fallbackError) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found - Please compile the project first using "npm run build"');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallbackContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Local MindMap server running at http://localhost:${PORT}/`);
  console.log(`Open your browser and navigate to http://localhost:${PORT}/ to start.`);
});
