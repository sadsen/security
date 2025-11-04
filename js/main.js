// ========================
// إعدادات الخريطة — مركزها الآن على الدرعية
// ========================
const DEFAULT_CENTER = [24.73722164546818, 46.53877581519047]; // الدرعية — القصور التاريخية
const DEFAULT_ZOOM = 18;

// ========================
// التحقق من وضع العرض
// ========================
const urlParams = new URLSearchParams(window.location.search);
const isViewMode = urlParams.has('view');

// ========================
// تشفير/فك تشفير مع ضغط خفيف لاختصار الرابط
// ========================
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
  const compact = compactData(data);
  const json = JSON.stringify(compact);
  const utf8 = new TextEncoder().encode(json);
  let binary = '';
  utf8.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function decodeData(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  const compact = JSON.parse(json);
  return expandData(compact);
}

// ========================
// إنشاء الخريطة
// ========================
const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

// --- تم إصلاح المسافات الزائدة ---
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=5d937485-a301-4455-9ba7-95a93120ff7d', {
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
}).addTo(map);

// ========================
// إخفاء لوحة التحكم في وضع العرض
// ========================
const sidebar = document.getElementById('sidebar');
if (isViewMode) {
  sidebar?.classList.add('hidden');
  map.dragging.enable();
  map.scrollWheelZoom.enable();
}

// ========================
// إدارة الدوائر
// ========================
let circles = [];
let addMode = false;

// ========================
// تحميل الخريطة من الرابط
// ========================
function loadFromUrl() {
  if (isViewMode) {
    try {
      const encodedParam = urlParams.get('view');
      if (!encodedParam) throw new Error("لا توجد بيانات");
      const encoded = decodeURIComponent(encodedParam);
      const data = decodeData(encoded);

      data.circles.forEach(c => {
        // --- إنشاء الدائرة ---
        const circle = L.circle([c.lat, c.lng], {
          radius: c.radius,
          color: c.color || '#1a5fb4',
          fillColor: c.fillColor || '#3388ff',
          fillOpacity: c.fillOpacity || 0.3
        }).addTo(map);

        // --- إنشاء العلامة القابلة للسحب ---
        const dragMarker = L.marker([c.lat, c.lng], {
          draggable: true,
          icon: L.divIcon({ className: 'invisible-drag-marker', iconSize: [0, 0] })
        }).addTo(map);

        // --- ربط حركة العلامة بتحريك الدائرة ---
        dragMarker.on('drag', function() {
          const newLatLng = dragMarker.getLatLng();
          circle.setLatLng(newLatLng);
        });

        dragMarker.on('dragend', function() {
          const newLatLng = dragMarker.getLatLng();
          circle.data.lat = newLatLng.lat;
          circle.data.lng = newLatLng.lng;
        });

        // --- حفظ المرجع ---
        circle.data = c;
        circle._dragMarker = dragMarker;
        circles.push(circle);
        attachEvents(circle);
      });

      if (data.center) {
        map.setView([data.center.lat, data.center.lng], data.center.zoom);
      }
    } catch (e) {
      console.error("فشل تحميل الخريطة:", e);
      alert("لا يمكن تحميل الخريطة من الرابط.");
    }
  }
}

// ========================
// مشاركة الخريطة
// ========================
function shareMap() {
  const data = {
    center: {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom()
    },
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
    const url = `${window.location.origin}${window.location.pathname}?view=${encodeURIComponent(encoded)}`;
    navigator.clipboard.writeText(url)
      .then(() => alert('تم نسخ رابط الخريطة!'))
      .catch(() => prompt('انسخ الرابط:', url));
  } catch (e) {
    console.error("فشل إنشاء الرابط:", e);
    alert("حدث خطأ أثناء إنشاء الرابط.");
  }
}

// ========================
// إنشاء نافذة تعديل (Popup) — تظهر مباشرة من الدائرة
// ========================
function createEditPopup(circle) {
  const d = circle.data || {};
  const color = circle.options.color || '#1a5fb4';
  const fillColor = circle.options.fillColor || '#3388ff';
  const opacity = circle.options.fillOpacity || 0.3;
  const radius = circle.getRadius() || 100;

  const content = `
    <style>
      .circle-edit-popup {
        width: 280px;
        max-width: 100%;
      }
      .circle-edit-popup label {
        display: block;
        margin-top: 8px;
        font-weight: bold;
        font-size: 14px;
      }
      .circle-edit-popup input[type="text"],
      .circle-edit-popup textarea,
      .circle-edit-popup input[type="color"],
      .circle-edit-popup input[type="number"] {
        width: 100%;
        padding: 6px;
        box-sizing: border-box;
        font-size: 14px;
      }
      .circle-edit-popup textarea {
        resize: vertical;
      }
      .circle-edit-popup button {
        margin-top: 10px;
        padding: 7px 14px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
        font-weight: bold;
      }
    </style>
    <div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName" value="${escapeHtml(d.name || '')}">
      <label>أفراد الأمن:</label>
      <textarea id="securityNames" rows="3" placeholder="أدخل أسماء...">${escapeHtml(d.security || '')}</textarea>
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

  // --- Popup يظهر مباشرة من مركز الدائرة ---
  const popup = L.popup({
    maxWidth: 320,
    // offset: [0, -10], // تم إزالة هذا
    closeButton: false, // إزالة زر الإغلاق
    autoPan: false      // منع الخريطة من التحرك
  })
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);

  return popup;
}

// ========================
// نسخ الدائرة
// ========================
window.duplicateCircle = function(circleId) {
  const original = circles.find(c => c._leaflet_id == circleId);
  if (!original) return;

  const latlng = original.getLatLng();
  const offset = 0.0003;
  const newLatLng = [
    latlng.lat + (Math.random() - 0.5) * offset * 2,
    latlng.lng + (Math.random() - 0.5) * offset * 2
  ];

  // --- إنشاء الدائرة الجديدة ---
  const newCircle = L.circle(newLatLng, {
    radius: original.getRadius(),
    color: original.options.color,
    fillColor: original.options.fillColor,
    fillOpacity: original.options.fillOpacity
  }).addTo(map);

  // --- إنشاء العلامة القابلة للسحب للنسخة الجديدة ---
  const newDragMarker = L.marker(newLatLng, {
    draggable: true,
    icon: L.divIcon({ className: 'invisible-drag-marker', iconSize: [0, 0] })
  }).addTo(map);

  newDragMarker.on('drag', function() {
    const newLatLng = newDragMarker.getLatLng();
    newCircle.setLatLng(newLatLng);
  });

  newDragMarker.on('dragend', function() {
    const newLatLng = newDragMarker.getLatLng();
    newCircle.data.lat = newLatLng.lat;
    newCircle.data.lng = newLatLng.lng;
  });

  // --- نسخ البيانات ---
  newCircle.data = { ...original.data, lat: newLatLng[0], lng: newLatLng[1] };
  newCircle._dragMarker = newDragMarker;
  circles.push(newCircle);
  attachEvents(newCircle);
  createEditPopup(newCircle);
  map.closePopup();
};

// ========================
// حذف الدائرة
// ========================
window.deleteCircle = function(circleId) {
  if (!confirm('هل أنت متأكد من حذف هذه الدائرة؟')) return;

  const index = circles.findIndex(c => c._leaflet_id == circleId);
  if (index === -1) return;

  const circle = circles[index];
  map.removeLayer(circle);
  // تأكد من إزالة العلامة القابلة للسحب أيضًا
  if (circle._dragMarker && map.hasLayer(circle._dragMarker)) {
    map.removeLayer(circle._dragMarker);
  }
  circles.splice(index, 1);
  map.closePopup();
};

// ========================
// حفظ بيانات الدائرة
// ========================
window.saveCircleData = function(btn, circleId) {
  const popupContent = btn.closest('.leaflet-popup-content');
  if (!popupContent) {
    console.error("لا يمكن العثور على محتوى popup.");
    return;
  }

  const circle = circles.find(c => c._leaflet_id == circleId);
  if (!circle) {
    console.error("لا يمكن العثور على الدائرة.");
    return;
  }

  const name = popupContent.querySelector('#siteName')?.value.trim() || '';
  const security = popupContent.querySelector('#securityNames')?.value.trim() || '';
  const notes = popupContent.querySelector('#notes')?.value.trim() || '';
  const color = popupContent.querySelector('#color')?.value || '#1a5fb4';
  const fillColor = popupContent.querySelector('#fillColor')?.value || '#3388ff';
  const opacity = parseFloat(popupContent.querySelector('#opacity')?.value) || 0.3;
  const radius = parseFloat(popupContent.querySelector('#radius')?.value) || 100;

  // --- تحديث بيانات الدائرة ---
  circle.data = { name, security, notes, lat: circle.getLatLng().lat, lng: circle.getLatLng().lng };
  circle.setStyle({ color, fillColor, fillOpacity: opacity });
  circle.setRadius(radius);

  // --- تحديث tooltip ---
  const tooltipContent = `<b>${escapeHtml(name || 'نقطة غير معنونة')}</b><br>
    <small>الأمن: ${escapeHtml(security || '---')}</small><br>
    <small style="color:#555;">${escapeHtml(notes || '')}</small>`;
  circle.setTooltipContent(tooltipContent);

  map.closePopup(); // إغلاق الـ popup بعد الحفظ
  console.log("تم حفظ الدائرة:", circle.data); // رسالة تأكيد في الكونسول
};

// ========================
// ربط الأحداث بالدائرة
// ========================
function attachEvents(circle) {
  if (!isViewMode) {
    circle.off('click');
    circle.on('click', function(e) {
      createEditPopup(e.target);
    });
  }

  const tooltipContent = `<b>${escapeHtml(circle.data?.name || 'نقطة مراقبة')}</b><br>
    <small>الأمن: ${escapeHtml(circle.data?.security || '---')}</small><br>
    <small style="color:#555;">${escapeHtml(circle.data?.notes || '')}</small>`;

  circle.bindTooltip(tooltipContent, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -10]
  });
}

// ========================
// دالة escape HTML — محدثة لدعم السطور الجديدة
// ========================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  // تحويل \n إلى <br> للحفاظ على التنسيق
  return div.innerHTML.replace(/\n/g, '<br>');
}

// ========================
// أحداث الواجهة
// ========================
document.getElementById('addCircleBtn')?.addEventListener('click', () => {
  addMode = true;
  alert('انقر على الخريطة لإنشاء دائرة جديدة.');
  map.getContainer().style.cursor = 'crosshair';
});

document.getElementById('shareBtn')?.addEventListener('click', shareMap);

map.on('click', (e) => {
  if (isViewMode || !addMode) return;
  addMode = false;
  map.getContainer().style.cursor = '';

  // --- إنشاء الدائرة ---
  const circle = L.circle(e.latlng, {
    radius: 100,
    color: '#1a5fb4',
    fillColor: '#3388ff',
    fillOpacity: 0.3
  }).addTo(map);

  // --- إنشاء العلامة القابلة للسحب ---
  const dragMarker = L.marker(e.latlng, {
    draggable: true,
    icon: L.divIcon({ className: 'invisible-drag-marker', iconSize: [0, 0] })
  }).addTo(map);

  // --- ربط حركة العلامة بتحريك الدائرة ---
  dragMarker.on('drag', function() {
    const newLatLng = dragMarker.getLatLng();
    circle.setLatLng(newLatLng);
  });

  dragMarker.on('dragend', function() {
    const newLatLng = dragMarker.getLatLng();
    circle.data.lat = newLatLng.lat;
    circle.data.lng = newLatLng.lng;
  });

  // --- تهيئة البيانات ---
  circle.data = { name: '', security: '', notes: '', lat: e.latlng.lat, lng: e.latlng.lng };
  circle._dragMarker = dragMarker;
  circles.push(circle);
  attachEvents(circle);
  createEditPopup(circle); // فتح نافذة الإدخال مباشرة
});

// ========================
// بدء التشغيل
// ========================
loadFromUrl();
