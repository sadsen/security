// Diriyah Security Map - Server v3.0 (Stable & Simplified)
const express = require('express');
const path = require('path');
// 'node-fetch' مطلوب للتوافق مع إصدارات Node.js القديمة.
// إذا كنت تستخدم Node.js 18+، يمكنك إزالة هذا السطر واستخدام fetch مباشرة.
const fetch = require('node-fetch'); 

const app = express();
const PORT = process.env.PORT || 10000; // منصة Render تفضل 10000

console.log('Booting Diriyah Security Map server...');

// 1. Middleware لقراءة بيانات JSON من الطلبات (ضروري لواجهة API)
app.use(express.json());

// 2. تحديد المجلد العام (public) لتقديم كل الملفات الثابتة (HTML, JS, CSS, IMG)
// هذه هي الطريقة القياسية والأكثر استقراراً.
const publicDir = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicDir}`);
app.use(express.static(publicDir));

// 3. واجهة API لاختصار الروابط (API Endpoint)
app.post('/api/shorten', async (req, res) => {
  const { url: longUrl } = req.body; // قراءة الرابط من جسم الطلب

  if (!longUrl) {
    return res.status(400).json({ error: 'URL is required in the request body' });
  }

  try {
    // نستخدم صيغة JSON من is.gd للحصول على استجابة واضحة
    const apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl )}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.shorturl) {
      res.status(200).json({ shortUrl: data.shorturl });
    } else {
      // إذا كان هناك خطأ من is.gd، أعد إرساله
      throw new Error(data.errormessage || 'Unknown error from shortening service');
    }
  } catch (error) {
    console.error('Shortening API failed:', error.message);
    res.status(500).json({ error: 'Failed to shorten URL', details: error.message });
  }
});

// 4. مسار احتياطي (Fallback) لجميع الطلبات الأخرى
// هذا يضمن أن روابط المشاركة (مثل /?x=...) تعمل بشكل صحيح عن طريق إرجاع index.html دائماً.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server is live and running on port ${PORT}`);
});
