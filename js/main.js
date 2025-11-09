// ===== أدوات URL و Base64 =====
function getParams(){ return new URLSearchParams(location.search); }
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }
function b64Encode(obj){ const s = JSON.stringify(obj); return btoa(unescape(encodeURIComponent(s))); }
function b64Decode(str){ try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

// ===== التخزين المحلي (مفتاح جديد لإجبار التحديث) =====
const LS_KEY = 'security:state.v3';

// ===== الحالة الافتراضية: المواقع التي زوّدتني بها =====
function defaultState(){
  const S = (id,name,lat,lng,type) => ({
    id, name, type, lat, lng,
    recipients: [],
    style: { radius: 15, fill: '#60a5fa', fillOpacity: 0.16, stroke: '#60a5fa', strokeWeight: 2 }
  });
  return {
    traffic: false,
    sites: [
      S('samhan-gate','بوابة سمحان',24.742132284177778,46.569503913805825,'بوابة'),
      S('samhan-area','منطقة سمحان',24.74091335108621,46.571891407130025,'منطقة'),
      S('bujairi-rbt','دوار البجيري',24.737521801476476,46.57406918772067,'دوار'),
      S('bujairi-signal','إشارة البجيري',24.73766260194535,46.575429040147306,'إشارة'),
      S('king-faisal-rd','طريق الملك فيصل',24.736133848943062,46.57696607050239,'طريق'),
      S('alshalhoub-triage','نقطة فرز الشلهوب',24.73523670533632,46.57785639752234,'نقطة فرز'),
      S('long-sports-track','المسار الرياضي المديد',24.735301077804944,46.58178092599035,'مسار رياضي'),
      S('king-salman-sq','ميدان الملك سلمان',24.73611373368281,46.58407097038162,'ميدان'),
      S('dim-light-rbt','دوار الضوء الخافت',24.739718342668006,46.58352614787052,'دوار'),
      S('kk-service-track','المسار الرياضي طريق الملك خالد الفرعي',24.740797019998627,46.5866145907347,'مسار رياضي'),
      S('baladiya-rbt','دوار البلدية',24.739266101368777,46.58172727078356,'دوار'),
      S('baladiya-entr','مدخل ساحة البلدية الفرعي',24.738638518378387,46.579858026042785,'مدخل'),
      S('bujairi-carpark-entr','مدخل مواقف البجيري (كار بارك)',24.73826438056506,46.57789576275729,'مدخل'),
      S('security-parking','مواقف الامن',24.73808736962705,46.57771858346317,'مواقف'),
      S('alruqayyah-rbt','دوار الروقية',24.741985907266145,46.56269186990043,'دوار'),
      S('bayt-mubarak','بيت مبارك',24.732609768937607,46.57827089439368,'موقع'),
      S('wadi-safar-rbt','دوار وادي صفار',24.72491458984474,46.57345489743978,'دوار'),
      S('ras-alnaama-rbt','دوار راس النعامة',24.710329841152387,46.572921959358204,'دوار'),
      S('alhabib-farm','مزرعة الحبيب',24.709445443672344,46.593971867951346,'مزرعة')
    ]
  };
}

// ===== LocalStorage (للوضع العادي فقط) =====
function loadLocal(){ try{ const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; }catch{return null;} }
function saveLocal(state){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch{} }

// ===== التطبيق =====
window.initMap = function () {
  const params = getParams();
  const isShare = params.get('view') === 'share';
  if (isShare) document.body.classList.add('share');

  // الحالة: في العرض من s= فقط، وفي العادي من LocalStorage أو الافتراضي
  let state;
  if (isShare) {
    state = params.get('s') ? (b64Decode(params.get('s')) || defaultState()) : defaultState();
  } else {
    state = loadLocal() || defaultState();
  }

  // الخريطة
  const defaultCenter = { lat: 24.7418, lng: 46.5758 };
  const center = { lat: parseFloat(params.get('lat')) || defaultCenter.lat, lng: parseFloat(params.get('lng')) || defaultCenter.lng };
  const zoom = parseInt(params.get('z') || '14', 10);
  const mapTypeId = (params.get('t') || 'roadmap');

  const mapEl = document.getElementById('map');
  const panel  = document.getElementById('panel');
  const sharebar = document.getElementById('sharebar');
  const trafficBtn = document.getElementById('traffic-toggle');

  if (isShare) { sharebar.classList.remove('hidden'); panel?.remove(); } else { sharebar.classList.add('hidden'); }

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
  let trafficOn = !!state.traffic;
  function setTraffic(on){ trafficOn = !!on; trafficBtn.setAttribute('aria-pressed', on?'true':'false'); trafficLayer.setMap(on?map:null); }
  setTraffic(trafficOn);
  trafficBtn.addEventListener('click', () => setTraffic(!trafficOn));

  // عناصر الكرت والمحرر
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

  function syncFeature(site){
    const m = markers.find(x => x.__id === site.id);
    const c = circles.find(x => x.__id === site.id);
    if (!m || !c) return;
    const pos = { lat: site.lat, lng: site.lng };
    m.setPosition(pos);
    c.setCenter(pos);
    c.setOptions({
      radius: site.style.radius,
      fillColor: site.style.fill,
      fillOpacity: site.style.fillOpacity,
      strokeColor: site.style.stroke,
      strokeWeight: site.style.strokeWeight
    });
    if (!isShare) saveLocal(state);
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
      draggable: !isShare, zIndex: 2
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

    marker.addListener('click', () => {
      openCard(site);
      map.panTo(pos);
      circle.setOptions({ strokeOpacity: 1, fillOpacity: Math.min(site.style.fillOpacity+0.06,1) });
      setTimeout(() => circle.setOptions({ strokeOpacity: 0.95, fillOpacity: site.style.fillOpacity }), 240);
    });

    marker.addListener('dragend', (e) => {
      if (isShare) return;
      site.lat = e.latLng.lat(); site.lng = e.latLng.lng();
      syncFeature(site);
    });
  }

  state.sites.forEach(createFeature);

  // ===== أدوات التحرير (للوضع العادي فقط) =====
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

    // تغيير خصائص الدائرة المحددة
    function withSel(fn){ if (!selectedId) return; const s = byId[selectedId]; fn(s); syncFeature(s); }
    edRadius.addEventListener('input', () => withSel(s => s.style.radius = parseInt(edRadius.value,10)));
    edFill.addEventListener('input',   () => withSel(s => s.style.fill = edFill.value));
    edFillOp.addEventListener('input', () => withSel(s => s.style.fillOpacity = parseFloat(edFillOp.value)));
    edStroke.addEventListener('input', () => withSel(s => s.style.stroke = edStroke.value));
    edStrokeW.addEventListener('input',() => withSel(s => s.style.strokeWeight = parseInt(edStrokeW.value,10)));

    // إضافة/حذف
    btnAdd.addEventListener('click', () => {
      const c = map.getCenter();
      const id = 'site-' + Math.random().toString(36).slice(2,8);
      const site = { id, name:'موقع جديد', type:'نقطة', lat:c.lat(), lng:c.lng(),
        recipients:[], style:{ radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 } };
      state.sites.push(site); createFeature(site); openCard(site); saveLocal(state);
    });
    btnDel.addEventListener('click', () => {
      if (!selectedId) return;
      const idx = state.sites.findIndex(s => s.id === selectedId);
      if (idx >= 0) {
        const mIdx = markers.findIndex(m => m.__id === selectedId);
        const cIdx = circles.findIndex(c => c.__id === selectedId);
        if (mIdx >= 0) { markers[mIdx].setMap(null); markers.splice(mIdx,1); }
        if (cIdx >= 0) { circles[cIdx].setMap(null); circles.splice(cIdx,1); }
        delete byId[selectedId];
        state.sites.splice(idx,1);
        closeCard();
        saveLocal(state);
      }
    });

    // محرر المستلمين
    editBtn?.addEventListener('click', () => {
      if (!selectedId) return; const site = byId[selectedId];
      editorInput.value = (site.recipients || []).join('\n');
      editor.classList.remove('hidden'); editorInput.focus();
    });
    editorCancel.addEventListener('click', () => editor.classList.add('hidden'));
    editorSave.addEventListener('click', () => {
      if (!selectedId) return; const site = byId[selectedId];
      site.recipients = editorInput.value.split('\n').map(s=>s.trim()).filter(Boolean);
      syncFeature(site); editor.classList.add('hidden'); saveLocal(state);
    });

    // توليد رابط العرض: تضمين الحالة كاملة في s=
    shareBtn.addEventListener('click', async () => {
      const c = map.getCenter(); const z = map.getZoom(); const t = map.getMapTypeId();
      const payload = { traffic: trafficOn, sites: state.sites };
      const s = encodeURIComponent(b64Encode(payload));
      const url = `${location.origin}${location.pathname}?view=share&lat=${toFixed6(c.lat())}&lng=${toFixed6(c.lng())}&z=${z}&t=${encodeURIComponent(t)}&s=${s}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      toast.textContent = 'تم النسخ ✅'; toast.classList.remove('hidden');
      setTimeout(()=>toast.classList.add('hidden'), 2000);
    });
  }

  console.log(isShare ? 'Readonly Share View 🔒' : 'Editor View ✅');
};
