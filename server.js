// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const publicDir = path.join(__dirname, 'public');

console.log('Booting Diriyah Security Map server...');
console.log('__dirname =', __dirname);

// 1) Static files (المسار الصحيح والمطلق)
app.use(express.static(publicDir, {
  extensions: ['html'],
}));

// 2) render index with Google key
function renderIndex(req, res) {
  try {
    const indexPath = path.join(publicDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const key = process.env.GOOGLE_MAP_KEY || '';
    html = html.replace('%GOOGLE_MAP_KEY%', key);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Internal Server Error');
  }
}

// 3) Root route
app.get('/', (req, res) => {
  renderIndex(req, res);
});

// 4) Short URL API
app.get('/api/short', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl) return res.status(400).json({ error: 'Missing url' });

    const api = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(longUrl);
    const result = await fetch(api);
    const txt = await result.text();

    res.json({ short: txt.trim() });
  } catch (err) {
    console.error('Shortening failed:', err);
    res.status(500).json({ error: 'Shortening failed' });
  }
});

// 5) Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// 6) Fallback — لكن فقط للمسارات التي ليست ملفات
app.get('*', (req, res, next) => {
  // إذا المسار يحتوي نقطة، معناها ملف → لا نرجّع index
  if (req.path.includes('.')) {
    return next();
  }

  // وإلا نرجع index.html (لروابط المشاركة)
  renderIndex(req, res);
});

// 7) Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
