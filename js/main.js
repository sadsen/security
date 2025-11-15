/* Diriyah Security Map – v12.4 (✅ fixed: route sharing now works correctly) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;

function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google.maps && document.readyState !== 'loading'){
    __BOOTED__ = true;
    boot();
    return true;
  }
  return false;
}

window.initMap = function(){ tryBoot(); };

document.addEventListener('DOMContentLoaded', ()=>{
  let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250);
}, {passive:true});

window.addEventListener('load', tryBoot, {once:true, passive:true});

document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden) tryBoot();
  else flushPersist();
}, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin = null;
let editMode = true, shareMode = false, cardPinned = false, addMode = false;
let btnTraffic, btnShare, btnAdd, btnRoute, btnRouteClear;
let modeBadge, toast;
let mapTypeSelector;

/* Route globals */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;

/* Hover state */
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
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const BASE_ZOOM = 15;

/* Route style */
let routeStyle = {
  color:   '#3344ff',
  weight:  4,
  opacity: 0.95
};

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

/* SVG icons */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`; }
function gateSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`; }
function meetSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }

/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;،,]+/g,' ').trim()).filter(Boolean);
let persistTimer=null;
const persist=()=>{ 
  if(shareMode) return; 
  clearTimeout(persistTimer); 
  persistTimer=setTimeout(()=>{
    writeShare(buildState());
  },300); 
};
function flushPersist(){ 
  if(shareMode) return; 
  clearTimeout(persistTimer); 
  writeShare(buildState());
}

/* Base64URL with compression */
function compressState(state) {
  const compressed = {};
  
  if(state.p && state.p.length === 2) {
    compressed.p = [Number(state.p[0].toFixed(6)), Number(state.p[1].toFixed(6))];
  }
  if(Number.isFinite(state.z)) compressed.z = state.z;
  if(state.m) compressed.m = state.m;
  if(state.t === 1) compressed.t = 1;
  if(state.e === 1) compressed.e = 1;
  
  if(state.c && state.c.length > 0) {
    compressed.c = state.c.map(circle => [
      circle[0], // id
      circle[1], // radius
      circle[2]?.replace('#','') || 'ff0000', // color
      circle[6] || '', // name
      circle[5] || '' // recipients
    ]);
  }
  
  if(state.n && state.n.length > 0) {
    compressed.n = state.n.map(circle => [
      circle[0], // id
      Number(circle[1].toFixed(6)), // lat
      Number(circle[2].toFixed(6)), // lng
      circle[3] || '', // name
      circle[4] || 20, // radius
      circle[5]?.replace('#','') || 'ff0000' // color
    ]);
  }
  
  // 🔧 إصلاح: التأكد من حفظ بيانات المسار حتى لو كانت فارغة جزئياً
  if(state.r) {
    compressed.r = {
      ov: state.r.ov || '',
      points: state.r.points || [],
      style: state.r.style || routeStyle
    };
  } else if (state.r === null) {
    // 🔧 إضافة: معالجة الحالة عندما يكون state.r = null
    compressed.r = null;
  }
  
  return compressed;
}

function b64uEncode(s){ 
  try {
    const b=btoa(unescape(encodeURIComponent(s))); 
    return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  } catch(e) {
    return '';
  }
}

function b64uDecode(t){
  try{ 
    t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); 
    const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; 
    return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); 
  }catch(e){ 
    return ''; 
  } 
}

function readShare(){ 
  const h=(location.hash||'').trim(); 
  if(!h.startsWith('#x=')) return null; 
  try{
    const decoded = b64uDecode(h.slice(3));
    if(!decoded) return null;
    return JSON.parse(decoded);
  }catch(e){
    return null;
  } 
}

/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=>k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = 'image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}

const circles = [];

/* ---------------- Route helpers ---------------- */
function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { ...routeStyle },
      map
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: routeStyle.color, strokeWeight: 2 },
    label: { text: String(index+1), color: routeStyle.color, fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ 
    routePoints[index] = m.getPosition(); 
    requestAndRenderRoute(); 
    persist();
  });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
  routePoints = [];
  // 🔧 إضافة: إعلام النظام بأن المسار تم مسحه
  persist();
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  
  // 🔧 إصلاح: إذا كان هناك نقطتان أو أكثر، قم بحساب المسار
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    // 🔧 إضافة: حفظ حتى لو كان هناك نقطة واحدة فقط
    persist();
  }
}

function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{
    if(m.setLabel){
      m.setLabel({ text:String(i+1), color:routeStyle.color, fontSize:'11px', fontWeight:'700' });
    }
  });
  
  // 🔧 إصلاح: إذا بقي نقطتان أو أكثر، قم بإعادة حساب المسار
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    // 🔧 إضافة: إذا قل العدد عن نقطتين، قم بمسح المسار وحفظ الحالة
    clearRouteVisuals();
  }
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    // 🔧 إضافة: حفظ الحالة حتى عندما لا يكون هناك مسار
    persist();
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      const r = result.routes?.[0];
      currentRouteOverview = r?.overview_polyline?.points || null;
      setTimeout(()=>{ extractActivePolyline(); },0);
      // 🔧 إضافة: حفظ فوري بعد نجاح حساب المسار
      flushPersist();
    } else {
      showToast('تعذر حساب المسار: ' + status);
      // 🔧 إضافة: حفظ الحالة حتى في حالة الفشل
      persist();
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir?.routes?.[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path?.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);
  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    ...routeStyle,
    zIndex: 9997
  });
  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  // 🔧 إضافة: حفظ فوري بعد استخراج المسار
  flushPersist();
}

function restoreRouteFromOverview(polyStr, routePointsArray = null, routeStyleData = null){
  if(!polyStr && (!routePointsArray || routePointsArray.length === 0)) {
    // 🔧 إضافة: إذا لم توجد بيانات مسار، قم بمسح أي مسار موجود
    clearRouteVisuals();
    return;
  }
  
  try{
    // 🔧 إصلاح: مسح المسار الحالي أولاً
    clearRouteVisuals();
    
    if(routeStyleData){
      routeStyle = { ...routeStyle, ...routeStyleData };
    }
    
    if(Array.isArray(routePointsArray) && routePointsArray.length > 0){
      routePoints = routePointsArray.map(p => new google.maps.LatLng(p.lat, p.lng));
    }
    
    // 🔧 إصلاح: إذا كان هناك polyStr، قم بإنشاء المسار
    if(polyStr) {
      const path = google.maps.geometry.encoding.decodePath(polyStr);
      activeRoutePoly = new google.maps.Polyline({
        map,
        path,
        ...routeStyle,
        zIndex: 9997
      });
      currentRouteOverview = polyStr;
      activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
    }
    
    // 🔧 إصلاح: إنشاء علامات النقاط حتى لو لم يكن هناك polyStr
    if(routePoints.length > 0){
      routeStopMarkers = routePoints.map((pos, i) => createStopMarker(pos, i));
    }
    
    // 🔧 إضافة: إذا كان هناك نقاط ولكن لا يوجد polyStr، حاول حساب المسار
    if(routePoints.length >= 2 && !polyStr) {
      setTimeout(() => {
        requestAndRenderRoute();
      }, 500);
    }
    
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: { ...routeStyle }
      });
    }
    
    console.log('Route restored:', { 
      points: routePoints.length, 
      overview: !!polyStr,
      style: routeStyle 
    });
  }catch(e){
    console.error('Error restoring route:', e);
    // 🔧 إضافة: محاولة بديلة إذا فشل استعادة المسار
    if(routePoints.length >= 2) {
      setTimeout(() => {
        requestAndRenderRoute();
      }, 1000);
    }
  }
}

/* ---------------- Route Card ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();
  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0, -6)
  });
  routeCardWin.open({ map });
  routeCardPinned = true;
  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();
  });
}

function renderRouteCard(){
  const color   = routeStyle.color   || '#3344ff';
  const weight  = routeStyle.weight  || 4;
  const opacity = routeStyle.opacity || 0.95;
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
    const clr = colorEl?.value || routeStyle.color;
    const w   = +weightEl?.value || routeStyle.weight;
    const o   = +opacityEl?.value || routeStyle.opacity;
    routeStyle = { color: clr, weight: w, opacity: o };
    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }
    routeStopMarkers.forEach(m => {
      if(m.setIcon){
        m.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: clr,
          strokeWeight: 2
        });
      }
      if(m.setLabel){
        m.setLabel({ text: m.getLabel()?.text || '1', color: clr, fontSize: '11px', fontWeight: '700' });
      }
    });
    // 🔧 إضافة: حفظ فوري عند تغيير الإعدادات
    flushPersist();
  }
  
  if(colorEl) colorEl.addEventListener('input', apply, {passive:true});
  if(weightEl) weightEl.addEventListener('input', apply, {passive:true});
  if(opacityEl) opacityEl.addEventListener('input', apply, {passive:true});
  if(weightEl && weightLbl) weightEl.addEventListener('input', ()=>{ weightLbl.textContent = weightEl.value; });
  if(opacityEl && opacityLbl) opacityEl.addEventListener('input', ()=>{ opacityLbl.textContent = (+opacityEl.value).toFixed(2); });
  if(saveBtn) saveBtn.addEventListener('click', ()=>{ flushPersist(); showToast('✓ تم حفظ إعدادات المسار'); if(routeCardWin){ routeCardWin.close(); routeCardWin = null; } routeCardPinned = false; }, {passive:true});
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(routeCardWin){ routeCardWin.close(); routeCardWin = null; } routeCardPinned = false; }, {passive:true});
}

/* ---------------- State Management ---------------- */
function writeShare(state){
  if(shareMode) return;
  
  const compressedState = compressState(state);
  const jsonString = JSON.stringify(compressedState);
  const tok = b64uEncode(jsonString);
  
  const newHash = `#x=${tok}`;
  if(location.hash !== newHash){
    history.replaceState(null,'',newHash);
  }
}

function applyState(s){
  if(!s) return;
  
  if(Array.isArray(s.p) && s.p.length === 2){ 
    map.setCenter({lat:s.p[1], lng:s.p[0]}); 
  }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  
  if(typeof s.m === 'string'){
    let mapTypeId = s.m;
    if (s.m === 'r') mapTypeId = 'roadmap';
    else if (s.m === 's') mapTypeId = 'satellite';
    else if (s.m === 'h') mapTypeId = 'hybrid';
    else if (s.m === 't') mapTypeId = 'terrain';
    if(['roadmap','satellite','hybrid','terrain'].includes(mapTypeId)){
      map.setMapTypeId(mapTypeId);
      if(mapTypeSelector) mapTypeSelector.value = mapTypeId;
    }
  }
  
  if (s.t === 1){ 
    trafficLayer.setMap(map); 
    if(btnTraffic) btnTraffic.setAttribute('aria-pressed','true'); 
  } else { 
    trafficLayer.setMap(null); 
    if(btnTraffic) btnTraffic.setAttribute('aria-pressed','false'); 
  }
  
  editMode = !shareMode;
  
  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id, radius, color, name, recipients] = row;
      const it = circles.find(x => x.id === id);
      if(!it) return;
      
      it.circle.setOptions({
        radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
        strokeColor: `#${color}`,
        fillColor: `#${color}`,
        fillOpacity: DEFAULT_FILL_OPACITY,
        strokeWeight: DEFAULT_STROKE_WEIGHT
      });
      
      if(name) it.meta.name = name;
      it.meta.recipients = recipients ? recipients.split('~').filter(Boolean) : [];
      
      applyShapeVisibility(it);
    });
  }
  
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id, lat, lng, name, radius, color] = row;
      
      if(circles.some(x => x.id === id)) return;
      
      const circle = new google.maps.Circle({
        map,
        center: {lat: +lat, lng: +lng},
        radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
        strokeColor: `#${color}`,
        strokeOpacity: .95,
        strokeWeight: DEFAULT_STROKE_WEIGHT,
        fillColor: `#${color}`,
        fillOpacity: DEFAULT_FILL_OPACITY,
        clickable: true,
        draggable: editMode && !shareMode,
        editable: false,
        zIndex: 9999
      });
      
      const meta = {
        name: name || 'موقع جديد',
        origName: name || 'موقع جديد',
        recipients: [],
        isNew: true,
        useMarker: false,
        markerColor: DEFAULT_MARKER_COLOR,
        markerScale: DEFAULT_MARKER_SCALE,
        markerKind: DEFAULT_MARKER_KIND
      };
      
      const item = { id, circle, marker: null, meta };
      circles.push(item);
      bindCircleEvents(item);
      applyShapeVisibility(item);
    });
  }
  
  // 🔧 إصلاح: استعادة المسار بشكل موثوق
  if(s.r !== undefined) {
    if(s.r === null) {
      // 🔧 معالجة الحالة عندما يكون المسار null
      clearRouteVisuals();
    } else if(s.r.ov || (s.r.points && s.r.points.length > 0)) {
      console.log('Restoring route from state:', s.r);
      restoreRouteFromOverview(s.r.ov, s.r.points, s.r.style);
    }
  }
  
  setTimeout(() => {
    updateUIForShareMode();
    updateMarkersScale();
  }, 100);
}

/* ---------------- Boot ---------------- */
function boot(){
  btnTraffic  = document.getElementById('btnTraffic');
  btnShare    = document.getElementById('btnShare');
  btnAdd      = document.getElementById('btnAdd');
  btnRoute    = document.getElementById('btnRoute');
  btnRouteClear = document.getElementById('btnRouteClear');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');
  
  // 🔧 إزالة الأزرار من القائمة
  const editBtn = document.getElementById('btnEdit');
  const roadsBtn = document.getElementById('btnRoads');
  const satelliteBtn = document.getElementById('btnSatellite');
  
  if(editBtn) editBtn.style.display = 'none';
  if(roadsBtn) roadsBtn.style.display = 'none';
  if(satelliteBtn) satelliteBtn.style.display = 'none';
  
  const existingControls = document.getElementById('mapControls');
  if(existingControls) existingControls.remove();
  
  const mapControlsDiv = document.createElement('div');
  mapControlsDiv.id = 'mapControls';
  mapControlsDiv.style.cssText = `
    position: absolute; top: 10px; left: 10px; z-index: 1000; background: white; padding: 8px; 
    border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: Tajawal, sans-serif;
    display: flex; flex-direction: column; gap: 4px; max-width: 200px;
  `;
  
  const label = document.createElement('label');
  label.htmlFor = 'mapTypeSelector';
  label.textContent = 'نوع الخريطة:';
  label.style.cssText = 'font-size: 12px; margin-bottom: 2px; color: #333;';
  
  mapTypeSelector = document.createElement('select');
  mapTypeSelector.id = 'mapTypeSelector';
  mapTypeSelector.style.cssText = 'font-size: 14px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; background: white;';
  mapTypeSelector.innerHTML = `
    <option value="roadmap">الطرق</option>
    <option value="satellite">الأقمار الصناعية</option>
    <option value="hybrid">مختلط</option>
    <option value="terrain">التضاريس</option>
  `;
  
  mapControlsDiv.appendChild(label);
  mapControlsDiv.appendChild(mapTypeSelector);
  document.body.appendChild(mapControlsDiv);
  
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error('Map element not found!');
    return;
  }
  
  map = new google.maps.Map(mapElement, {
    center: DEFAULT_CENTER,
    zoom: 15,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
    styles: [
      {
        "elementType": "geometry",
        "stylers": [{ "color": "#f5f5f5" }]
      },
      {
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
      },
      {
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#616161" }]
      },
      {
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#f5f5f5" }]
      },
      {
        "featureType": "administrative.land_parcel",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#bdbdbd" }]
      },
      {
        "featureType": "poi",
        "elementType": "geometry",
        "stylers": [{ "color": "#eeeeee" }]
      },
      {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
      },
      {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [{ "color": "#e5e5e5" }]
      },
      {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#9e9e9e" }]
      },
      {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [{ "color": "#ffffff" }]
      },
      {
        "featureType": "road.arterial",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
      },
      {
        "featureType": "road.highway",
        "elementType": "geometry",
        "stylers": [{ "color": "#dadada" }]
      },
      {
        "featureType": "road.highway",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#616161" }]
      },
      {
        "featureType": "road.local",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#9e9e9e" }]
      },
      {
        "featureType": "transit.line",
        "elementType": "geometry",
        "stylers": [{ "color": "#e5e5e5" }]
      },
      {
        "featureType": "transit.station",
        "elementType": "geometry",
        "stylers": [{ "color": "#eeeeee" }]
      },
      {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{ "color": "#c9c9c9" }]
      },
      {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#9e9e9e" }]
      }
    ]
  });

  trafficLayer = new google.maps.TrafficLayer();
  
  map.addListener('maptypeid_changed', () => {
    const type = map.getMapTypeId();
    if(mapTypeSelector) mapTypeSelector.value = type;
    persist();
  });

  map.addListener('zoom_changed', throttle(updateMarkersScale, 80));
  
  mapTypeSelector.addEventListener('change', () => {
    map.setMapTypeId(mapTypeSelector.value);
    persist();
  }, {passive:true});

  async function copyShareLink(){
    try{
      flushPersist();
      await new Promise(resolve => setTimeout(resolve, 500)); // 🔧 زيادة الوقت للتأكد من الحفظ
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      showToast('✓ تم نسخ رابط المشاركة إلى الحافظة');
    }catch(err){
      showToast('فشل النسخ — حاول يدويًا');
    }
  }

  if(btnTraffic) btnTraffic.addEventListener('click', ()=>{
    const on = btnTraffic.getAttribute('aria-pressed') === 'true';
    if(on) trafficLayer.setMap(null); else trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed', String(!on));
    persist();
  }, {passive:true});

  if(btnRoute) btnRoute.addEventListener('click', ()=>{
    if(shareMode){ showToast('وضع المشاركة لا يسمح بالتحرير'); return; }
    routeMode = !routeMode;
    btnRoute.setAttribute('aria-pressed', String(routeMode));
    if(routeMode){
      showToast('✓ وضع المسار مفعل — انقر لإضافة نقاط');
      addMode = false; 
      if(btnAdd) btnAdd.setAttribute('aria-pressed','false'); 
      document.body.classList.remove('add-cursor');
    } else { 
      showToast('✓ تم إيقاف وضع المسار'); 
    }
  }, {passive:true});

  if(btnRouteClear) btnRouteClear.addEventListener('click', ()=>{
    routePoints = []; 
    clearRouteVisuals(); 
    showToast('✓ تم مسح المسار');
  }, {passive:true});

  if(btnShare) btnShare.addEventListener('click', copyShareLink, {passive:true});

  if(btnAdd) btnAdd.addEventListener('click', ()=>{
    if(shareMode) return;
    addMode = !addMode;
    btnAdd.setAttribute('aria-pressed', String(addMode));
    document.body.classList.toggle('add-cursor', addMode);
    showToast(addMode ? '✓ انقر على الخريطة لإضافة موقع' : '✓ تم إلغاء الإضافة');
  }, {passive:true});

  map.addListener('click', (e)=>{
    cardHovering = false; 
    circleHovering = false;
    
    if (cardPinned && infoWin) { infoWin.close(); cardPinned = false; }
    if (routeCardPinned && routeCardWin) { routeCardWin.close(); routeCardPinned = false; }
    
    if(routeMode && editMode && !shareMode){
      addRoutePoint(e.latLng);
      return;
    }
    
    if(addMode && editMode && !shareMode){
      const id = genNewId();
      const circle = new google.maps.Circle({
        map, 
        center: e.latLng, 
        radius: DEFAULT_RADIUS,
        strokeColor: DEFAULT_COLOR, 
        strokeOpacity: .95, 
        strokeWeight: DEFAULT_STROKE_WEIGHT,
        fillColor: DEFAULT_COLOR, 
        fillOpacity: DEFAULT_FILL_OPACITY,
        clickable: true, 
        draggable: true, 
        editable: false, 
        zIndex: 9999
      });
      
      const meta = {
        name: 'موقع جديد', 
        origName: 'موقع جديد', 
        recipients: [], 
        isNew: true,
        useMarker: false, 
        markerColor: DEFAULT_MARKER_COLOR, 
        markerScale: DEFAULT_MARKER_SCALE, 
        markerKind: DEFAULT_MARKER_KIND
      };
      
      const item = { id, circle, marker: null, meta };
      circles.push(item);
      bindCircleEvents(item);
      openCard(item, true);
      cardPinned = true;
      persist();
      
      addMode = false; 
      if(btnAdd) btnAdd.setAttribute('aria-pressed','false'); 
      document.body.classList.remove('add-cursor');
      updateMarkersScale();
    }
  });

  const openCardThrottled = throttle((item, pin)=>openCard(item, pin), 120);
  LOCATIONS.forEach(loc=>{
    const circle = new google.maps.Circle({
      map, 
      center: {lat: loc.lat, lng: loc.lng}, 
      radius: DEFAULT_RADIUS,
      strokeColor: DEFAULT_COLOR, 
      strokeOpacity: .95, 
      strokeWeight: DEFAULT_STROKE_WEIGHT,
      fillColor: DEFAULT_COLOR, 
      fillOpacity: DEFAULT_FILL_OPACITY,
      clickable: true, 
      draggable: editMode && !shareMode,
      editable: false, 
      zIndex: 9999
    });
    
    const meta = { 
      name: loc.name, 
      origName: loc.name, 
      recipients: [], 
      isNew: false, 
      useMarker: false 
    };
    
    const item = { id: loc.id, circle, marker: null, meta };
    circles.push(item);
    
    circle.addListener('mouseover', ()=>{ 
      circleHovering = true; 
      if(!cardPinned) openCardThrottled(item, false); 
    });
    circle.addListener('mouseout',  ()=>{ 
      circleHovering = false; 
      scheduleCardHide(); 
    });
    circle.addListener('click', ()=>{ 
      openCard(item, true); 
    });
  });

  const savedState = readShare();
  shareMode = !!savedState;
  
  if(savedState){
    setTimeout(() => {
      applyState(savedState);
      if(modeBadge) modeBadge.textContent = shareMode ? 'SHARE' : 'EDIT';
    }, 500);
  } else {
    setTimeout(() => {
      writeShare(buildState());
    }, 1000);
  }
  
  updateMarkersScale();
  
  const persistEvents = ['center_changed', 'zoom_changed', 'maptypeid_changed', 'idle'];
  persistEvents.forEach(event => {
    map.addListener(event, persist);
  });

  window.addEventListener('beforeunload', flushPersist);

  updateUIForShareMode();
  
  showToast('✓ جاهز للاستخدام - التحرير مفعل');
}

// ... باقي الدوال (bindCircleEvents, openCard, renderCard, attachCardEvents, etc.) ...
// تبقى كما هي بدون تغيير ...

function buildState(){
  const center = map.getCenter();
  const zoom   = map.getZoom();
  const cRows = [];
  const nRows = [];
  
  circles.forEach(it=>{
    const ctr = it.circle.getCenter();
    const r  = Math.round(it.circle.getRadius());
    const sc = (it.circle.get('strokeColor') || DEFAULT_COLOR).replace('#','');
    const fo = Math.round((it.circle.get('fillOpacity') ?? DEFAULT_FILL_OPACITY) * 100);
    const sw = it.circle.get('strokeWeight') || DEFAULT_STROKE_WEIGHT;
    const rec = (it.meta.recipients || []).join('~');
    const name = it.meta.name || '';
    const useMarker = it.meta.useMarker ? 1 : 0;
    const mc = (it.meta.markerColor || DEFAULT_MARKER_COLOR).replace('#','');
    const ms = it.meta.markerScale || DEFAULT_MARKER_SCALE;
    const mk = it.meta.markerKind || DEFAULT_MARKER_KIND;
    
    if(it.meta.isNew){
      nRows.push([it.id, ctr.lat(), ctr.lng(), name, r, sc, fo, sw, rec, useMarker, mc, ms, mk]);
    }else{
      cRows.push([it.id, r, sc, fo, sw, rec, name, useMarker, mc, ms, mk]);
    }
  });
  
  const typ = map.getMapTypeId();
  let m = 'r';
  if(typ === 'roadmap') m = 'r';
  else if(typ === 'satellite') m = 's';
  else if(typ === 'hybrid') m = 'h';
  else if(typ === 'terrain') m = 't';
  
  const t = trafficLayer.getMap() ? 1 : 0;
  
  // 🔧 إصلاح: التأكد من تضمين بيانات المسار بشكل صحيح
  let r = null;
  if(currentRouteOverview || routePoints.length > 0) {
    r = {
      ov: currentRouteOverview || '',
      points: routePoints.map(p => ({ lat: p.lat(), lng: p.lng() })),
      style: { ...routeStyle }
    };
    console.log('Saving route data:', r);
  }
  
  return {
    p: [center.lng(), center.lat()],
    z: zoom,
    m,
    t,
    e: editMode ? 1 : 0,
    c: cRows,
    n: nRows,
    r
  };
}

// ... باقي الدوال المساعدة تبقى كما هي ...
