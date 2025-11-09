/*
  Security Map – Share Mode (v2)
  - رابط مشاركة قصير #s=TOKEN&t=.. يحمل كل الإعدادات ويعمل على الجوال
  - TOKEN هو Base64 URL-safe لـ JSON صغير (map type/traffic/recipients/circles/center/zoom)
  - منع سباق التحميل: تعريف window.initMap قبل نداء Google
*/

let map, trafficLayer;
let cardPinned = false;

// عناصر الواجهة
const btnRoadmap = document.getElementById('btnRoadmap');
const btnSatellite = document.getElementById('btnSatellite');
const btnTraffic  = document.getElementById('btnTraffic');
const btnRecipients = document.getElementById('btnRecipients');

const infoCard = document.getElementById('infoCard');
const infoTitle = document.getElementById('infoTitle');
const infoSubtitle = document.getElementById('infoSubtitle');
const infoLatLng = document.getElementById('infoLatLng');
const infoRadius = document.getElementById('infoRadius');
const infoNotesRow = document.getElementById('infoNotesRow');
const infoNotes = document.getElementById('infoNotes');
const pinCard = document.getElementById('pinCard');
const closeCard = document.getElementById('closeCard');

const recipientsModal = document.getElementById('recipientsModal');
const recipientsInput = document.getElementById('recipientsInput');
const saveRecipients = document.getElementById('saveRecipients');
const cancelRecipients = document.getElementById('cancelRecipients');

const toast = document.getElementById('toast');

// إعدادات عامة
const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 }; // Diriyah
const DEFAULT_RADIUS = 15; // meters
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;

// مواقع افتراضية (أكمل قائمتك هنا)
const LOCATIONS = [
  { id: 0, name: "Samhan Gate", lat: 24.742132355539432, lng: 46.56966664740594, notes: "بوابة سَمْحان" },
  { id: 1, name: "Al-Bujairi Roundabout", lat: 24.73754835059363, lng: 46.57401116325427, notes: "دوار البجيري" },
  { id: 2, name: "King Salman Square", lat: 24.73647, lng: 46.57254, notes: "ميدان الملك سلمان" },
  { id: 3, name: "AlMozah Roundabout", lat: 24.743980167228152, lng: 46.56606089138615, notes: "دوار الموزة" },
];

const circles = []; // [{id, circle, meta}...]

// ================= مشاركة: ترميز/فك ترميز حالة مختصرة =================
function encodeState(obj){
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b64;
}
function decodeState(token){
  try{
    const b64 = token.replace(/-/g,'+').replace(/_/g,'/');
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }catch{ return null; }
}
function writeShareToken(state){
  const token = encodeState(state);
  const t = Date.now().toString(36).slice(-6); // كاسر كاش قصير
  const hash = `#s=${token}&t=${t}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
function readShareToken(){
  if (!location.hash) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  const s = q.get('s');
  if (!s) return null;
  return decodeState(s);
}

// يبني الحالة الحالية من الخريطة والواجهة
function buildShareState(){
  // نوع الخريطة
  const type = map.getMapTypeId() === 'roadmap' ? 'r' : 'h';
  // المرور
  const trafficOn = (btnTraffic.getAttribute('aria-pressed') === 'true') ? 1 : 0;
  // المستلمين
  const recipients = recipientsInput.value.trim();
  // الدوائر (id, radius, stroke hex, fillOpacity)
  const c = circles.map(({id, circle}) => {
    const r  = Math.round(circle.getRadius());
    const sc = (circle.strokeColor || DEFAULT_COLOR).replace('#','');
    const fo = Number((circle.fillOpacity ?? DEFAULT_FILL_OPACITY).toFixed(2));
    return [id, r, sc, fo];
  });
  // موضع الخريطة
  const center = map.getCenter();
  const cy = +center.lat().toFixed(6);
  const cx = +center.lng().toFixed(6);
  const z = map.getZoom();

  return { m: type, tr: trafficOn, rcp: recipients, c, cx, cy, z };
}

// يطبّق حالة المشاركة على الخريطة والواجهة
function applyShareState(s){
  if (!s) return;
  // موضع الخريطة إن وُجد
  if (Number.isFinite(s.cx) && Number.isFinite(s.cy)) {
    map.setCenter({ lat: s.cy, lng: s.cx });
  }
  if (Number.isFinite(s.z)) map.setZoom(s.z);

  // نوع الخريطة
  setMapType(s.m === 'r' ? 'roadmap' : 'hybrid', /*silent*/true);

  // المرور
  if (s.tr) {
    trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed','true');
  } else {
    trafficLayer.setMap(null);
    btnTraffic.setAttribute('aria-pressed','false');
  }

  // المستلمين
  if (typeof s.rcp === 'string') {
    recipientsInput.value = s.rcp;
    localStorage.setItem('recipients', s.rcp);
  }

  // الدوائر
  if (Array.isArray(s.c)) {
    s.c.forEach(([id, r, sc, fo]) => {
      const item = circles.find(x => x.id === id);
      if (item) {
        if (Number.isFinite(r)) item.circle.setRadius(r);
        if (sc) item.circle.setOptions({ strokeColor: `#${sc}`, fillColor: `#${sc}` });
        if (Number.isFinite(fo)) item.circle.setOptions({ fillOpacity: fo });
      }
    });
  }
}

// حفظ/كتابة الرابط بعد أي تغيير مهم
function persistShare(){
  writeShareToken(buildShareState());
}

// ================= خريطة Google =================
function addCircleForLocation(loc){
  const center = new google.maps.LatLng(loc.lat, loc.lng);
  const circle = new google.maps.Circle({
    strokeColor: DEFAULT_COLOR,
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    map,
    center,
    radius: DEFAULT_RADIUS,
    clickable: true,
    draggable: false,
    editable: false,
  });

  // تفاعلات كرت المعلومات
  circle.addListener('mouseover', () => { if(!cardPinned){ showInfo(loc, circle); } });
  circle.addListener('mouseout',  () => { if(!cardPinned){ hideInfoCard(); } });
  circle.addListener('click', () => {
    showInfo(loc, circle);
    cardPinned = true; // نثبّت بالكليك
    pinCard.setAttribute('aria-pressed','true');
  });

  circles.push({ id: loc.id, circle, meta: loc });
}

function setMapType(type, silent=false){
  map.setMapTypeId(type);
  btnRoadmap.setAttribute('aria-pressed', String(type === 'roadmap'));
  btnSatellite.setAttribute('aria-pressed', String(type !== 'roadmap'));
  if (!silent) persistShare();
}

function toggleTraffic(){
  const visible = btnTraffic.getAttribute('aria-pressed') === 'true';
  if (visible){
    trafficLayer.setMap(null);
    btnTraffic.setAttribute('aria-pressed','false');
  } else {
    trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed','true');
  }
  persistShare();
}

function showInfo(loc, circle){
  const c = circle.getCenter();
  infoTitle.textContent = loc.name || '—';
  infoSubtitle.textContent = loc.notes || '';
  infoLatLng.textContent = `${c.lat().toFixed(6)}, ${c.lng().toFixed(6)}`;
  infoRadius.textContent = `${Math.round(circle.getRadius())} م`;

  if (loc.notes){
    infoNotes.textContent = loc.notes;
    infoNotesRow.classList.remove('hidden');
  } else {
    infoNotesRow.classList.add('hidden');
  }

  infoCard.classList.remove('hidden');
}
function hideInfoCard(){ infoCard.classList.add('hidden'); }

// ================= المستلمون =================
function getRecipients(){ // للتهيئة الأولى فقط
  const raw = localStorage.getItem('recipients') || '';
  return raw.split(',').map(s=>s.trim()).filter(Boolean);
}
function openRecipientsEditor(){
  recipientsInput.value = getRecipients().join(', ') || recipientsInput.value || '';
  recipientsModal.classList.remove('hidden');
  recipientsModal.setAttribute('aria-hidden','false');
}
function closeRecipientsEditor(){
  recipientsModal.classList.add('hidden');
  recipientsModal.setAttribute('aria-hidden','true');
}
function onSaveRecipients(){
  const list = recipientsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  localStorage.setItem('recipients', list.join(', '));
  persistShare();
  showToast('تم الحفظ وتحديث المستلمين');
  closeRecipientsEditor();
}

// ================= إشعار بسيط =================
let toastTimer;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.add('hidden'), 2200);
}

// ================= initMap (مهم: مرفوعة على window قبل تحميل Google) =================
function initMap(){
  // أنشئ الخريطة
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });
  trafficLayer = new google.maps.TrafficLayer();

  // ربط الأزرار
  btnRoadmap.addEventListener('click', () => setMapType('roadmap'));
  btnSatellite.addEventListener('click', () => setMapType('hybrid'));
  btnTraffic.addEventListener('click', toggleTraffic);

  btnRecipients.addEventListener('click', openRecipientsEditor);
  saveRecipients.addEventListener('click', onSaveRecipients);
  cancelRecipients.addEventListener('click', closeRecipientsEditor);

  pinCard.addEventListener('click', () => {
    cardPinned = !cardPinned;
    pinCard.setAttribute('aria-pressed', String(cardPinned));
    showToast(cardPinned ? 'تم تثبيت الكرت' : 'تم إلغاء تثبيت الكرت');
  });
  closeCard.addEventListener('click', () => { cardPinned = false; hideInfoCard(); });

  // أضف الدوائر
  LOCATIONS.forEach(addCircleForLocation);

  // طبّق حالة المشاركة إن وُجدت
  const S = readShareToken();
  if (S) applyShareState(S);
  else {
    // حمّل المستلمين المحليين كبداية (للاستخدام الأول)
    recipientsInput.value = getRecipients().join(', ');
    persistShare(); // اكتب رابط مشاركة أولي
  }

  // عند تحريك/تكبير الخريطة، حدّث مركز/زووم في الرابط
  map.addListener('idle', () => { persistShare(); });
}

// اجعلها متاحة قبل تحميل سكربت Google
window.initMap = initMap;

// ================= ملاحظات تقنية =================
// - تحذير Google حول Marker/Overlay قد يظهر أحيانًا وهو غير مانع.
// - 404 favicon.ico غير مؤثر. أضف أيقونة إن رغبت.
