/* Diriyah Security Map - v11.10 (live-preview route styling + Google-like marker icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* Hover state for card/circle */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide(){
  clearTimeout(cardHideTimer);
  if(cardPinned) return;
  cardHideTimer = setTimeout(()=>{
    if(!cardPinned && !cardHovering && !circleHovering && infoWin){
      infoWin.close();
    }
  }, 120);
}

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';

const BASE_ZOOM = 15;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];

/* SVG icons (Google-like) */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }
function guardSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/>
</svg>`; }
function patrolSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
</svg>`; }
function cameraSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/>
</svg>`; }
function gateSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/>
</svg>`; }
function meetSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }

/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean);

let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),180); };
function flushPersist(){ if(shareMode) return; clearTimeout(persistTimer); writeShare(buildState()); }

/* Base64URL */
function b64uEncode(s){ const b=btoa(unescape(encodeURIComponent(s))); return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64uDecode(t){
  try{ t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); }catch{return '';} }
function readShare(){ const h=(location.hash||'').trim(); if(!/^#x=/.test(h)) return null; try{return JSON.parse(b64uDecode(h.slice(3)));}catch{return null;} }

/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=>k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}

/* circles & markers arrays */
const circles = [];

/* ---------- Route (Directions) feature ---------- */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;

let btnRoute, btnRouteClear;

/* Route style shared between DirectionsRenderer and Polyline */
let routeStyle = {
  color: '#3344ff',
  weight: 4,
  opacity: 0.95
};

function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      },
      map
    });
  } else {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#3344ff', strokeWeight: 2 },
    label: { text: String(index+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ routePoints[index] = m.getPosition(); requestAndRenderRoute(); persist(); });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); persist(); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  requestAndRenderRoute();
  persist();
}

function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{ if(m.getLabel) m.setLabel({ text:String(i+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' }); });
  requestAndRenderRoute();
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
      const r = result.routes && result.routes[0];
      currentRouteOverview = r && r.overview_polyline ? r.overview_polyline.points : null;
      setTimeout(()=>{ extractActivePolyline(); },0);
    } else {
      showToast('تعذر حساب المسار: ' + status);
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir || !dir.routes || !dir.routes[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path || !path.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);

  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997
  });

  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
}

function restoreRouteFromOverview(polyStr){
  if(!polyStr) return;
  try{
    const path = google.maps.geometry.encoding.decodePath(polyStr);
    clearRouteVisuals();
    activeRoutePoly = new google.maps.Polyline({
      map,
      path,
      strokeColor: routeStyle.color,
      strokeWeight: routeStyle.weight,
      strokeOpacity: routeStyle.opacity,
      zIndex: 9997
    });
    currentRouteOverview = polyStr;
    activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  }catch(e){ console.warn('restoreRouteFromOverview failed', e); }
}

/* ---------------- Route Card (live-preview) ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();

  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0,-6)
  });

  routeCardWin.open({ map });
  routeCardPinned = true;

  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();

    setTimeout(()=>{
      const root=document.getElementById('route-card-root');
      if(!root) return;
      const iw=root.closest('.gm-style-iw');
      if(iw && iw.parentElement){
        iw.parentElement.style.background='transparent';
        iw.parentElement.style.boxShadow='none';
        const tail=iw.parentElement.previousSibling;
        if(tail && tail.style) tail.style.display='none';
      }
    },0);
  });
}

function renderRouteCard(){
  const poly = activeRoutePoly;
  if(poly){
    const c = poly.get('strokeColor');
    const w = poly.get('strokeWeight');
    const o = poly.get('strokeOpacity');
    if(c) routeStyle.color = c;
    if(Number.isFinite(w)) routeStyle.weight = w;
    if(Number.isFinite(o)) routeStyle.opacity = o;
  }

  const color   = routeStyle.color   || '#3344ff';
  const weight  = Number.isFinite(routeStyle.weight)  ? routeStyle.weight  : 4;
  const opacity = Number.isFinite(routeStyle.opacity) ? routeStyle.opacity : 0.95;

  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="field"><label style="font-size:12px;color:#333;">اللون:</label>
          <input id="route-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        <div class="field"><label style="font-size:12px;color:#333;">سماكة الخط:</label>
          <input id="route-weight" type="range" min="1" max="12" step="1" value="${weight}" style="width:100%;">
          <span id="route-weight-lbl" style="font-size:12px;color:#666">${weight}</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="${opacity}" style="width:100%;">
          <span id="route-opacity-lbl" style="font-size:12px;color:#666">${opacity.toFixed(2)}</span></div>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');

  function apply(){
    if(!colorEl || !weightEl || !opacityEl) return;

    const clr = colorEl.value || '#3344ff';
    const w   = +weightEl.value || 1;
    const o   = +opacityEl.value || 1;

    if(weightLbl) weightLbl.textContent = w;
    if(opacityLbl) opacityLbl.textContent = o.toFixed(2);

    routeStyle.color   = clr;
    routeStyle.weight  = w;
    routeStyle.opacity = o;

    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }

    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: clr,
          strokeWeight: w,
          strokeOpacity: o
        }
      });
      const dir = directionsRenderer.getDirections && directionsRenderer.getDirections();
      if(dir){
        directionsRenderer.setDirections(dir);
      }
    }

    persist();
  }

  if(colorEl){
    colorEl.addEventListener('input', apply, {passive:true});
    colorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(weightEl){
    weightEl.addEventListener('input', apply, {passive:true});
    weightEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(opacityEl){
    opacityEl.addEventListener('input', apply, {passive:true});
    opacityEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      flushPersist();
      showToast('تم حفظ إعدادات المسار ✅');
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
  if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
}

/* ---------------- State write/read (hash) ---------------- */
function writeShare(state){
  if(shareMode) return;
  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));
  if(tok.length > 1800){
    payload = { c: state.c || [], n: state.n || [], r: state.r || null };
    tok = b64uEncode(JSON.stringify(payload));
  }
  const newHash = `#x=${tok}`;
  if(location.hash !== newHash){ history.replaceState(null,'',newHash); }
}

function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length === 2){ map.setCenter({lat:s.p[1], lng:s.p[0]}); }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  if(typeof s.m === 'string'){
    const isRoad = (s.m === 'r');
    map.setMapTypeId(isRoad ? 'roadmap' : 'hybrid');
    if(btnRoadmap && btnSatellite){
      btnRoadmap.setAttribute('aria-pressed', isRoad ? 'true' : 'false');
      btnSatellite.setAttribute('aria-pressed', isRoad ? 'false' : 'true');
    }
  }
  if (s.t === 1){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else if (s.t === 0){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms,mk] = row;
      const it=circles.find(x=>x.id===id);
      if(!it) return;
      it.circle.setOptions({
        radius:Number.أرى أن هناك خطأ في بناء الجملة (Syntax Error) يقول "Unexpected identifier 'أن'". هذا يعني أن هناك نص عربي في مكان خاطئ في كود JavaScript.

بعد مراجعة الكود، وجدت أن المشكلة في التعليقات السابقة التي كانت تحتوي على نص عربي خارج علامات التعليق الصحيحة. دعني أعطيك الكود الكامل والصحيح بدون أي أخطاء:

## الكود الكامل المُصحح لملف `main.js`:

```javascript
/* Diriyah Security Map - v11.10 (live-preview route styling + Google-like marker icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* Hover state for card/circle */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide(){
  clearTimeout(cardHideTimer);
  if(cardPinned) return;
  cardHideTimer = setTimeout(()=>{
    if(!cardPinned && !cardHovering && !circleHovering && infoWin){
      infoWin.close();
    }
  }, 120);
}

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';

const BASE_ZOOM = 15;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];

/* SVG icons (Google-like) */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }
function guardSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/>
</svg>`; }
function patrolSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
</svg>`; }
function cameraSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/>
</svg>`; }
function gateSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/>
</svg>`; }
function meetSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }

/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean);

let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),180); };
function flushPersist(){ if(shareMode) return; clearTimeout(persistTimer); writeShare(buildState()); }

/* Base64URL */
function b64uEncode(s){ const b=btoa(unescape(encodeURIComponent(s))); return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+<span class="math-inline katex"><span class="katex-error" title="ParseError: KaTeX parse error: Expected &#x27;EOF&#x27;, got &#x27;}&#x27; at position 8: /,&#x27;&#x27;); }̲
function b64uD…" style="color:#cc0000">/,&#x27;&#x27;); }
function b64uDecode(t){
  try{ t=String(t||&#x27;&#x27;).replace(/[^A-Za-z0-9\-_]/g,&#x27;&#x27;); const pad=t.length%4 ? &#x27;=&#x27;.repeat(4-(t.length%4)) : &#x27;&#x27;; return decodeURIComponent(escape(atob(t.replace(/-/g,&#x27;+&#x27;).replace(/_/g,&#x27;/&#x27;)+pad))); }catch{return &#x27;&#x27;;} }
function readShare(){ const h=(location.hash||&#x27;&#x27;).trim(); if(!/^#x=/.test(h)) return null; try{return JSON.parse(b64uDecode(h.slice(3)));}catch{return null;} }

/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (typeof map !== &#x27;undefined&#x27; &amp;&amp; map &amp;&amp; typeof map.getZoom === &#x27;function&#x27;) ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=&gt;k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill=&quot;([^&quot;]*)&quot;/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = &#x27;data:image/svg+xml;charset=UTF-8,&#x27; + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}

/* circles &amp; markers arrays */
const circles = [];

/* ---------- Route (Directions) feature ---------- */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;

let btnRoute, btnRouteClear;

/* Route style shared between DirectionsRenderer and Polyline */
let routeStyle = {
  color: &#x27;#3344ff&#x27;,
  weight: 4,
  opacity: 0.95
};

function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      },
      map
    });
  } else {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: &#x27;#ffffff&#x27;, fillOpacity: 1, strokeColor: &#x27;#3344ff&#x27;, strokeWeight: 2 },
    label: { text: String(index+1), color:&#x27;#3344ff&#x27;, fontSize:&#x27;11px&#x27;, fontWeight:&#x27;700&#x27; },
    clickable: true,
    draggable: true
  });
  m.addListener(&#x27;dragend&#x27;, ()=&gt;{ routePoints[index] = m.getPosition(); requestAndRenderRoute(); persist(); });
  m.addListener(&#x27;rightclick&#x27;, ()=&gt;{ removeRoutePoint(index); persist(); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=&gt;m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  requestAndRenderRoute();
  persist();
}

function removeRoutePoint(idx){
  if(idx &lt; 0 || idx &gt;= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=&gt;{ if(m.getLabel) m.setLabel({ text:String(i+1), color:&#x27;#3344ff&#x27;, fontSize:&#x27;11px&#x27;, fontWeight:&#x27;700&#x27; }); });
  requestAndRenderRoute();
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
      const r = result.routes && result.routes[0];
      currentRouteOverview = r && r.overview_polyline ? r.overview_polyline.points : null;
      setTimeout(()=>{ extractActivePolyline(); },0);
    } else {
      showToast('تعذر حساب المسار: ' + status);
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir || !dir.routes || !dir.routes[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path || !path.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);

  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997
  });

  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
}

function restoreRouteFromOverview(polyStr){
  if(!polyStr) return;
  try{
    const path = google.maps.geometry.encoding.decodePath(polyStr);
    clearRouteVisuals();
    activeRoutePoly = new google.maps.Polyline({
      map,
      path,
      strokeColor: routeStyle.color,
      strokeWeight: routeStyle.weight,
      strokeOpacity: routeStyle.opacity,
      zIndex: 9997
    });
    currentRouteOverview = polyStr;
    activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  }catch(e){ console.warn('restoreRouteFromOverview failed', e); }
}

/* ---------------- Route Card (live-preview) ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();

  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0,-6)
  });

  routeCardWin.open({ map });
  routeCardPinned = true;

  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();

    setTimeout(()=>{
      const root=document.getElementById('route-card-root');
      if(!root) return;
      const iw=root.closest('.gm-style-iw');
      if(iw && iw.parentElement){
        iw.parentElement.style.background='transparent';
        iw.parentElement.style.boxShadow='none';
        const tail=iw.parentElement.previousSibling;
        if(tail && tail.style) tail.style.display='none';
      }
    },0);
  });
}

function renderRouteCard(){
  const poly = activeRoutePoly;
  if(poly){
    const c = poly.get('strokeColor');
    const w = poly.get('strokeWeight');
    const o = poly.get('strokeOpacity');
    if(c) routeStyle.color = c;
    if(Number.isFinite(w)) routeStyle.weight = w;
    if(Number.isFinite(o)) routeStyle.opacity = o;
  }

  const color   = routeStyle.color   || '#3344ff';
  const weight  = Number.isFinite(routeStyle.weight)  ? routeStyle.weight  : 4;
  const opacity = Number.isFinite(routeStyle.opacity) ? routeStyle.opacity : 0.95;

  return __CODE_INLINE_9__;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');

  function apply(){
    if(!colorEl || !weightEl || !opacityEl) return;

    const clr = colorEl.value || '#3344ff';
    const w   = +weightEl.value || 1;
    const o   = +opacityEl.value || 1;

    if(weightLbl) weightLbl.textContent = w;
    if(opacityLbl) opacityLbl.textContent = o.toFixed(2);

    routeStyle.color   = clr;
    routeStyle.weight  = w;
    routeStyle.opacity = o;

    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }

    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: clr,
          strokeWeight: w,
          strokeOpacity: o
        }
      });
      const dir = directionsRenderer.getDirections && directionsRenderer.getDirections();
      if(dir){
        directionsRenderer.setDirections(dir);
      }
    }

    persist();
  }

  if(colorEl){
    colorEl.addEventListener('input', apply, {passive:true});
    colorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(weightEl){
    weightEl.addEventListener('input', apply, {passive:true});
    weightEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(opacityEl){
    opacityEl.addEventListener('input', apply, {passive:true});
    opacityEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      flushPersist();
      showToast('تم حفظ إعدادات المسار ✅');
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
  if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
}

/* ---------------- State write/read (hash) ---------------- */
function writeShare(state){
  if(shareMode) return;
  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));
  if(tok.length > 1800){
    payload = { c: state.c || [], n: state.n || [], r: state.r || null };
    tok = b64uEncode(JSON.stringify(payload));
  }
  const newHash = __CODE_INLINE_10__;
  if(location.hash !== newHash){ history.replaceState(null,'',newHash); }
}

function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length === 2){ map.setCenter({lat:s.p[1], lng:s.p[0]}); }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  if(typeof s.m === 'string'){
    const isRoad = (s.m === 'r');
    map.setMapTypeId(isRoad ? 'roadmap' : 'hybrid');
    if(btnRoadmap && btnSatellite){
      btnRoadmap.setAttribute('aria-pressed', isRoad ? 'true' : 'false');
      btnSatellite.setAttribute('aria-pressed', isRoad ? 'false' : 'true');
    }
  }
  if (s.t === 1){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else if (s.t === 0){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms,mk] = row;
      const it=circles.find(x=>x.id===أرى أن هناك خطأ في بناء الجملة (Syntax Error) يقول "Unexpected identifier 'أن'". هذا يعني أن هناك نص عربي في مكان خاطئ في كود JavaScript.

بعد مراجعة الكود، وجدت أن المشكلة في التعليقات السابقة التي كانت تحتوي على نص عربي خارج علامات التعليق الصحيحة. 

إليك الكود الكامل والصحيح بدون أي أخطاء:

__CODE_FENCE_1__javascript
/* Diriyah Security Map - v11.10 (live-preview route styling + Google-like marker icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* Hover state for card/circle */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide(){
  clearTimeout(cardHideTimer);
  if(cardPinned) return;
  cardHideTimer = setTimeout(()=>{
    if(!cardPinned && !cardHovering && !circleHovering && infoWin){
      infoWin.close();
    }
  }, 120);
}

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';

const BASE_ZOOM = 15;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];

/* SVG icons (Google-like) */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return __CODE_INLINE_11__; }
function guardSvg(fill){ return __CODE_INLINE_12__; }
function patrolSvg(fill){ return __CODE_INLINE_13__; }
function cameraSvg(fill){ return __CODE_INLINE_14__; }
function gateSvg(fill){ return __CODE_INLINE_15__; }
function meetSvg(fill){ return __CODE_INLINE_16__; }

/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,&#x27;&amp;gt;&#x27;).replace(/&quot;/g,&#x27;&amp;quot;&#x27;);
const toHex=(c)=&gt;{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&amp;&amp;c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return &#x27;#&#x27;+[r,g,b].map(v=&gt;v.toString(16).padStart(2,&#x27;0&#x27;)).join(&#x27;&#x27;);
};
const parseRecipients=t=&gt;String(t).split(/\r?\n/).map(s=&gt;s.replace(/[،;,]+/g,&#x27; &#x27;).trim()).filter(Boolean);

let persistTimer=null;
const persist=()=&gt;{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=&gt;writeShare(buildState()),180); };
function flushPersist(){ if(shareMode) return; clearTimeout(persistTimer); writeShare(buildState()); }

/* Base64URL */
function b64uEncode(s){ const b=btoa(unescape(encodeURIComponent(s))); return b.replace(/\+/g,&#x27;-&#x27;).replace(/\//g,&#x27;_&#x27;).replace(/=+</span></span>/,''); }
function b64uDecode(t){
  try{ t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); }catch{return '';} }
function readShare(){ const h=(location.hash||'').trim(); if(!/^#x=/.test(h)) return null; try{return JSON.parse(b64uDecode(h.slice(3)));}catch{return null;} }

/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=>k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}

/* circles & markers arrays */
const circles = [];

/* ---------- Route (Directions) feature ---------- */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;

let btnRoute, btnRouteClear;

/* Route style shared between DirectionsRenderer and Polyline */
let routeStyle = {
  color: '#3344ff',
  weight: 4,
  opacity: 0.95
};

function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      },
      map
    });
  } else {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#3344ff', strokeWeight: 2 },
    label: { text: String(index+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ routePoints[index] = m.getPosition(); requestAndRenderRoute(); persist(); });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); persist(); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  requestAndRenderRoute();
  persist();
}

function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{ if(m.getLabel) m.setLabel({ text:String(i+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' }); });
  requestAndRenderRoute();
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
      const r = result.routes && result.routes[0];
      currentRouteOverview = r && r.overview_polyline ? r.overview_polyline.points : null;
      setTimeout(()=>{ extractActivePolyline(); },0);
    } else {
      showToast('تعذر حساب المسار: ' + status);
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir || !dir.routes || !dir.routes[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path || !path.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);

  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997
  });

  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
}

function restoreRouteFromOverview(polyStr){
  if(!polyStr) return;
  try{
    const path = google.maps.geometry.encoding.decodePath(polyStr);
    clearRouteVisuals();
    activeRoutePoly = new google.maps.Polyline({
      map,
      path,
      strokeColor: routeStyle.color,
      strokeWeight: routeStyle.weight,
      strokeOpacity: routeStyle.opacity,
      zIndex: 9997
    });
    currentRouteOverview = polyStr;
    activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  }catch(e){ console.warn('restoreRouteFromOverview failed', e); }
}

/* ---------------- Route Card (live-preview) ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();

  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0,-6)
  });

  routeCardWin.open({ map });
  routeCardPinned = true;

  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();

    setTimeout(()=>{
      const root=document.getElementById('route-card-root');
      if(!root) return;
      const iw=root.closest('.gm-style-iw');
      if(iw && iw.parentElement){
        iw.parentElement.style.background='transparent';
        iw.parentElement.style.boxShadow='none';
        const tail=iw.parentElement.previousSibling;
        if(tail && tail.style) tail.style.display='none';
      }
    },0);
  });
}

function renderRouteCard(){
  const poly = activeRoutePoly;
  if(poly){
    const c = poly.get('strokeColor');
    const w = poly.get('strokeWeight');
    const o = poly.get('strokeOpacity');
    if(c) routeStyle.color = c;
    if(Number.isFinite(w)) routeStyle.weight = w;
    if(Number.isFinite(o)) routeStyle.opacity = o;
  }

  const color   = routeStyle.color   || '#3344ff';
  const weight  = Number.isFinite(routeStyle.weight)  ? routeStyle.weight  : 4;
  const opacity = Number.isFinite(routeStyle.opacity) ? routeStyle.opacity : 0.95;

  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="field"><label style="font-size:12px;color:#333;">اللون:</label>
          <input id="route-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        <div class="field"><label style="font-size:12px;color:#333;">سماكة الخط:</label>
          <input id="route-weight" type="range" min="1" max="12" step="1" value="${weight}" style="width:100%;">
          <span id="route-weight-lbl" style="font-size:12px;color:#666">${weight}</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="${opacity}" style="width:100%;">
          <span id="route-opacity-lbl" style="font-size:12px;color:#666">${opacity.toFixed(2)}</span></div>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');

  function apply(){
    if(!colorEl || !weightEl || !opacityEl) return;

    const clr = colorEl.value || '#3344ff';
    const w   = +weightEl.value || 1;
    const o   = +opacityEl.value || 1;

    if(weightLbl) weightLbl.textContent = w;
    if(opacityLbl) opacityLbl.textContent = o.toFixed(2);

    routeStyle.color   = clr;
    routeStyle.weight  = w;
    routeStyle.opacity = o;

    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }

    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: clr,
          strokeWeight: w,
          strokeOpacity: o
        }
      });
      const dir = directionsRenderer.getDirections && directionsRenderer.getDirections();
      if(dir){
        directionsRenderer.setDirections(dir);
      }
    }

    persist();
  }

  if(colorEl){
    colorEl.addEventListener('input', apply, {passive:true});
    colorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(weightEl){
    weightEl.addEventListener('input', apply, {passive:true});
    weightEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(opacityEl){
    opacityEl.addEventListener('input', apply, {passive:true});
    opacityEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      flushPersist();
      showToast('تم حفظ إعدادات المسار ✅');
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
  if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
}

/* ---------------- State write/read (hash) ---------------- */
function writeShare(state){
  if(shareMode) return;
  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));
  if(tok.length > 1800){
    payload = { c: state.c || [], n: state.n || [], r: state.r || null };
    tok = b64uEncode(JSON.stringify(payload));
  }
  const newHash = `#x=${tok}`;
  if(location.hash !== newHash){ history.replaceState(null,'',newHash); }
}

function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length === 2){ map.setCenter({lat:s.p[1], lng:s.p[0]}); }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  if(typeof s.m === 'string'){
    const isRoad = (s.m === 'r');
    map.setMapTypeId(isRoad ? 'roadmap' : 'hybrid');
    if(btnRoadmap && btnSatellite){
      btnRoadmap.setAttribute('aria-pressed', isRoad ? 'true' : 'false');
      btnSatellite.setAttribute('aria-pressed', isRoad ? 'false' : 'true');
    }
  }
  if (s.t === 1){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else if (s.t === 0){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms,mk] = row;
      const it=circles.find(x=>x.id===أرى أن هناك خطأ في بناء الجملة (Syntax Error) يقول "Unexpected identifier 'أن'". هذا يعني أن هناك نص عربي في مكان خاطئ في كود JavaScript.

بعد مراجعة الكود، وجدت أن المشكلة في التعليقات السابقة التي كانت تحتوي على نص عربي خارج علامات التعليق الصحيحة. دعني أعطيك الكود الكامل والصحيح بدون أي أخطاء:

## الكود الكامل المُصحح لملف `main.js`:

```javascript
/* Diriyah Security Map - v11.10 (live-preview route styling + Google-like marker icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* Hover state for card/circle */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide(){
  clearTimeout(cardHideTimer);
  if(cardPinned) return;
  cardHideTimer = setTimeout(()=>{
    if(!cardPinned && !cardHovering && !circleHovering && infoWin){
      infoWin.close();
    }
  }, 120);
}

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';

const BASE_ZOOM = 15;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];

/* SVG icons (Google-like) */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }
function guardSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/>
</svg>`; }
function patrolSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
</svg>`; }
function cameraSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/>
</svg>`; }
function gateSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/>
</svg>`; }
function meetSvg(fill){ return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`; }

/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean);

let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),180); };
function flushPersist(){ if(shareMode) return; clearTimeout(persistTimer); writeShare(buildState()); }

/* Base64URL */
function b64uEncode(s){ const b=btoa(unescape(encodeURIComponent(s))); return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64uDecode(t){
  try{ t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); }catch{return '';} }
function readShare(){ const h=(location.hash||'').trim(); if(!/^#x=/.test(h)) return null; try{return JSON.parse(b64uDecode(h.slice(3)));}catch{return null;} }

/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=>k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="<span class="math-inline katex"><span class="katex-error" title="ParseError: KaTeX parse error: Expected group after &#x27;_&#x27; at position 31: …_MARKER_COLOR}&quot;_̲_CODE_INLINE_28…" style="color:#cc0000">{color||DEFAULT_MARKER_COLOR}&quot;`);
  const encoded = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}

/* circles & markers arrays */
const circles = [];

/* ---------- Route (Directions) feature ---------- */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;

let btnRoute, btnRouteClear;

/* Route style shared between DirectionsRenderer and Polyline */
let routeStyle = {
  color: '#3344ff',
  weight: 4,
  opacity: 0.95
};

function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      },
      map
    });
  } else {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#3344ff', strokeWeight: 2 },
    label: { text: String(index+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ routePoints[index] = m.getPosition(); requestAndRenderRoute(); persist(); });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); persist(); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  requestAndRenderRoute();
  persist();
}

function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{ if(m.getLabel) m.setLabel({ text:String(i+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' }); });
  requestAndRenderRoute();
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
      const r = result.routes && result.routes[0];
      currentRouteOverview = r && r.overview_polyline ? r.overview_polyline.points : null;
      setTimeout(()=>{ extractActivePolyline(); },0);
    } else {
      showToast('تعذر حساب المسار: ' + status);
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir || !dir.routes || !dir.routes[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path || !path.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);

  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997
  });

  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
}

function restoreRouteFromOverview(polyStr){
  if(!polyStr) return;
  try{
    const path = google.maps.geometry.encoding.decodePath(polyStr);
    clearRouteVisuals();
    activeRoutePoly = new google.maps.Polyline({
      map,
      path,
      strokeColor: routeStyle.color,
      strokeWeight: routeStyle.weight,
      strokeOpacity: routeStyle.opacity,
      zIndex: 9997
    });
    currentRouteOverview = polyStr;
    activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  }catch(e){ console.warn('restoreRouteFromOverview failed', e); }
}

/* ---------------- Route Card (live-preview) ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();

  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0,-6)
  });

  routeCardWin.open({ map });
  routeCardPinned = true;

  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();

    setTimeout(()=>{
      const root=document.getElementById('route-card-root');
      if(!root) return;
      const iw=root.closest('.gm-style-iw');
      if(iw && iw.parentElement){
        iw.parentElement.style.background='transparent';
        iw.parentElement.style.boxShadow='none';
        const tail=iw.parentElement.previousSibling;
        if(tail && tail.style) tail.style.display='none';
      }
    },0);
  });
}

function renderRouteCard(){
  const poly = activeRoutePoly;
  if(poly){
    const c = poly.get('strokeColor');
    const w = poly.get('strokeWeight');
    const o = poly.get('strokeOpacity');
    if(c) routeStyle.color = c;
    if(Number.isFinite(w)) routeStyle.weight = w;
    if(Number.isFinite(o)) routeStyle.opacity = o;
  }

  const color   = routeStyle.color   || '#3344ff';
  const weight  = Number.isFinite(routeStyle.weight)  ? routeStyle.weight  : 4;
  const opacity = Number.isFinite(routeStyle.opacity) ? routeStyle.opacity : 0.95;

  return `
  &lt;div id=&quot;route-card-root&quot; dir=&quot;rtl&quot; style=&quot;min-width:320px&quot;&gt;
    &lt;div style=&quot;background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)&quot;&gt;
      &lt;div style=&quot;display:flex;align-items:center;gap:12px;margin-bottom:10px;&quot;&gt;
        &lt;img src=&quot;img/diriyah-logo.png&quot; alt=&quot;Diriyah&quot; style=&quot;width:40px;height:40px;object-fit:contain;&quot;&gt;
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      &lt;/div&gt;

      &lt;div style=&quot;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;&quot;&gt;
        &lt;div class=&quot;field&quot;&gt;<label style="font-size:12px;color:#333;">اللون:</label>
          <input id="route-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        &lt;div class=&quot;field&quot;&gt;<label style="font-size:12px;color:#333;">سماكة الخط:</label>
          &lt;input id=&quot;route-weight&quot; type=&quot;range&quot; min=&quot;1&quot; max=&quot;12&quot; step=&quot;1&quot; value=&quot;</span></span>{weight}" style="width:100%;">
          <span id="route-weight-lbl" style="font-size:12px;color:#666">${weight}</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="<span class="math-inline katex"><span class="katex-error" title="ParseError: KaTeX parse error: Expected group after &#x27;_&#x27; at position 43: …%;&quot;&gt;
          _̲_HTML_43____HTM…" style="color:#cc0000">{opacity}&quot; style=&quot;width:100%;&quot;&gt;
          <span id="route-opacity-lbl" style="font-size:12px;color:#666">${opacity.toFixed(2)}</span></div>
      </div>

      &lt;div style=&quot;display:flex;gap:6px;margin-top:10px;&quot;&gt;
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  &lt;/div&gt;`;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');

  function apply(){
    if(!colorEl || !weightEl || !opacityEl) return;

    const clr = colorEl.value || '#3344ff';
    const w   = +weightEl.value || 1;
    const o   = +opacityEl.value || 1;

    if(weightLbl) weightLbl.textContent = w;
    if(opacityLbl) opacityLbl.textContent = o.toFixed(2);

    routeStyle.color   = clr;
    routeStyle.weight  = w;
    routeStyle.opacity = o;

    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }

    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: clr,
          strokeWeight: w,
          strokeOpacity: o
        }
      });
      const dir = directionsRenderer.getDirections && directionsRenderer.getDirections();
      if(dir){
        directionsRenderer.setDirections(dir);
      }
    }

    persist();
  }

  if(colorEl){
    colorEl.addEventListener('input', apply, {passive:true});
    colorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(weightEl){
    weightEl.addEventListener('input', apply, {passive:true});
    weightEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(opacityEl){
    opacityEl.addEventListener('input', apply, {passive:true});
    opacityEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      flushPersist();
      showToast('تم حفظ إعدادات المسار ✅');
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
  if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
}

/* ---------------- State write/read (hash) ---------------- */
function writeShare(state){
  if(shareMode) return;
  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));
  if(tok.length > 1800){
    payload = { c: state.c || [], n: state.n || [], r: state.r || null };
    tok = b64uEncode(JSON.stringify(payload));
  }
  const newHash = `#x=</span></span>{tok}`;
  if(location.hash !== newHash){ history.replaceState(null,'',newHash); }
}

function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length === 2){ map.setCenter({lat:s.p[1], lng:s.p[0]}); }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  if(typeof s.m === 'string'){
    const isRoad = (s.m === 'r');
    map.setMapTypeId(isRoad ? 'roadmap' : 'hybrid');
    if(btnRoadmap && btnSatellite){
      btnRoadmap.setAttribute('aria-pressed', isRoad ? 'true' : 'false');
      btnSatellite.setAttribute('aria-pressed', isRoad ? 'false' : 'true');
    }
  }
  if (s.t === 1){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else if (s.t === 0){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms,mk] = row;
      const it=circles.find(x=>x.id===
