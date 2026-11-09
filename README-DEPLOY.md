# نشر SecurityMap على Cloudflare Pages

1. ارفع محتويات هذا المجلد إلى مستودع GitHub جديد أو استبدل ملفات المستودع الحالي بعد أخذ نسخة احتياطية.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. إعدادات البناء: Framework preset = None، Build command = (فارغ)، Build output directory = public.
4. Settings → Variables and Secrets: أضف GOOGLE_MAP_KEY و ARCGIS_API_KEY. لا تضع القيم في GitHub. استخدم Secret لمفتاح ArcGIS.
5. أعد نشر المشروع بعد إضافة المتغيرات.
6. Pages → Custom domains → Add domain → map.seensu.com، واتبع تعليمات سجل CNAME أو إعداد DNS.
7. قيّد مفتاح Google Maps على map.seensu.com (وأضف نطاق pages.dev مؤقتًا للاختبار). مفتاح Google Maps الموجود في المشروع الأصلي كان مكشوفًا؛ يفضّل تدويره.
8. اختبر فتح الخريطة وطبقة الأقمار الصناعية وروابط المشاركة والتصدير قبل إيقاف Render.

تنبيه: هذا تحويل أولي غير مختبر على Cloudflare فعليًا. واجهات الخرائط قد تحتاج ضبط ترخيص ArcGIS ومعدل الطلبات. مفتاح Google Maps للمتصفح ليس سرًا؛ يجب تقييده عبر Google Cloud. وظائف Pages تخضع لحدود الخطة المجانية. بيانات localStorage لا تنتقل تلقائيًا بين النطاقات؛ صدّر بياناتك قبل النقل. لا تغيّر DNS الخاص بالدومين الرئيسي seensu.com إن كان عليه موقع آخر.
