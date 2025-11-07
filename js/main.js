/* ========================
   إعدادات أساسية
======================== */
const DEFAULT_CENTER = [24.73722164546818, 46.53877581519047]; // الدرعية — القصور التاريخية
const DEFAULT_ZOOM = 14;

const urlParams = new URLSearchParams(window.location.search);
const isViewModeQuery = urlParams.has('view');
const hash = window.location.hash || "";
const isViewModeHash = hash.startsWith("#view=") || hash.includes("&view=");
const isViewMode = isViewModeQuery || isViewModeHash;

// طبّق كلاس لوضع العرض لتعديل التخطيط في CSS
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.toggle('view-mode', isViewMode);
});

/* ========================
   أدوات Base64-URL آمنة
======================== */
function toBase64Url(bytes) {
  // btoa من بايتات
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  const b64 = btoa(binary);
  // استبدال الرموز غير الآمنة في روابط
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64url) {
  // إعادة الرموز لقيم base64 القياسية
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  // أضف padding إن لزم
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ========================
   ضغط/فك ضغط بيانات الرابط (مُدمج)
======================== */
function compactData(data) {
  return {
    c: data.center,
    r: data.circles.map(c => ({
      l: [c.lat, c.lng],
      r: c.radius,
      co: c.color,
      fc: c.fillColor,
      o: c.fillOpacity,
      n: c.name,
      s: c.security,
      t: c.notes
    }))
  };
}

function expandData(compact) {
  return {
    center: compact.c,
    circles: compact.r.map(c => ({
      lat: c.l[0],
      lng: c.l[1],
      radius: c.r,
      color: c.co,
      fillColor: c.fc,
      fillOpacity: c.o,
      name: c.n || '',
      security: c.s || '',
      notes: c.t || ''
    }))
  };
}

function encodeData(data) {
  const json = JSON.stringify(compactData(data));
  const utf8 = new TextEncoder().encode(json);
  return toBase64Url(utf8); // ← Base64-URL
}

function decodeData(encoded) {
  const bytes = fromBase64Url(encoded); // ← Base64-URL
  const json = new TextDecoder().decode(bytes);
  return expandData(JSON.parse(json));
}

/* ========================
   قراءة/كتابة قيمة view من/إلى الرابط
======================== */
function getViewParam() {
  // 1) من الهاش #view=...
  if (window.location.hash) {
    const h = window.location.hash.replace(/^#/, "");
    const search = new URLSearchParams(h);
    if (search.has("view")) return search.get("view");
    // دعم شكل #view=... بدون باراميترات أخرى
    if (h.startsWith("view=")) return h.slice(5);
  }
  // 2) من الاستعلام ?view=...
  const sp = new URLSearchParams(window.location.search);
  if (sp.has("view")) return sp.get("view");
  return null;
}

function setViewParam(encoded) {
  // نكتب في الهاش لضمان أن المنصات لا تقصّه
  const newHash = `view=${encoded}`;
  const newUrl = `${location.origin}${location.pathname}#${newHash}`;
  history.replaceState(null, "", newUrl);
  return newUrl;
}

/* ========================
   إنشاء الخريطة + تحسينات الأداء
======================== */
const map = L.map('map', {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  zoomControl: true,
  preferCanvas: true,
  updateWhenIdle: true,
  inertia: true,
  zoomAnimation: true,
  markerZoomAnimation: true,
  fadeAnimation: true
});

// طبقة البلاطات
L.tileLayer(
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=5d937485-a301-4455-9ba7-95a93120ff7d',
  {
    maxZoom: 20,
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
  }
).addTo(map);

// بديل اختبار الشبكة/المفتاح
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

/* ========================
   الواجهة
======================== */
const sidebar = document.getElementById('sidebar');
const addCircleBtn = document.getElementById('addCircleBtn');
const shareBtn = document.getElementById('shareBtn');

if (isViewMode) {
  sidebar?.classList.add('hidden');
  map.dragging.enable();
  map.scrollWheelZoom.enable();
}

/* ========================
   نموذج البيانات + الحالة
======================== */
let circles = [];
let addMode = false;

/* ========================
   أدوات عرض
======================== */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
function updateTooltip(circle, html) {
  const tt = circle.getTooltip?.();
  if (tt) tt.setContent(html);
  else circle.bindTooltip(html, { className: 'custom-tooltip', direction: 'top', offset: [0, -10] });
}
function tooltipHtml(d) {
  const name  = escapeHtml(d?.name || 'نقطة مراقبة');
  const names = escapeHtml(d?.security || '---'); // Enter = سطر جديد
  const notes = escapeHtml(d?.notes || '');
  return `
    <div class="tt">
      <div class="tt-title">${name}</div>
      <div class="tt-label">الأمن:</div>
      <div class="tt-names">${names}</div>
      ${notes ? `<div class="tt-notes">${notes}</div>` : ``}
    </div>
  `;
}

/* ========================
   مشاركة الخريطة (هاش + Web Share)
======================== */
function shareMap() {
  const data = {
    center: { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() },
    circles: circles.map(c => ({
      lat: c.getLatLng().lat,
      lng: c.getLatLng().lng,
      radius: c.getRadius(),
      color: c.options.color,
      fillColor: c.options.fillColor,
      fillOpacity: c.options.fillOpacity,
      name: c.data?.name || '',
      security: c.data?.security || '',
      notes: c.data?.notes || ''
    }))
  };

  try {
    const encoded = encodeData(data);
    const url = setViewParam(encoded); // ← نكتب في الهاش
    // دعم Web Share على الجوال
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {
        navigator.clipboard.writeText(url).then(() => alert('تم نسخ رابط الخريطة!')).catch(() => prompt('انسخ الرابط:', url));
      });
    } else {
      navigator.clipboard.writeText(url)
        .then(() => alert('تم نسخ رابط الخريطة!'))
        .catch(() => prompt('انسخ الرابط:', url));
    }
  } catch (e) {
    console.error('فشل إنشاء الرابط:', e);
    alert('حدث خطأ أثناء إنشاء الرابط.');
  }
}

/* ========================
   تحرير/نسخ/حذف
======================== */
function createEditPopup(circle) {
  const d = circle.data || {};
  const color = circle.options.color || '#7c3aed';
  const fillColor = circle.options.fillColor || '#c084fc';
  const opacity = circle.options.fillOpacity ?? 0.35;
  const radius = circle.getRadius() || 100;

  const content = `
    <style>
      .circle-edit-popup { width: 280px; max-width: 100%; }
      .circle-edit-popup label { display:block; margin-top:8px; font-weight:bold; font-size:14px; }
      .circle-edit-popup input[type="text"],
      .circle-edit-popup textarea,
      .circle-edit-popup input[type="color"],
      .circle-edit-popup input[type="number"] {
        width: 100%; padding: 6px; box-sizing: border-box; font-size: 14px;
      }
      .circle-edit-popup textarea { resize: vertical; }
      .circle-edit-popup button { margin-top:10px; padding:7px 14px; border:none; border-radius:6px; cursor:pointer; width:100%; font-weight:bold; }
    </style>
    <div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName" value="${escapeHtml(d.name || '')}">
      <label>أفراد الأمن:</label>
      <textarea id="securityNames" rows="3" placeholder="أدخل أسماء... (كل اسم في سطر)">${escapeHtml(d.security || '')}</textarea>
      <label>ملاحظات:</label>
      <textarea id="notes" rows="3">${escapeHtml(d.notes || '')}</textarea>
      <label>لون الحدود:</label>
      <input type="color" id="color" value="${color}">
      <label>لون التعبئة:</label>
      <input type="color" id="fillColor" value="${fillColor}">
      <label>الشفافية:</label>
      <input type="number" id="opacity" min="0" max="1" step="0.1" value="${opacity}">
      <label>نصف القطر (م):</label>
      <input type="number" id="radius" min="10" value="${radius}">
      <button onclick="saveCircleData(this, ${circle._leaflet_id})">حفظ</button>
      <button type="button" style="background:#555;" onclick="duplicateCircle(${circle._leaflet_id})">نسخ الدائرة</button>
      <button type="button" style="background:#d32f2f;color:white;" onclick="deleteCircle(${circle._leaflet_id})">حذف الدائرة</button>
    </div>
  `;

  L.popup({ maxWidth: 320 })
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);
}

window.duplicateCircle = function(circleId) {
  const original = circles.find(c => c._leaflet_id == circleId);
  if (!original) return;

  const latlng = original.getLatLng();
  const offset = 0.0003;
  const newLatLng = [
    latlng.lat + (Math.random() - 0.5) * offset * 2,
    latlng.lng + (Math.random() - 0.5) * offset * 2
  ];

  const newCircle = L.circle(newLatLng, {
    radius: original.getRadius(),
    color: original.options.color,
    fillColor: original.options.fillColor,
    fillOpacity: original.options.fillOpacity
  }).addTo(map);

  newCircle.data = { ...original.data };
  circles.push(newCircle);
  attachEvents(newCircle);
  createEditPopup(newCircle);
  map.closePopup();
};

window.deleteCircle = function(circleId) {
  if (!confirm('هل أنت متأكد من حذف هذه الدائرة؟')) return;
  const index = circles.findIndex(c => c._leaflet_id == circleId);
  if (index === -1) return;
  const circle = circles[index];
  map.removeLayer(circle);
  circles.splice(index, 1);
  map.closePopup();
};

window.saveCircleData = function(btn, circleId) {
  const popupContent = btn.closest('.leaflet-popup-content');
  if (!popupContent) return;

  const circle = circles.find(c => c._leaflet_id == circleId);
  if (!circle) return;

  const name = popupContent.querySelector('#siteName')?.value.trim() || '';
  const security = popupContent.querySelector('#securityNames')?.value.trim() || '';
  const notes = popupContent.querySelector('#notes')?.value.trim() || '';
  const color = popupContent.querySelector('#color')?.value || '#7c3aed';
  const fillColor = popupContent.querySelector('#fillColor')?.value || '#c084fc';
  const opacity = parseFloat(popupContent.querySelector('#opacity')?.value) || 0.35;
  const radius = parseFloat(popupContent.querySelector('#radius')?.value) || 100;

  circle.data = { name, security, notes, lat: circle.getLatLng().lat, lng: circle.getLatLng().lng };
  circle.setStyle({ color, fillColor, fillOpacity: opacity });
  circle.setRadius(radius);

  updateTooltip(circle, tooltipHtml(circle.data));
  map.closePopup();
};

/* ========================
   سحب الدائرة (يدوي)
======================== */
function enableCircleDrag(circle) {
  if (isViewMode) return;

  let dragging = false;
  let startPoint = null;
  let startLatLng = null;

  function onMouseDown(e) {
    dragging = true;
    startPoint = e.containerPoint;
    startLatLng = circle.getLatLng();
    map.dragging.disable();
    L.DomEvent.stopPropagation(e.originalEvent);
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.containerPoint.x - startPoint.x;
    const dy = e.containerPoint.y - startPoint.y;
    const start = map.latLngToContainerPoint(startLatLng);
    const targetPoint = L.point(start.x + dx, start.y + dy);
    const targetLatLng = map.containerPointToLatLng(targetPoint);
    circle.setLatLng(targetLatLng);
    if (circle.data) {
      circle.data.lat = targetLatLng.lat;
      circle.data.lng = targetLatLng.lng;
      updateTooltip(circle, tooltipHtml(circle.data));
    }
  }
  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    map.dragging.enable();
  }

  circle.on('mousedown', onMouseDown);
  map.on('mousemove', onMouseMove);
  map.on('mouseup', onMouseUp);
  map.on('mouseout', onMouseUp);
}

/* ========================
   ربط أحداث الدائرة
======================== */
function attachEvents(circle) {
  const html = tooltipHtml(circle.data);

  if (isViewMode) {
    // التولتيب عند اللمس لتخفيف الحمل
    circle.bindTooltip(html, {
      className: 'custom-tooltip',
      direction: 'top',
      offset: [0, -10],
      permanent: false,
      interactive: true
    });
    circle.on('click', () => {
      circles.forEach(c => c.setZIndexOffset(0));
      circle.setZIndexOffset(1000);
      circle.openTooltip();
    });
  } else {
    updateTooltip(circle, html);
    circle.off('click');
    circle.on('click', (e) => createEditPopup(e.target));
    enableCircleDrag(circle);
  }
}

/* ========================
   تحميل من رابط المشاركة (أولوية للهاش)
======================== */
function loadFromUrl() {
  if (!isViewMode) return;
  try {
    const encoded = getViewParam();
    if (!encoded) throw new Error('لا توجد بيانات');

    const data = decodeData(encoded);

    data.circles.forEach(c => {
      const circle = L.circle([c.lat, c.lng], {
        radius: c.radius || 100,
        color: c.color || '#7c3aed',
        fillColor: c.fillColor || '#c084fc',
        fillOpacity: c.fillOpacity ?? 0.35
      }).addTo(map);

      circle.data = { name: c.name || '', security: c.security || '', notes: c.notes || '', lat: c.lat, lng: c.lng };
      circles.push(circle);
      attachEvents(circle);
    });

    // افتح أول كرت توضيحيًا
    if (circles.length) {
      circles[0].openTooltip();
      circles[0].setZIndexOffset(1000);
    }

    if (data.center) {
      map.setView([data.center.lat, data.center.lng], data.center.zoom || DEFAULT_ZOOM);
    }
  } catch (e) {
    console.error('فشل تحميل الخريطة:', e);
    alert('لا يمكن تحميل الخريطة من الرابط.');
  }
}

/* ========================
   أحداث الواجهة
======================== */
addCircleBtn?.addEventListener('click', () => {
  addMode = true;
  alert('انقر على الخريطة لإنشاء دائرة جديدة.');
  map.getContainer().style.cursor = 'crosshair';
});

shareBtn?.addEventListener('click', shareMap);

map.on('click', (e) => {
  if (isViewMode || !addMode) return;
  addMode = false;
  map.getContainer().style.cursor = '';

  const circle = L.circle(e.latlng, {
    radius: 100,
    color: '#7c3aed',
    fillColor: '#c084fc',
    fillOpacity: 0.35
  }).addTo(map);

  circle.data = { name: '', security: '', notes: '', lat: e.latlng.lat, lng: e.latlng.lng };
  circles.push(circle);
  attachEvents(circle);
  createEditPopup(circle);
});

/* ========================
   بدء التشغيل
======================== */
loadFromUrl();
