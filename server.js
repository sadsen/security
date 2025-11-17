// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const publicDir = path.join(__dirname, 'public');

console.log('Booting Diriyah Security Map server...');
console.log('__dirname =', __dirname);

// --- Middleware ---
// !! إضافة مهمة: لتمكين قراءة JSON من POST requests
app.use(express.json()); 

// ---------------- Static Files ----------------
// تقديم الملفات الثابتة بشكل صحيح
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/img', express.static(path.join(publicDir, 'img')));


// ---------------- render index.html ----------------
function renderIndex(req, res) {
  try {
    const indexPath = path.join(publicDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // قراءة المفتاح من المتغير
    const key = process.env.GOOGLE_MAP_KEY || '';

    // استبدال المتغير داخل الـ HTML
    html = html.replace('%GOOGLE_MAP_KEY%', key);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Internal Server Error');
  }
}

// ---------------- Routes ----------------
app.get('/', (req, res) => {
  renderIndex(req, res);
});

// --- !!! تم تعديل هذا المسار بالكامل ---
// يتطابق الآن مع ما يطلبه main.js (v16.0)
app.post('/api/shorten', async (req, res) => {
  try {
    // 1. اقرأ من الجسم (body) وليس (query)
    const longUrl = req.body.url; 
    if (!longUrl) {
      return res.status(400).json({ error: 'Missing url in request body' });
    }

    const api = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(longUrl);
    
    // تأكد من أن بيئة التشغيل تدعم fetch (Node.js 18+)
    const result = await fetch(api); 
    const txt = await result.text();

    if (!result.ok || txt.startsWith('Error')) {
       throw new Error(txt);
    }

    // 2. أعد الاستجابة بالصيغة المتوقعة { shortUrl: ... }
    res.json({ shortUrl: txt.trim() }); 
    
  } catch (err) {
    console.error('Shortening failed:', err.message);
    res.status(500).json({ error: 'Shortening failed' });
  }
});


app.get('/health', (req, res) => {
  res.send('OK');
});

// ---------------- Fallback (للروابط مثل share links) ----------------
app.get('*', (req, res, next) => {
  // تجاهل الملفات أو API
  if (req.path.includes('.') || req.path.startsWith('/api')) {
    return next();
  }

  renderIndex(req, res);
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
