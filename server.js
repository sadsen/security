const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// 1) static يجب أن يكون قبل أي شيء
app.use(express.static(path.join(__dirname, 'public')));

// 2) الصفحة الرئيسية
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public/index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace('%GOOGLE_MAP_KEY%', process.env.GOOGLE_MAP_KEY || '');
  res.send(html);
});

// 3) API الاختصار
app.get('/api/short', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl) return res.status(400).json({ error: 'Missing url' });

    const api = "https://is.gd/create.php?format=simple&url=" + encodeURIComponent(longUrl);
    const r = await fetch(api);
    const txt = await r.text();

    res.json({ short: txt.trim() });
  } catch {
    res.status(500).json({ error: 'Shortening failed' });
  }
});

// 4) fallback للـ SPA فقط، وليس للملفات
app.get('*', (req, res) => {
  const file = path.join(__dirname, 'public/index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('%GOOGLE_MAP_KEY%', process.env.GOOGLE_MAP_KEY || '');
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on port", PORT));
