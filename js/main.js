// أدوات URL
function getParams(){ return new URLSearchParams(location.search); }
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }

// تُستدعى عبر callback=initMap
window.initMap = function () {
  const params = getParams();
  const isShare = params.get('view') === 'share';
  if (isShare) document.body.classList.add('share');

  // مركز افتراضي: الدرعية
  const defaultCenter = { lat: 24.7418, lng: 46.5758 };
  const center = {
    lat: parseFloat(params.get('lat')) || defaultCenter.lat,
    lng: parseFloat(params.get('lng')) || defaultCenter.lng,
  };
  const zoom = parseInt(params.get('z') || '14', 10);
  const mapTypeId = (params.get('t') || 'roadmap');

  // عناصر DOM
  const mapEl = document.getElementById('map');
  const panel = document.getElementById('panel');
  const sharebar = document.getElementById('sharebar');
  const exitShare = document.getElementById('exit-share');
  const trafficBtn = document.getElementById('traffic-toggle');

  // وضع العرض: إظهار الشريط وإزالة اللوحة من DOM
  if (isShare) {
    sharebar.classList.remove('hidden');
    exitShare.href = location.pathname;
    panel?.remove();
  } else {
    sharebar.classList.add('hidden');
  }

  // الخريطة (نُبقي واجهة Google متاحة في الوضعين)
  const map = new google.maps.Map(mapEl, {
    center, zoom, mapTypeId,
    gestureHandling: 'greedy',
    disableDefaultUI: false,
    mapTypeControl: true, zoomControl: true,
    streetViewControl: false, fullscreenControl: true,
    keyboardShortcuts: true
  });

  // طبقة حركة المرور
  const trafficLayer = new google.maps.TrafficLayer();
  let trafficOn = (params.get('tr') || '0') === '1';
  function setTraffic(on){
    trafficOn = !!on;
    trafficBtn.setAttribute('aria-pressed', trafficOn ? 'true' : 'false');
    trafficLayer.setMap(trafficOn ? map : null);
  }
  setTraffic(trafficOn);
  trafficBtn.addEventListener('click', () => setTraffic(!trafficOn));

  // بيانات المواقع مع المستلمين (أمثلة)
  const SITES = [
    {
      id: 'samhan-gate',
      name: 'بوابة سمحان', type: 'بوابة',
      lat: 24.742132355539432, lng: 46.56966664740594,
      recipients: ['قائد المنطقة – سمحان', 'غرفة التحكم', 'دورية المتابعة']
    },
    {
      id: 'bujairi-rbt',
      name: 'دوار البجيري', type: 'دوار',
      lat: 24.73754835059363,  lng: 46.57401116325427,
      recipients: ['مجموعة البجيري', 'المناوب الميداني']
    },
    {
      id: 'king-salman-sq',
      name: 'ميدان الملك سلمان', type: 'ميدان',
      lat: 24.7406, lng: 46.5802,
      recipients: ['قائد الميدان', 'غرفة التحكم']
    }
  ];
  const DEFAULT_RADIUS_M = 15;

  // كرت المعلومات + المحرر
  const card = document.getElementById('info-card');
  const closeBtn = card.querySelector('.close');
  const nameEl = document.getElementById('site-name');
  const typeEl = document.getElementById('site-type');
  const coordEl = document.getElementById('site-coord');
  const radiusEl = document.getElementById('site-radius');
  const recEl = document.getElementById('site-recipients');
  const editActions = document.getElementById('edit-actions');
  const editBtn = document.getElementById('edit-recipients');

  const editor = document.getElementById('editor');
  const editorInput = document.getElementById('editor-input');
  const editorSave = document.getElementById('editor-save');
  const editorCancel = document.getElementById('editor-cancel');

  let currentSiteId = null;

  function renderRecipients(list){
    if (!list || !list.length) return '—';
    return list.join('، ');
  }

  function openCard(site){
    currentSiteId = site.id;
    nameEl.textContent = site.name || '—';
    typeEl.textContent = site.type || '—';
    coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
    radiusEl.textContent = `${DEFAULT_RADIUS_M} م`;
    recEl.textContent = renderRecipients(site.recipients);
    // زر التحرير يظهر فقط خارج وضع العرض
    if (!isShare) editActions.classList.remove('hidden');
    else editActions.classList.add('hidden');

    card.classList.remove('hidden');
  }

  function closeCard(){ card.classList.add('hidden'); currentSiteId = null; }
  closeBtn.addEventListener('click', closeCard);
  map.addListener('click', closeCard);

  // طبقاتنا
  const markers = [], circles = [];
  const byId = Object.create(null);

  SITES.forEach((site) => {
    byId[site.id] = site;
    const pos = { lat: site.lat, lng: site.lng };

    const marker = new google.maps.Marker({
      position: pos, map, title: site.name,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6,
              fillColor: '#e11d48', fillOpacity: 1,
              strokeColor: '#ffffff', strokeWeight: 2 },
      zIndex: 2
    });
    markers.push(marker);

    const circle = new google.maps.Circle({
      map, center: pos, radius: DEFAULT_RADIUS_M,
      strokeColor: '#60a5fa', strokeOpacity: 0.95, strokeWeight: 2,
      fillColor: '#60a5fa', fillOpacity: 0.16, clickable: false, zIndex: 1
    });
    circles.push(circle);

    marker.addListener('click', () => {
      openCard(site);
      map.panTo(pos);
      circle.setOptions({ strokeOpacity: 1, fillOpacity: 0.22 });
      setTimeout(() => circle.setOptions({ strokeOpacity: 0.95, fillOpacity: 0.16 }), 240);
    });
  });

  // الوضع العادي فقط: عناصر اللوحة ومشاركة الرابط
  if (!isShare) {
    const toggleMarkers = document.getElementById('toggle-markers');
    const toggleCircles = document.getElementById('toggle-circles');
    const baseMapSel = document.getElementById('basemap');
    const shareBtn = document.getElementById('share-btn');
    const toast = document.getElementById('toast');

    baseMapSel.value = map.getMapTypeId();

    toggleMarkers.addEventListener('change', () => {
      const show = toggleMarkers.checked; markers.forEach(m => m.setMap(show ? map : null));
    });
    toggleCircles.addEventListener('change', () => {
      const show = toggleCircles.checked; circles.forEach(c => c.setMap(show ? map : null));
    });
    baseMapSel.addEventListener('change', () => { map.setMapTypeId(baseMapSel.value); });

    // نسخ رابط عرض فقط (يشمل نوع الخريطة والمرور)
    shareBtn.addEventListener('click', async () => {
      const c = map.getCenter(); const z = map.getZoom(); const t = map.getMapTypeId();
      const url = `${location.origin}${location.pathname}?view=share&lat=${toFixed6(c.lat())}&lng=${toFixed6(c.lng())}&z=${z}&t=${encodeURIComponent(t)}&tr=${trafficOn ? '1' : '0'}`;
      try { await navigator.clipboard.writeText(url); toast.textContent = 'تم النسخ ✅'; }
      catch { toast.textContent = url; }
      toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2000);
    });

    // محرر المستلمين
    editBtn?.addEventListener('click', () => {
      if (!currentSiteId) return;
      const site = byId[currentSiteId];
      editorInput.value = (site.recipients || []).join('\n');
      editor.classList.remove('hidden');
      editorInput.focus();
    });
    editorCancel.addEventListener('click', () => editor.classList.add('hidden'));
    editorSave.addEventListener('click', () => {
      if (!currentSiteId) return;
      const site = byId[currentSiteId];
      const lines = editorInput.value.split('\n')
        .map(s => s.trim()).filter(Boolean);
      site.recipients = lines;
      recEl.textContent = renderRecipients(site.recipients);
      editor.classList.add('hidden');
    });
  } else {
    // وضع العرض: احترم نوع الخريطة والمرور من الرابط فقط
    if (params.get('t')) map.setMapTypeId(params.get('t'));
  }

  // دبوس تشغيل اختياري
  new google.maps.Marker({
    position: center, map, title: 'Test OK',
    icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 4,
      fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1.5 },
    zIndex: 0
  });

  console.log(isShare ? 'Share View (readonly) with logo ✅' : 'Full View with editor ✅');
};

// حماية عامة
window.addEventListener('unhandledrejection', (e)=>console.error('Unhandled promise rejection:', e.reason||e));
setTimeout(()=>{ if(!window.google || !window.google.maps){ console.error('لم يتم تحميل مكتبة Google Maps. تحقق من المفتاح/القيود/الشبكة.'); } }, 4000);
