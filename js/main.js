/* Security Map – v3.3 (Share/Edit) – إصلاح تفاعل الدوائر عبر zIndex مرتفع */
let map, trafficLayer;
let cardPinned = false;
let editMode = false;     // من الزر
let shareMode = false;    // إذا كان الرابط يحتوي s=
let circles = [];         // [{id, circle, meta}]
let activeItem = null;

let btnRoadmap, btnSatellite, btnTraffic, btnRecipients, btnEditMode, modeBadge;
let infoCard, infoTitle, infoSubtitle, infoLatLng, infoRadius, infoNotesRow, infoNotes, pinCard, closeCard;
let gearBtn, editDropdown, editColor, editRadius, editRadiusVal, editNotes, btnSaveCircle, btnDeleteCircle, btnCloseDropdown;
let recipientsModal, recipientsInput, saveRecipients, cancelRecipients, toast;

const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 };
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;
const CIRCLE_Z = 9999; // <— يضمن استقبال النقر فوق أي طبقة (TrafficLayer إلخ)

// مواقع عربية
const LOCATIONS = [
  { id: 0,  name: "بوابة سمحان",                          lat: 24.742132284177778, lng: 46.569503913805825, notes: "" },
  { id: 1,  name: "منطقة سمحان",                          lat: 24.74091335108621,  lng: 46.571891407130025, notes: "" },
  { id: 2,  name: "دوار البجيري",                         lat: 24.737521801476476, lng: 46.57406918772067,  notes: "" },
  { id: 3,  name: "إشارة البجيري",                        lat: 24.73766260194535,  lng: 46.575429040147306, notes: "" },
  { id: 4,  name: "طريق الملك فيصل",                      lat: 24.736133848943062, lng: 46.57696607050239,  notes: "" },
  { id: 5,  name: "نقطة فرز الشلهوب",                     lat: 24.73523670533632,  lng: 46.57785639752234,  notes: "" },
  { id: 6,  name: "المسار الرياضي المديد",                lat: 24.735301077804944, lng: 46.58178092599035,  notes: "" },
  { id: 7,  name: "ميدان الملك سلمان",                    lat: 24.73611373368281,  lng: 46.58407097038162,  notes: "" },
  { id: 8,  name: "دوار الضوء الخافت",                     lat: 24.739718342668006, lng: 46.58352614787052,  notes: "" },
  { id: 9,  name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347,   notes: "" },
  { id:10,  name: "دوار البلدية",                          lat: 24.739266101368777, lng: 46.58172727078356,  notes: "" },
  { id:11,  name: "مدخل ساحة البلدية الفرعي",             lat: 24.738638518378387, lng: 46.579858026042785, notes: "" },
  { id:12,  name: "مدخل مواقف البجيري (كار بارك)",        lat: 24.73826438056506,  lng: 46.57789576275729,  notes: "" },
  { id:13,  name: "مواقف الامن",                           lat: 24.73808736962705,  lng: 46.57771858346317,  notes: "" },
  { id:14,  name: "دوار الروقية",                          lat: 24.741985907266145, lng: 46.56269186990043,  notes: "" },
  { id:15,  name: "بيت مبارك",                             lat: 24.732609768937607, lng: 46.57827089439368,  notes: "" },
  { id:16,  name: "دوار وادي صفار",                        lat: 24.72491458984474,  lng: 46.57345489743978,  notes: "" },
  { id:17,  name: "دوار راس النعامة",                      lat: 24.710329841152387, lng: 46.572921959358204, notes: "" },
  { id:18,  name: "مزرعة الحبيب",                          lat: 24.709445443672344, lng: 46.593971867951346, notes: "" },
];

/* ===== مشاركة مختصرة ===== */
function encodeState(o){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }catch{ return ""; } }
function decodeState(t){ try{ return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/'))))); }catch{ return null; } }
function writeShareToken(state){ if(shareMode) return; const token=encodeState(state); const t=Date.now().toString(36).slice(-6); const h=`#s=${token}&t=${t}`; if(location.hash!==h) history.replaceState(null,'',h); }
function readShareToken(){ if(!location.hash) return null; const q=new URLSearchParams(location.hash.slice(1)); const s=q.get('s'); return s?decodeState(s):null; }

function buildShareState(){
  const type = map.getMapTypeId()==='roadmap'?'r':'h';
  const tr = (btnTraffic.getAttribute('aria-pressed')==='true')?1:0;
  const rcp = recipientsInput.value.trim();
  const c = circles.map(({id,circle,meta})=>{
    const r=Math.round(circle.getRadius());
    const sc=(circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo=Number((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY).toFixed(2));
    return [id,r,sc,fo,meta?.notes||''];
  });
  const ctr=map.getCenter(); const cy=+ctr.lat().toFixed(6), cx=+ctr.lng().toFixed(6), z=map.getZoom();
  return {m:type,tr,rcp,c,cx,cy,z};
}
function applyShareState(s){
  if(!s) return;
  if(Number.isFinite(s.cy)&&Number.isFinite(s.cx)) map.setCenter({lat:s.cy,lng:s.cx});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  setMapType(s.m==='r'?'roadmap':'hybrid',true);
  if(s.tr){trafficLayer.setMap(map);btnTraffic.setAttribute('aria-pressed','true');}
  else{trafficLayer.setMap(null);btnTraffic.setAttribute('aria-pressed','false');}
  if(typeof s.rcp==='string'){ recipientsInput.value=s.rcp; try{localStorage.setItem('recipients',s.rcp);}catch{} }
  if(Array.isArray(s.c)){ s.c.forEach(([id,r,sc,fo,notes])=>{ const it=circles.find(x=>x.id===id); if(!it) return; if(Number.isFinite(r)) it.circle.setRadius(r); if(sc) it.circle.setOptions({strokeColor:`#${sc}`,fillColor:`#${sc}`, zIndex:CIRCLE_Z}); if(Number.isFinite(fo)) it.circle.setOptions({fillOpacity:fo}); if(typeof notes==='string') it.meta.notes=notes; }); }
}

let persistTimer=null;
function persistShareThrottled(){ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShareToken(buildShareState()),220); }

/* ===== دوائر وتفاعلات (مع zIndex) ===== */
function addCircleForLocation(loc){
  const center = new google.maps.LatLng(loc.lat, loc.lng);
  const circle = new google.maps.Circle({
    strokeColor: DEFAULT_COLOR,
    strokeOpacity: 0.95,
    strokeWeight: 2,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    map,
    center,
    radius: DEFAULT_RADIUS,
    clickable: true,
    draggable: false,
    editable: false,
    zIndex: CIRCLE_Z   // <— هنا الحل
  });

  circle.addListener('mouseover', ()=>{ if(!cardPinned) showInfo({id:loc.id, meta:loc, circle}); });
  circle.addListener('mouseout',  ()=>{ if(!cardPinned) hideInfoCard(); });
  circle.addListener('click',     ()=>{ showInfo({id:loc.id, meta:loc, circle}); cardPinned=true; pinCard.setAttribute('aria-pressed','true'); });

  circles.push({ id: loc.id, circle, meta: {...loc} });
}

function setMapType(type, silent=false){
  map.setMapTypeId(type);
  btnRoadmap.setAttribute('aria-pressed', String(type==='roadmap'));
  btnSatellite.setAttribute('aria-pressed', String(type!=='roadmap'));
  if(!silent) persistShareThrottled();
}

/* ===== كرت المعلومات (إجبار الإظهار) ===== */
function showInfo(item){
  activeItem = item;
  const { meta, circle } = item;
  const c = circle.getCenter();

  infoTitle.textContent = meta.name || '—';
  infoSubtitle.textContent = meta.notes || '';
  infoLatLng.textContent = `${c.lat().toFixed(6)}, ${c.lng().toFixed(6)}`;
  infoRadius.textContent = `${Math.round(circle.getRadius())} م`;

  if(meta.notes && meta.notes.trim()!==''){ infoNotes.textContent = meta.notes; infoNotesRow.classList.remove('hidden'); }
  else{ infoNotesRow.classList.add('hidden'); }

  infoCard.classList.remove('hidden');
  infoCard.style.display='block';
  infoCard.style.zIndex='5000';

  if(editMode){
    gearBtn.style.display='inline-flex';
    editColor.value = (circle.get('strokeColor') || DEFAULT_COLOR);
    editRadius.value = Math.round(circle.getRadius());
    editRadiusVal.textContent = editRadius.value;
    editNotes.value = meta.notes || '';
  }else{
    gearBtn.style.display='none';
    editDropdown.classList.remove('open');
  }
}
function hideInfoCard(){
  if(!cardPinned){
    infoCard.classList.add('hidden');
    infoCard.style.display='none';
    editDropdown.classList.remove('open');
  }
}

/* ===== المستلمون ===== */
function getRecipients(){ try{ return (localStorage.getItem('recipients')||'').split(',').map(s=>s.trim()).filter(Boolean); }catch{ return []; } }
function openRecipientsEditor(){ recipientsInput.value = getRecipients().join(', ') || recipientsInput.value || ''; recipientsModal.classList.remove('hidden'); recipientsModal.setAttribute('aria-hidden','false'); }
function closeRecipientsEditor(){ recipientsModal.classList.add('hidden'); recipientsModal.setAttribute('aria-hidden','true'); }
function onSaveRecipients(){ const list=recipientsInput.value.split(',').map(s=>s.trim()).filter(Boolean); try{localStorage.setItem('recipients',list.join(', '));}catch{} showToast('تم الحفظ وتحديث المستلمين'); closeRecipientsEditor(); persistShareThrottled(); }

/* ===== إشعار ===== */
let toastTimer; function showToast(msg){ toast.textContent=msg; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.add('hidden'), 2000); }

/* ===== وضع التحرير ===== */
function setEditMode(on){
  editMode = !!on;
  if(shareMode) editMode = false;  // حماية
  modeBadge.textContent = editMode ? 'Edit' : 'Share';
  modeBadge.className   = editMode ? 'badge-edit' : 'mode-badge badge-share';

  if(editMode){
    if(!activeItem && circles.length){
      const first = circles[0];
      showInfo(first);
      cardPinned = true;
      pinCard.setAttribute('aria-pressed','true');
    }
    if(activeItem) gearBtn.style.display='inline-flex';
  }else{
    gearBtn.style.display='none';
    editDropdown.classList.remove('open');
    cardPinned=false;
  }
  showToast(editMode ? 'تم تفعيل وضع التحرير' : 'تم إلغاء وضع التحرير');
}
function toggleDropdown(){ if(!editMode || !activeItem) return; editDropdown.classList.toggle('open'); editDropdown.setAttribute('aria-hidden', String(!editDropdown.classList.contains('open'))); }

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

  // Top controls
  btnRoadmap.addEventListener('click', ()=> setMapType('roadmap'));
  btnSatellite.addEventListener('click', ()=> setMapType('hybrid'));
  btnTraffic.addEventListener('click', ()=>{
    const v = btnTraffic.getAttribute('aria-pressed')==='true';
    if(v){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }
    else { trafficLayer.setMap(map);  btnTraffic.setAttribute('aria-pressed','true'); }
    persistShareThrottled();
  });

  btnRecipients.addEventListener('click', openRecipientsEditor);
  saveRecipients.addEventListener('click', onSaveRecipients);
  cancelRecipients.addEventListener('click', closeRecipientsEditor);

  pinCard.addEventListener('click', ()=>{ cardPinned=!cardPinned; pinCard.setAttribute('aria-pressed', String(cardPinned)); showToast(cardPinned?'تم تثبيت الكرت':'تم إلغاء تثبيت الكرت'); });
  closeCard.addEventListener('click', ()=>{ cardPinned=false; hideInfoCard(); });

  gearBtn.addEventListener('click', toggleDropdown);
  btnCloseDropdown.addEventListener('click', toggleDropdown);

  editRadius.addEventListener('input', ()=>{ if(!activeItem) return; activeItem.circle.setRadius(+editRadius.value); editRadiusVal.textContent=editRadius.value; infoRadius.textContent=`${editRadius.value} م`; });
  editColor.addEventListener('input', ()=>{ if(!activeItem) return; activeItem.circle.setOptions({ strokeColor:editColor.value, fillColor:editColor.value, zIndex:CIRCLE_Z }); });

  btnSaveCircle.addEventListener('click', ()=>{
    if(!activeItem) return;
    activeItem.meta.notes = editNotes.value.trim();
    infoSubtitle.textContent = activeItem.meta.notes || '';
    if(activeItem.meta.notes){ infoNotes.textContent=activeItem.meta.notes; infoNotesRow.classList.remove('hidden'); }
    else{ infoNotesRow.classList.add('hidden'); }
    showToast('تم حفظ تعديلات الدائرة');
    persistShareThrottled();
  });

  btnDeleteCircle.addEventListener('click', ()=>{
    if(!activeItem) return;
    activeItem.circle.setMap(null);
    circles = circles.filter(x=>x.id!==activeItem.id);
    activeItem=null; hideInfoCard();
    showToast('تم حذف الدائرة');
    persistShareThrottled();
  });

  // دوائر
  LOCATIONS.forEach(addCircleForLocation);

  // Share mode?
  const S = readShareToken();
  shareMode = !!S;
  if(shareMode){
    modeBadge.textContent='Share'; modeBadge.className='mode-badge badge-share';
    applyShareState(S);
  }else{
    recipientsInput.value = getRecipients().join(', ');
    writeShareToken(buildShareState());
  }

  // زر تحرير: لو أنت في Share، امسح الهاش أولًا
  btnEditMode.addEventListener('click', ()=>{
    if(shareMode){ history.replaceState(null,'',location.pathname); shareMode=false; }
    setEditMode(!editMode);
  });

  map.addListener('idle', persistShareThrottled);
}

window.initMap = initMap;
