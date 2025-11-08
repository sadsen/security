/* ========= إعدادات أساسية ========= */
const API_KEY = 'AIzaSyCjX9UJKG53r5ymGydlWEMNbuvi234LcC8';
const DEFAULT_CENTER = { lat: 24.7408, lng: 46.5759 };
const DEFAULT_ZOOM   = 14;

/* ========= تحميل سكربت خرائط Google بطريقة آمنة ========= */
function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();

    const src = `https://maps.googleapis.com/maps/api/js?key=${AIzaSyCjX9UJKG53r5ymGydlWEMNbuvi234LcC8
}&libraries=geometry&v=weekly`;
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google && window.google.maps) resolve();
      else reject(new Error('google.maps غير متوفر بعد onload'));
    };
    s.onerror = () => reject(new Error('فشل تحميل سكربت خرائط Google (onerror)'));
    document.head.appendChild(s);
  });
}

/* ========= متغيرات عامة ========= */
let map, trafficLayer, transitLayer, bikeLayer;
let infoWindow;
const circles = [];

/* ========= واجهة أخطاء ========= */
function showErrorOverlay(message) {
  const wrap = document.getElementById('gmap-error');
  const pre  = document.getElementById('err-details');
  if (!wrap || !pre) return;
  pre.textContent = message || 'Unknown';
  wrap.hidden = false;
}

/* ========= تهيئة الخريطة ========= */
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: 'roadmap',
    gestureHandling: 'greedy',
    clickableIcons: true,
  });

  infoWindow = new google.maps.InfoWindow();

  // طبقات
  trafficLayer = new google.maps.TrafficLayer();
  transitLayer = new google.maps.TransitLayer();
  bikeLayer    = new google.maps.BicyclingLayer();

  // دائرة افتراضية صغيرة فقط للتأكيد أن كل شيء يعمل
  const test = new google.maps.Circle({
    map,
    center: DEFAULT_CENTER,
    radius: 15,
    strokeColor: '#7c3aed',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: '#a78bfa',
    fillOpacity: 0.25,
    draggable: false,
    editable: false,
  });
  circles.push(test);
  attachHoverCard(test, {
    siteName: 'موقع افتراضي',
    names: [],
    notes: ''
  });

  wireUI();
}

/* ========= كرت المعلومات ========= */
function attachHoverCard(circle, data) {
  const html = `
    <div style="min-width:220px;max-width:280px;line-height:1.6">
      <div style="font-weight:800;margin-bottom:4px">${escapeHTML(data.siteName||'بدون اسم')}</div>
      ${data.names?.length ? `<div style="opacity:.85">الأمن:</div><div>${data.names.map(n=>escapeHTML(n)).join('<br>')}</div>` : ''}
      ${data.notes ? `<div style="margin-top:6px;opacity:.8">${escapeHTML(data.notes)}</div>` : ''}
    </div>
  `;

  const pos = circle.getCenter();
  circle.addListener('mouseover', () => { infoWindow.setContent(html); infoWindow.setPosition(pos); infoWindow.open({map}); });
  circle.addListener('mouseout',  () => { /* اتركها مفتوحة لو حبيت */ });
  circle.addListener('click',     () => { infoWindow.setContent(html); infoWindow.setPosition(pos); infoWindow.open({map}); });
}

/* ========= أدوات الواجهة ========= */
function wireUI() {
  const $ = (id) => document.getElementById(id);

  // طبقات
  const mapTypeSelect = $('mapTypeSelect');
  const layerTraffic  = $('layerTraffic');
  const layerTransit  = $('layerTransit');
  const layerBike     = $('layerBike');

  mapTypeSelect.addEventListener('change', () => map.setMapTypeId(mapTypeSelect.value));

  layerTraffic.addEventListener('change', () => layerTraffic.checked ? trafficLayer.setMap(map) : trafficLayer.setMap(null));
  layerTransit.addEventListener('change', () => layerTransit.checked ? transitLayer.setMap(map) : transitLayer.setMap(null));
  layerBike.addEventListener('change', () => layerBike.checked ? bikeLayer.setMap(map) : bikeLayer.setMap(null));

  // إضافة دائرة جديدة
  $('addCircleBtn').addEventListener('click', () => {
    const center = map.getCenter();
    const circle = new google.maps.Circle({
      map,
      center,
      radius: Number($('radius').value || 15),
      strokeColor: $('strokeColor').value,
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: $('fillColor').value,
      fillOpacity: Number($('fillOpacity').value || 0.25),
      draggable: $('dragToggle').checked,
      editable: $('editToggle').checked,
    });
    circles.push(circle);
    const names = $('securityNames').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    attachHoverCard(circle, {
      siteName: $('siteName').value.trim() || 'موقع بدون اسم',
      names,
      notes: $('notes').value.trim()
    });
  });

  // مشاركة (placeholder)
  $('shareBtn').addEventListener('click', () => {
    alert('ميزة مشاركة الخريطة لاحقاً. المهم الآن تشغيل الخريطة بنجاح.');
  });

  // مزامنة التحديث الحيّ للدائرة المحددة (اختياري)
  ['fillColor','strokeColor','fillOpacity','radius','dragToggle','editToggle'].forEach(id=>{
    const el = $(id);
    el.addEventListener('input', ()=>{
      const c = circles[circles.length-1];
      if(!c) return;
      if(id==='fillColor')   c.setOptions({fillColor: el.value});
      if(id==='strokeColor') c.setOptions({strokeColor: el.value});
      if(id==='fillOpacity') c.setOptions({fillOpacity: Number(el.value)});
      if(id==='radius')      c.setRadius(Number(el.value||15));
      if(id==='dragToggle')  c.setDraggable(el.checked);
      if(id==='editToggle')  c.setEditable(el.checked);
    });
  });
}

/* ========= Utils ========= */
function escapeHTML(s){return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}

/* ========= الإقلاع ========= */
(async function boot(){
  try{
    await loadGoogleMaps();
    initMap();
  }catch(e){
    console.error('[BOOT] Google Maps load/init failed:', e);
    showErrorOverlay(String(e && e.message ? e.message : e));
  }
})();

