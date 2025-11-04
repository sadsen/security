const MAPTILER_KEY = 'a5Bw04JDHtYYQy2RwFvl';
const DEFAULT_CENTER = [24.7136, 46.6753]; // الرياض (يمكنك تغييرها)
const DEFAULT_ZOOM = 12;

const urlParams = new URLSearchParams(window.location.search);
const isViewMode = urlParams.has('view');

const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer(`https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`, {
  attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
  tileSize: 512,
  zoomOffset: -1
}).addTo(map);

const sidebar = document.getElementById('sidebar');
if (isViewMode) {
  sidebar.classList.add('hidden');
  map.dragging.enable();
  map.scrollWheelZoom.enable();
}

let circles = [];
let addMode = false;

function loadFromUrl() {
  if (isViewMode) {
    try {
      const data = JSON.parse(atob(urlParams.get('view')));
      data.circles.forEach(c => {
        const circle = L.circle([c.lat, c.lng], {
          radius: c.radius,
          color: c.color,
          fillColor: c.fillColor,
          fillOpacity: c.fillOpacity
        }).addTo(map);
        circle.data = c;
        circles.push(circle);
        attachEvents(circle);
      });
      if (data.center) map.setView([data.center.lat, data.center.lng], data.center.zoom);
    } catch (e) {
      console.error("فشل تحميل الخريطة");
    }
  }
}

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
      ...c.data
    }))
  };
  const encoded = btoa(JSON.stringify(data));
  const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`;
  navigator.clipboard.writeText(url).then(() => {
    alert('تم نسخ رابط الخريطة إلى الحافظة!');
  }).catch(() => {
    prompt('انسخ الرابط يدويًا:', url);
  });
}

function createEditPopup(circle) {
  const d = circle.data || {};
  const color = circle.options.color || '#3388ff';
  const opacity = circle.options.fillOpacity || 0.3;
  const radius = circle.getRadius() || 100;
  return `<div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName" value="${d.name || ''}">
      <label>أفراد الأمن:</label>
      <input type="text" id="securityNames" value="${d.security || ''}">
      <label>ملاحظات:</label>
      <textarea id="notes" rows="2">${d.notes || ''}</textarea>
      <label>اللون (hex):</label>
      <input type="color" id="color" value="${color}">
      <label>الشفافية (0-1):</label>
      <input type="number" id="opacity" min="0" max="1" step="0.1" value="${opacity}">
      <label>نصف القطر (متر):</label>
      <input type="number" id="radius" min="10" value="${radius}">
      <button onclick="saveCircleData(this)">حفظ</button>
    </div>`;
}

window.saveCircleData = function(btn) {
  const popup = btn.closest('.circle-edit-popup');
  const circle = btn.__circle;
  const name = popup.querySelector('#siteName').value;
  const security = popup.querySelector('#securityNames').value;
  const notes = popup.querySelector('#notes').value;
  const color = popup.querySelector('#color').value;
  const opacity = parseFloat(popup.querySelector('#opacity').value) || 0.3;
  const radius = parseFloat(popup.querySelector('#radius').value) || 100;
  circle.data = { name, security, notes };
  circle.setStyle({ color, fillColor: color, fillOpacity: opacity });
  circle.setRadius(radius);
  const tooltipContent = `<b>${name || 'نقطة غير معنونة'}</b><br><small>الأمن: ${security || '---'}</small><br><small>${notes || ''}</small>`;
  circle.setTooltipContent(tooltipContent);
  circle.closePopup();
};

function attachEvents(circle) {
  if (!isViewMode) {
    circle.on('click', function(e) {
      const content = createEditPopup(circle);
      const popup = L.popup().setLatLng(circle.getLatLng()).setContent(content).openOn(map);
      setTimeout(() => {
        const saveBtn = popup.getElement().querySelector('button');
        if (saveBtn) saveBtn.__circle = circle;
      }, 100);
    });
  }
  const tooltipContent = circle.data?.name ? 
    `<b>${circle.data.name}</b><br><small>الأمن: ${circle.data.security || '---'}</small>` : 'نقطة مراقبة';
  circle.bindTooltip(tooltipContent, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -10]
  });
}

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
    color: '#3388ff',
    fillColor: '#3388ff',
    fillOpacity: 0.3
  }).addTo(map);
  circle.data = { name: '', security: '', notes: '' };
  circles.push(circle);
  attachEvents(circle);
  const content = `<div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName">
      <label>أفراد الأمن:</label>
      <input type="text" id="securityNames">
      <label>ملاحظات:</label>
      <textarea id="notes" rows="2"></textarea>
      <button onclick="saveCircleData(this)">إضافة</button>
    </div>`;
  const popup = L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
  setTimeout(() => {
    const saveBtn = popup.getElement().querySelector('button');
    if (saveBtn) saveBtn.__circle = circle;
  }, 100);
});


loadFromUrl();
