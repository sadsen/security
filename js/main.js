<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>خريطة الأمن — تحرير</title>

  <!-- تسريع تحميل خرائط Google -->
  <link rel="dns-prefetch" href="https://maps.googleapis.com">
  <link rel="dns-prefetch" href="https://maps.gstatic.com">
  <link rel="preconnect" href="https://maps.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://maps.gstatic.com" crossorigin>

  <link rel="stylesheet" href="css/style.css" />
</head>
<body>

  <!-- الخريطة تملأ الشاشة -->
  <div id="map" aria-label="الخريطة"></div>

  <!-- لوحة الطبقات (لا تغطي الأزرار) -->
  <div id="layersControl" class="layers">
    <button class="handle" type="button" onclick="this.parentElement.classList.toggle('open')">الطبقات</button>
    <div class="body">
      <h4>الطبقات</h4>
      <div class="row">
        <label for="baseType">نوع الخريطة</label>
        <select id="baseType">
          <option value="roadmap">خريطة</option>
          <option value="hybrid">قمر صناعي</option>
          <option value="terrain">تضاريس</option>
          <option value="satellite">صورة قمر</option>
        </select>
      </div>
      <div class="row">
        <label><input type="checkbox" id="trafficLayer"> حركة المرور</label>
      </div>
      <div class="row">
        <label><input type="checkbox" id="transitLayer"> النقل العام</label>
      </div>
      <div class="row">
        <label><input type="checkbox" id="bicyclingLayer"> مسارات الدراجات</label>
      </div>
    </div>
  </div>

  <!-- زر فتح اللوحة (جوال) -->
  <button id="mobileToggle" type="button">تحرير ☰</button>

  <!-- خلفية اللوحة للجوال -->
  <div id="drawerBackdrop" class="hidden"></div>

  <!-- اللوحة الجانبية للتحرير -->
  <aside class="sidebar">
    <h2 style="margin:0 0 10px; font-weight:900">لوحة التحكم</h2>

    <div class="section">
      <button id="addCircleBtn" class="btn btn-primary">➕ إضافة موقع</button>
    </div>

    <div class="section">
      <button id="shareBtn" class="btn btn-dark">📤 مشاركة (رابط عرض)</button>
      <p id="addHint" class="hidden" style="color:#9ca3af; margin:8px 2px 0">انقر على الخريطة لوضع الدائرة…</p>
      <p class="hint" style="color:#9ca3af; margin:8px 2px 0">نصيحة: مرّر على الدائرة لعرض الكرت.</p>
    </div>

    <!-- حالة فارغة -->
    <div id="emptyState" class="section">
      <div class="panel">
        لا توجد دائرة محددة. اضغط على أي دائرة لبدء التحرير.
      </div>
    </div>

    <!-- محرّر الدائرة -->
    <div id="editor" class="section hidden">
      <div class="editor-head">
        <h3>تحرير الدائرة</h3>
        <button id="closeEditor" type="button" class="chip">×</button>
      </div>

      <label for="ed-name">اسم الموقع</label>
      <input id="ed-name" type="text" placeholder="اسم الموقع" />

      <div class="section">
        <label for="ed-security">أفراد الأمن (كل اسم في سطر)</label>
        <textarea id="ed-security" placeholder="أدخل كل اسم في سطر جديد"></textarea>
      </div>

      <div class="section">
        <label for="ed-notes">ملاحظات</label>
        <textarea id="ed-notes" placeholder="أدخل ملاحظاتك…"></textarea>
      </div>

      <div class="section grid-2">
        <div>
          <label for="ed-fill">لون التعبئة</label>
          <input id="ed-fill" type="color" />
        </div>
        <div>
          <label for="ed-stroke">لون الحدود</label>
          <input id="ed-stroke" type="color" />
        </div>
      </div>

      <div class="section">
        <label for="ed-opacity">شفافية التعبئة: <span id="op-val">0.25</span></label>
        <input id="ed-opacity" type="range" min="0" max="1" step="0.01" />
      </div>

      <div class="section">
        <label for="ed-radius">نصف القطر (م): <span id="radius-val">15</span></label>
        <input id="ed-radius" type="range" min="5" max="300" step="1" />
        <div class="row-inline">
          <input id="ed-radius-num" type="number" min="1" step="1" /> م
        </div>
      </div>

      <div class="section row-inline">
        <label class="check"><input id="ed-draggable" type="checkbox" /> سحب الدائرة</label>
        <label class="check"><input id="ed-editable" type="checkbox" /> تغيير الحجم</label>
      </div>

      <div class="section grid-2">
        <button id="dupBtn" class="btn btn-dark">نسخ الدائرة</button>
        <button id="delBtn" class="btn btn-danger" disabled>حذف الدائرة</button>
      </div>
    </div>
  </aside>

  <!-- تطبيق (تحرير) -->
  <script src="js/main.js"></script>
  <!-- خرائط Google: استبدل YOUR_API_KEY -->
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCjX9UJKG53r5ymGydlWEMNbuvi234LcC8&libraries=geometry&v=weekly&callback=initApp" async defer></script>
</body>
</html>
