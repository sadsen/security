/* Security Map – v4.3.1 (Glass UI + Safe Init + Share)
   - خريطة ملء الشاشة + لوحة تحكم زجاجية
   - كرت معلومات زجاجي (InfoWindow) بدون X، شعار أكبر
   - يظهر بالـ hover، يختفي عند الخروج، يثبت بالضغط على الدائرة
   - الضغط على الخريطة يُخفي ويفكّ التثبيت
   - المستلمون (سطر لكل اسم) لكل دائرة + ضمن رابط المشاركة المختصر
*/

/* ===== Safe init guard: يضمن استدعاء initMap حتى لو تأخر سكربت Google ===== */
window.__MAP_READY__ = false;
window.__MAP_INITED__ = false;
window.initMap = function initMapWrapper(){ if (window.__MAP_INITED__) return; window.__MAP_INITED__ = true; try { initMap(); } catch (e) { console.error(e); } };
(function waitForGoogle(){ if (window.google && google.maps){ if (!window.__MAP_INITED__) window.initMap(); window.__MAP_READY__ = true; } else { setTimeout(waitForGoogle, 250); } })();

/* ===== متغيرات عامة ===== */
let map, trafficLayer;
let cardPinned = false;
let editMode = false;
let shareMode = false;
let circles = [];            // [{id, circle, meta}]
let activeItem = null;
let infoWin = null;
let hideTimer = null;

// DOM refs
let btnRoadmap, btnSatellite, btnTraffic, btnRecipients, btnEditMode, modeBadge;
let recipientsModal, recipientsInput, saveRecipients, cancelRecipients, toast;

const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 };
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;
const CIRCLE_Z = 9999;

/* ===== نقاط الدوائر (مع مصفوفة مستلمين) ===== */
const LOCATIONS = [
  { id: 0,  name: "بوابة سمحان",                          lat: 24.742132284177778, lng: 46.569503913805825, notes: "", recipients: [] },
  { id: 1,  name: "منطقة سمحان",                          lat: 24.74091335108621,  lng: 46.571891407130025, notes: "", recipients: [] },
  { id: 2,  name: "دوار البجيري",                         lat: 24.737521801476476, lng: 46.57406918772067,  notes: "", recipients: [] },
  { id: 3,  name: "إشارة البجيري",                        lat: 24.73766260194535,  lng: 46.575429040147306, notes: "", recipients: [] },
  { id: 4,  name: "طريق الملك فيصل",                      lat: 24.736133848943062, lng: 46.57696607050239,  notes: "", recipients: [] },
  { id: 5,  name: "نقطة فرز الشلهوب",                     lat: 24.73523670533632,  lng: 46.57785639752234,  notes: "", recipients: [] },
  { id: 6,  name: "المسار الرياضي المديد",                lat: 24.735301077804944, lng: 46.58178092599035,  notes: "", recipients: [] },
  { id: 7,  name: "ميدان الملك سلمان",                    lat: 24.73611373368281,  lng: 46.58407097038162,  notes: "", recipients: [] },
  { id: 8,  name: "دوار الضوء الخافت",                     lat: 24.739718342668006, lng: 46.58352614787052,  notes: "", recipients: [] },
  { id: 9,  name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347,   notes: "", recipients: [] },
  { id:10,  name: "دوار البلدية",                          lat: 24.739266101368777, lng: 46.58172727078356,  notes: "", recipients: [] },
  { id:11,  name: "مدخل ساحة البلدية الفرعي",             lat: 24.738638518378387, lng: 46.579858026042785, notes: "", recipients: [] },
  { id:12,  name: "مدخل مواقف البجيري (كار بارك)",        lat: 24.73826438056506,  lng: 46.57789576275729,  notes: "", recipients: [] },
  { id:13,  name: "مواقف الامن",                           lat: 24.73808736962705,  lng: 46.57771858346317,  notes: "", recipients: [] },
  { id:14,  name: "دوار الروقية",                          lat: 24.741985907266145, lng: 46.56269186990043,  notes: "", recipients: [] },
  { id:15,  name: "بيت مبارك",                             lat: 24.732609768937607, lng: 46.57827089439368,  notes: "", recipients: [] },
  { id:16,  name: "دوار وادي صفار",                        lat: 24.72491458984474,  lng: 46.57345489743978,  notes: "", recipients: [] },
  { id:17,  name: "دوار راس النعامة",                      lat: 24.710329841152387, lng: 46.572921959358204, notes: "", recipients: [] },
  { id:18,  name: "مزرعة الحبيب",                          lat: 24.709445443672344, lng: 46.593971867951346, notes: "", recipients: [] },
];

/* ===== مشاركة مختصرة (ترميز/فك) ===== */
function encodeState(o){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }catch{ return ""; } }
function decodeState(t){ try{ return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/'))))); }catch{ return null; } }
function writeShareToken(state){ if(shareMode) return; const token=encodeState(state); const t=Date.now().toString(36).slice(-6); const h=`#s=${token}&t=${t}`; if(location.hash!==h) history.replaceState(null,'',h); }
function readShareToken(){ if(!location.hash) return null; const q=new URLSearchParams(location.hash.slice(1)); const s=q.get('s'); return s?decodeState(s):null; }

function buildShareState(){
  const type = map.getMapTypeId()==='roadmap'?'r':'h';
  const tr = (btnTraffic.getAttribute('aria-pressed')==='true')?1:0;
  const rcp = recipientsInput ? recipientsInput.value.trim() : "";
  const c = circles.map(({id,circle,meta})=>{
    const r = Math.round(circle.getRadius());
    const sc = (circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo = Number((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY).toFixed(2));
    const rec = Array.isArray(meta.recipients) ? meta.recipients.join("\n") : "";
    return [id, r, sc, fo, meta?.notes || "", rec];
  });
  const ctr=map.getCenter(); const cy=+ctr.lat().toFixed(6), cx=+ctr.lng().toFixed(6), z=map.getZoom();
  return {m:type,tr,rcp,c,cx,cy,z};
}
function applyShareState(s){
  if(!s) return;
  if(Number.isFinite(s.cy)&&Number.isFinite(s.cx)) map.setCenter({lat:s.cy,lng:s.cx});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  setMapType(s.m==='r'?'roadmap':'hybrid', true);
  if(s.tr){trafficLayer.setMap(map);btnTraffic.setAttribute('aria-pressed','true');}
  else{trafficLayer.setMap(null);btnTraffic.setAttribute('aria-pressed','false');}
  if(typeof s.rcp==='string' && recipientsInput){ recipientsInput.value=s.rcp; try{localStorage.setItem('recipients',s.rcp);}catch{} }
  if(Array.isArray(s.c)){
    s.c.forEach(([id,r,sc,fo,notes,rec])=>{
      const it=circles.find(x=>x.id===id); if(!it) return;
      if(Number.isFinite(r)) it.circle.setRadius(r);
      if(sc) it.circle.setOptions({strokeColor:`#${sc}`, fillColor:`#${sc}`, zIndex:CIRCLE_Z});
      if(Number.isFinite(fo)) it.circle.setOptions({fillOpacity:fo});
      if(typeof notes==='string') it.meta.notes = notes;
      if(typeof rec==='string') it.meta.recipients = parseRecipients(rec);
    });
  }
}

let persistTimer=null;
function persistShareThrottled(){ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShareToken(buildShareState()), 220); }

/* ===== أدوات مساعدة ===== */
function parseRecipients(text){ return String(text).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean); }
function stringifyRecipients(list){ return Array.isArray(list)?list.join("\n"):""; }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ===== InfoWindow زجاجي ===== */
function renderInfoContent(item){
  const { meta } = item;
  const names = Array.isArray(meta.recipients)? meta.recipients : [];

  const namesHtml = names.length
    ? `<ol style="margin:6px 0 0 0;padding-inline-start:20px;">${names.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>`
    : `<div style="color:#777;font-size:12px;margin-top:4px;">لا توجد أسماء مضافة</div>`;

  return `
  <div id="iw-root" dir="rtl" style="min-width:260px;max-width:380px;">
    <div id="glass" style="
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 16px; padding: 10px 12px; color:#111; box-shadow: 0 12px 28px rgba(0,0,0,.18);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="line-height:1.2;">
          <div style="font-weight:800;font-size:16px;">${escapeHtml(meta.name || '—')}</div>
          ${meta.notes ? `<div style="font-size:12px;color:#666;margin-top:2px;">${escapeHtml(meta.notes)}</div>` : ``}
        </div>
        <div style="margin-inline-start:auto;display:flex;gap:6px;">
          ${editMode ? `<button id="iw-gear" title="تحرير" style="border:1px solid #ddd;padding:2px 6px;border-radius:8px;background:#fff;">⚙️</button>` : ``}
        </div>
      </div>

      <div style="border-top:1px dashed #eaeaea; padding-top:6px;">
        <div style="font-weight:700;margin-bottom:4px;">المستلمون:</div>
        ${namesHtml}
      </div>

      ${editMode ? `
      <div id="iw-edit" style="margin-top:10px;border:1px solid #eee;border-radius:10px;padding:8px;background:#fafafa;display:none;">
        <div style="font-size:12px;color:#666;margin-bottom:6px;">اكتب اسمًا في كل سطر (يُحافظ على الترتيب).</div>
        <textarea id="ed-recipients" rows="5" style="width:100%;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;white-space:pre;">${escapeHtml(stringifyRecipients(names))}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="ed-save" class="btn" style="color:#111;border-color:#ddd;background:#fff;">حفظ</button>
          <button id="ed-delete" class="btn secondary" style="color:#111;border-color:#ddd;background:#fff;">حذف جميع الأسماء</button>
        </div>
      </div>` : ``}
    </div>
  </div>`;
}

function attachInfoEvents(item){
  const root = document.getElementById('iw-root');
  if (!root) return;

  // أخفِ زر الإغلاق الافتراضي والذيل وخلفية الفقاعة
  const closeBtn = root.parentElement?.querySelector('.gm-ui-hover-effect');
  if (closeBtn) closeBtn.style.display = 'none';
  const iw = root.closest('.gm-style-iw');
  if (iw && iw.parentElement){
    iw.parentElement.style.background = 'transparent';
    iw.parentElement.style.boxShadow  = 'none';
    const tail = iw.parentElement.previousSibling;
    if (tail && tail.style) tail.style.display = 'none';
  }

  if (!editMode) return;

  const editBox  = document.getElementById('iw-edit');
  const btnGear  = document.getElementById('iw-gear');
  const edRec    = document.getElementById('ed-recipients');
  const edSave   = document.getElementById('ed-save');
  const edDel    = document.getElementById('ed-delete');

  btnGear?.addEventListener('click', ()=>{
    if (!editBox) return;
    const vis = editBox.style.display !== 'none';
    editBox.style.display = vis ? 'none' : 'block';
  });

  edSave?.addEventListener('click', ()=>{
    item.meta.recipients = parseRecipients(edRec.value);
    openInfoWindow(item, true);
    showToast('تم حفظ المستلمين');
    persistShareThrottled();
  });

  edDel?.addEventListener('click', ()=>{
    item.meta.recipients = [];
    openInfoWindow(item, true);
    showToast('تم حذف جميع الأسماء');
    persistShareThrottled();
  });
}

function openInfoWindow(item, reopen=false){
  activeItem = item;

  if (!infoWin){
    infoWin = new google.maps.InfoWindow({
      content: '',
      maxWidth: 400,
      pixelOffset: new google.maps.Size(0, -6),
    });
  }

  const html = renderInfoContent(item);
  infoWin.setContent(html);
  infoWin.setPosition(item.circle.getCenter());
  if (!reopen) infoWin.open({ map });
  setTimeout(() => attachInfoEvents(item), 0);
}

/* ===== رسم الدوائر + تفاعلاتها ===== */
function addCircleForLocation(loc){
  const center = new google.maps.LatLng(loc.lat, loc.lng);
  const circle = new google.maps.Circle({
    strokeColor: DEFAULT_COLOR, strokeOpacity: 0.95, strokeWeight: 2,
    fillColor: DEFAULT_COLOR,   fillOpacity: DEFAULT_FILL_OPACITY,
    map, center, radius: DEFAULT_RADIUS, clickable: true,
    draggable: false, editable: false, zIndex: CIRCLE_Z
  });

  circle.addListener('mouseover', () => {
    clearTimeout(hideTimer);
    if(!cardPinned) openInfoWindow({id:loc.id, meta:loc, circle});
  });
  circle.addListener('mouseout', () => {
    if(cardPinned) return;
    hideTimer = setTimeout(()=>{ if(infoWin) infoWin.close(); }, 120);
  });
  circle.addListener('click', () => {
    openInfoWindow({id:loc.id, meta:loc, circle});
    cardPinned = true;
  });

  circles.push({ id: loc.id, circle, meta: { ...loc } });
}

function setMapType(type, silent=false){
  map.setMapTypeId(type);
  btnRoadmap.setAttribute('aria-pressed', String(type==='roadmap'));
  btnSatellite.setAttribute('aria-pressed', String(type!=='roadmap'));
  if(!silent) persistShareThrottled();
}

/* ===== مستلمون عامّون + Toast ===== */
function getRecipients(){ try{ return (localStorage.getItem('recipients')||'').split(',').map(s=>s.trim()).filter(Boolean); }catch{ return []; } }
function openRecipientsEditor(){ recipientsInput.value = getRecipients().join(', '); recipientsModal.classList.remove('hidden'); recipientsModal.setAttribute('aria-hidden','false'); }
function closeRecipientsEditor(){ recipientsModal.classList.add('hidden'); recipientsModal.setAttribute('aria-hidden','true'); }
function onSaveRecipients(){ const list=recipientsInput.value.split(',').map(s=>s.trim()).filter(Boolean); try{localStorage.setItem('recipients', list.join(', '));}catch{} showToast('تم الحفظ'); closeRecipientsEditor(); persistShareThrottled(); }

let toastTimer;
function showToast(msg){ toast.textContent=msg; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.add('hidden'), 2000); }

/* ===== وضع التحرير ===== */
function setEditMode(on){
  editMode = !!on;
  if(shareMode) editMode = false;
  modeBadge.textContent = editMode ? 'Edit' : 'Share';
  modeBadge.className   = 'badge ' + (editMode ? 'badge-edit' : 'badge-share');

  if(editMode){
    if(!activeItem && circles.length){
      const first = circles[0]; openInfoWindow(first); cardPinned = true;
    }
  }else{
    if (infoWin && !cardPinned) infoWin.close();
  }
  showToast(editMode ? 'تم تفعيل التحرير' : 'تم إلغاء التحرير');
}

/* ===== initMap الحقيقي (يُستدعى من الحارس بالأعلى) ===== */
function initMap(){
  // DOM refs
  btnRoadmap = document.getElementById('btnRoadmap');
  btnSatellite = document.getElementById('btnSatellite');
  btnTraffic = document.getElementById('btnTraffic');
  btnRecipients = document.getElementById('btnRecipients');
  btnEditMode = document.getElementById('btnEditMode');
  modeBadge = document.getElementById('modeBadge');
  recipientsModal = document.getElementById('recipientsModal');
  recipientsInput = document.getElementById('recipientsInput');
  saveRecipients = document.getElementById('saveRecipients');
  cancelRecipients = document.getElementById('cancelRecipients');
  toast = document.getElementById('toast');

  // الخريطة
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM,
    mapTypeId: 'roadmap', disableDefaultUI: true,
    clickableIcons: false, gestureHandling: 'greedy',
  });
  trafficLayer = new google.maps.TrafficLayer();

  // لوحة التحكم
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

  // الضغط على الخريطة: إغلاق الكرت وفك التثبيت
  map.addListener('click', () => { cardPinned=false; if(infoWin) infoWin.close(); });

  // إنشاء الدوائر
  LOCATIONS.forEach(addCircleForLocation);

  // وضع المشاركة؟
  const S = readShareToken();
  shareMode = !!S;
  if(shareMode){
    modeBadge.textContent='Share'; modeBadge.className='badge badge-share';
    applyShareState(S);
  }else{
    if (recipientsInput) recipientsInput.value = getRecipients().join(', ');
    writeShareToken(buildShareState());
  }

  // زر تحرير: لو أنت في Share امسح الهاش أولاً
  btnEditMode.addEventListener('click', ()=>{
    if(shareMode){ history.replaceState(null,'',location.pathname); shareMode=false; }
    setEditMode(!editMode);
  });

  // تحدّث الرابط عند التحريك/التكبير
  map.addListener('idle', persistShareThrottled);
}
