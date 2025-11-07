/* ========================
   إعدادات أساسية
======================== */
const DEFAULT_CENTER = [24.73722164546818, 46.53877581519047];
const DEFAULT_ZOOM = 14;

const urlParams = new URLSearchParams(window.location.search);
const isViewModeQuery = urlParams.has('view');
const hash = window.location.hash || "";
const isViewModeHash = hash.startsWith("#view=") || hash.includes("&view=");
const isViewMode = isViewModeQuery || isViewModeHash;

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.toggle('view-mode', isViewMode);
});

/* ========================
   Base64 URL الآمن
======================== */
function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ========================
   ضغط/فك ضغط بيانات الرابط
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
  return toBase64Url(utf8);
}
function decodeData(encoded) {
  const bytes = fromBase64Url(encoded);
  const json = new TextDecoder().decode(bytes);
  return expandData(JSON.parse(json));
}

/* ========================
   قراءة/كتابة قيمة view
======================== */
function getViewParam() {
  if (location.hash) {
    const h = location.hash.replace(/^#/, "");
    const hs = new URLSearchParams(h.includes('=') ? h : `view=${h}`);
    if (hs.has('view')) return hs.get('view');
  }
  const sp = new URLSearchParams(location.search);
  if (sp.has('view')) return sp.get('view');
  return null;
}
function setViewParam(encoded) {
  const newHash = `view=${encoded}`;
  const newUrl  = `${location.origin}${location.pathname}#${newHash}`;
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

L.tileLayer(
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=5d937485-a301-4455-9ba7-95a93120ff7d',
  { maxZoom: 20, attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>' }
).addTo(map);

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

let circles = [];
let addMode = false;

/* ========================
   أدوات عرض + الكرت
======================== */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function tooltipHtml(d){
  const name  = escapeHtml(d?.name || 'نقطة مراقبة');
  const raw   = d?.security ?? '---';
  const lines = String(raw).split(/\r?\n/).map(s => escapeHtml(s.trim())).filter(Boolean);

  return `
    <div class="tt">
      <div class="tt-title">${name}</div>
      <div class="tt-label">الأمن:</div>
      <div class="tt-names">
        ${lines.length ? lines.map(s => `<div class="name-line">${s}</div>`).join("") : `<div class="name-line">---</div>`}
      </div>
      ${d?.notes ? `<div class="tt-notes">${escapeHtml(d.notes)}</div>` : ``}
    </div>
  `;
}

/* ===== لاصق الكرت بحافة الدائرة (إزاحة ديناميكية) ===== */
function circlePixelRadius(circle) {
  const center = circle.getLatLng();
  const meters = circle.getRadius();
  const metersPerDegLat = 111320; // تقريب جيد
  const north = L.latLng(center.lat + (meters / metersPerDegLat), center.lng);

  const pCenter = map.latLngToContainerPoint(center);
  const pNorth  = map.latLngToContainerPoint(north);
  return Math.max(0, pCenter.y - pNorth.y);
}
function updateTooltipOffset(circle, extra = 10) {
  const tt = circle.getTooltip && circle.getTooltip();
  if (!tt) return;
  const rpx = circlePixelRadius(circle);
  tt.options.offset = L.point(0, -(rpx + extra)); // فوق حافة الدائرة مباشرة
  tt.update();
}

/* ========================
   مشاركة الخريطة
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
    const url = setViewParam(encoded);
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {
        navigator.clipboard.writeText(url).then(() => alert('تم نسخ رابط الخريطة!'));
      });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('تم نسخ رابط الخريطة!'));
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
      .circle-edit-popup input, .circle-edit-popup textarea { width:100%; padding:6px; font-size:14px; box-sizing:border-box; }
      .circle-edit-popup textarea { resize: vertical; }
      .circle-edit-popup button { margin-top:10px; padding:7px 14px; border:none; border-radius:6px; cursor:pointer; width:100%; font-weight:bold; background:#c27b39; color:#fff; }
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
      <button style="background:#555" onclick="duplicateCircle(${circle._leaflet_id})">نسخ</button>
      <button style="background:#d32f2f;color:white" onclick="deleteCircle(${circle._leaflet_id})">حذف</button>
    </div>
  `;

  L.popup({ maxWidth: 320 })
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);
}

window.duplicateCircle = id => {
  const orig = circles.find(c => c._leaflet_id == id);
  if (!orig) return;
  const ll = orig.getLatLng();
  const off = 0.0003;
  const nl = [ ll.lat + (Math.random()-0.5)*off*2, ll.lng + (Math.random()-0.5)*off*2 ];
  const nc = L.circle(nl, {
    radius: orig.getRadius(),
    color: orig.options.color,
    fillColor: orig.options.fillColor,
    fillOpacity: orig.options.fillOpacity
  }).addTo(map);
  nc.data = { ...orig.data };
  circles.push(nc);
  attachEvents(nc);
  createEditPopup(nc);
  map.closePopup();
};

window.deleteCircle = id => {
  const i = circles.findIndex(c => c._leaflet_id == id);
  if (i !== -1) { map.removeLayer(circles[i]); circles.splice(i, 1); map.closePopup(); }
};

window.saveCircleData = (btn, id) => {
  const popup = btn.closest('.leaflet-popup-content');
  const c = circles.find(c => c._leaflet_id == id);
  if (!c) return;
  const n  = popup.querySelector('#siteName').value.trim();
  const s  = popup.querySelector('#securityNames').value.trim();
  const t  = popup.querySelector('#notes').value.trim();
  const color = popup.querySelector('#color').value;
  const fillColor = popup.querySelector('#fillColor').value;
  const op = parseFloat(popup.querySelector('#opacity').value);
  const r  = parseFloat(popup.querySelector('#radius').value);
  c.data = { name:n, security:s, notes:t, lat:c.getLatLng().lat, lng:c.getLatLng().lng };
  c.setStyle({ color, fillColor, fillOpacity: op });
  c.setRadius(r);
  const html = tooltipHtml(c.data);
  const tt = c.getTooltip();
  if (tt) tt.setContent(html); else c.bindTooltip(html, { className:'custom-tooltip', direction:'top' });
  updateTooltipOffset(c); // ← مهم بعد تغيير نصف القطر
  map.closePopup();
};

/* ========================
   ربط الأحداث + لاصق الكرت
======================== */
function attachEvents(circle) {
  const html = tooltipHtml(circle.data);

  // اربط التولتيب ثم اضبط إزاحته حسب نصف القطر
  circle.bindTooltip(html, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -12], // مؤقت؛ سنحدّثه ديناميكيًا
    interactive: true
  });

  // تحديث الإزاحة فور الإضافة
  circle.once('add', () => updateTooltipOffset(circle));

  // حدّث الإزاحة مع تغيّر الزووم/التحريك/حجم الخريطة
  const refresh = () => updateTooltipOffset(circle);
  map.on('zoom', refresh);
  map.on('move', refresh);
  map.on('resize', refresh);
  circle.on('tooltipopen', refresh);
  circle.on('popupopen', refresh);

  if (isViewMode) {
    circle.on('click', () => {
      circles.forEach(c => c.setZIndexOffset(0));
      circle.setZIndexOffset(1000);
      circle.openTooltip();
      updateTooltipOffset(circle);
    });
  } else {
    circle.off('click');
    circle.on('click', e => createEditPopup(e.target));
  }

  // تأكيد تحديث المحتوى والإزاحة
  const tt = circle.getTooltip();
  if (tt) { tt.setContent(html); updateTooltipOffset(circle); }
}

/* ========================
   تحميل من الرابط (بدون تنبيه)
======================== */
function loadFromUrl() {
  if (!isViewMode) return;
  try {
    const encoded = getViewParam();
    if (!encoded) return;
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

    if (circles.length) { circles[0].openTooltip(); circles[0].setZIndexOffset(1000); }
    if (data.center) { map.setView([data.center.lat, data.center.lng], data.center.zoom || DEFAULT_ZOOM); }
  } catch (e) {
    console.warn('فشل تحميل الخريطة من الرابط:', e);
  }
}

/* ========================
   واجهة المستخدم
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
