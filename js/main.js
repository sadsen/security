/*
  Security Map – v3 (Share/Edit)
  - زر تفعيل/إلغاء وضع التحرير (Edit Mode)
  - التحرير مُعطّل تلقائيًا عند وجود #s=TOKEN (روابط المشاركة)
  - كرت المعلومات بتصميم سابق + قائمة منسدلة يمين الكرت لتحرير الدائرة
  - الحفظ يحدّث الحالة ويولّد رابط مشاركة مختصر
*/

let map, trafficLayer;
let cardPinned = false;
let editMode = false;           // يتغير بالزر
let shareMode = false;          // true إذا وُجد s= في الرابط
const circles = [];             // [{id, circle, meta}...]
let activeItem = null;          // {id, circle, meta}

// DOM refs (نملؤها داخل initMap)
let btnRoadmap, btnSatellite, btnTraffic, btnRecipients, btnEditMode, modeBadge;
let infoCard, infoTitle, infoSubtitle, infoLatLng, infoRadius, infoNotesRow, infoNotes, pinCard, closeCard;
let gearBtn, editDropdown, editColor, editRadius, editRadiusVal, editNotes, btnSaveCircle, btnDeleteCircle, btnCloseDropdown;
let recipientsModal, recipientsInput, saveRecipients, cancelRecipients, toast;

const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 };
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;

const LOCATIONS = [
  { id: 0, name: "Samhan Gate", lat: 24.742132355539432, lng: 46.56966664740594, notes: "بوابة سَمْحان" },
  { id: 1, name: "Al-Bujairi Roundabout", lat: 24.73754835059363, lng: 46.57401116325427, notes: "دوار البجيري" },
  { id: 2, name: "King Salman Square", lat: 24.73647, lng: 46.57254, notes: "ميدان الملك سلمان" },
  { id: 3, name: "AlMozah Roundabout", lat: 24.743980167228152, lng: 46.56606089138615, notes: "دوار الموزة" },
];

/* ===== مشاركة: ترميز/فك ترميز ===== */
function encodeState(obj){
  try{
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch{ return ""; }
}
function decodeState(token){
  try{
    const b64 = token.replace(/-/g,'+').replace(/_/g,'/');
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }catch{ return null; }
}
function writeShareToken(state){
  try{
    const token = encodeState(state);
    const t = Date.now().toString(36).slice(-6);
    const hash = `#s=${token}&t=${t}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }catch{}
}
function readShareToken(){
  try{
    if (!location.hash) return null;
    const q = new URLSearchParams(location.hash.slice(1));
    const s = q.get('s');
    if (!s) return null;
    return decodeState(s);
  }catch{ return null; }
}

function buildShareState(){
  if (!map) return {};
  const type = map.getMapTypeId() === 'roadmap' ? 'r' : 'h';
  const trafficOn = (btnTraffic.getAttribute('aria-pressed') === 'true') ? 1 : 0;
  const recipients = recipientsInput.value.trim();
  const c = circles.map(({id, circle, meta}) => {
    const r  = Math.round(circle.getRadius());
    const sc = (circle.get('strokeColor') || DEFAULT_COLOR).replace('#','');
    const fo = Number((circle.get('fillOpacity') ?? DEFAULT_FILL_OPACITY).toFixed(2));
    return [id, r, sc, fo, meta?.notes || ""];
  });
  const center = map.getCenter();
  const cy = +center.lat().toFixed(6);
  const cx = +center.lng().toFixed(6);
  const z = map.getZoom();
  return { m: type, tr: trafficOn, rcp: recipients, c, cx, cy, z };
}

function applyShareState(s){
  if (!s) return;
  if (Number.isFinite(s.cy) && Number.isFinite(s.cx)) map.setCenter({ lat: s.cy, lng: s.cx });
  if (Number.isFinite(s.z)) map.setZoom(s.z);
  setMapType(s.m === 'r' ? 'roadmap' : 'hybrid', true);
  if (s.tr){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else     { trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }
  if (typeof s.rcp === 'string'){ recipientsInput.value = s.rcp; try{ localStorage.setItem('recipients', s.rcp); }catch{} }
  if (Array.isArray(s.c)){
    s.c.forEach(([id, r, sc, fo, notes])=>{
      const item = circles.find(x=>x.id===id);
      if (!item) return;
      if (Number.isFinite(r)) item.circle.setRadius(r);
      if (sc) item.circle.setOptions({ strokeColor: `#${sc}`, fillColor: `#${sc}` });
      if (Number.isFinite(fo)) item.circle.setOptions({ fillOpacity: fo });
      if (typeof notes === 'string'){ item.meta.notes = notes; }
    });
  }
}

let _persistTimer=null;
function persistShareThrottled(){
  if (shareMode) return; // لا نكتب فوق روابط المشاركة المفتوحة للعرض
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(()=> writeShareToken(buildShareState()), 200);
}

/* ===== Google Map ===== */
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

  google.maps.event.addListener(circle, "mouseover", () => { if(!cardPinned) showInfo({id:loc.id, meta:loc, circle}); });
  google.maps.event.addListener(circle, "mouseout",  () => { if(!cardPinned) hideInfoCard(); });
  google.maps.event.addListener(circle, "click",     () => {
    showInfo({id:loc.id, meta:loc, circle});
    cardPinned = true;
    pinCard.setAttribute('aria-pressed','true');
  });

  circles.push({ id: loc.id, circle, meta: {...loc} });
}

function setMapType(type, silent=false){
  map.setMapTypeId(type);
  btnRoadmap.setAttribute('aria-pressed', String(type === 'roadmap'));
  btnSatellite.setAttribute('aria-pressed', String(type !== 'roadmap'));
  if (!silent) persistShareThrottled();
}

function showInfo(item){
  activeItem = item;
  const {meta, circle} = item;
  const c = circle.getCenter();
  infoTitle.textContent = meta.name || '—';
  infoSubtitle.textContent = meta.notes || '';
  infoLatLng.textContent = `${c.lat().toFixed(6)}, ${c.lng().toFixed(6)}`;
  infoRadius.textContent = `${Math.round(circle.getRadius())} م`;
  if (meta.notes && meta.notes.trim() !== ""){
    infoNotes.textContent = meta.notes;
    infoNotesRow.classList.remove('hidden');
  } else {
    infoNotesRow.classList.add('hidden');
  }

  // تحديث قيم القائمة المنسدلة (إن كان التحرير مفعّلًا)
  if (editMode){
    editColor.value = (circle.get('strokeColor') || DEFAULT_COLOR);
    editRadius.value = Math.round(circle.getRadius());
    editRadiusVal.textContent = editRadius.value;
    editNotes.value = meta.notes || '';
    gearBtn.style.display = 'inline-flex';
  } else {
    gearBtn.style.display = 'none';
    editDropdown.classList.remove('open');
  }

  infoCard.classList.remove('hidden');
}
function hideInfoCard(){
  if (!cardPinned){
    infoCard.classList.add('hidden');
    editDropdown.classList.remove('open');
  }
}

/* ===== المستلمون ===== */
function getRecipients(){
  try{ return (localStorage.getItem('recipients')||'').split(',').map(s=>s.trim()).filter(Boolean); }
  catch{ return []; }
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
  try{ localStorage.setItem('recipients', list.join(', ')); }catch{}
  showToast('تم الحفظ وتحديث المستلمين');
  closeRecipientsEditor();
  persistShareThrottled();
}

/* ===== إشعار ===== */
let toastTimer;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.add('hidden'), 2000);
}

/* ===== وضع التحرير ===== */
function setEditMode(on){
  editMode = !!on;
  if (shareMode) editMode = false; // حماية: لا تحرير في وضع المشاركة
  // شارة أعلى الصفحة
  modeBadge.textContent = editMode ? 'Edit' : 'Share';
  modeBadge.className = editMode ? 'badge-edit' : 'mode-badge badge-share';
  // إظهار/إخفاء زر الترس
  if (editMode && activeItem){ gearBtn.style.display = 'inline-flex'; }
  else { gearBtn.style.display = 'none'; editDropdown.classList.remove('open'); }
  showToast(editMode ? 'تم تفعيل وضع التحرير' : 'تم إلغاء وضع التحرير');
}

function toggleDropdown(){
  if (!editMode || !activeItem) return;
  editDropdown.classList.toggle('open');
  editDropdown.setAttribute('aria-hidden', String(!editDropdown.classList.contains('open')));
}

/* ===== initMap ===== */
function initMap(){
  // DOM refs
  btnRoadmap = document.getElementById('btnRoadmap');
  btnSatellite = document.getElementById('btnSatellite');
  btnTraffic = document.getElementById('btnTraffic');
  btnRecipients = document.getElementById('btnRecipients');
  btnEditMode = document.getElementById('btnEditMode');
  modeBadge = document.getElementById('modeBadge');

  infoCard = document.getElementById('infoCard');
  infoTitle = document.getElementById('infoTitle');
  infoSubtitle = document.getElementById('infoSubtitle');
  infoLatLng = document.getElementById('infoLatLng');
  infoRadius = document.getElementById('infoRadius');
  infoNotesRow = document.getElementById('infoNotesRow');
  infoNotes = document.getElementById('infoNotes');
  pinCard = document.getElementById('pinCard');
  closeCard = document.getElementById('closeCard');

  gearBtn = document.getElementById('gearBtn');
  editDropdown = document.getElementById('editDropdown');
  editColor = document.getElementById('editColor');
  editRadius = document.getElementById('editRadius');
  editRadiusVal = document.getElementById('editRadiusVal');
  editNotes = document.getElementById('editNotes');
  btnSaveCircle = document.getElementById('btnSaveCircle');
  btnDeleteCircle = document.getElementById('btnDeleteCircle');
  btnCloseDropdown = document.getElementById('btnCloseDropdown');

  recipientsModal = document.getElementById('recipientsModal');
  recipientsInput = document.getElementById('recipientsInput');
  saveRecipients = document.getElementById('saveRecipients');
  cancelRecipients = document.getElementById('cancelRecipients');
  toast = document.getElementById('toast');

  // Map
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });
  trafficLayer = new google.maps.TrafficLayer();

  // Buttons
  btnRoadmap.addEventListener('click', () => setMapType('roadmap'));
  btnSatellite.addEventListener('click', () => setMapType('hybrid'));
  btnTraffic.addEventListener('click', () => { const v = btnTraffic.getAttribute('aria-pressed')==='true'; if(v){trafficLayer.setMap(null);btnTraffic.setAttribute('aria-pressed','false');} else {trafficLayer.setMap(map);btnTraffic.setAttribute('aria-pressed','true');} persistShareThrottled(); });

  btnRecipients.addEventListener('click', openRecipientsEditor);
  saveRecipients.addEventListener('click', onSaveRecipients);
  cancelRecipients.addEventListener('click', closeRecipientsEditor);

  pinCard.addEventListener('click', () => { cardPinned=!cardPinned; pinCard.setAttribute('aria-pressed', String(cardPinned)); showToast(cardPinned ? 'تم تثبيت الكرت' : 'تم إلغاء تثبيت الكرت'); });
  closeCard.addEventListener('click', () => { cardPinned=false; hideInfoCard(); });

  gearBtn.addEventListener('click', toggleDropdown);
  btnCloseDropdown.addEventListener('click', toggleDropdown);

  // محررات القائمة المنسدلة (تطبيق مباشر أثناء السحب/التغيير)
  editRadius.addEventListener('input', () => {
    if (!activeItem) return;
    activeItem.circle.setRadius(+editRadius.value);
    editRadiusVal.textContent = editRadius.value;
    infoRadius.textContent = `${editRadius.value} م`;
  });
  editColor.addEventListener('input', () => {
    if (!activeItem) return;
    activeItem.circle.setOptions({ strokeColor: editColor.value, fillColor: editColor.value });
  });

  btnSaveCircle.addEventListener('click', () => {
    if (!activeItem) return;
    activeItem.meta.notes = editNotes.value.trim();
    infoSubtitle.textContent = activeItem.meta.notes || '';
    if (activeItem.meta.notes){ infoNotes.textContent = activeItem.meta.notes; infoNotesRow.classList.remove('hidden'); }
    else { infoNotesRow.classList.add('hidden'); }
    showToast('تم حفظ تعديلات الدائرة');
    persistShareThrottled();
  });

  btnDeleteCircle.addEventListener('click', () => {
    if (!activeItem) return;
    activeItem.circle.setMap(null);
    const idx = circles.findIndex(x=>x.id===activeItem.id);
    if (idx>=0) circles.splice(idx,1);
    activeItem=null;
    hideInfoCard();
    showToast('تم حذف الدائرة');
    persistShareThrottled();
  });

  // دوائر
  LOCATIONS.forEach(addCircleForLocation);

  // مشاركة: اكتشف هل هذا رابط عرض (يحتوي s=)
  const S = readShareToken();
  shareMode = !!S;
  if (shareMode) {
    // تعطيل التحرير بالكامل
    btnEditMode.style.display = 'none';
    modeBadge.textContent = 'Share';
    modeBadge.className = 'mode-badge badge-share';
    applyShareState(S);
  } else {
    // تحميل مستلمين البداية وكتابة رابط أولي
    recipientsInput.value = getRecipients().join(', ');
    writeShareToken(buildShareState());
    modeBadge.textContent = 'Share';
  }

  // زر وضع التحرير (فقط إذا لم يكن Share link)
  btnEditMode.addEventListener('click', () => setEditMode(!editMode));

  // تحديث الهاش عند حركة/تكبير
  map.addListener('idle', persistShareThrottled);
}

// تأكيد توافر initMap قبل سكربت Google
window.initMap = initMap;
