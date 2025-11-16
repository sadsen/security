const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Inject Google Maps key dynamically
app.get('/', (req, res) => {
  const file = path.join(__dirname, 'public/index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('%GOOGLE_MAP_KEY%', process.env.GOOGLE_MAP_KEY || '');
  res.send(html);
});

// Short URL (is.gd)
app.get('/api/short', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl) return res.status(400).json({ error: "Missing url" });

    const api = "https://is.gd/create.php?format=simple&url=" + encodeURIComponent(longUrl);
    const r = await fetch(api);
    const t = await r.text();

    res.json({ short: t.trim() });
  } catch (e) {
    res.status(500).json({ error: "Shortening failed" });
  }
});

// Fallback for any path → index.html
app.get('*', (req, res) => {
  const file = path.join(__dirname, 'public/index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('%GOOGLE_MAP_KEY%', process.env.GOOGLE_MAP_KEY || '');
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
