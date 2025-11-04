// ========================
// إعدادات الخريطة
// ========================
const DEFAULT_CENTER = [24.7136, 46.6753]; // الرياض — غيّرها حسب منطقتك
const DEFAULT_ZOOM = 12;

// ========================
// التحقق من وضع العرض
// ========================
const urlParams = new URLSearchParams(window.location.search);
const isViewMode = urlParams.has('view');

// ========================
// إنشاء الخريطة
// ========================
const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

// خريطة Stadia Maps (مجانية بـ API Key)
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=5d937485-a301-4455-9ba7-95a93120ff7d', {
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
}).addTo(map);

// ========================
// إخفاء لوحة التحكم في وضع العرض
// ========================
const sidebar = document.getElementById('sidebar');
if (isViewMode) {
  sidebar.classList.add('hidden');
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
      const encoded = urlParams.get('view');
      const jsonString = decodeURIComponent(
        atob(encoded)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const data = JSON.parse(jsonString);

      data.circles.forEach(c => {
        const circle = L.circle([c.lat, c.lng], {
          radius: c.radius,
          color: c.color || '#1a5fb4',        // لون الحدود الأغمق
          fillColor: c.fillColor || '#3388ff', // لون التعبئة الأفتح
          fillOpacity: c.fillOpacity || 0.3
        }).addTo(map);
        circle.data = c;
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
// مشاركة الخريطة (يدعم العربية والسّطور الجديدة)
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

  const jsonString = JSON.stringify(data);
  const encoded = btoa(
    encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode('0x' + p1)
    )
  );

  const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`;

  navigator.clipboard.writeText(url)
    .then(() => alert('تم نسخ رابط الخريطة إلى الحافظة!'))
    .catch(() => prompt('انسخ الرابط يدويًا:', url));
}

// ========================
// إنشاء نافذة تعديل
// ========================
function createEditPopup(circle) {
  const d = circle.data || {};
  const color = circle.options.color || '#1a5fb4';
  const fillColor = circle.options.fillColor || '#3388ff';
  const opacity = circle.options.fillOpacity || 0.3;
  const radius = circle.getRadius() || 100;

  const content = `
    <div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName" value="${escapeHtml(d.name || '')}">
      <label>أفراد الأمن:</label>
      <textarea id="securityNames" rows="3" placeholder="اكتب أسماء أفراد الأمن، اضغط Enter لسطر جديد">${escapeHtml(d.security || '')}</textarea>
      <label>ملاحظات:</label>
      <textarea id="notes" rows="2">${escapeHtml(d.notes || '')}</textarea>
      <label>لون الحدود:</label>
      <input type="color" id="color" value="${color}">
      <label>لون التعبئة:</label>
      <input type="color" id="fillColor" value="${fillColor}">
      <label>الشفافية:</label>
      <input type="number" id="opacity" min="0" max="1" step="0.1" value="${opacity}">
      <label>نصف القطر (م):</label>
      <input type="number" id="radius" min="10" value="${radius}">
      <button onclick="saveCircleData(this, ${circle._leaflet_id})">حفظ</button>
    </div>
  `;

  const popup = L.popup()
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);

  return popup;
}

// ========================
// حفظ بيانات الدائرة
// ========================
window.saveCircleData = function(btn, circleId) {
  const popupContent = btn.closest('.leaflet-popup-content');
  if (!popupContent) return;

  const circle = circles.find(c => c._leaflet_id == circleId);
  if (!circle) return;

  const name = popupContent.querySelector('#siteName')?.value.trim() || '';
  const security = popupContent.querySelector('#securityNames')?.value.trim() || '';
  const notes = popupContent.querySelector('#notes')?.value.trim() || '';
  const color = popupContent.querySelector('#color')?.value || '#1a5fb4';
  const fillColor = popupContent.querySelector('#fillColor')?.value || '#3388ff';
  const opacity = parseFloat(popupContent.querySelector('#opacity')?.value) || 0.3;
  const radius = parseFloat(popupContent.querySelector('#radius')?.value) || 100;

  circle.data = { name, security, notes };
  circle.setStyle({ color, fillColor, fillOpacity: opacity });
  circle.setRadius(radius);

  const tooltipContent = `<b>${escapeHtml(name || 'نقطة غير معنونة')}</b><br><small>الأمن: ${escapeHtml(security || '---')}</small><br><small>${escapeHtml(notes)}</small>`;
  circle.setTooltipContent(tooltipContent);
  map.closePopup();
};

// ========================
// ربط الأحداث بالدائرة
// ========================
function attachEvents(circle) {
  if (!isViewMode) {
    circle.off('click');
    circle.on('click', function(e) {
      const clickedCircle = e.target;
      if (clickedCircle && typeof clickedCircle.getLatLng === 'function') {
        createEditPopup(clickedCircle);
      }
    });
  }

  const tooltipContent = circle.data?.name
    ? `<b>${escapeHtml(circle.data.name)}</b><br><small>الأمن: ${escapeHtml(circle.data.security || '---')}</small>`
    : 'نقطة مراقبة';

  circle.bindTooltip(tooltipContent, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -10]
  });
}

// ========================
// دالة لتفادي حقن HTML
// ========================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================
// أحداث واجهة المستخدم
// ========================
document.getElementById('addCircleBtn')?.addEventListener('click', () => {
  addMode = true;
  alert('الآن انقر على الخريطة لتحديد موقع الدائرة.');
  map.getContainer().style.cursor = 'crosshair';
});

document.getElementById('shareBtn')?.addEventListener('click', shareMap);

map.on('click', (e) => {
  if (isViewMode || !addMode) return;
  addMode = false;
  map.getContainer().style.cursor = '';

  const circle = L.circle(e.latlng, {
    radius: 100,
    color: '#1a5fb4',     // لون الحدود الأغمق
    fillColor: '#3388ff', // لون التعبئة الأفتح
    fillOpacity: 0.3
  }).addTo(map);

  circle.data = { name: '', security: '', notes: '' };
  circles.push(circle);
  attachEvents(circle);
  createEditPopup(circle); // فتح نافذة الإدخال مباشرة
});

// ========================
// بدء التشغيل
// ========================
loadFromUrl();
