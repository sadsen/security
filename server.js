const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const publicDir = path.join(__dirname, 'public');
const jsDir = path.join(publicDir, 'js');

// تأكيد وجود المجلدات
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir);

// Middlewares
app.use(express.json());

/* =======================================================
   renderIndex — تحميل index.html + استبدال مفتاح Google
======================================================= */
function renderIndex(req, res) {
  try {
    const indexPath = path.join(publicDir, 'index.html');

    let html = fs.readFileSync(indexPath, 'utf8');

    const apiKey = process.env.GOOGLE_MAP_KEY || '';
    html = html.replace(/%GOOGLE_MAP_KEY%/g, apiKey);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Internal Server Error');
  }
}

// الصفحة الرئيسية
app.get('/', renderIndex);

// Health check
app.get('/health', (req, res) => res.send('OK'));

/* =======================================================
   API — is.gd URL Shortener
======================================================= */
app.post('/api/shorten', async (req, res) => {
  try {
    const longUrl = req.body.url;

    if (!longUrl) {
      return res.status(400).json({ error: 'Missing url in request body' });
    }

    const api =
      'https://is.gd/create.php?format=simple&url=' +
      encodeURIComponent(longUrl);

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

/* =======================================================
   Static Files — يتم تقديمها بدون index.html
======================================================= */

// تقديم ملفات JS فقط
app.use('/js', express.static(jsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// تقديم ملفات public بدون إرسال index.html
app.use(express.static(publicDir, { index: false }));

// أي مسار آخر يرجع index.html
app.get('*', renderIndex);

/* =======================================================
   بدء تشغيل الخادم
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
  console.log('Public directory:', publicDir);
  console.log('JS directory:', jsDir);
});
