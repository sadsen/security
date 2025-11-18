const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const publicDir = path.join(__dirname, 'public');

// تأكد من أن مجلد public موجود
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// تأكد من أن مجلد js موجود
const jsDir = path.join(publicDir, 'js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir);
}

// Middleware
app.use(express.json());

// خدمة الملفات الثابتة
app.use(express.static(publicDir));

// تحديد نوع المحتوى لملفات JS
app.use('/js', express.static(path.join(publicDir, 'js'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Routes
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

// Fallback route
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
  console.log('Public directory:', publicDir);
  console.log('JS directory:', jsDir);
});
