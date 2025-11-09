/* Diriyah Security Map – v8 (short share token + mobile-safe + glass card + Tajawal) */
'use strict';

/* ---------- Safe init guard ---------- */
window.__MAP_INITED__ = false;
window.initMap = function(){ if(window.__MAP_INITED__) return; window.__MAP_INITED__ = true; try{ boot(); }catch(e){ console.error(e); } };
(function wait(){ if(window.google && google.maps){ if(!window.__MAP_INITED__) window.initMap(); } else { setTimeout(wait, 150); } })();

/* ---------- Globals ---------- */
let map, trafficLayer, infoWin=null;
let cardPinned=false, editMode=false, shareMode=false, hideTimer=null;

let btnRoadmap, btnSatellite, btnTraffic, btnEditMode, btnShare, modeBadge, toast, fabShare;

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;        // افتراضي 20م
const DEFAULT_COLOR  = '#ff0000'; // أحمر
const DEFAULT_FILL_OPACITY = 0.40; // شفافية متوسطة
const DEFAULT_STROKE_WEIGHT = 2;
const CIRCLE_Z = 9999;

/* ---------- Locations ---------- */
const LOCATIONS = [
  { id:0,  name:"بوابة سمحان",                          lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان",                          lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري",                         lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري",                        lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل",                      lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب",                     lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد",                lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان",                    lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت",                     lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347   },
  { id:10, name:"دوار البلدية",                          lat:24.739266101368777, lng:46.58172727078356  },
  { id:11, name:"مدخل ساحة البلدية الفرعي",             lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)",        lat:24.73826438056506,  lng:46.57789576275729  },
  { id:13, name:"مواقف الامن",                           lat:24.73808736962705,  lng:46.57771858346317  },
  { id:14, name:"دوار الروقية",                          lat:24.741985907266145, lng:46.56269186990043  },
  { id:15, name:"بيت مبارك",                             lat:24.732609768937607, lng:46.57827089439368  },
  { id:16, name:"دوار وادي صفار",                        lat:24.72491458984474,  lng:46.57345489743978  },
  { id:17, name:"دوار راس النعامة",                      lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب",                          lat:24.709445443672344, lng:46.593971867951346 },
];

const circles = [];

/* ---------- Base64URL (بدون + / =) ---------- */
function b64uEncode(s){
  const b = btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64uDecode(tok){
  try{
    tok = String(tok||'').replace(/[^A-Za-z0-9\-_]/g,'');
    const pad = tok.length % 4 ? '='.repeat(4 - (tok.length % 4)) : '';
    const s = tok.replace(/-/g,'+').replace(/_/g,'/') + pad;
    return decodeURIComponent(escape(atob(s)));
  }catch{ return ''; }
}

/* ---------- قراءة/كتابة توكِن المشاركة (#x=...) ---------- */
function readShare(){
  const h = (location.hash||'').trim();
  if(!/^#x=/.test(h)) return null;
  try{ return JSON.parse(b64uDecode(h.slice(3))); }catch{ return null; }
}
function writeShare(state){
  if(shareMode) return;
  const MAX_TOKEN = 1500; // حد آمن للتطبيقات/واتساب
  let slim = JSON.stringify(state);
  let tok  = b64uEncode(slim);
  if(tok.length > MAX_TOKEN){
    const s2 = { c: state.c, t: state.t|0 }; // إبقاء الدوائر والمرور فقط
    slim = JSON.stringify(s2);
    tok  = b64uEncode(slim);
  }
  if(location.hash !== `#x=${tok}`){
    history.replaceState(null,'',`#x=${tok}`);
  }
}

/* ---------- تجميع/تطبيق الحالة (دلتا فقط وبضغط أعلى) ---------- */
/*
  p:[lng,lat]  (4 منازل)
  z: zoom, m:'r'|'h', t: 0|1
  c: [[id, r, sc, fo, sw, rec]]
      sc: لون بدون # ، fo: شفافية ×100 (صحيح)، rec: أسماء مفصولة ~
*/
function buildState(){
  const ctr=map.getCenter(), z=map.getZoom();
  const m = map.getMapTypeId()==='roadmap'?'r':'h';
  const t = btnTraffic.getAttribute('aria-pressed')==='true'?1:0;

  const c=[];
  circles.forEach(({id, circle, meta})=>{
    const r  = Math.round(circle.getRadius());
    const sc = (circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo = Math.round((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY)*100);
    const sw = (circle.get('strokeWeight')??DEFAULT_STROKE_WEIGHT)|0;
    const rec = (meta.recipients||[]).map(s=>s.trim()).filter(Boolean).join('~');

    const changed =
      (r!==DEFAULT_RADIUS) ||
      (toHex('#'+sc)!==toHex(DEFAULT_COLOR)) ||
      (fo!==Math.round(DEFAULT_FILL_OPACITY*100)) ||
      (sw!==DEFAULT_STROKE_WEIGHT) ||
      rec.length>0;

    if(changed){ c.push([id,r,sc,fo,sw,rec]); }
  });

  return { p:[+ctr.lng().toFixed(4), +ctr.lat().toFixed(4)], z, m, t, c };
}
function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length===2) map.setCenter({lat:s.p[1], lng:s.p[0]});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  map.setMapTypeId(s.m==='r'?'roadmap':'hybrid');

  btnRoadmap.setAttribute('aria-pressed', String(s.m==='r'));
  btnSatellite.setAttribute('aria-pressed', String(s.m!=='r'));

  if(s.t){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else   { trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

  if(Array.isArray(s.c)){
    s.c.forEach(([id,r,sc,fo,sw,rec])=>{
      const it=circles.find(x=>x.id===id); if(!it) return;
      it.circle.setOptions({
        radius: Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor: sc?`#${sc}`:DEFAULT_COLOR,
        fillColor: sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity: Number.isFinite(fo)?(fo/100):DEFAULT_FILL_OPACITY,
        strokeWeight: Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT,
      });
      it.meta.recipients = typeof rec==='string' && rec.length ? rec.split('~').map(s=>s.trim()).filter(Boolean) : [];
    });
  }
}
let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),180); };

/* ---------- Boot ---------- */
function boot(){
  btnRoadmap  = document.getElementById('btnRoadmap');
  btnSatellite= document.getElementById('btnSatellite');
  btnTraffic  = document.getElementById('btnTraffic');
  btnEditMode = document.getElementById('btnEditMode');
  btnShare    = document.getElementById('btnShare');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');
  fabShare    = document.getElementById('fabShare');

  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER, zoom: 15, mapTypeId:'roadmap',
    disableDefaultUI:true, clickableIcons:false, gestureHandling:'greedy'
  });
  trafficLayer = new google.maps.TrafficLayer();

  btnRoadmap.onclick   = ()=>{ map.setMapTypeId('roadmap');  btnRoadmap.setAttribute('aria-pressed','true');  btnSatellite.setAttribute('aria-pressed','false'); persist(); };
  btnSatellite.onclick = ()=>{ map.setMapTypeId('hybrid');   btnSatellite.setAttribute('aria-pressed','true'); btnRoadmap.setAttribute('aria-pressed','false');  persist(); };
  btnTraffic.onclick   = ()=>{ const on=btnTraffic.getAttribute('aria-pressed')==='true'; if(on){trafficLayer.setMap(null);} else {trafficLayer.setMap(map);} btnTraffic.setAttribute('aria-pressed', String(!on)); persist(); };

  btnShare.onclick = copyShareLink;
  fabShare.onclick = copyShareLink;

  /* أنشئ الدوائر أولاً */
  LOCATIONS.forEach(addCircle);

  /* ثم طبّق حالة المشاركة مباشرة لو وُجدت */
  const S = readShare();
  shareMode = !!S;
  if(S){ applyState(S); setViewOnly(); }
  else { writeShare(buildState()); }

  btnEditMode.onclick  = ()=>{ if(shareMode) return; editMode=!editMode; modeBadge.textContent=editMode?'Edit':'Share'; modeBadge.className='badge '+(editMode?'badge-edit':'badge-share'); cardPinned=false; if(infoWin) infoWin.close(); updateFab(); };

  map.addListener('idle', persist);
  map.addListener('click', ()=>{ cardPinned=false; if(infoWin) infoWin.close(); });
  updateFab();
}

/* ---------- View-only ---------- */
function setViewOnly(){
  editMode=false; document.body.setAttribute('data-viewonly','1');
  modeBadge.textContent='Share'; modeBadge.className='badge badge-share';
  if(btnEditMode){ btnEditMode.style.display='none'; btnEditMode.disabled=true; }
  updateFab();
}
function updateFab(){
  if(shareMode || !editMode){ fabShare.classList.add('hidden'); }
  else { fabShare.classList.remove('hidden'); }
}

/* ---------- Circles & Card ---------- */
function addCircle(loc){
  const circle = new google.maps.Circle({
    map, center:{lat:loc.lat,lng:loc.lng}, radius:DEFAULT_RADIUS,
    strokeColor:DEFAULT_COLOR, strokeOpacity:.95, strokeWeight:DEFAULT_STROKE_WEIGHT,
    fillColor:DEFAULT_COLOR, fillOpacity:DEFAULT_FILL_OPACITY,
    clickable:true, draggable:false, editable:false, zIndex:CIRCLE_Z
  });
  const meta = { name:loc.name, recipients:[] };
  const item = { id:loc.id, circle, meta };
  circles.push(item);

  circle.addListener('mouseover', ()=>{ clearTimeout(hideTimer); if(!cardPinned) openCard(item); });
  circle.addListener('mouseout',  ()=>{ if(cardPinned) return; hideTimer=setTimeout(()=>{ if(infoWin) infoWin.close(); },120); });
  circle.addListener('click',     ()=>{ openCard(item); cardPinned=true; });
}

function openCard(item){
  if(!infoWin){
    infoWin = new google.maps.InfoWindow({ content:'', maxWidth: 520, pixelOffset: new google.maps.Size(0,-6) });
  }
  infoWin.setContent(renderCard(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });

  setTimeout(()=>{
    const root = document.getElementById('iw-root');
    if(!root) return;
    const closeBtn = root.parentElement?.querySelector('.gm-ui-hover-effect');
    if(closeBtn) closeBtn.style.display='none';
    const iw = root.closest('.gm-style-iw');
    if(iw && iw.parentElement){
      iw.parentElement.style.background='transparent';
      iw.parentElement.style.boxShadow='none';
      const tail = iw.parentElement.previousSibling;
      if(tail && tail.style) tail.style.display='none';
    }
    attachCardEvents(item);
  },0);
}

function renderCard(item){
  const c = item.circle, meta=item.meta;
  const names = Array.isArray(meta.recipients) ? meta.recipients : [];
  const namesHtml = names.length
    ? `<ol style="margin:6px 0 0 0;padding-inline-start:20px;">${names.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>`
    : `<div class="note">لا توجد أسماء مضافة</div>`;

  const radius = Math.round(c.getRadius());
  const color  = c.get('strokeColor') || DEFAULT_COLOR;
  const stroke = c.get('strokeWeight') || DEFAULT_STROKE_WEIGHT;
  const fillO  = Number(c.get('fillOpacity') ?? DEFAULT_FILL_OPACITY);

  const inlineShareBtn = (!shareMode && editMode)
    ? `<button id="btn-card-share" style="margin-inline-start:auto; border:1px solid #ddd; background:#fff; border-radius:10px; padding:4px 8px; cursor:pointer;">نسخ الرابط</button>`
    : ``;

  return `
  <div id="iw-root" dir="rtl" style="min-width:360px; max-width:520px;">
    <div style="
      background: rgba(255,255,255,0.93);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 18px; padding: 14px; color:#111;
      box-shadow: 0 16px 36px rgba(0,0,0,.22);">

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:50px; height:50px; object-fit:contain;">
        <div style="font-weight:800; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(meta.name)}</div>
        ${inlineShareBtn}
        ${(!shareMode && editMode) ? `<span class="badge-edit" style="margin-inline-start:8px;padding:2px 8px;border-radius:8px;background:#1f5a1f;color:#eaffea;border:1px solid #2d7a2d;">وضع التحرير</span>` : ``}
      </div>

      <div style="border-top:1px dashed #e7e7e7; padding-top:8px;">
        <div style="font-weight:700; margin-bottom:4px;">المستلمون:</div>
        ${namesHtml}
      </div>

      ${(!shareMode && editMode) ? `
      <div style="margin-top:12px; border-top:1px dashed #e7e7e7; padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">أدوات الدائرة:</div>
        <div class="form-grid">
          <div class="field"><label>نصف القطر (م):</label><input id="ctl-radius" type="range" min="5" max="120" step="1" value="${radius}" style="width:100%;"><span id="lbl-radius" class="note">${radius}</span></div>
          <div class="field"><label>اللون:</label><input id="ctl-color" type="color" value="${toHex(color)}"></div>
          <div class="field"><label>حدّ الدائرة:</label><input id="ctl-stroke" type="number" min="1" max="8" step="1" value="${stroke}" style="width:70px;"></div>
          <div class="field"><label>شفافية التعبئة:</label><input id="ctl-fill" type="range" min="0" max="0.8" step="0.02" value="${fillO}" style="width:100%;"><span id="lbl-fill" class="note">${fillO.toFixed(2)}</span></div>
        </div>
        <div style="margin-top:8px;">
          <label class="note">أسماء المستلمين (سطر لكل اسم):</label>
          <textarea id="ctl-names" rows="4" style="width:100%; background:#fff; border:1px solid #ddd; border-radius:10px; padding:8px; white-space:pre;">${escapeHtml(names.join("\n"))}</textarea>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button id="btn-save"  style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حفظ</button>
            <button id="btn-clear" style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الأسماء</button>
          </div>
        </div>
      </div>` : ``}
    </div>
  </div>`;
}

function attachCardEvents(item){
  if(shareMode || !editMode) return;
  const c=item.circle;

  const insideShare = document.getElementById('btn-card-share');
  if(insideShare){ insideShare.addEventListener('click', copyShareLink); }

  const r  = document.getElementById('ctl-radius');
  const lr = document.getElementById('lbl-radius');
  const col= document.getElementById('ctl-color');
  const sw = document.getElementById('ctl-stroke');
  const fo = document.getElementById('ctl-fill');
  const lf = document.getElementById('lbl-fill');
  const names=document.getElementById('ctl-names');
  const save =document.getElementById('btn-save');
  const clr  =document.getElementById('btn-clear');

  r.addEventListener('input', ()=>{ const v=+r.value||DEFAULT_RADIUS; lr.textContent=v; c.setRadius(v); persist(); });
  col.addEventListener('input', ()=>{ const v=col.value||DEFAULT_COLOR; c.setOptions({strokeColor:v, fillColor:v}); persist(); });
  sw.addEventListener('input', ()=>{ const v=clamp(+sw.value,1,8); sw.value=v; c.setOptions({strokeWeight:v}); persist(); });
  fo.addEventListener('input', ()=>{ const v=clamp(+fo.value,0,0.8); lf.textContent=v.toFixed(2); c.setOptions({fillOpacity:v}); persist(); });

  save.addEventListener('click', ()=>{ item.meta.recipients = parseRecipients(names.value); openCard(item); persist(); showToast('تم الحفظ. اضغط “🔗” لنسخ الرابط'); });
  clr.addEventListener('click',  ()=>{ item.meta.recipients = []; openCard(item); persist(); showToast('تم حذف الأسماء'); });
}

/* ---------- Share ---------- */
async function copyShareLink(){
  writeShare(buildState());
  try{ await navigator.clipboard.writeText(location.href); showToast('تم نسخ رابط المشاركة ✅'); }
  catch{
    const tmp=document.createElement('input'); tmp.value=location.href; document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy'); tmp.remove(); showToast('تم نسخ رابط المشاركة ✅');
  }
}

/* ---------- Helpers ---------- */
function clamp(x,min,max){ return Math.min(max, Math.max(min, x)); }
function toHex(col){ if(/^#/.test(col)) return col; const m=col.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i); if(!m) return DEFAULT_COLOR; const [r,g,b]=[+m[1],+m[2],+m[3]]; return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function parseRecipients(text){ return String(text).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function showToast(msg){ if(!toast) return; toast.textContent=msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'),1600); }
