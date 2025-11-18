const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const publicDir = path.join(__dirname, 'public');

console.log('Booting Diriyah Security Map server...');
console.log('__dirname =', __dirname);

// --- Middleware ---
app.use(express.json());

// --- Static Files ---
// تقديم جميع الملفات الثابتة من مجلد public
app.use(express.static(publicDir));

// --- Routes ---
app.get('/', (req, res) => {
  renderIndex(req, res);
});

app.post('/api/shorten', async (req, res) => {
  try {
    const longUrl = req.body.url;
    if (!longUrl) {
      return res.status(400).json({ error: 'Missing url in request body' });
    }
    const api = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(longUrl);
    const result = await fetch(api);
    const txt = await result.text();
    if (!result.ok || txt.startsWith('Error')) {
      throw new Error(txt);
    }
    res.json({ shortUrl: txt.trim() });
  } catch (err) {
    console.error('Shortening failed:', err.message);
    res.status(500).json({ error: 'Shortening failed' });
  }
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// تقديم ملف index.html لجميع المسارات الأخرى
app.get('*', (req, res) => {
  renderIndex(req, res);
});

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

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
