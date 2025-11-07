/* ============ إعدادات عامة ============ */
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM = 14;

let map;                        // Google Map
let addMode = false;            // وضع إضافة دائرة
const circles = [];             // جميع الدوائر
const infoWindows = new Map();  // لكل دائرة InfoWindow
let activeCircle = null;        // الدائرة المحددة للتحرير

/* وضع العرض من الرابط */
const urlParams = new URLSearchParams(location.search);
const isViewModeQuery = urlParams.has('view');
const hash = location.hash || "";
const isViewModeHash = hash.startsWith("#view=") || hash.includes("&view=");
const isViewMode = isViewModeQuery || isViewModeHash;

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.toggle('view-mode', isViewMode);
});

/* ============ أدوات ترميز الرابط ============ */
function toBase64Url(bytes){let b="";bytes.forEach(x=>b+=String.fromCharCode(x));return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function fromBase64Url(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");const p=b.length%4;if(p)b+="=".repeat(4-p);const bin=atob(b);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}

function compactData(data){
  return {
    c: data.center, // {lat,lng,zoom}
    r: data.circles.map(c => ({
      l: [c.center.lat, c.center.lng],
      r: c.radius,
      co: c.strokeColor,
      fc: c.fillColor,
      o: c.fillOpacity,
      n: c.name,
      s: c.security,
      t: c.notes
    }))
  };
}
function expandData(compact){
  return {
    center: compact.c,
    circles: compact.r.map(x => ({
      center: { lat: x.l[0], lng: x.l[1] },
      radius: x.r,
      strokeColor: x.co,
      fillColor: x.fc,
      fillOpacity: x.o,
      name: x.n || '',
      security: x.s || '',
      notes: x.t || ''
    }))
  };
}
function encodeData(data){const json=JSON.stringify(compactData(data));const utf8=new TextEncoder().encode(json);return toBase64Url(utf8);}
function decodeData(encoded){const bytes=fromBase64Url(encoded);const json=new TextDecoder().decode(bytes);return expandData(JSON.parse(json));}

function getViewParam(){
  if(location.hash){const h=location.hash.replace(/^#/,"");const hs=new URLSearchParams(h.includes('=')?h:`view=${h}`);if(hs.has('view'))return hs.get('view');}
  const sp=new URLSearchParams(location.search); if(sp.has('view')) return sp.get('view'); return null;
}
function setViewParam(encoded){
  const newHash=`view=${encoded}`; const newUrl=`${location.origin}${location.pathname}#${newHash}`; history.replaceState(null,"",newUrl); return newUrl;
}

/* ============ HTML كرت المعلومات ============ */
function escapeHtml(t){const d=document.createElement('div');d.textContent=t??'';return d.innerHTML;}
function infoHtml(d){
  const name  = escapeHtml(d?.name || 'نقطة مراقبة');
  const raw   = d?.security ?? '---';
  const lines = String(raw).split(/\r?\n/).map(s=>escapeHtml(s.trim())).filter(Boolean);
  return `
    <div class="info-card">
      <div class="tt-title">${name}</div>
      <div class="tt-label">الأمن:</div>
      <div class="tt-names">
        ${lines.length ? lines.map(s=>`<div class="name-line">${s}</div>`).join("") : `<div class="name-line">---</div>`}
      </div>
      ${d?.notes ? `<div class="tt-notes">${escapeHtml(d.notes)}</div>` : ``}
    </div>`;
}

/* أعلى حافة الدائرة */
function topEdgeLatLng(centerLatLng, radiusMeters){
  return google.maps.geometry.spherical.computeOffset(centerLatLng, radiusMeters, 0);
}

/* إنشاء/تحديث InfoWindow */
function ensureInfoWindow(circle){
  let iw = infoWindows.get(circle.__id);
  const html = infoHtml(circle.__data);
  const anchorLatLng = topEdgeLatLng(circle.getCenter(), circle.getRadius());
  if (!iw){
    iw = new google.maps.InfoWindow({ content: html, position: anchorLatLng });
    infoWindows.set(circle.__id, iw);
  }else{
    iw.setContent(html); iw.setPosition(anchorLatLng);
  }
  return iw;
}
function closeAllInfoWindows(except){infoWindows.forEach(iw=>{if(iw!==except)iw.close();});}

/* ============ Hover لعرض الكرت ============ */
function wireCircleHover(circle){
  const open = () => { const iw=ensureInfoWindow(circle); closeAllInfoWindows(iw); iw.open({map}); };
  const move = () => { const iw=ensureInfoWindow(circle); iw.setPosition(topEdgeLatLng(circle.getCenter(), circle.getRadius())); };
  const close = () => { const iw=infoWindows.get(circle.__id); if(iw) iw.close(); };

  circle.setOptions({ clickable: true });
  circle.addListener('mouseover', open);
  circle.addListener('mousemove', move);
  circle.addListener('mouseout', close);
  circle.addListener('click', () => { open(); selectCircle(circle); }); // للجوال + فتح المحرر
}

/* ============ إنشاء دائرة جديدة ============ */
function createCircleAt(latLng){
  const circle = new google.maps.Circle({
    map, center: latLng, radius: 100,
    strokeColor:'#7c3aed', strokeOpacity:1, strokeWeight:2,
    fillColor:'#c084fc', fillOpacity:0.35,
    clickable:true, draggable:false, editable:false
  });
  circle.__id = Math.random().toString(36).slice(2);
  circle.__data = { name:'', security:'', notes:'' };

  wireCircleHover(circle);
  circles.push(circle);
  selectCircle(circle); // افتح المحرر مباشرة
}

/* ============ الشريط الجانبي (محرر الدائرة) ============ */
const ed = {};
function cacheEditorEls(){
  ed.wrap = document.getElementById('editor');
  ed.empty = document.getElementById('emptyState');
  ed.close = document.getElementById('closeEditor');
  ed.name = document.getElementById('ed-name');
  ed.security = document.getElementById('ed-security');
  ed.notes = document.getElementById('ed-notes');
  ed.stroke = document.getElementById('ed-stroke');
  ed.fill = document.getElementById('ed-fill');
  ed.opacity = document.getElementById('ed-opacity');
  ed.opVal = document.getElementById('op-val');
  ed.radius = document.getElementById('ed-radius');
  ed.radiusNum = document.getElementById('ed-radius-num');
  ed.radVal = document.getElementById('radius-val');
  ed.draggable = document.getElementById('ed-draggable');
  ed.editable = document.getElementById('ed-editable');
  ed.dup = document.getElementById('dupBtn');
  ed.del = document.getElementById('delBtn');
}

function updateEditorFromCircle(c){
  if(!c){ ed.wrap.classList.add('hidden'); ed.empty.classList.remove('hidden'); return; }
  ed.empty.classList.add('hidden');
  ed.wrap.classList.remove('hidden');
  ed.name.value = c.__data.name || '';
  ed.security.value = c.__data.security || '';
  ed.notes.value = c.__data.notes || '';
  ed.stroke.value = c.get('strokeColor') || '#7c3aed';
  ed.fill.value = c.get('fillColor') || '#c084fc';
  ed.opacity.value = (typeof c.get('fillOpacity') === 'number') ? c.get('fillOpacity') : 0.35;
  ed.opVal.textContent = ed.opacity.value;
  const r = Math.round(c.getRadius());
  ed.radius.value = Math.min(Math.max(r, +ed.radius.min), +ed.radius.max);
  ed.radiusNum.value = r;
  ed.radVal.textContent = r;
  ed.draggable.checked = !!c.getDraggable?.() || c.get('draggable');
  ed.editable.checked = !!c.getEditable?.() || c.get('editable');
}

function bindEditorEvents(){
  ed.close.addEventListener('click', ()=> selectCircle(null));

  ed.name.addEventListener('input', ()=>{
    if(!activeCircle) return;
    activeCircle.__data.name = ed.name.value.trim();
    ensureInfoWindow(activeCircle);
  });
  ed.security.addEventListener('input', ()=>{
    if(!activeCircle) return;
    activeCircle.__data.security = ed.security.value;
    ensureInfoWindow(activeCircle);
  });
  ed.notes.addEventListener('input', ()=>{
    if(!activeCircle) return;
    activeCircle.__data.notes = ed.notes.value;
    ensureInfoWindow(activeCircle);
  });

  ed.stroke.addEventListener('input', ()=>{
    if(!activeCircle) return;
    activeCircle.setOptions({ strokeColor: ed.stroke.value });
    ensureInfoWindow(activeCircle);
  });
  ed.fill.addEventListener('input', ()=>{
    if(!activeCircle) return;
    activeCircle.setOptions({ fillColor: ed.fill.value });
    ensureInfoWindow(activeCircle);
  });
  ed.opacity.addEventListener('input', ()=>{
    if(!activeCircle) return;
    const v = parseFloat(ed.opacity.value);
    ed.opVal.textContent = v.toFixed(2);
    activeCircle.setOptions({ fillOpacity: v });
    ensureInfoWindow(activeCircle);
  });

  const applyRadius = (v)=>{
    if(!activeCircle) return;
    const val = Math.max(10, Math.round(+v||100));
    activeCircle.setRadius(val);
    ed.radius.value = val;
    ed.radiusNum.value = val;
    ed.radVal.textContent = val;
    ensureInfoWindow(activeCircle);
  };
  ed.radius.addEventListener('input', ()=> applyRadius(ed.radius.value));
  ed.radiusNum.addEventListener('input', ()=> applyRadius(ed.radiusNum.value));

  ed.draggable.addEventListener('change', ()=>{
    if(!activeCircle) return;
    activeCircle.setDraggable?.(ed.draggable.checked);
  });
  ed.editable.addEventListener('change', ()=>{
    if(!activeCircle) return;
    activeCircle.setEditable?.(ed.editable.checked);
  });

  ed.dup.addEventListener('click', ()=>{
    if(!activeCircle) return;
    const ll = activeCircle.getCenter();
    const off = 0.0006;
    const nl = { lat: ll.lat() + (Math.random()-0.5)*off, lng: ll.lng() + (Math.random()-0.5)*off };
    const nc = new google.maps.Circle({
      map,
      center: nl,
      radius: activeCircle.getRadius(),
      strokeColor: activeCircle.get('strokeColor'),
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: activeCircle.get('fillColor'),
      fillOpacity: activeCircle.get('fillOpacity'),
      clickable: true,
      draggable: activeCircle.getDraggable?.(),
      editable: activeCircle.getEditable?.()
    });
    nc.__id = Math.random().toString(36).slice(2);
    nc.__data = {...activeCircle.__data};
    wireCircleHover(nc);
    circles.push(nc);
    selectCircle(nc);
  });

  ed.del.addEventListener('click', ()=>{
    if(!activeCircle) return;
    if(!confirm('هل تريد حذف هذه الدائرة؟')) return;
    const idx = circles.indexOf(activeCircle);
    if(idx>-1) circles.splice(idx,1);
    const iw = infoWindows.get(activeCircle.__id);
    if(iw) iw.close();
    activeCircle.setMap(null);
    infoWindows.delete(activeCircle.__id);
    selectCircle(null);
  });
}

function selectCircle(circle){
  activeCircle = circle;
  updateEditorFromCircle(circle);
  if(!circle) return;
  const iw = ensureInfoWindow(circle);
  closeAllInfoWindows(iw);
  iw.open({map});
  circle.addListener('center_changed', ()=> ensureInfoWindow(circle));
  circle.addListener('radius_changed', ()=> ensureInfoWindow(circle));
  circle.addListener('dragend', ()=> ensureInfoWindow(circle));
}

/* ============ مشاركة الخريطة ============ */
function shareMap(){
  const data = {
    center: { lat: map.getCenter().lat(), lng: map.getCenter().lng(), zoom: map.getZoom() },
    circles: circles.map(c => ({
      center: { lat: c.getCenter().lat(), lng: c.getCenter().lng() },
      radius: c.getRadius(),
      strokeColor: c.get('strokeColor'),
      fillColor: c.get('fillColor'),
      fillOpacity: c.get('fillOpacity'),
      name: c.__data?.name || '',
      security: c.__data?.security || '',
      notes: c.__data?.notes || ''
    }))
  };
  try{
    const encoded = encodeData(data);
    const url = setViewParam(encoded);
    if (navigator.share){
      navigator.share({ title: document.title, url }).catch(() => {
        navigator.clipboard.writeText(url).then(()=>alert('تم نسخ رابط الخريطة!'));
      });
    }else{
      navigator.clipboard.writeText(url).then(()=>alert('تم نسخ رابط الخريطة!'));
    }
  }catch(e){
    console.error('فشل إنشاء الرابط:', e);
    alert('حدث خطأ أثناء إنشاء الرابط.');
  }
}

/* ============ تحميل من رابط المشاركة ============ */
function loadFromUrl(){
  if (!isViewMode) return;
  try{
    const encoded = getViewParam();
    if (!encoded) return;
    const data = decodeData(encoded);

    if (data.center) {
      map.setCenter(new google.maps.LatLng(data.center.lat, data.center.lng));
      map.setZoom(data.center.zoom || DEFAULT_ZOOM);
    }

    (data.circles || []).forEach(c => {
      const circle = new google.maps.Circle({
        map,
        center: new google.maps.LatLng(c.center.lat, c.center.lng),
        radius: c.radius || 100,
        strokeColor: c.strokeColor || '#7c3aed',
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: c.fillColor || '#c084fc',
        fillOpacity: (typeof c.fillOpacity === 'number') ? c.fillOpacity : 0.35,
        clickable: true,
        draggable: false,
        editable: false
      });
      circle.__id = Math.random().toString(36).slice(2);
      circle.__data = { name: c.name || '', security: c.security || '', notes: c.notes || '' };
      wireCircleHover(circle);
      circles.push(circle);
    });
  }catch(e){
    console.warn('فشل تحميل الخريطة من الرابط:', e);
  }
}

/* ============ واجهة عامة ============ */
function initUI(){
  cacheEditorEls();
  bindEditorEvents();

  const addBtn = document.getElementById('addCircleBtn');
  const shareBtnEl = document.getElementById('shareBtn');

  addBtn?.addEventListener('click', ()=>{
    addMode = true;
    alert('انقر على الخريطة لوضع دائرة جديدة.');
  });
  shareBtnEl?.addEventListener('click', shareMap);

  map.addListener('click', (e) => {
    if (!addMode) return;
    addMode = false;
    createCircleAt(e.latLng);
  });
}

/* ============ طبقات وأنواع الخريطة ============ */
function setupLayersControl() {
  const box = document.getElementById('layersControl');
  const toggleBtn = document.getElementById('toggleLayers');
  const sel = document.getElementById('basemapSelect');
  const tTraffic = document.getElementById('trafficToggle');
  const tTransit = document.getElementById('transitToggle');
  const tBike = document.getElementById('bicyclingToggle');

  const trafficLayer = new google.maps.TrafficLayer();
  const transitLayer = new google.maps.TransitLayer();
  const bicyclingLayer = new google.maps.BicyclingLayer();

  const savedType = localStorage.getItem('gm_base_map_type') || 'roadmap';
  const savedTraffic = localStorage.getItem('gm_layer_traffic') === '1';
  const savedTransit = localStorage.getItem('gm_layer_transit') === '1';
  const savedBike = localStorage.getItem('gm_layer_bike') === '1';
  const savedMin = localStorage.getItem('gm_layers_min') === '1';

  sel.value = savedType;
  tTraffic.checked = savedTraffic;
  tTransit.checked = savedTransit;
  tBike.checked = savedBike;
  if (savedMin) box.classList.add('min');

  map.setMapTypeId(savedType);
  trafficLayer.setMap(savedTraffic ? map : null);
  transitLayer.setMap(savedTransit ? map : null);
  bicyclingLayer.setMap(savedBike ? map : null);

  sel.addEventListener('change', () => {
    map.setMapTypeId(sel.value);
    localStorage.setItem('gm_base_map_type', sel.value);
  });
  tTraffic.addEventListener('change', () => {
    trafficLayer.setMap(tTraffic.checked ? map : null);
    localStorage.setItem('gm_layer_traffic', tTraffic.checked ? '1' : '0');
  });
  tTransit.addEventListener('change', () => {
    transitLayer.setMap(tTransit.checked ? map : null);
    localStorage.setItem('gm_layer_transit', tTransit.checked ? '1' : '0');
  });
  tBike.addEventListener('change', () => {
    bicyclingLayer.setMap(tBike.checked ? map : null);
    localStorage.setItem('gm_layer_bike', tBike.checked ? '1' : '0');
  });

  toggleBtn.addEventListener('click', ()=>{
    box.classList.toggle('min');
    localStorage.setItem('gm_layers_min', box.classList.contains('min') ? '1' : '0');
  });

  // (اختياري) إظهار أداة Google القياسية أيضًا
  map.setOptions({
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.DEFAULT,
      position: google.maps.ControlPosition.TOP_LEFT,
      mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
    }
  });
}

/* ============ تهيئة الخريطة ============ */
window.initMap = function initMap(){
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: false,      // سنفعّله ونخصّصه في setupLayersControl()
    fullscreenControl: true,
    streetViewControl: false
  });

  setupLayersControl();  // ✅ اللوحة الآن داخل الخريطة ولن تغطي الشريط الجانبي
  initUI();
  loadFromUrl();
};
