const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

function makeRequest(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`[PROXY] Fetching: ${url.substring(0, 100)}...`);

    const req = https.get(url, { timeout }, (res) => {
      const isVideo = res.headers['content-type'] && (
        res.headers['content-type'].includes('video') || 
        res.headers['content-type'].includes('octet-stream') ||
        res.headers['content-type'].includes('application/octet-stream')
      );

      console.log(`[PROXY] Status: ${res.statusCode}, Type: ${res.headers['content-type']}`);

      if (isVideo) {
        let buffer = Buffer.alloc(0);
        let chunks = 0;

        res.on('data', chunk => {
          buffer = Buffer.concat([buffer, chunk]);
          chunks++;
          if (chunks % 50 === 0) console.log(`[PROXY] Received ${chunks} chunks (${buffer.length} bytes)`);
        });

        res.on('end', () => {
          const elapsed = Date.now() - startTime;
          const base64 = buffer.toString('base64');
          const dataUrl = `data:video/mp4;base64,${base64}`;
          console.log(`[PROXY] Video complete: ${buffer.length} bytes in ${elapsed}ms`);
          resolve({ video_url: dataUrl });
        });
      } else {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const elapsed = Date.now() - startTime;
          try {
            const parsed = JSON.parse(data);
            console.log(`[PROXY] JSON parsed successfully in ${elapsed}ms`);
            resolve(parsed);
          } catch (err) {
            console.log(`[PROXY] JSON parse error: ${err.message}`);
            resolve({ 
              error: 'Invalid JSON response', 
              raw: data.substring(0, 1000),
              statusCode: res.statusCode
            });
          }
        });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`[PROXY] Request timeout after ${timeout}ms`);
      reject(new Error('Request timeout'));
    });

    req.on('error', (err) => {
      console.error(`[PROXY] Request error: ${err.message}`);
      reject(err);
    });
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // API proxy endpoint
  if (req.url.startsWith('/api/proxy')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const apiUrl = urlObj.searchParams.get('url');

    if (!apiUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    makeRequest(apiUrl, 25000)
      .then(data => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        console.error(`[PROXY] Error: ${err.message}`);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: 'Proxy request failed', 
          message: err.message 
        }));
      });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(path.join(__dirname))) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('Not Found');
      } else {
        res.statusCode = 500;
        res.end('Server Error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.statusCode = 200;
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[SERVER] Running at http://${HOST}:${PORT}/`);
});