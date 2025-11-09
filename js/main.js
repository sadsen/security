// ---------- أدوات URL و Base64 ----------
function getParams(){ return new URLSearchParams(location.search); }
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }
function b64EncodeUnicode(obj){ const s = typeof obj === 'string' ? obj : JSON.stringify(obj); return btoa(unescape(encodeURIComponent(s))); }
function b64DecodeUnicode(str){ try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

// ---------- الحالة الافتراضية ----------
function defaultState(){
  return {
    traffic: false,
    sites: [
      { id:'samhan-gate', name:'بوابة سمحان', type:'بوابة', lat:24.742132355539432, lng:46.56966664740594,
        recipients:['قائد المنطقة – سمحان','غرفة التحكم','دورية المتابعة'],
        style:{ radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 } },
      { id:'bujairi-rbt', name:'دوار البجيري', type:'دوار', lat:24.73754835059363, lng:46.57401116325427,
        recipients:['مجموعة البجيري','المناوب الميداني'],
        style:{ radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 } },
      { id:'king-salman-sq', name:'ميدان الملك سلمان', type:'ميدان', lat:24.7406, lng:46.5802,
        recipients:['قائد الميدان','غرفة التحكم'],
        style:{ radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 } }
    ]
  };
}

// ---------- تطبيق ----------
window.initMap = function () {
  const params = getParams();
  const isShare = params.get('view') === 'share';
  if (isShare) document.body.classList.add('share');

  // حمّل الحالة من s= إن وُجدت (وإلا افتراضي)
  const state = params.get('s') ? (b64DecodeUnicode(params.get('s')) || defaultState()) : defaultState();

  // إعداد الخريطة
  const defaultCenter = { lat: 24.7418, lng: 46.5758 };
  const center = { lat: parseFloat(params.get('lat')) || defaultCenter.lat, lng: parseFloat(params.get('lng')) || defaultCenter.lng };
  const zoom = parseInt(params.get('z') || '14', 10);
  const mapTypeId = (params.get('t') || 'roadmap');

  const mapEl = document.getElementById('map');
  const panel = document.getElementById('panel');
  const sharebar = document.getElementById('sharebar');
  const exitShare = document.getElementById('exit-share');
  const trafficBtn = document.getElementById('traffic-toggle');

  // وضع العرض: إظهار الشريط، إزالة اللوحة تماماً، وزر إنهاء العرض يرجع للرابط الأساسي بدون باراميترات
  if (isShare) {
    sharebar.classList.remove('hidden');
    const base = location.origin + location.pathname; // URL نظيف
    exitShare.setAttribute('href', base);
    panel?.remove();
  } else {
    sharebar.classList.add('hidden');
  }

  const map = new google.maps.Map(mapEl, {
    center, zoom, mapTypeId,
    gestureHandling: 'greedy',
    disableDefaultUI: false,
    mapTypeControl: true, zoomControl: true,
    streetViewControl: false, fullscreenControl: true,
    keyboardShortcuts: true
  });

  // حركة المرور
  const trafficLayer = new google.maps.TrafficLayer();
  let trafficOn = params.has('tr') ? (params.get('tr') === '1') : !!state.traffic;
  function setTraffic(on){ trafficOn = !!on; trafficBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); trafficLayer.setMap(on ? map : null); }
  setTraffic(trafficOn);
  trafficBtn.addEventListener('click', () => setTraffic(!trafficOn));

  // عناصر الكرت + المحرر
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

  // مصفوفات الطبقات
  const markers = [];
  const circles = [];
  const byId = Object.create(null);
  let selectedId = null;

  function renderRecipients(list){ return (list && list.length) ? list.join('، ') : '—'; }

  function openCard(site){
    selectedId = site.id;
    nameEl.textContent = site.name || '—';
    typeEl.textContent = site.type || '—';
    coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
    radiusEl.textContent = `${site.style.radius} م`;
    recEl.textContent = renderRecipients(site.recipients);
    if (!isShare) editActions.classList.remove('hidden'); else editActions.classList.add('hidden');
    card.classList.remove('hidden');

    // عكس الخصائص في اللوحة
    if (!isShare) {
      document.getElementById('ed-radius').value   = site.style.radius;
      document.getElementById('ed-fill').value     = site.style.fill;
      document.getElementById('ed-fillop').value   = site.style.fillOpacity;
      document.getElementById('ed-stroke').value   = site.style.stroke;
      document.getElementById('ed-stroke-w').value = site.style.strokeWeight;
    }
  }
  function closeCard(){ card.classList.add('hidden'); selectedId = null; }
  closeBtn.addEventListener('click', closeCard);
  map.addListener('click', closeCard);

  function syncCircle(site){
    const m = markers.find(x => x.__id === site.id);
    const c = circles.find(x => x.__id === site.id);
    if (!m || !c) return;
    const pos = {lat:site.lat, lng:site.lng};
    m.setPosition(pos);
    c.setCenter(pos);
    c.setOptions({
      radius: site.style.radius,
      fillColor: site.style.fill,
      fillOpacity: site.style.fillOpacity,
      strokeColor: site.style.stroke,
      strokeWeight: site.style.strokeWeight
    });
    if (selectedId === site.id) {
      coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
      radiusEl.textContent = `${site.style.radius} م`;
      recEl.textContent = renderRecipients(site.recipients);
    }
  }

  function createFeature(site){
    byId[site.id] = site;
    const pos = { lat: site.lat, lng: site.lng };
    const marker = new google.maps.Marker({
      position: pos, map, title: site.name,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor:'#e11d48', fillOpacity:1, strokeColor:'#ffffff', strokeWeight:2 },
      draggable: !isShare, // ممنوع السحب في وضع العرض
      zIndex: 2
    });
    marker.__id = site.id;
    markers.push(marker);

    const circle = new google.maps.Circle({
      map, center: pos, radius: site.style.radius,
      strokeColor: site.style.stroke, strokeOpacity: 0.95, strokeWeight: site.style.strokeWeight,
      fillColor: site.style.fill, fillOpacity: site.style.fillOpacity, clickable: false, zIndex: 1
    });
    circle.__id = site.id;
    circles.push(circle);

    // تفاعل النقر (عرض فقط في share، تحرير + عرض في الوضع العادي)
    marker.addListener('click', () => {
      openCard(site);
      map.panTo(pos);
      circle.setOptions({ strokeOpacity: 1, fillOpacity: Math.min(site.style.fillOpacity+0.06, 1) });
      setTimeout(() => circle.setOptions({ strokeOpacity: 0.95, fillOpacity: site.style.fillOpacity }), 240);
    });

    // تحريك الموقع (الوضع العادي فقط)
    marker.addListener('dragend', (e) => {
      if (isShare) return;
      site.lat = e.latLng.lat(); site.lng = e.latLng.lng();
      syncCircle(site);
    });
  }

  // أنشئ الميزات
  state.sites.forEach(createFeature);

  // ===== الوضع العادي: تفعيل أدوات التحرير =====
  if (!isShare) {
    const toggleMarkers = document.getElementById('toggle-markers');
    const toggleCircles = document.getElementById('toggle-circles');
    const baseMapSel    = document.getElementById('basemap');
    const shareBtn      = document.getElementById('share-btn');
    const toast         = document.getElementById('toast');

    const edRadius  = document.getElementById('ed-radius');
    const edFill    = document.getElementById('ed-fill');
    const edFillOp  = document.getElementById('ed-fillop');
    const edStroke  = document.getElementById('ed-stroke');
    const edStrokeW = document.getElementById('ed-stroke-w');
    const btnAdd    = document.getElementById('btn-add');
    const btnDel    = document.getElementById('btn-del');

    baseMapSel.value = map.getMapTypeId();

    toggleMarkers.addEventListener('change', () => { const show = toggleMarkers.checked; markers.forEach(m => m.setMap(show ? map : null)); });
    toggleCircles.addEventListener('change', () => { const show = toggleCircles.checked; circles.forEach(c => c.setMap(show ? map : null)); });
    baseMapSel.addEventListener('change', () => { map.setMapTypeId(baseMapSel.value); });

    // تعديل خصائص الدائرة المحددة
    function withSelected(fn){ if (!selectedId) return; const s = byId[selectedId]; fn(s); syncCircle(s); }
    edRadius.addEventListener('input', () => withSelected(s => s.style.radius = parseInt(edRadius.value,10)));
    edFill.addEventListener('input', ()   => withSelected(s => s.style.fill = edFill.value));
    edFillOp.addEventListener('input', () => withSelected(s => s.style.fillOpacity = parseFloat(edFillOp.value)));
    edStroke.addEventListener('input', () => withSelected(s => s.style.stroke = edStroke.value));
    edStrokeW.addEventListener('input',()=> withSelected(s => s.style.strokeWeight = parseInt(edStrokeW.value,10)));

    // إضافة/حذف دائرة
    btnAdd.addEventListener('click', () => {
      const c = map.getCenter();
      const id = 'site-' + Math.random().toString(36).slice(2,8);
      const site = { id, name:'موقع جديد', type:'نقطة', lat:c.lat(), lng:c.lng(),
        recipients:[], style:{ radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 } };
      state.sites.push(site);
      createFeature(site);
      openCard(site);
    });

    btnDel.addEventListener('click', () => {
      if (!selectedId) return;
      const idx = state.sites.findIndex(s => s.id === selectedId);
      if (idx >= 0) {
        // احذف الطبقات
        const mIdx = markers.findIndex(m => m.__id === selectedId);
        const cIdx = circles.findIndex(c => c.__id === selectedId);
        if (mIdx >= 0) { markers[mIdx].setMap(null); markers.splice(mIdx,1); }
        if (cIdx >= 0) { circles[cIdx].setMap(null); circles.splice(cIdx,1); }
        delete byId[selectedId];
        state.sites.splice(idx,1);
        closeCard();
      }
    });

    // محرر المستلمين
    editBtn?.addEventListener('click', () => {
      if (!selectedId) return;
      const site = byId[selectedId];
      editorInput.value = (site.recipients || []).join('\n');
      editor.classList.remove('hidden');
      editorInput.focus();
    });
    editorCancel.addEventListener('click', () => editor.classList.add('hidden'));
    editorSave.addEventListener('click', () => {
      if (!selectedId) return;
      const site = byId[selectedId];
      site.recipients = editorInput.value.split('\n').map(s=>s.trim()).filter(Boolean);
      syncCircle(site);
      editor.classList.add('hidden');
    });

    // توليد رابط العرض (مقفل) مع تضمين الحالة كاملة داخل s=
    shareBtn.addEventListener('click', async () => {
      const c = map.getCenter(); const z = map.getZoom(); const t = map.getMapTypeId();
      const payload = { traffic: trafficOn, sites: state.sites };
      const s = b64EncodeUnicode(payload);
      const url = `${location.origin}${location.pathname}?view=share&lat=${toFixed6(c.lat())}&lng=${toFixed6(c.lng())}&z=${z}&t=${encodeURIComponent(t)}&s=${encodeURIComponent(s)}`;
      const toast = document.getElementById('toast');
      try { await navigator.clipboard.writeText(url); toast.textContent = 'تم النسخ ✅'; }
      catch { toast.textContent = url; }
      toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'), 2000);
    });
  }

  // دبوس مرجعي بسيط
  new google.maps.Marker({
    position: center, map, title: 'Test OK',
    icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 4, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1.5 },
    zIndex: 0
  });

  console.log(isShare ? 'Readonly Share View 🔒' : 'Editor View ✅');
};
