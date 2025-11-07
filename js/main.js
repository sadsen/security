/* ========================
   إعدادات أساسية
======================== */
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM = 14;

let map;                        // Google Map instance
let addMode = false;            // وضع إضافة دائرة
const circles = [];             // جميع الدوائر
const infoWindows = new Map();  // لكل دائرة InfoWindow

/* وضع العرض من الرابط */
const urlParams = new URLSearchParams(location.search);
const isViewModeQuery = urlParams.has('view');
const hash = location.hash || "";
const isViewModeHash = hash.startsWith("#view=") || hash.includes("&view=");
const isViewMode = isViewModeQuery || isViewModeHash;

/* طبّق كلاس view-mode */
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.toggle('view-mode', isViewMode);
});

/* ========================
   Base64 URL الآمن
======================== */
function toBase64Url(bytes){
  let b=""; bytes.forEach(x=>b+=String.fromCharCode(x));
  return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function fromBase64Url(s){
  let b=s.replace(/-/g,"+").replace(/_/g,"/");
  const p=b.length%4; if(p) b+="=".repeat(4-p);
  const bin=atob(b); const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}

/* ========================
   ضغط/فك ضغط بيانات المشاركة
======================== */
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
function encodeData(data){
  const json = JSON.stringify(compactData(data));
  const utf8 = new TextEncoder().encode(json);
  return toBase64Url(utf8);
}
function decodeData(encoded){
  const bytes = fromBase64Url(encoded);
  const json = new TextDecoder().decode(bytes);
  return expandData(JSON.parse(json));
}

/* قراءة/كتابة view في الرابط (نستخدم الهاش) */
function getViewParam(){
  if (location.hash){
    const h = location.hash.replace(/^#/, "");
    const hs = new URLSearchParams(h.includes('=') ? h : `view=${h}`);
    if (hs.has('view')) return hs.get('view');
  }
  const sp = new URLSearchParams(location.search);
  if (sp.has('view')) return sp.get('view');
  return null;
}
function setViewParam(encoded){
  const newHash = `view=${encoded}`;
  const newUrl = `${location.origin}${location.pathname}#${newHash}`;
  history.replaceState(null, "", newUrl);
  return newUrl;
}

/* ========================
   HTML الخاص بالكرت
======================== */
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
    </div>
  `;
}

/* ========================
   نقطة أعلى الدائرة (باستخدام geometry)
======================== */
function topEdgeLatLng(centerLatLng, radiusMeters){
  // heading 0 = اتجاه الشمال (أعلى)
  return google.maps.geometry.spherical.computeOffset(centerLatLng, radiusMeters, 0);
}

/* إنشاء/تحديث InfoWindow لدائرة */
function ensureInfoWindow(circle){
  let iw = infoWindows.get(circle.__id);
  const html = infoHtml(circle.__data);
  const anchorLatLng = topEdgeLatLng(circle.getCenter(), circle.getRadius());

  if (!iw){
    iw = new google.maps.InfoWindow({
      content: html,
      position: anchorLatLng
      // disableAutoPan: true  // فعّلها لو ما تبي الخريطة تتحرك مع ظهور الكرت
    });
    infoWindows.set(circle.__id, iw);
  } else {
    iw.setContent(html);
    iw.setPosition(anchorLatLng);
  }
  return iw;
}
function closeAllInfoWindows(except){
  infoWindows.forEach(iw => { if (iw !== except) iw.close(); });
}

/* ========================
   مشاركة الخريطة
======================== */
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

/* ========================
   Hover داخل الدائرة
======================== */
function wireCircleHover(circle){
  const open = () => {
    const iw = ensureInfoWindow(circle);
    closeAllInfoWindows(iw);
    iw.open({ map });
  };
  const move = () => {
    const iw = ensureInfoWindow(circle);
    iw.setPosition(topEdgeLatLng(circle.getCenter(), circle.getRadius()));
  };
  const close = () => {
    const iw = infoWindows.get(circle.__id);
    if (iw) iw.close();
  };

  circle.setOptions({ clickable: true });
  circle.addListener('mouseover', open);
  circle.addListener('mousemove', move);
  circle.addListener('mouseout', close);

  // للجوال (لا يوجد hover)
  circle.addListener('click', open);
}

/* ========================
   إنشاء دائرة + إدخال سريع
======================== */
function createCircleAt(latLng){
  const circle = new google.maps.Circle({
    map,
    center: latLng,
    radius: 100,
    strokeColor: '#7c3aed',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: '#c084fc',
    fillOpacity: 0.35,
    clickable: true
  });

  circle.__id = Math.random().toString(36).slice(2);
  circle.__data = { name: '', security: '', notes: '' };

  wireCircleHover(circle);
  circles.push(circle);

  const name = prompt('اسم الموقع:', '');
  if (name !== null) circle.__data.name = name.trim();
  const sec = prompt('أفراد الأمن (كل اسم في سطر):', '');
  if (sec !== null) circle.__data.security = sec.trim();
  const notes = prompt('ملاحظات:', '');
  if (notes !== null) circle.__data.notes = notes.trim();

  ensureInfoWindow(circle);
}

/* ========================
   تحميل من رابط المشاركة
======================== */
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
        clickable: true
      });
      circle.__id = Math.random().toString(36).slice(2);
      circle.__data = { name: c.name || '', security: c.security || '', notes: c.notes || '' };
      wireCircleHover(circle);
      circles.push(circle);
      ensureInfoWindow(circle);
    });
  }catch(e){
    console.warn('فشل تحميل الخريطة من الرابط:', e);
  }
}

/* ========================
   تهيئة الخريطة
======================== */
function initUI(){
  const addBtn = document.getElementById('addCircleBtn');
  const shareBtn = document.getElementById('shareBtn');

  addBtn?.addEventListener('click', ()=>{
    addMode = true;
    alert('انقر على الخريطة لوضع دائرة جديدة.');
  });
  shareBtn?.addEventListener('click', shareMap);

  map.addListener('click', (e) => {
    if (!addMode) return;
    addMode = false;
    createCircleAt(e.latLng);
  });
}

window.initMap = function initMap(){
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: false,
    fullscreenControl: true,
    streetViewControl: false
  });

  initUI();
  loadFromUrl();
};
