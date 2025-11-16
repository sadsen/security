/* Diriyah Security Map – v14.0 (✅ fixed: All buttons, InfoWindow visibility, State application) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;

function tryBoot(){
  // تحقق مزدوج لضمان تحميل Google Maps و DOM
  if(__BOOTED__) return true;
  if(window.google && google.maps && document.readyState !== 'loading' && document.getElementById('map')){
    __BOOTED__ = true;
    boot();
    return true;
  }
  return false;
}

// دالة البدء الرئيسية المطلوبة من API
window.initMap = function(){ tryBoot(); };

// محاولات بدء إضافية
document.addEventListener('DOMContentLoaded', ()=>{
  let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250);
}, {passive:true});

window.addEventListener('load', tryBoot, {once:true, passive:true});

document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden) tryBoot();
  else flushPersist();
}, {passive:true});

/* ---------------- Throttle Function ---------------- */
function throttle(fn, ms){
  let last = 0, timer = null, pendingArgs = null;
  return function(...args){
    const now = performance.now();
    if(now - last >= ms){
      last = now;
      fn.apply(this, args);
    } else {
      pendingArgs = args;
      clearTimeout(timer);
      timer = setTimeout(()=>{
        last = performance.now();
        fn.apply(this, pendingArgs);
        pendingArgs = null;
      }, ms - (now - last));
    }
  };
}

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
let routeInfoWin = null;

/* Route information */
let routeDistance = 0;
let routeDuration = 0;

/* Hover state - ⚠️ تم تعطيلها مؤقتاً لضمان ظهور الكروت */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide(){
  // ⚠️ تم تحييد المنطق لضمان ظهور الكروت - يمكن إعادة تفعيله لاحقاً
  // clearTimeout(cardHideTimer);
  // if(cardPinned) return;
  // cardHideTimer = setTimeout(()=>{
  //   if(!cardPinned && !cardHovering && !circleHovering && infoWin){
  //     infoWin.close();
  //   }
  // }, 120);
}

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const BASE_ZOOM = 15;

/* Route style */
let routeStyle = {
  color:   '#3344ff',
  weight:  4,
  opacity: 0.95
};

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
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
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
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
  if(shareMode) return location.href; 
  clearTimeout(persistTimer); 
  return writeShare(buildState());
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} متر`;
  } else {
    return `${(meters / 1000).toFixed(1)} كم`;
  }
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} دقيقة`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ساعة`;
    } else {
      return `${hours} ساعة و ${remainingMinutes} دقيقة`;
    }
  }
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
    compressed.c = state.c.map(circle => {
      const item = circles.find(c => c.id === circle[0]);
      // التأكد من وجود البيانات الوصفية قبل محاولة الوصول إليها
      const recipients = item ? item.meta.recipients.join('~') : '';
      return [
        circle[0], // id
        circle[1], // radius
        circle[2]?.replace('#','') || 'ff0000', // color
        circle[3] || '', // name
        recipients // recipients
      ];
    });
  }
  
  if(state.n && state.n.length > 0) {
    compressed.n = state.n.map(circle => {
      const item = circles.find(c => c.id === circle[0]);
      const recipients = item ? item.meta.recipients.join('~') : '';
      return [
        circle[0], // id
        Number(circle[1].toFixed(6)), // lat
        Number(circle[2].toFixed(6)), // lng
        circle[3] || '', // name
        circle[4] || 20, // radius
        circle[5]?.replace('#','') || 'ff0000', // color
        recipients // recipients
      ];
    });
  }
  
  if(state.r && (state.r.ov || state.r.points)) {
    compressed.r = {
      ov: state.r.ov || '',
      points: state.r.points || [],
      style: {
        color: state.r.style?.color || routeStyle.color,
        weight: state.r.style?.weight || routeStyle.weight,
        opacity: state.r.style?.opacity || routeStyle.opacity
      },
      distance: state.r.distance || 0,
      duration: state.r.duration || 0
    };
  } else {
    compressed.r = null;
  }
  
  return compressed;
}

function b64uEncode(s){ 
  try {
    const utf8Bytes = new TextEncoder().encode(s);
    const binaryString = String.fromCharCode.apply(null, utf8Bytes);
    const b = btoa(binaryString);
    return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  } catch(e) {
    console.error('Base64 encoding error:', e);
    return '';
  }
}

function b64uDecode(t){
  try{ 
    t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); 
    const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; 
    const binaryString = atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }catch(e){ 
    console.error('Base64 decoding error:', e);
    return ''; 
  } 
}

function readShare(){ 
  const params = new URLSearchParams(location.search);
  const h = params.get('x');
  if(!h) return null; 
  
  try{
    const decoded = b64uDecode(h);
    if(!decoded) return null;
    const state = JSON.parse(decoded);
    console.log('✅ Loaded shared state from ?x=:', state);
    return state;
  }catch(e){
    console.error('❌ Error parsing shared state:', e);
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
  // ⚠️ إصلاح: استخدام لون المؤشر المخزن في البيانات الوصفية (meta) بدلاً من لون الدائرة أحياناً
  const finalColor = color || DEFAULT_MARKER_COLOR;
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${finalColor}"`);
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
  if(routeInfoWin) { routeInfoWin.close(); routeInfoWin = null; }
  currentRouteOverview = null;
  routePoints = [];
  routeDistance = 0;
  routeDuration = 0;
  if(btnRoute && btnRoute.getAttribute('aria-pressed') === 'true') {
    toggleRouteMode(); // Turn off route mode if on
  }
  if(btnRouteClear) btnRouteClear.style.display = 'none';
  persist();
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    persist();
  }
  if(btnRouteClear) btnRouteClear.style.display = 'block';
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
  
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    clearRouteVisuals();
  }
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    if(routeInfoWin) { routeInfoWin.close(); routeInfoWin = null; }
    currentRouteOverview = null;
    routeDistance = 0;
    routeDuration = 0;
    persist();
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  
  console.log('🔄 Requesting route with points:', routePoints.length);
  
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      const r = result.routes?.[0];
      currentRouteOverview = r?.overview_polyline?.points || null;
      
      if(r?.legs && r.legs.length > 0) {
        routeDistance = r.legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0);
        routeDuration = r.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);
      }
      
      console.log('✅ Route calculated - Distance:', routeDistance, 'Duration:', routeDuration);
      
      setTimeout(()=>{ extractActivePolyline(); },0);
      flushPersist();
    } else {
      console.error('❌ Route calculation failed:', status);
      showToast('تعذر حساب المسار: ' + status);
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
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997,
    clickable: true
  });
  
  activeRoutePoly.addListener('click', (e)=>{
    if(shareMode || !editMode) return openRouteInfoCard(e.latLng, true);
    openRouteCard(e.latLng);
  });
  
  activeRoutePoly.addListener('mouseover', (e)=>{
    if(shareMode || !editMode) return;
    document.body.style.cursor = 'pointer';
  });
  
  activeRoutePoly.addListener('mouseout', (e)=>{
    if(shareMode || !editMode) return;
    document.body.style.cursor = '';
  });
  
  flushPersist();
}

function openRouteInfoCard(latLng, pinned = false){
  if(!routeInfoWin) {
    routeInfoWin = new google.maps.InfoWindow({
      maxWidth: 320,
      pixelOffset: new google.maps.Size(0, -6)
    });
  }
  
  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);
  const pointCount = routePoints.length;
  
  const content = `
  <div dir="rtl" style="min-width:280px">
    <div style="background:rgba(255,255,255,0.95); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.08); border-radius:16px; padding:16px; color:#111; box-shadow:0 12px 28px rgba(0,0,0,.15)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:${routeStyle.color}; border-radius:10px; display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm14 0v-6.7l-6 3.37v6.71l6-3.38z"/>
          </svg>
        </div>
        <div style="flex:1">
          <div style="font-weight:800;font-size:16px;color:#333;">معلومات المسار</div>
          <div style="font-size:12px;color:#666;">${pointCount} نقطة</div>
        </div>
      </div>
      
      <div style="border-top:1px solid #f0f0f0; padding-top:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">المسافة</div>
            <div style="font-weight:700;font-size:14px;color:#333;">${distanceText}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">الوقت المتوقع</div>
            <div style="font-weight:700;font-size:14px;color:#333;">${durationText}</div>
          </div>
        </div>
      </div>
      
      ${!shareMode ? `
      <div style="border-top:1px solid #f0f0f0; padding-top:12px; margin-top:12px;">
        <div style="font-size:11px;color:#666;text-align:center;">
          💡 انقر على الخط لتعديل الإعدادات
        </div>
      </div>
      ` : ''}
    </div>
  </div>`;
  
  routeInfoWin.setContent(content);
  routeInfoWin.setPosition(latLng);
  routeInfoWin.open({ map });
  routeCardPinned = pinned;
  
  if(pinned) {
    google.maps.event.addListenerOnce(routeInfoWin, 'closeclick', ()=>{
      routeCardPinned = false;
    });
  }
}

function restoreRouteFromOverview(polyStr, routePointsArray = null, routeStyleData = null, routeDistanceData = 0, routeDurationData = 0){
  console.log('🔄 Restoring route:', { 
    hasPolyStr: !!polyStr, 
    pointsCount: routePointsArray?.length,
    style: routeStyleData,
    distance: routeDistanceData,
    duration: routeDurationData
  });
  
  if(!polyStr && (!routePointsArray || routePointsArray.length === 0)) {
    console.log('❌ No route data to restore');
    clearRouteVisuals();
    return;
  }
  
  try{
    clearRouteVisuals();
    
    if(routeStyleData){
      routeStyle = {
        color: routeStyleData.color || routeStyle.color,
        weight: routeStyleData.weight || routeStyle.weight,
        opacity: routeStyleData.opacity || routeStyle.opacity
      };
    }
    
    routeDistance = routeDistanceData || 0;
    routeDuration = routeDurationData || 0;
    
    if(Array.isArray(routePointsArray) && routePointsArray.length > 0){
      routePoints = routePointsArray.map(p => new google.maps.LatLng(p.lat, p.lng));
      console.log('✅ Restored route points:', routePoints.length);
    }
    
    if(polyStr) {
      try {
        const path = google.maps.geometry.encoding.decodePath(polyStr);
        activeRoutePoly = new google.maps.Polyline({
          map,
          path,
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity,
          zIndex: 9997,
          clickable: true
        });
        currentRouteOverview = polyStr;
        
        console.log('✅ Restored route polyline with points:', path.length);
        
        activeRoutePoly.addListener('click', (e)=>{
          if(shareMode || !editMode) return openRouteInfoCard(e.latLng, true);
          openRouteCard(e.latLng);
        });
        
        activeRoutePoly.addListener('mouseover', (e)=>{
          if(shareMode || !editMode) return;
          document.body.style.cursor = 'pointer';
        });
        
        activeRoutePoly.addListener('mouseout', (e)=>{
          if(shareMode || !editMode) return;
          document.body.style.cursor = '';
        });
      } catch (e) {
        console.error('❌ Error decoding polyline:', e);
      }
    }
    
    if(routePoints.length > 0){
      routeStopMarkers = routePoints.map((pos, i) => {
        const m = new google.maps.Marker({
          position: pos,
          map,
          icon: { 
            path: google.maps.SymbolPath.CIRCLE, 
            scale: 6, 
            fillColor: '#ffffff', 
            fillOpacity: 1, 
            strokeColor: routeStyle.color, 
            strokeWeight: 2 
          },
          label: { 
            text: String(i+1), 
            color: routeStyle.color, 
            fontSize: '11px', 
            fontWeight: '700' 
          },
          clickable: true,
          draggable: !shareMode // ⚠️ إصلاح: استخدام !shareMode بدلاً من editMode
        });
        m.addListener('dragend', ()=>{ 
          routePoints[i] = m.getPosition(); 
          requestAndRenderRoute(); 
          persist();
        });
        m.addListener('rightclick', ()=>{ removeRoutePoint(i); });
        return m;
      });
      console.log('✅ Created route markers:', routeStopMarkers.length);
    }
    
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
    }
    
    if(routePoints.length > 0) {
      if(btnRouteClear) btnRouteClear.style.display = 'block';
    }
    
    console.log('✅ Route restoration completed successfully');
    
  }catch(e){
    console.error('❌ Error restoring route:', e);
    if(routePoints.length >= 2) {
      setTimeout(() => {
        console.log('🔄 Retrying route calculation...');
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
  // ⚠️ التأكد من أن الكرت لا يُغلق فوراً
  google.maps.event.addListenerOnce(routeCardWin, 'closeclick', ()=>{
    routeCardPinned = false;
    routeCardWin = null;
  });
}

function renderRouteCard(){
  const color   = routeStyle.color   || '#3344ff';
  const weight  = routeStyle.weight  || 4;
  const opacity = routeStyle.opacity || 0.95;
  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);
  
  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>
      
      <div style="background:rgba(0,0,0,0.03); border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px; text-align:center;">
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">المسافة</div>
            <div style="font-weight:700;font-size:13px;color:#333;">${distanceText}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">الوقت المتوقع</div>
            <div style="font-weight:700;font-size:13px;color:#333;">${durationText}</div>
          </div>
        </div>
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
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');
  
  function apply(){
    const clr = colorEl?.value || routeStyle.color;
    const w   = +weightEl?.value || routeStyle.weight;
    const o   = +opacityEl?.value || routeStyle.opacity;
    routeStyle = { color: clr, weight: w, opacity: o };
    
    if(activeRoutePoly){
      activeRoutePoly.setOptions({ 
        strokeColor: clr, 
        strokeWeight: w, 
        strokeOpacity: o 
      });
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
        m.setLabel({ 
          text: m.getLabel()?.text || '1', 
          color: clr, 
          fontSize: '11px', 
          fontWeight: '700' 
        });
      }
    });
    
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: { 
          strokeColor: clr, 
          strokeWeight: w, 
          strokeOpacity: o 
        }
      });
    }
    
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
  if(shareMode) return location.href;
  
  const compressedState = compressState(state);
  const jsonString = JSON.stringify(compressedState);
  const tok = b64uEncode(jsonString);
  
  const newSearch = `?x=${tok}`;
  const newUrlPath = `${location.pathname}${newSearch}`; 
  
  if(location.search !== newSearch){
    history.replaceState(null, '', newUrlPath); 
  }
  
  return `${location.origin}${newUrlPath}`;
}


function applyState(s){
  // 🔧 تعديل: إذا كانت الحالة فارغة، قم بإنشاء كائن افتراضي
  if(!s) s = {}; 
  
  console.log('🔄 Applying state:', s);
  
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
  
  // ⚠️ تعديل: يجب أن تكون editMode صحيحة ما لم نكن في وضع المشاركة
  editMode = !shareMode;
  
  // 🔧 حلقة لتحديث خصائص الدوائر الثابتة بناءً على الحالة المشتركة
  const processedIds = new Set();
  
  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id, radius, colorHex, name, recipientsStr] = row;
      processedIds.add(id);
      const it = circles.find(x => x.id === id);
      if(!it) return;
      
      const color = `#${colorHex}`;
      
      it.circle.setOptions({
        radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
        strokeColor: color,
        fillColor: color,
        fillOpacity: DEFAULT_FILL_OPACITY,
        strokeWeight: DEFAULT_STROKE_WEIGHT
      });
      
      // تحديث المؤشر
      it.marker.setIcon(buildMarkerIcon(color, it.meta.scale, it.meta.kind));
      
      if(name) it.meta.name = name;
      if(recipientsStr) {
        it.meta.recipients = recipientsStr.split('~').filter(Boolean);
      }
      
      applyShapeVisibility(it);
      it.circle.setDraggable(editMode && !it.fixed);
      it.marker.setDraggable(editMode && !it.fixed);
      it.circle.setEditable(false);
    });
  }
  
  // 🔧 حلقة لإنشاء الدوائر المضافة حديثاً
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id, la, ln, name, radius, colorHex, recipientsStr] = row;
      processedIds.add(id);
      const pos = new google.maps.LatLng(la, ln);
      const color = `#${colorHex}`;
      
      // التحقق مما إذا كانت الدائرة موجودة بالفعل (لتجنب التكرار في حالة تحديث الحالة)
      let it = circles.find(x => x.id === id);
      
      if(!it){
        it = createCircle({
          id: id,
          position: pos,
          isNew: false, // لم يعد جديداً بعد تحميله من الحالة
          isFixed: false,
          name: name,
          radius: radius,
          color: color,
          markerKind: DEFAULT_MARKER_KIND,
          markerColor: color, // استخدام نفس لون الدائرة
          markerScale: DEFAULT_MARKER_SCALE,
          recipients: recipientsStr ? recipientsStr.split('~').filter(Boolean) : []
        });
      } else {
        // تحديث الموقع والخيارات إذا كانت موجودة مسبقاً
        it.marker.setPosition(pos);
        it.circle.setCenter(pos);
        it.circle.setOptions({
          radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
          strokeColor: color,
          fillColor: color,
          fillOpacity: DEFAULT_FILL_OPACITY,
          strokeWeight: DEFAULT_STROKE_WEIGHT
        });
        it.marker.setIcon(buildMarkerIcon(color, it.meta.scale, it.meta.kind));
        if(name) it.meta.name = name;
        if(recipientsStr) {
          it.meta.recipients = recipientsStr.split('~').filter(Boolean);
        }
      }
      
      applyShapeVisibility(it);
      it.marker.setDraggable(editMode && !it.fixed);
      it.circle.setDraggable(editMode && !it.fixed);
      it.circle.setEditable(false);
    });
  }
  
  // 🔧 تأكد من أن الدوائر الثابتة التي لم يتم تعديلها هي أيضاً غير قابلة للتحرير
  circles.forEach(it => {
    if(it.fixed && !processedIds.has(it.id)){
      it.circle.setEditable(false);
      it.circle.setDraggable(editMode && !it.fixed);
      it.marker.setDraggable(editMode && !it.fixed);
      // تحديث الأيقونة الافتراضية للتأكد من المقياس الصحيح
      it.marker.setIcon(buildMarkerIcon(it.meta.color, it.meta.scale, it.meta.kind));
    }
  });
  
  if(s.r && (s.r.ov || s.r.points)){
    const points = s.r.points ? s.r.points.map(p => ({ lat: p.lat, lng: p.lng })) : [];
    restoreRouteFromOverview(s.r.ov, points, s.r.style, s.r.distance, s.r.duration);
  } else {
    clearRouteVisuals();
  }
  
  if(shareMode){
    document.body.classList.add('share-mode');
    if(modeBadge) modeBadge.style.display = 'none';
    if(btnShare) btnShare.style.display = 'none';
    if(btnAdd) btnAdd.style.display = 'none';
    if(btnRoute) btnRoute.style.display = 'none';
    if(btnRouteClear) btnRouteClear.style.display = 'none';
    if(mapTypeSelector) mapTypeSelector.style.display = 'none';
  }
}

function buildState(){
  const center = map.getCenter();
  const s = {
    p: [Number(center.lng().toFixed(6)), Number(center.lat().toFixed(6))],
    z: map.getZoom(),
    m: (map.getMapTypeId()||'roadmap').slice(0,1),
    t: (trafficLayer && trafficLayer.getMap()) ? 1 : 0,
    c: [], // Circles with modifications
    n: [], // New circles
    r: null // Route data
  };
  
  circles.forEach(it=>{
    if(!it.visible) return;
    
    const meta = it.meta;
    const circleOptions = it.circle.getOptions();
    const circleCenter = it.circle.getCenter();
    const radius = Math.round(it.circle.getRadius());
    const color = toHex(circleOptions.strokeColor);
    const name = meta.name || '';
    
    if(it.fixed){
      // Only save fixed circles if radius/color/name/recipients was modified
      const original = LOCATIONS.find(l => l.id === it.id);
      const originalColor = toHex(DEFAULT_COLOR);
      const originalRadius = DEFAULT_RADIUS;
      
      const isModified = (radius !== originalRadius) || (color !== originalColor) || (name !== original.name) || (meta.recipients.length > 0);
      
      if(isModified){
        s.c.push([it.id, radius, color, name, meta.recipients]);
      }
    } else {
      // Save custom circles completely
      s.n.push([
        it.id,
        Number(circleCenter.lat().toFixed(6)),
        Number(circleCenter.lng().toFixed(6)),
        name,
        radius,
        color,
        meta.recipients
      ]);
    }
  });
  
  if(currentRouteOverview && routePoints.length > 1) {
    s.r = {
      ov: currentRouteOverview,
      points: routePoints.map(p => ({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) })),
      style: {
        color: routeStyle.color,
        weight: routeStyle.weight,
        opacity: routeStyle.opacity
      },
      distance: routeDistance,
      duration: routeDuration
    };
  } else if (routePoints.length > 0) {
    // Save points even if polyline failed to calculate (e.g. initial load)
    s.r = {
      points: routePoints.map(p => ({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) })),
      style: routeStyle,
      distance: 0,
      duration: 0
    };
  } else {
    s.r = null;
  }
  
  return s;
}


/* ---------------- Map Logic ---------------- */

function createCircle(opts){
  const id = opts.id || Date.now();
  const pos = opts.position || DEFAULT_CENTER;
  const isNew = opts.isNew || false;
  const isFixed = opts.isFixed || false;
  const name = opts.name || '';
  const recipients = opts.recipients || [];
  const markerColor = opts.markerColor || opts.color || DEFAULT_MARKER_COLOR;
  const markerKind = opts.markerKind || DEFAULT_MARKER_KIND;
  
  const circle = new google.maps.Circle({
    strokeColor: opts.color || DEFAULT_COLOR,
    strokeOpacity: DEFAULT_STROKE_WEIGHT,
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    fillColor: opts.color || DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    map,
    center: pos,
    radius: opts.radius || DEFAULT_RADIUS,
    draggable: !shareMode && editMode && !isFixed,
    editable: false, // Start with false, overridden by action
    zIndex: 9998
  });
  
  const marker = new google.maps.Marker({
    position: pos,
    map,
    // ⚠️ تعديل: بناء الأيقونة هنا باستخدام buildMarkerIcon
    icon: buildMarkerIcon(markerColor, opts.markerScale, markerKind),
    draggable: !shareMode && editMode && !isFixed,
    zIndex: 9999
  });
  
  const item = {
    id,
    circle,
    marker,
    fixed: isFixed,
    isNew,
    visible: true,
    meta: {
      name,
      kind: markerKind,
      scale: opts.markerScale || DEFAULT_MARKER_SCALE,
      color: markerColor,
      recipients
    }
  };
  circles.push(item);
  
  circle.addListener('center_changed', throttle(()=>{
    marker.setPosition(circle.getCenter());
    persist();
  }, 100));
  
  circle.addListener('radius_changed', throttle(persist, 100));
  
  circle.addListener('click', (e)=>{
    // ⚠️ تعديل: عند النقر، افتح كرت المعلومات في وضع المشاركة، وكرت التحرير في وضع التحرير
    if(shareMode || !editMode) return openInfoCard(item, e.latLng, true);
    openEditCard(item, e.latLng);
  });
  
  marker.addListener('click', (e)=>{
    // ⚠️ تعديل: عند النقر، افتح كرت المعلومات في وضع المشاركة، وكرت التحرير في وضع التحرير
    if(shareMode || !editMode) return openInfoCard(item, e.latLng, true);
    openEditCard(item, e.latLng);
  });
  
  circle.addListener('dragend', persist);
  marker.addListener('dragend', ()=>{
    circle.setCenter(marker.getPosition());
    persist();
  });
  
  // Hover effects for visibility - تم تحييدها (فقط للمؤشر المرئي)
  const showHover = () => { /*if(infoWin) infoWin.close();*/ circleHovering = true; scheduleCardHide(); };
  const hideHover = () => { circleHovering = false; scheduleCardHide(); };
  circle.addListener('mouseover', showHover);
  marker.addListener('mouseover', showHover);
  circle.addListener('mouseout', hideHover);
  marker.addListener('mouseout', hideHover);
  
  return item;
}

function applyShapeVisibility(item){
  if(!item.circle || !item.marker) return;
  const mapRef = item.visible ? map : null;
  item.circle.setMap(mapRef);
  item.marker.setMap(mapRef);
}

function deleteCircle(item){
  item.circle.setMap(null);
  item.marker.setMap(null);
  const index = circles.findIndex(c => c.id === item.id);
  if(index > -1) circles.splice(index, 1);
  if(infoWin) infoWin.close();
  persist();
}

let nextCustomId = -1;
function getNextCustomId(){
  const ids = circles.filter(c => c.id < 0).map(c => c.id);
  while(ids.includes(nextCustomId)) {
    nextCustomId--;
  }
  return nextCustomId;
}

function addNewCircle(latLng){
  const newId = getNextCustomId();
  const newItem = createCircle({
    id: newId,
    position: latLng,
    isNew: true,
    name: 'موقع جديد',
    radius: 50
  });
  openEditCard(newItem, latLng);
  
  // Enter edit mode immediately after creation
  newItem.circle.setEditable(true);
  newItem.circle.setOptions({ strokeOpacity: 1.0, strokeWeight: 3 });
  
  persist();
}


/* ---------------- Card Logic ---------------- */

function openInfoCard(item, position, pinned = false){
  if(infoWin) infoWin.close();
  
  // ⚠️ إصلاح: استخدام لون المؤشر المخزن في البيانات الوصفية بدلاً من لون الدائرة
  const color = item.meta.color || toHex(item.circle.getOptions().strokeColor);
  const radius = Math.round(item.circle.getRadius());
  const distanceText = formatDistance(radius);
  const kind = MARKER_KINDS.find(k=>k.id===item.meta.kind);
  
  const content = `
  <div dir="rtl" style="min-width:260px">
    <div style="background:rgba(255,255,255,0.95); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.08); border-radius:16px; padding:16px; color:#111; box-shadow:0 12px 28px rgba(0,0,0,.15)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:${color}; border-radius:10px; display:flex;align-items:center;justify-content:center;">
          ${kind.svg.replace('fill="'+kind.svg.match(/fill="([^"]*)"/)[1]+'"', `fill="#ffffff"`).replace('24','20').replace('24','20')}
        </div>
        <div style="flex:1">
          <div style="font-weight:800;font-size:16px;color:#333;">${escapeHtml(item.meta.name || 'موقع بدون اسم')}</div>
          <div style="font-size:12px;color:#666;">${kind.label} - قطر ${distanceText}</div>
        </div>
      </div>
      
      ${item.meta.recipients.length > 0 ? `
      <div style="border-top:1px solid #f0f0f0; padding-top:12px;">
        <div style="font-size:11px;color:#666;margin-bottom:6px;">المستهدفون:</div>
        <div style="font-size:13px;font-weight:600;color:#333;">${escapeHtml(item.meta.recipients.join(', '))}</div>
      </div>
      ` : ''}
    </div>
  </div>`;
  
  infoWin = new google.maps.InfoWindow({
    content,
    position,
    maxWidth: 320,
    pixelOffset: new google.maps.Size(0, -6)
  });
  
  infoWin.open({ map });
  cardPinned = pinned;
  cardHovering = true;
  
  infoWin.addListener('domready', () => {
    const cardRoot = document.querySelector('.gm-style-iw-c');
    if(cardRoot){
      cardRoot.addEventListener('mouseover', () => { cardHovering = true; clearTimeout(cardHideTimer); });
      cardRoot.addEventListener('mouseout', () => { cardHovering = false; scheduleCardHide(); });
    }
  });
  
  infoWin.addListener('closeclick', ()=>{
    cardPinned = false;
    infoWin = null; // ⚠️ إصلاح: مسح المتغير عند الإغلاق
  });
}

function openEditCard(item, position){
  if(infoWin) infoWin.close();
  
  const currentRadius = Math.round(item.circle.getRadius());
  const currentColor = toHex(item.circle.getOptions().strokeColor);
  const currentName = escapeHtml(item.meta.name || '');
  const currentRecipients = escapeHtml(item.meta.recipients.join('\n'));
  const isNew = item.isNew || !item.fixed;
  
  // Ensure only this item is editable
  circles.forEach(c => {
    c.circle.setEditable(c.id === item.id);
    c.circle.setOptions({ strokeOpacity: DEFAULT_STROKE_WEIGHT, strokeWeight: DEFAULT_STROKE_WEIGHT }); // إزالة الحدود المميزة للغير محدد
  });
  item.circle.setOptions({ strokeOpacity: 1.0, strokeWeight: 3 }); // وضع الحدود المميزة للمحدد
  
  const kindOptions = MARKER_KINDS.map(k =>
    `<option value="${k.id}" ${k.id === item.meta.kind ? 'selected' : ''}>${k.label}</option>`
  ).join('');
  
  const content = `
  <div id="edit-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:40px;height:40px;background:${currentColor}; border-radius:10px; display:flex;align-items:center;justify-content:center;">
          ${MARKER_KINDS.find(k=>k.id===item.meta.kind).svg.replace(/fill="([^"]*)"/g, `fill="#ffffff"`).replace('24','20').replace('24','20')}
        </div>
        <div style="flex:1;font-weight:800;font-size:16px;">تحرير الموقع ${isNew ? 'الجديد' : ''}</div>
      </div>
      
      <div class="field"><label style="font-size:12px;color:#333;">الاسم:</label>
        <input id="circle-name" type="text" value="${currentName}" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;"></div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;margin-bottom:10px;">
        <div class="field"><label style="font-size:12px;color:#333;">نوع الأيقونة:</label>
          <select id="marker-kind" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:6px;">${kindOptions}</select></div>
        <div class="field"><label style="font-size:12px;color:#333;">اللون:</label>
          <input id="circle-color" type="color" value="${currentColor}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
      </div>
      
      <div class="field"><label style="font-size:12px;color:#333;">نصف القطر (متر):</label>
        <input id="circle-radius" type="range" min="10" max="500" step="5" value="${currentRadius}" style="width:100%;">
        <span id="radius-label" style="font-size:12px;color:#666">${currentRadius} متر</span></div>
      
      <div class="field"><label style="font-size:12px;color:#333;">المستهدفون (كل سطر اسم):</label>
        <textarea id="circle-recipients" rows="2" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">${currentRecipients}</textarea></div>
      
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="save-btn" style="flex:1;background:#4285f4;color:white;border:none;border-radius:10px;padding:8px 12px;cursor:pointer;">حفظ</button>
        <button id="cancel-btn" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;">إلغاء</button>
        ${isNew ? `<button id="delete-btn" style="flex:1;border:1px solid #f44336;background:#fefefe;color:#f44336;border-radius:10px;padding:8px 12px;cursor:pointer;">حذف</button>` : ''}
      </div>
    </div>
  </div>`;
  
  infoWin = new google.maps.InfoWindow({
    content,
    position,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0, -6)
  });
  
  infoWin.open({ map });
  cardPinned = true;
  cardHovering = true;
  
  infoWin.addListener('domready', () => {
    attachEditCardEvents(item);
    const cardRoot = document.querySelector('.gm-style-iw-c');
    if(cardRoot){
      cardRoot.addEventListener('mouseover', () => { cardHovering = true; clearTimeout(cardHideTimer); });
      cardRoot.addEventListener('mouseout', () => { cardHovering = false; scheduleCardHide(); });
    }
  });
  
  infoWin.addListener('closeclick', ()=>{
    // ⚠️ إصلاح: إزالة حدود التحرير عند الإغلاق
    item.circle.setEditable(false);
    item.circle.setOptions({ strokeOpacity: DEFAULT_STROKE_WEIGHT, strokeWeight: DEFAULT_STROKE_WEIGHT });
    cardPinned = false;
    // If it's a new unsaved circle, delete it
    if(item.isNew) deleteCircle(item);
    infoWin = null; // ⚠️ إصلاح: مسح المتغير عند الإغلاق
  });
}

function attachEditCardEvents(item){
  const nameInput = document.getElementById('circle-name');
  const radiusInput = document.getElementById('circle-radius');
  const radiusLabel = document.getElementById('radius-label');
  const colorInput = document.getElementById('circle-color');
  const recipientsInput = document.getElementById('circle-recipients');
  const kindSelect = document.getElementById('marker-kind');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const deleteBtn = document.getElementById('delete-btn');
  
  if(radiusInput){
    radiusInput.addEventListener('input', ()=>{
      const radius = +radiusInput.value;
      item.circle.setRadius(radius);
      radiusLabel.textContent = `${radius} متر`;
      // Note: no persist here, saved on click
    });
  }
  
  if(colorInput){
    colorInput.addEventListener('input', ()=>{
      const color = colorInput.value;
      item.circle.setOptions({ strokeColor: color, fillColor: color });
      item.marker.setIcon(buildMarkerIcon(color, item.meta.scale, item.meta.kind));
      // Note: no persist here, saved on click
    });
  }
  
  if(kindSelect){
    kindSelect.addEventListener('change', ()=>{
      item.meta.kind = kindSelect.value;
      item.marker.setIcon(buildMarkerIcon(item.circle.getOptions().strokeColor, item.meta.scale, item.meta.kind));
    });
  }
  
  function saveChanges(){
    if(nameInput) item.meta.name = nameInput.value.trim();
    if(recipientsInput) item.meta.recipients = parseRecipients(recipientsInput.value);
    item.isNew = false;
    item.circle.setEditable(false);
    item.circle.setOptions({ strokeOpacity: DEFAULT_STROKE_WEIGHT, strokeWeight: DEFAULT_STROKE_WEIGHT });
    
    // Update marker color meta for state saving consistency
    item.meta.color = toHex(item.circle.getOptions().strokeColor);
    item.meta.kind = kindSelect.value;
    
    flushPersist();
    showToast('✓ تم حفظ التغييرات');
    if(infoWin) infoWin.close();
    cardPinned = false;
    infoWin = null;
  }
  
  if(saveBtn) saveBtn.addEventListener('click', saveChanges, {passive:true});
  
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>{
    // Restore original state (or just close for now)
    item.circle.setEditable(false);
    item.circle.setOptions({ strokeOpacity: DEFAULT_STROKE_WEIGHT, strokeWeight: DEFAULT_STROKE_WEIGHT });
    if(item.isNew) deleteCircle(item);
    else { applyState(readShare()); } // Simple reload for cancelled changes
    if(infoWin) infoWin.close();
    cardPinned = false;
    infoWin = null;
  }, {passive:true});
  
  if(deleteBtn) deleteBtn.addEventListener('click', ()=>{
    deleteCircle(item);
    showToast('✓ تم حذف الموقع');
    if(infoWin) infoWin.close();
    cardPinned = false;
    infoWin = null;
  }, {passive:true});
}

/* ---------------- UI State Toggles ---------------- */

function toggleTraffic(){
  if(shareMode) return;
  // ⚠️ إصلاح: تأكيد وجود الزر قبل محاولة قراءة الخاصية
  if(!btnTraffic) return;
  const isChecked = btnTraffic.getAttribute('aria-pressed') === 'true';
  if(isChecked){
    trafficLayer.setMap(null);
    btnTraffic.setAttribute('aria-pressed', 'false');
  } else {
    trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed', 'true');
  }
  persist();
}

function toggleAddMode(){
  if(shareMode) return;
  if(routeMode) toggleRouteMode(); // Turn off route mode
  
  addMode = !addMode;
  // ⚠️ إصلاح: تأكيد وجود الزر
  if(btnAdd) btnAdd.setAttribute('aria-pressed', String(addMode));
  
  // Update map cursor and message
  if(addMode){
    map.setOptions({ draggableCursor: 'crosshair' });
    showToast('💡 انقر على الخريطة لإضافة موقع جديد', 4000);
  } else {
    map.setOptions({ draggableCursor: '' });
    hideToast();
  }
}

function toggleRouteMode(){
  if(shareMode) return;
  if(addMode) toggleAddMode(); // Turn off add mode
  
  routeMode = !routeMode;
  // ⚠️ إصلاح: تأكيد وجود الزر
  if(btnRoute) btnRoute.setAttribute('aria-pressed', String(routeMode));
  
  // Update map cursor and message
  if(routeMode){
    map.setOptions({ draggableCursor: 'crosshair' });
    showToast('💡 انقر على الخريطة لإضافة نقطة مسار', 4000);
    if(routePoints.length > 0 && btnRouteClear) btnRouteClear.style.display = 'block';
  } else {
    map.setOptions({ draggableCursor: '' });
    hideToast();
  }
}

function handleMapClick(e){
  if(addMode){
    toggleAddMode();
    addNewCircle(e.latLng);
  } else if (routeMode) {
    addRoutePoint(e.latLng);
    if(routePoints.length === 1) showToast('✓ تم إضافة نقطة البداية. أضف نقطة ثانية لحساب المسار.', 3000);
    else showToast('✓ تم إضافة نقطة مسار جديدة.', 3000);
  }
}

function showToast(message, duration = 3000){
  if(!toast) return;
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.pointerEvents = 'auto';
  
  clearTimeout(toast.timer);
  if(duration > 0){
    toast.timer = setTimeout(hideToast, duration);
  }
}

function hideToast(){
  if(toast){
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    clearTimeout(toast.timer);
  }
}

/* ---------------- Share function fix ---------------- */
function handleShareClick(){
  const shareUrl = flushPersist();
  
  if(navigator.share){
    navigator.share({
      title: 'مشاركة خريطة أمن الدرعية',
      text: 'خريطة أمن الدرعية مع الإحداثيات المحددة',
      url: shareUrl
    }).then(() => {
      console.log('✅ Successful share');
    }).catch((error) => {
      console.error('❌ Error sharing:', error);
      fallbackCopy(shareUrl);
    });
  } else {
    fallbackCopy(shareUrl);
  }
}

function fallbackCopy(url){
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(() => {
      showToast('✓ تم نسخ رابط المشاركة إلى الحافظة.');
      console.log('✅ Copied to clipboard:', url);
    }).catch(err => {
      console.error('❌ Failed to copy URL:', err);
      showToast('❌ تعذر النسخ. الرابط هو: ' + url, 5000);
    });
  } else {
    // Very old fallback (may cause popups)
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('✓ تم نسخ رابط المشاركة إلى الحافظة (طريقة قديمة).');
  }
}

/* ---------------- Main Boot ---------------- */

function boot(){
  console.log('Booting map application...');
  
  trafficLayer = new google.maps.TrafficLayer();
  
  // 1. العثور على جميع عناصر واجهة المستخدم
  btnTraffic = document.getElementById('btn-traffic');
  btnShare   = document.getElementById('btn-share');
  btnAdd     = document.getElementById('btn-add');
  btnRoute   = document.getElementById('btn-route');
  btnRouteClear = document.getElementById('btn-route-clear');
  modeBadge  = document.getElementById('mode-badge');
  toast      = document.getElementById('toast');
  mapTypeSelector = document.getElementById('map-type');
  
  if(!btnTraffic || !btnShare || !btnAdd || !btnRoute || !mapTypeSelector){
    console.warn('⚠️ بعض عناصر واجهة المستخدم المطلوبة غير موجودة.');
  }
  
  const urlParams = new URLSearchParams(location.search);
  shareMode = urlParams.has('x');
  
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: BASE_ZOOM,
    mapTypeId: 'roadmap',
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    rotateControl: false,
    scaleControl: false,
    zoomControl: !shareMode
  });
  
  // 2. إنشاء الدوائر الثابتة
  LOCATIONS.forEach(loc => {
    createCircle({
      id: loc.id,
      position: new google.maps.LatLng(loc.lat, loc.lng),
      isFixed: true,
      name: loc.name,
      radius: DEFAULT_RADIUS,
      color: DEFAULT_COLOR,
      markerKind: 'pin',
      markerColor: DEFAULT_MARKER_COLOR, // ⚠️ إرسال لون المؤشر منفصلاً
      markerScale: DEFAULT_MARKER_SCALE
    });
  });
  
  // 3. تطبيق الحالة المشتركة/المحفوظة
  const sharedState = readShare();
  applyState(sharedState);
  
  // 4. ربط أحداث الخريطة
  map.addListener('click', handleMapClick);
  map.addListener('zoom_changed', throttle(persist, 200));
  map.addListener('center_changed', throttle(persist, 200));
  map.addListener('maptypeid_changed', persist);
  
  // 5. ربط أحداث أزرار واجهة المستخدم (فقط في وضع التحرير)
  if(!shareMode){
    // ⚠️ التأكد من أن جميع الأزرار تعمل
    if(btnShare) btnShare.addEventListener('click', handleShareClick); 
    if(btnTraffic) btnTraffic.addEventListener('click', toggleTraffic);
    if(btnAdd) btnAdd.addEventListener('click', toggleAddMode);
    if(btnRoute) btnRoute.addEventListener('click', toggleRouteMode);
    if(btnRouteClear) btnRouteClear.addEventListener('click', clearRouteVisuals);
  
    if(mapTypeSelector){
      mapTypeSelector.addEventListener('change', (e)=>{
        map.setMapTypeId(e.target.value);
      }, {passive:true});
    }
  
    // الإظهار الأولي لزر المسح
    if(btnRouteClear) {
      btnRouteClear.style.display = (routePoints.length > 0) ? 'block' : 'none';
    }
  
  } else {
    console.log('Map loaded in share mode.');
  }
  
  // Log for debugging
  console.log('Map booted successfully. Share mode:', shareMode);
}
