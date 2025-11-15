/* Diriyah Security Map – v13.2 (✅ المسار في وضع المشاركة والعرض، تأكيد نسخ الرابط، وتفعيل زر واحد فقط) */
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
function meetSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`; }

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

// 🔧 جديد: دالة لتحويل المسافة إلى نص مقروء
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} متر`;
  } else {
    return `${(meters / 1000).toFixed(1)} كم`;
  }
}

// 🔧 جديد: دالة لتحويل الوقت إلى نص مقروء
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
  
  // 🔧 إصلاح: حفظ أسماء المستلمين بشكل صحيح
  if(state.c && state.c.length > 0) {
    compressed.c = state.c.map(circle => {
      // البحث عن العنصر المناسب في المصفوفة بناءً على الهيكل الصحيح
      const item = circles.find(c => c.id === circle[0]);
      const recipients = item ? item.meta.recipients.join('~') : '';
      return [
        circle[0], // id
        circle[1], // radius
        circle[2]?.replace('#','') || 'ff0000', // color
        circle[3] || '', // name
        recipients // recipients - الإصلاح هنا
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
        recipients // recipients - الإصلاح هنا
      ];
    });
  }
  
  // 🔧 إصلاح: حفظ إعدادات نمط المسار بشكل صحيح
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
    const b=btoa(unescape(encodeURIComponent(s))); 
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
    return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); 
  }catch(e){ 
    console.error('Base64 decoding error:', e);
    return ''; 
  } 
}

function readShare(){ 
  const h=(location.hash||'').trim(); 
  if(!h.startsWith('#x=')) return null; 
  try{
    const decoded = b64uDecode(h.slice(3));
    if(!decoded) return null;
    const state = JSON.parse(decoded);
    console.log('✅ Loaded shared state:', state);
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
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
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
      
      // 🔧 جديد: استخراج المسافة والوقت من النتيجة
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
  
  // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
  activeRoutePoly.addListener('click', (e)=>{
    if(shareMode || !editMode) return;
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

// 🔧 جديد: دالة لعرض كرت معلومات المسار
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
  <div class="info-card">
    <div class="card-header">
      <div class="card-title">
        <strong>معلومات المسار</strong>
        <div>${pointCount} نقطة</div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-row">
        <div class="info-label">المسافة</div>
        <div class="info-value">${distanceText}</div>
      </div>
      <div class="card-row">
        <div class="info-label">الوقت المتوقع</div>
        <div class="info-value">${durationText}</div>
      </div>
    </div>
    ${!shareMode ? `
    <div class="card-footer">
      <small>💡 انقر على الخط لتعديل الإعدادات</small>
    </div>
    ` : ''}
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

// 🔧 إصلاح كامل: تطبيق إعدادات النمط بشكل صحيح عند استعادة المسار
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
    
    // 🔧 إصلاح: تطبيق إعدادات النمط أولاً قبل إنشاء أي عناصر
    if(routeStyleData){
      routeStyle = {
        color: routeStyleData.color || routeStyle.color,
        weight: routeStyleData.weight || routeStyle.weight,
        opacity: routeStyleData.opacity || routeStyle.opacity
      };
    }
    
    // 🔧 جديد: استعادة معلومات المسافة والوقت
    routeDistance = routeDistanceData || 0;
    routeDuration = routeDurationData || 0;
    
    if(Array.isArray(routePointsArray) && routePointsArray.length > 0){
      routePoints = routePointsArray.map(p => new google.maps.LatLng(p.lat, p.lng));
      console.log('✅ Restored route points:', routePoints.length);
    }
    
    // 🔧 إصلاح: إنشاء المسار مع تطبيق النمط مباشرة
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
        
        // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
        activeRoutePoly.addListener('click', (e)=>{
          if(shareMode || !editMode) return;
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
    
    // 🔧 إصلاح: إنشاء علامات النقاط مع تطبيق النمط
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
            fontSize:'11px', 
            fontWeight:'700' 
          },
          clickable: true,
          draggable: !shareMode
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
    
    // 🔧 إصلاح: تحديث directionsRenderer بالنمط الجديد
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
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
}

function renderRouteCard(){
  const color   = routeStyle.color   || '#3344ff';
  const weight  = routeStyle.weight  || 4;
  const opacity = routeStyle.opacity || 0.95;
  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);
  
  return `
  <div class="route-card">
    <div class="card-header">
      <strong>إعدادات المسار</strong>
    </div>
    <div class="card-body">
      <div class="card-section">
        <div class="card-row">
          <div class="info-label">المسافة</div>
          <div class="info-value">${distanceText}</div>
        </div>
        <div class="card-row">
          <div class="info-label">الوقت المتوقع</div>
          <div class="info-value">${durationText}</div>
        </div>
      </div>
      <div class="card-section">
        <div class="form-row">
          <label>اللون:</label>
          <input id="route-color" type="color" value="${color}">
        </div>
        <div class="form-row">
          <label>سماكة الخط:</label>
          <input id="route-weight" type="range" min="1" max="12" step="1" value="${weight}">
          <span id="route-weight-lbl">${weight}</span>
        </div>
        <div class="form-row">
          <label>الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="${opacity}">
          <span id="route-opacity-lbl">${opacity.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <button id="route-save" class="btn">حفظ</button>
      <button id="route-close" class="btn">إغلاق</button>
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
    
    // 🔧 إصلاح: تطبيق النمط على جميع عناصر المسار
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
  
  editMode = !shareMode;
  
  // 🔧 إصلاح: تطبيق إعدادات الدوائر مع أسماء المستلمين
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
      // 🔧 الإصلاح: استعادة أسماء المستلمين
      if(recipients) {
        it.meta.recipients = recipients.split('~').filter(Boolean);
      }
      
      applyShapeVisibility(it);
    });
  }
  
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id, lat, lng, name, radius, color, recipients] = row;
      
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
        recipients: recipients ? recipients.split('~').filter(Boolean) : [], // 🔧 الإصلاح هنا
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
  
  // 🔧 إصلاح كامل: استعادة المسار بشكل صحيح
  if(s.r !== undefined && s.r !== null) {
    console.log('🔄 Restoring route from state:', s.r);
    
    // تأخير استعادة المسار لضمان تحميل الخريكة أولاً
    setTimeout(() => {
      restoreRouteFromOverview(
        s.r.ov, 
        s.r.points, 
        s.r.style,
        s.r.distance || 0,
        s.r.duration || 0
      );
      
      // 🔧 إصلاح: عرض معلومات المسار بعد الاستعادة في وضع المشاركة
      if(shareMode && activeRoutePoly && routePoints.length > 0) {
        setTimeout(() => {
          // افتح نافذة معلومات المسار في وضع المشاركة إذا كان هناك مسار نشط
          const midPoint = activeRoutePoly.getPath().getAt(Math.floor(activeRoutePoly.getPath().getLength() / 2));
          if(midPoint) openRouteInfoCard(midPoint, true);
        }, 1000);
      }
    }, 1500);
  } else {
    console.log('ℹ️ No route data in state');
    clearRouteVisuals();
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

  // 🔧 إصلاح كامل لدالة المشاركة
  async function copyShareLink(){
    try{
      // تأكد من حفظ أحدث حالة
      flushPersist();
      
      // انتظر قليلاً لضمان حفظ الحالة
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // أنشئ الرابط
      const baseUrl = window.location.origin + window.location.pathname;
      const currentHash = window.location.hash;
      
      let shareUrl;
      if (currentHash && currentHash.startsWith('#x=')) {
        shareUrl = baseUrl + currentHash;
      } else {
        // إذا لم يكن هناك هاش، أنشئ واحداً جديداً
        const state = buildState();
        const compressedState = compressState(state);
        const jsonString = JSON.stringify(compressedState);
        const tok = b64uEncode(jsonString);
        shareUrl = baseUrl + '#x=' + tok;
      }
      
      console.log('🔗 Sharing URL:', shareUrl);
      
      // استخدم Clipboard API إذا كان متاحاً
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('✓ تم نسخ رابط المشاركة إلى الحافظة', 3000);
      } else {
        // طريقة بديلة للمتصفحات القديمة
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            showToast('✓ تم نسخ رابط المشاركة إلى الحافظة', 3000);
          } else {
            throw new Error('فشل النسخ');
          }
        } catch (err) {
          document.body.removeChild(textArea);
          // إذا فشل النسخ، اعرض الرابط للمستخدم لنسخه يدوياً
          showToast('❌ فشل النسخ التلقائي. الرابط: ' + shareUrl, 5000);
        }
      }
    } catch(err) {
      console.error('❌ Share error:', err);
      showToast('❌ فشل نسخ الرابط. حاول مرة أخرى.', 3000);
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
    
    // 🔧 إصلاح: تفعيل/إلغاء زر المسار وتعطيل زر الإضافة عند تفعيل المسار
    if(routeMode){
      showToast('✅ وضع المسار مفعل — انقر على الخريطة لإضافة نقاط المسار');
      // إلغاء وضع الإضافة عند تفعيل وضع المسار
      addMode = false; 
      if(btnAdd) btnAdd.setAttribute('aria-pressed','false'); 
      document.body.classList.remove('add-cursor');
      document.body.classList.add('route-cursor');
    } else { 
      showToast('✅ تم إيقاف وضع المسار'); 
      document.body.classList.remove('route-cursor');
    }
  }, {passive:true});

  if(btnRouteClear) btnRouteClear.addEventListener('click', ()=>{
    routePoints = []; 
    clearRouteVisuals(); 
    showToast('✅ تم مسح المسار');
  }, {passive:true});

  // 🔧 إصلاح: إضافة حدث النقر لزر المشاركة
  if(btnShare) {
    btnShare.addEventListener('click', copyShareLink, {passive:true});
  }

  // 🔧 إصلاح: تعديل سلوك زر الإضافة لإلغاء زر المسار عند تفعيله
  if(btnAdd) btnAdd.addEventListener('click', ()=>{
    if(shareMode) return;
    addMode = !addMode;
    btnAdd.setAttribute('aria-pressed', String(addMode));
    
    // تفاعل الأزرار: إلغاء وضع المسار عند تفعيل وضع الإضافة
    if (addMode) {
      document.body.classList.add('add-cursor');
      document.body.classList.remove('route-cursor');
      showToast('✅ انقر على الخريطة لإضافة موقع');
      
      // إلغاء وضع المسار
      routeMode = false;
      if(btnRoute) btnRoute.setAttribute('aria-pressed', 'false');
    } else {
      document.body.classList.remove('add-cursor');
      showToast('✅ تم إلغاء الإضافة');
    }
  }, {passive:true});

  map.addListener('click', (e)=>{
    cardHovering = false; 
    circleHovering = false;
    
    if (cardPinned && infoWin) { infoWin.close(); cardPinned = false; }
    if (routeCardPinned && routeCardWin) { routeCardWin.close(); routeCardPinned = false; }
    if (routeCardPinned && routeInfoWin) { routeInfoWin.close(); routeCardPinned = false; }
    
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
    console.log('🔄 Applying saved state in share mode:', shareMode);
    setTimeout(() => {
      applyState(savedState);
      if(modeBadge) modeBadge.textContent = shareMode ? 'SHARE' : 'EDIT';
      showToast(shareMode ? '✅ وضع المشاركة مفعل' : '✅ وضع التحرير مفعل');
    }, 800);
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
  
  showToast('✅ جاهز للاستخدام - التحرير مفعل');
}

/* ---------------- Card Functions ---------------- */
function bindCircleEvents(item){
  const openCardThrottled = throttle((it, pin)=>openCard(it, pin), 120);
  const c = item.circle;
  c.addListener('mouseover', ()=>{ circleHovering = true; if(!cardPinned) openCardThrottled(item, false); });
  c.addListener('mouseout',  ()=>{ circleHovering = false; scheduleCardHide(); });
  c.addListener('click',     ()=>{ openCard(item, true); });
  google.maps.event.addListener(c,'center_changed', ()=>{
    if(item.marker){ item.marker.setPosition(c.getCenter()); }
    persist();
  });
}

function openCard(item, pin = true){
  if(!infoWin) infoWin = new google.maps.InfoWindow({ content:'', maxWidth:520, pixelOffset:new google.maps.Size(0,-6) });
  infoWin.setContent(renderCard(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });
  cardPinned = !!pin;
  setTimeout(()=>{
    const root=document.getElementById('iw-root'); 
    if(!root) return;
    attachCardEvents(item);
  },0);
}

function renderCard(item){
  const c=item.circle, meta=item.meta;
  const names=Array.isArray(meta.recipients)?meta.recipients:[];
  const namesHtml = names.length
    ? `<div class="names-list">
${names.map(n=>`<div class="name">${escapeHtml(n)}</div>`).join('')}
</div>`
    : `<div class="names-empty">
لا توجد أسماء مضافة
</div>`;
  const center=c.getCenter();
  const radius=Math.round(c.getRadius());
  const color =toHex(c.get('strokeColor')||DEFAULT_COLOR);
  const stroke=c.get('strokeWeight')||DEFAULT_STROKE_WEIGHT;
  const fillO =Number(c.get('fillOpacity')??DEFAULT_FILL_OPACITY);
  const useMarker = !!meta.useMarker;
  const markerColor = meta.markerColor || DEFAULT_MARKER_COLOR;
  const markerScale = Number.isFinite(meta.markerScale) ? meta.markerScale : DEFAULT_MARKER_SCALE;
  const markerKind  = meta.markerKind || DEFAULT_MARKER_KIND;
  const optionsHtml = MARKER_KINDS.map(k=>`<option value="${k.id}"${k.id===markerKind?' selected':''}>${k.label}</option>`).join('');
  
  const showEditTools = !shareMode && editMode;
  
  return `
  <div class="card" id="iw-root">
    <div class="card-header">
      <div class="title">
        ${showEditTools ? `
          <input type="text" id="ctl-name" value="${escapeHtml(meta.name)}" autocomplete="off" placeholder="اكتب اسماً للموقع">
        ` : `
          <strong>${escapeHtml(meta.name)}</strong>
        `}
      </div>
      ${showEditTools ? `<button id="btn-card-share" title="نسخ الرابط">🔗</button>` : ``}
    </div>
    <div class="coords">
      الإحداثيات: ${center.lat().toFixed(6)}, ${center.lng().toFixed(6)}
    </div>
    <div class="recipients">
      <h3>المستلمون:</h3>
      ${namesHtml}
    </div>
    ${showEditTools ? `
    <div class="tools">
      <div class="shape-selector">
        <h3>نوع التمثيل:</h3>
        <div class="radio-group">
          <label><input type="radio" name="shape" value="circle" id="ctl-shape" ${!useMarker?'checked':''}> دائرة</label>
          <label><input type="radio" name="shape" value="marker" ${useMarker?'checked':''}> أيقونة</label>
        </div>
      </div>
      <div class="circle-tools" style="${useMarker?'display:none;':''}">
        <h4>أدوات الدائرة:</h4>
        <div class="form-row">
          <label>نصف القطر (م):
              <input type="range" id="ctl-radius" min="5" max="1000" step="5" value="${radius}">
              <span id="lbl-radius">${radius}</span>
          </label>
          <label>اللون:
              <input type="color" id="ctl-color" value="${color}">
          </label>
          <label>حدّ الدائرة:
              <input type="range" id="ctl-stroke" min="1" max="8" step="1" value="${stroke}">
          </label>
          <label>شفافية التعبئة:
              <input type="range" id="ctl-fill" min="0" max="1" step="0.05" value="${fillO}">
              <span id="lbl-fill">${fillO.toFixed(2)}</span>
          </label>
        </div>
      </div>
      <div class="marker-tools" style="${!useMarker?'display:none;':''}">
        <h4>أدوات الأيقونة:</h4>
        <div class="form-row">
          <label>نوع الأيقونة:
              <select id="ctl-marker-kind">
                ${optionsHtml}
              </select>
          </label>
          <label>لون الأيقونة:
              <input type="color" id="ctl-marker-color" value="${markerColor}">
          </label>
          <label>حجم الأيقونة:
              <input type="range" id="ctl-marker-scale" min="0.5" max="3" step="0.1" value="${markerScale}">
              <span id="lbl-marker-scale">${markerScale.toFixed(1)}</span>
          </label>
        </div>
      </div>
      <div class="card-footer">
        <div class="recipient-input">
          <label>أسماء المستلمين (سطر لكل اسم):</label>
          <textarea id="ctl-names" rows="4">${escapeHtml(names.join("\n"))}</textarea>
        </div>
        <div class="button-group">
          <button class="btn" id="btn-save">حفظ</button>
          <button class="btn" id="btn-clear">حذف الأسماء</button>
          <button class="btn" id="btn-del">حذف الموقع</button>
        </div>
      </div>
    </div>
  </div>
` : ``}
  </div>`;
}

function attachCardEvents(item){
  if(shareMode) return;
  
  const nameEl = document.getElementById('ctl-name');
  const shapeEl = document.getElementById('ctl-shape');
  const radiusEl = document.getElementById('ctl-radius');
  const radiusLbl = document.getElementById('lbl-radius');
  const colorEl = document.getElementById('ctl-color');
  const strokeEl = document.getElementById('ctl-stroke');
  const fillEl = document.getElementById('ctl-fill');
  const fillLbl = document.getElementById('lbl-fill');
  const namesEl = document.getElementById('ctl-names');
  const saveBtn = document.getElementById('btn-save');
  const clearBtn = document.getElementById('btn-clear');
  const delBtn = document.getElementById('btn-del');
  const markerKindEl = document.getElementById('ctl-marker-kind');
  const markerColorEl = document.getElementById('ctl-marker-color');
  const markerScaleEl = document.getElementById('ctl-marker-scale');
  const markerScaleLbl = document.getElementById('lbl-marker-scale');
  const cardShareBtn = document.getElementById('btn-card-share');
  
  if(nameEl) nameEl.addEventListener('input', ()=>{ item.meta.name = nameEl.value; persist(); });
  if(shapeEl) shapeEl.addEventListener('change', ()=>{ 
    item.meta.useMarker = shapeEl.value === 'marker'; 
    applyShapeVisibility(item); 
    persist(); 
  });
  if(radiusEl && radiusLbl) {
    radiusEl.addEventListener('input', ()=>{ 
      item.circle.setRadius(+radiusEl.value); 
      radiusLbl.textContent = radiusEl.value; 
      persist(); 
    });
  }
  if(colorEl) colorEl.addEventListener('input', ()=>{ 
    item.circle.setOptions({ strokeColor: colorEl.value, fillColor: colorEl.value }); 
    persist(); 
  });
  if(strokeEl) strokeEl.addEventListener('input', ()=>{ 
    item.circle.setOptions({ strokeWeight: +strokeEl.value }); 
    persist(); 
  });
  if(fillEl && fillLbl) {
    fillEl.addEventListener('input', ()=>{ 
      item.circle.setOptions({ fillOpacity: +fillEl.value }); 
      fillLbl.textContent = (+fillEl.value).toFixed(2); 
      persist(); 
    });
  }
  if(namesEl) namesEl.addEventListener('input', ()=>{ 
    item.meta.recipients = parseRecipients(namesEl.value); 
    persist(); 
  });
  if(saveBtn) saveBtn.addEventListener('click', ()=>{ 
    flushPersist(); 
    showToast('✅ تم حفظ التغييرات'); 
  });
  if(clearBtn) clearBtn.addEventListener('click', ()=>{ 
    item.meta.recipients = []; 
    if(namesEl) namesEl.value = ''; 
    persist(); 
    showToast('✅ تم حذف الأسماء'); 
  });
  if(delBtn) delBtn.addEventListener('click', ()=>{ 
    item.circle.setMap(null); 
    if(item.marker) item.marker.setMap(null); 
    circles.splice(circles.indexOf(item), 1); 
    if(infoWin) infoWin.close(); 
    persist(); 
    showToast('✅ تم حذف الموقع'); 
  });
  if(markerKindEl) markerKindEl.addEventListener('change', ()=>{ 
    item.meta.markerKind = markerKindEl.value; 
    applyShapeVisibility(item); 
    persist(); 
  });
  if(markerColorEl) markerColorEl.addEventListener('input', ()=>{ 
    item.meta.markerColor = markerColorEl.value; 
    applyShapeVisibility(item); 
    persist(); 
  });
  if(markerScaleEl && markerScaleLbl) {
    markerScaleEl.addEventListener('input', ()=>{ 
      item.meta.markerScale = +markerScaleEl.value; 
      markerScaleLbl.textContent = markerScaleEl.value; 
      applyShapeVisibility(item); 
      persist(); 
    });
  }
  if(cardShareBtn) cardShareBtn.addEventListener('click', async ()=>{ 
    try{ 
      const url = window.location.href; 
      await navigator.clipboard.writeText(url); 
      showToast('✅ تم نسخ الرابط'); 
    }catch(err){ 
      showToast('❌ فشل النسخ — حاول يدويًا'); 
    } 
  });
}

function applyShapeVisibility(item){
  const useMarker = item.meta.useMarker;
  if(useMarker){
    item.circle.setMap(null);
    if(!item.marker){
      item.marker = new google.maps.Marker({
        position: item.circle.getCenter(),
        map,
        clickable: true,
        draggable: editMode && !shareMode,
        zIndex: 9999
      });
      item.marker.addListener('dragend', ()=>{
        item.circle.setCenter(item.marker.getPosition());
        persist();
      });
      item.marker.addListener('click', ()=>{
        openCard(item, true);
      });
    } else {
      item.marker.setMap(map);
    }
    updateMarkerIcon(item);
  } else {
    item.circle.setMap(map);
    if(item.marker) item.marker.setMap(null);
  }
}

function updateMarkerIcon(item){
  if(!item.marker) return;
  const icon = buildMarkerIcon(
    item.meta.markerColor || DEFAULT_MARKER_COLOR,
    item.meta.markerScale || DEFAULT_MARKER_SCALE,
    item.meta.markerKind || DEFAULT_MARKER_KIND
  );
  item.marker.setIcon(icon);
}

function updateMarkersScale(){
  circles.forEach(item=>{
    if(item.meta.useMarker && item.marker){
      updateMarkerIcon(item);
    }
  });
}

function genNewId(){
  let id=0;
  while(circles.some(x=>x.id===id)) id++;
  return id;
}

function buildState(){
  const center=map.getCenter();
  const state={
    p:[center.lng(), center.lat()],
    z:map.getZoom(),
    m:map.getMapTypeId(),
    t:trafficLayer.getMap()?1:0,
    e:editMode?1:0,
    c:[],
    n:[]
  };
  
  circles.forEach(it=>{
    const c=it.circle;
    const center=c.getCenter();
    if(it.meta.isNew){
      state.n.push([
        it.id,
        center.lat(),
        center.lng(),
        it.meta.name||'',
        c.getRadius(),
        toHex(c.get('strokeColor')),
        it.meta.recipients.join('~') // 🔧 الإصلاح: حفظ أسماء المستلمين
      ]);
    } else {
      state.c.push([
        it.id,
        c.getRadius(),
        toHex(c.get('strokeColor')),
        it.meta.name||'',
        it.meta.recipients.join('~') // 🔧 الإصلاح: حفظ أسماء المستلمين
      ]);
    }
  });
  
  // 🔧 إصلاح: حفظ حالة المسار بشكل صحيح
  if(currentRouteOverview || routePoints.length > 0){
    state.r = {
      ov: currentRouteOverview || '',
      points: routePoints.map(p => ({ lat: p.lat(), lng: p.lng() })),
      style: { ...routeStyle },
      distance: routeDistance,
      duration: routeDuration
    };
  } else {
    state.r = null;
  }
  
  console.log('💾 Built state with:', {
    circles: state.c.length,
    newCircles: state.n.length,
    hasRoute: !!state.r,
    routePoints: state.r?.points?.length
  });
  
  return state;
}

// 🔧 إصلاح كامل لدالة showToast
function showToast(msg, dur=3000){
  // البحث عن عنصر Toast الموجود أو إنشاء واحد جديد
  let toastElement = document.getElementById('toast');
  
  if(!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'toast';
    toastElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 14px 24px;
      border-radius: 25px;
      font-family: Tajawal, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      white-space: nowrap;
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      opacity: 1;
    `;
    document.body.appendChild(toastElement);
  }
  
  toastElement.textContent = msg;
  toastElement.style.transform = 'translateX(-50%) translateY(0)';
  toastElement.style.opacity = '1';
  
  setTimeout(()=>{ 
    toastElement.style.transform = 'translateX(-50%) translateY(100px)';
    toastElement.style.opacity = '0';
  }, dur);
}

function updateUIForShareMode(){
  const editControls = document.querySelectorAll('#btnAdd, #btnRoute, #btnRouteClear');
  editControls.forEach(btn=>{
    if(btn) btn.style.display = shareMode ? 'none' : 'flex';
  });
  if(modeBadge) modeBadge.textContent = shareMode ? 'SHARE' : 'EDIT';
}
